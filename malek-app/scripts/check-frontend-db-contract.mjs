#!/usr/bin/env node
/**
 * Frontend ↔ Database Contract Gate v2
 *
 * Fast PR-safe verification:
 *   - discovers production Supabase .from()/.rpc() usage automatically
 *   - verifies tables/views, referenced root columns and mutation keys against generated DB types
 *   - verifies RPC existence + literal argument keys/required args
 *   - keeps critical FK/enum/date/storage/membership invariants
 *   - optional LIVE mode performs read-only comparison against hosted Supabase
 *
 * The generated database.ts must itself be checked against migrations in CI via
 * `pnpm db0:check-types`; together these form migration → generated contract → frontend parity.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  discoverFrontendUsage,
  parseDatabaseTypes,
  validateFrontendUsage,
} from './frontend-db-contract-lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SOURCE_ROOT = join(ROOT, 'src');
const TYPES_PATH = join(SOURCE_ROOT, 'types', 'database.ts');
const CLIENT_PATH = join(SOURCE_ROOT, 'lib', 'supabase.ts');

const FKS = [
  'contracts_property_id_fkey', 'contracts_tenant_id_fkey', 'contracts_unit_id_fkey',
  'invoices_contract_id_fkey', 'payments_receipt_id_fkey', 'receipts_payment_id_fkey',
];

const ENUMS = {
  user_role: ['ADMIN', 'MANAGER', 'USER', 'ACCOUNTANT', 'OPERATIONS', 'VIEWER'],
  entity_status: ['ACTIVE', 'INACTIVE', 'BLACKLISTED'],
  charged_to_type: ['OWNER', 'TENANT', 'COMPANY'],
  utility_status: ['UNPAID', 'PAID', 'OVERDUE'],
};

const STORAGE_BUCKETS = ['attachments'];
const DATE_COLUMNS = [
  ['contracts', 'start_date'], ['contracts', 'end_date'],
  ['invoices', 'issue_date'], ['invoices', 'due_date'],
];

const types = readFileSync(TYPES_PATH, 'utf8');
const clientSource = readFileSync(CLIENT_PATH, 'utf8');
const database = parseDatabaseTypes(types);
const usage = discoverFrontendUsage(SOURCE_ROOT);
const validation = validateFrontendUsage(usage, database);

const MGMT_TOKEN = process.env.SUPABASE_MGMT_TOKEN;
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'nnggcnpcuomwfuupupwg';
const STRICT_DYNAMIC = process.env.FRONTEND_DB_CONTRACT_STRICT_DYNAMIC === '1';
let passed = 0;
let failed = 0;
let skipped = 0;
let warned = 0;

function ok(label) { passed++; console.log(`  ✅ ${label}`); }
function fail(label, detail) { failed++; console.log(`  ❌ ${label}${detail ? `: ${detail}` : ''}`); }
function skip(label, detail) { skipped++; console.log(`  ⏭️  ${label}: ${detail}`); }
function warn(label) { warned++; console.log(`  ⚠️  ${label}`); }
function check(label, condition, detail) { condition ? ok(label) : fail(label, detail); }

function enumDeclaration(enumName) {
  const match = types.match(new RegExp(`\\n      ${enumName}: ([^\\n]+)`));
  return match?.[1] ?? '';
}

async function sql(query) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MGMT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    },
  );
  if (!response.ok) throw Error(await response.text());
  return response.json();
}

const hasLive = Boolean(MGMT_TOKEN);

async function main() {
  console.log('\n=== MALEK Frontend ↔ Database Contract Gate v2 ===');
  console.log(`Mode: ${hasLive ? 'LIVE + generated types' : 'DRY (generated types + source discovery)'}`);

  console.log('\n── 1. Generated contract + typed client ──');
  check('Plain TypeScript database contract', !types.trim().startsWith('{"types"'));
  check('Generated database contract has substantial schema', types.length > 100_000);
  check('Has Tables section', types.includes('Tables:'));
  check('Has Views section', types.includes('Views:'));
  check('Has Functions section', types.includes('Functions:'));
  check('Has Enums section', types.includes('Enums:'));
  check('Supabase client is bound to Database generic', /createClient\s*<\s*Database\s*>/.test(clientSource));

  console.log('\n── 2. Automatic frontend discovery ──');
  check('Discovered database relations from production source', usage.tables.size > 0, 'scanner found zero .from() targets');
  check('Discovered RPCs from production source', usage.rpcs.size > 0, 'scanner found zero .rpc() targets');
  check(
    'Payment facade RPC is automatically discovered',
    usage.rpcs.has('record_invoice_payment_atomic'),
    'record_invoice_payment_atomic would be invisible to the gate',
  );
  console.log(`  ℹ️  ${usage.tables.size} tables/views, ${usage.rpcs.size} RPCs discovered automatically`);

  console.log('\n── 3. Frontend ↔ generated database contract ──');
  if (validation.errors.length === 0) ok('No frontend/database mismatches');
  else for (const error of validation.errors) fail('Contract mismatch', error);

  for (const warning of validation.warnings) {
    if (STRICT_DYNAMIC) fail('Unverified dynamic contract usage', warning);
    else warn(warning);
  }

  console.log('\n── 4. Critical relational + enum invariants ──');
  for (const fk of FKS) check(`FK ${fk}`, types.includes(fk), 'missing from generated schema contract');
  for (const [enumName, values] of Object.entries(ENUMS)) {
    const declaration = enumDeclaration(enumName);
    for (const value of values) {
      check(`Enum ${enumName} '${value}'`, declaration.includes(`'${value}'`), 'missing from generated enum declaration');
    }
  }

  console.log('\n── 5. Database-only contracts ──');
  if (!hasLive) {
    for (const [table, column] of DATE_COLUMNS) skip(`${table}.${column} SQL type`, 'covered by migration replay; live check unavailable');
    for (const bucket of STORAGE_BUCKETS) skip(`Bucket ${bucket}`, 'covered by migration replay; live check unavailable');
  }

  if (hasLive) {
    console.log('\n── 6. Live relation parity (read-only) ──');
    const liveRelationRows = await sql(`
      SELECT table_name
        FROM information_schema.tables
       WHERE table_schema='public'
      UNION
      SELECT table_name
        FROM information_schema.views
       WHERE table_schema='public'
    `);
    const liveRelations = new Set(liveRelationRows.map((row) => row.table_name));
    for (const relation of usage.tables.keys()) check(`Live relation ${relation}`, liveRelations.has(relation));

    console.log('\n── 7. Live used-column parity (read-only) ──');
    const liveColumnRows = await sql(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public'",
    );
    const liveColumns = new Map();
    for (const row of liveColumnRows) {
      const set = liveColumns.get(row.table_name) ?? new Set();
      set.add(row.column_name);
      liveColumns.set(row.table_name, set);
    }
    for (const [relation, entry] of usage.tables) {
      for (const column of entry.columns) {
        check(`Live column ${relation}.${column}`, liveColumns.get(relation)?.has(column) === true);
      }
    }

    console.log('\n── 8. Live RPC parity (read-only) ──');
    const liveRpcRows = await sql(
      "SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'",
    );
    const liveRpcs = new Set(liveRpcRows.map((row) => row.proname));
    for (const rpc of usage.rpcs.keys()) check(`Live RPC ${rpc}`, liveRpcs.has(rpc));

    console.log('\n── 9. Live FK parity (read-only) ──');
    const liveFkRows = await sql(
      "SELECT conname FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='f'",
    );
    const liveFks = new Set(liveFkRows.map((row) => row.conname));
    for (const fk of FKS) check(`Live FK ${fk}`, liveFks.has(fk));

    console.log('\n── 10. Live date types (read-only) ──');
    for (const [table, column] of DATE_COLUMNS) {
      const rows = await sql(
        `SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}' AND column_name='${column}'`,
      );
      check(`Live ${table}.${column} is date`, rows?.[0]?.data_type === 'date', rows?.[0]?.data_type);
    }

    console.log('\n── 11. Storage buckets (read-only) ──');
    const buckets = await sql('SELECT id, name, public FROM storage.buckets');
    for (const bucket of STORAGE_BUCKETS) {
      check(`Bucket ${bucket} exists`, buckets.some((row) => row.name === bucket));
      check(`Bucket ${bucket} is private`, buckets.some((row) => row.name === bucket && !row.public));
    }

    console.log('\n── 12. Six-role membership authority (read-only) ──');
    const membership = await sql(`
      select
        (select column_default from information_schema.columns
         where table_schema='public' and table_name='company_members' and column_name='role') as role_default,
        (select pg_get_constraintdef(oid) from pg_constraint
         where conrelid='public.company_members'::regclass and conname='company_members_role_check') as role_check,
        pg_get_functiondef('app_private.can_manage_company_members(uuid)'::regprocedure) as manager_function,
        has_function_privilege('anon', 'app_private.can_manage_company_members(uuid)', 'EXECUTE') as anon_execute,
        (select count(*)::int from public.company_members where upper(role) in ('OWNER','MEMBER')) as legacy_rows
    `);
    const contract = membership[0] ?? {};
    const sixRoles = ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'OPERATIONS', 'USER', 'VIEWER'];
    check('company_members role default is USER', contract.role_default === "'USER'::text", contract.role_default);
    check(
      'company_members CHECK has six canonical roles',
      sixRoles.every((role) => contract.role_check?.includes(`'${role}'`))
        && !contract.role_check?.includes("'OWNER'")
        && !contract.role_check?.includes("'MEMBER'"),
      contract.role_check,
    );
    check(
      'membership management uses effective users.manage permission',
      contract.manager_function?.includes("current_user_has_effective_app_permission('users.manage')")
        && contract.manager_function?.includes('current_company_id()')
        && !contract.manager_function?.includes("'OWNER'")
        && !contract.manager_function?.includes("'MEMBER'"),
    );
    check('anon cannot execute membership authority helper', contract.anon_execute === false);
    check('no legacy membership rows remain', contract.legacy_rows === 0, String(contract.legacy_rows));
  }

  const total = passed + failed + skipped;
  console.log(`\n=== ${passed}/${total} checks passed (${failed} failed, ${skipped} skipped, ${warned} warnings) ===`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error?.stack ?? error?.message ?? String(error));
  process.exit(1);
});
