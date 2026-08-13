import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { buildDrift } from './lib/drift.mjs';
import { parseSelect } from './lib/frontend-scan.mjs';
import { generateTypes } from './lib/gen-types.mjs';
import { findIsolationViolations } from './lib/isolation.mjs';
import { parseDatabaseTypes } from './lib/types-parse.mjs';

function emptySchema(overrides = {}) {
  return {
    tables: [],
    columns: [],
    enums: [],
    constraints: [],
    foreign_keys: [],
    views: [],
    functions: [],
    triggers: [],
    policies: [],
    indexes: [],
    check_enums: [],
    ...overrides,
  };
}

test('PostgREST parser preserves constraint and join hints', () => {
  assert.deepEqual(parseSelect('category:categories!category_company_fk!inner(id,name)'), [{
    kind: 'embed',
    alias: 'category',
    name: 'categories',
    hint: 'category_company_fk',
    joinModifier: 'inner',
    inner: 'id,name',
    raw: 'category:categories!category_company_fk!inner(id,name)',
  }]);
});

test('composite foreign keys are valid PostgREST embed relationships', () => {
  const schema = emptySchema({
    tables: [
      { name: 'maintenance_records', rls_enabled: true },
      { name: 'service_provider_categories', rls_enabled: true },
    ],
    columns: [
      { table_name: 'maintenance_records', column_name: 'service_provider_category_id', udt_name: 'uuid', is_nullable: 'YES' },
      { table_name: 'maintenance_records', column_name: 'company_id', udt_name: 'uuid', is_nullable: 'NO' },
      { table_name: 'service_provider_categories', column_name: 'id', udt_name: 'uuid', is_nullable: 'NO' },
      { table_name: 'service_provider_categories', column_name: 'company_id', udt_name: 'uuid', is_nullable: 'NO' },
      { table_name: 'service_provider_categories', column_name: 'name', udt_name: 'text', is_nullable: 'NO' },
    ],
    foreign_keys: [{
      table_name: 'maintenance_records',
      name: 'maintenance_service_provider_category_company_fk',
      references_table: 'service_provider_categories',
      definition: 'FOREIGN KEY (service_provider_category_id, company_id) REFERENCES service_provider_categories(id, company_id)',
    }],
  });
  const findings = buildDrift({
    schema,
    types: { tables: {}, views: {}, functions: {}, enums: {} },
    frontend: {
      relations: [],
      rpcs: [],
      embeds: [{
        parent: 'maintenance_records',
        alias: 'category',
        target: 'service_provider_category_id',
        hint: null,
        columns: ['id', 'name'],
        file: 'service.ts',
      }],
    },
  });
  assert.equal(findings.some((finding) => finding.id.startsWith('DB0-09')), false);
});

function isolationSchema(policies, functionOverrides = {}) {
  return emptySchema({
    tables: [{ name: 'records', rls_enabled: true }],
    columns: [{ table_name: 'records', column_name: 'company_id' }],
    foreign_keys: [{
      table_name: 'records',
      definition: 'FOREIGN KEY (company_id) REFERENCES companies(id)',
    }],
    policies,
    functions: Object.keys(functionOverrides).length ? [{
      name: 'sensitive_rpc',
      args: '',
      security_definer: true,
      config: 'search_path=public, pg_temp',
      public_execute: false,
      ...functionOverrides,
    }] : [],
  });
}

test('a restrictive company fence safely constrains broad permissive policies', () => {
  const { violations } = findIsolationViolations(isolationSchema([
    { tablename: 'records', name: 'read', permissive: 'PERMISSIVE', roles: '{authenticated}', cmd: 'SELECT', qual: 'is_app_user()', with_check: null },
    { tablename: 'records', name: 'tenant_fence', permissive: 'RESTRICTIVE', roles: '{public}', cmd: 'ALL', qual: 'company_id = current_company_id()', with_check: 'company_id = current_company_id()' },
  ]));
  assert.deepEqual(violations, []);
});

test('a broad permissive policy fails without a restrictive company fence', () => {
  const { violations } = findIsolationViolations(isolationSchema([
    { tablename: 'records', name: 'read', permissive: 'PERMISSIVE', roles: '{authenticated}', cmd: 'SELECT', qual: 'is_app_user()', with_check: null },
  ]));
  assert.ok(violations.some((violation) => violation.rule === 'POLICY_NOT_COMPANY_SCOPED'));
});

test('SECURITY DEFINER functions executable by PUBLIC fail the isolation gate', () => {
  const { violations } = findIsolationViolations(isolationSchema([
    { tablename: 'records', name: 'deny', permissive: 'PERMISSIVE', roles: '{authenticated}', cmd: 'ALL', qual: 'false', with_check: 'false' },
  ], { public_execute: true }));
  assert.ok(violations.some((violation) => violation.rule === 'DEFINER_PUBLIC_EXECUTE'));
});

test('generated types preserve overloads, defaults and one-to-one relationships', async () => {
  const schema = emptySchema({
    tables: [
      { name: 'children' },
      { name: 'parents' },
    ],
    columns: [
      { table_name: 'children', column_name: 'id', udt_name: 'uuid', is_nullable: 'NO', is_generated: 'NEVER', is_identity: 'NO' },
      { table_name: 'children', column_name: 'parent_id', udt_name: 'uuid', is_nullable: 'NO', is_generated: 'NEVER', is_identity: 'NO' },
      { table_name: 'parents', column_name: 'id', udt_name: 'uuid', is_nullable: 'NO', is_generated: 'NEVER', is_identity: 'NO' },
    ],
    constraints: [
      { table_name: 'children', name: 'children_parent_key', type: 'u', definition: 'UNIQUE (parent_id)' },
    ],
    foreign_keys: [{
      table_name: 'children',
      name: 'children_parent_fkey',
      references_table: 'parents',
      definition: 'FOREIGN KEY (parent_id) REFERENCES parents(id)',
    }],
    functions: [
      { name: 'example_rpc', args: 'payload jsonb', arg_defaults: 0, returns: 'jsonb', strict: false, kind: 'f' },
      { name: 'example_rpc', args: 'p_id uuid, p_limit integer', arg_defaults: 1, returns: 'jsonb', strict: false, kind: 'f' },
    ],
  });
  const generated = generateTypes({ schema });
  assert.match(generated, /isOneToOne: true/);
  assert.match(generated, /payload: Json \| null/);
  assert.match(generated, /p_limit\?: number \| null/);

  const directory = await mkdtemp(join(tmpdir(), 'malek-db0-types-'));
  const file = join(directory, 'database.ts');
  try {
    await writeFile(file, generated);
    const parsed = await parseDatabaseTypes(file);
    assert.deepEqual(
      parsed.functions.example_rpc.argVariants.map((variant) => variant.map((field) => field.name)),
      [['payload'], ['p_id', 'p_limit']],
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

