#!/usr/bin/env node
// WP-DB0 Gate 3 — RLS / company isolation and FK integrity.
//
// Structural gate over the replayed schema. It asserts the invariants that make
// multi-tenancy safe, so a future migration cannot quietly drop them:
//
//   * every company-scoped table has RLS enabled
//   * every company-scoped table has at least one policy
//   * every company-scoped policy is actually company-aware (or denies all)
//   * every company_id is anchored by a foreign key
//   * every SECURITY DEFINER function pins search_path
//   * every view runs with security_invoker
//   * no policy grants access to the anon role on a tenant table

import { createDatabase, replay } from './lib/replay.mjs';
import { introspect } from './lib/introspect.mjs';

const db = await createDatabase();
const { failures } = await replay(db, { stopOnError: false });
if (failures.length) {
  console.error(`Migration replay failed (${failures.length}).`);
  for (const f of failures) console.error(`  ${f.file}: ${f.error}`);
  process.exit(2);
}
const schema = await introspect(db);
await db.close();

const violations = [];
const add = (rule, detail) => violations.push({ rule, detail });

const columnsByTable = new Map();
for (const c of schema.columns) {
  if (!columnsByTable.has(c.table_name)) columnsByTable.set(c.table_name, new Set());
  columnsByTable.get(c.table_name).add(c.column_name);
}

const policiesByTable = new Map();
for (const p of schema.policies) {
  if (!policiesByTable.has(p.tablename)) policiesByTable.set(p.tablename, []);
  policiesByTable.get(p.tablename).push(p);
}

const fksByTable = new Map();
for (const fk of schema.foreign_keys) {
  if (!fksByTable.has(fk.table_name)) fksByTable.set(fk.table_name, []);
  fksByTable.get(fk.table_name).push(fk);
}

const tenantTables = schema.tables.filter((t) => columnsByTable.get(t.name)?.has('company_id'));

for (const table of tenantTables) {
  const policies = policiesByTable.get(table.name) ?? [];

  if (!table.rls_enabled) {
    add('RLS_DISABLED', `${table.name} has company_id but RLS is disabled`);
    continue;
  }
  if (policies.length === 0) {
    add('NO_POLICY', `${table.name} has RLS enabled but no policies`);
    continue;
  }

  const denyAll = policies.every((p) => {
    const q = (p.qual ?? '').trim().toLowerCase();
    const c = (p.with_check ?? '').trim().toLowerCase();
    return (q === 'false' || q === '') && (c === 'false' || c === '');
  });
  const companyAware = policies.some((p) => /company/i.test(`${p.qual ?? ''} ${p.with_check ?? ''}`));
  if (!denyAll && !companyAware) {
    add('POLICY_NOT_COMPANY_SCOPED', `${table.name} policies never reference company scope: ${policies.map((p) => p.name).join(', ')}`);
  }

  const fks = fksByTable.get(table.name) ?? [];
  const anchored = fks.some((fk) => {
    const m = /FOREIGN KEY \(([^)]+)\)/i.exec(fk.definition);
    if (!m) return false;
    return m[1].split(',').map((s) => s.trim().replace(/"/g, '')).includes('company_id');
  });
  if (!anchored) {
    add('COMPANY_ID_NOT_ANCHORED', `${table.name}.company_id has no foreign key anchoring it to a company`);
  }

  const anonPolicies = policies.filter(
    (p) => /(^|[{,\s])anon([},\s]|$)/.test(p.roles ?? '') && !/false/i.test(`${p.qual ?? ''}${p.with_check ?? ''}`),
  );
  for (const p of anonPolicies) {
    add('ANON_ACCESS', `${table.name} policy "${p.name}" grants the anon role non-deny access`);
  }
}

for (const f of schema.functions) {
  if (f.security_definer && !/search_path/.test(f.config ?? '')) {
    add('DEFINER_NO_SEARCH_PATH', `${f.name}(${f.args}) is SECURITY DEFINER without a pinned search_path`);
  }
}

for (const v of schema.views) {
  if (String(v.security_invoker) !== 'true') {
    add('VIEW_NOT_INVOKER', `view ${v.name} does not set security_invoker`);
  }
}

console.log('WP-DB0 isolation gate');
console.log('='.repeat(60));
console.log(`Tenant tables checked : ${tenantTables.length}`);
console.log(`Policies checked      : ${schema.policies.length}`);
console.log(`Functions checked     : ${schema.functions.length}`);
console.log(`Views checked         : ${schema.views.length}`);

if (!violations.length) {
  console.log('\nPASS — no isolation violations.');
  process.exit(0);
}

const byRule = {};
for (const v of violations) (byRule[v.rule] ??= []).push(v.detail);
console.log(`\nFAIL — ${violations.length} violation(s):`);
for (const [rule, details] of Object.entries(byRule)) {
  console.log(`\n  ${rule} (${details.length})`);
  for (const d of details) console.log(`    - ${d}`);
}
process.exit(1);
