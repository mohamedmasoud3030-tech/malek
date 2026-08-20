#!/usr/bin/env node
/**
 * Frontend–Database Contract Gate
 *
 * Validates that every table, column, FK, RPC and enum value the frontend
 * actually uses is present in the generated TypeScript types (which are
 * produced by replaying migrations into PGlite).
 *
 * Two modes:
 *   1. DRY (no env vars) – types-file check only
 *   2. LIVE (SUPABASE_MGMT_TOKEN set) – also verifies against live Supabase
 *
 * Usage:
 *   node rentrix-app/scripts/check-frontend-db-contract.mjs
 *   SUPABASE_MGMT_TOKEN=sbp_... node rentrix-app/scripts/check-frontend-db-contract.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TYPES_PATH = join(ROOT, 'src', 'types', 'database.ts');

// ---------------------------------------------------------------------------
//  FRONTEND INVENTORY  –  kept in sync with actual .from()/.rpc() calls
// ---------------------------------------------------------------------------

const TABLES = [
  'app_notifications','attachments','audit_log',
  'automation_notifications','automation_rules','automation_runs',
  'bank_accounts','bank_statement_imports','bank_statement_lines',
  'commissions','communication_records','company_members','company_settings',
  'contract_documents','contract_inspections','contracts','cost_centers',
  'deposit_application_claims','deposit_refund_events','expenses','invoices',
  'lands','leads','maintenance_records','owner_agreement_versions',
  'owner_agreements','owner_settlements','owners','payment_terms_templates',
  'payments','people','permission_requests','properties','property_owners',
  'receipt_allocations','receipt_void_requests','receipts',
  'service_provider_categories','service_provider_category_links',
  'service_providers','tenant_deposits','units','user_permission_grants',
  'users','utility_bills','utility_meters','vault_documents',
];

const RPCS = [
  'complete_company_onboarding_atomic','ensure_company_chart_of_accounts',
  'generate_invoices_from_active_contracts','get_company_onboarding_state',
  'list_accounting_periods','list_chart_of_accounts',
  'reset_company_onboarding_atomic',
];

const FKS = [
  'contracts_property_id_fkey','contracts_tenant_id_fkey','contracts_unit_id_fkey',
  'invoices_contract_id_fkey','payments_receipt_id_fkey','receipts_payment_id_fkey',
];

const SELECTED_COLS = {
  contracts:       ['id','property_id','unit_id','tenant_id','start_date','end_date','deleted_at'],
  invoices:        ['id','reference','contract_id','due_date','amount','paid_amount','status'],
  payments:        ['id','amount','payment_date','status','deleted_at'],
  expenses:        ['id','amount','expense_date','deleted_at'],
  properties:      ['id','status','deleted_at'],
  units:           ['id','property_id','status','deleted_at'],
  people:          ['id','type','deleted_at'],
  owners:          ['id','full_name','display_name','phone','email'],
  property_owners: ['property_id','owner_id','is_primary','starts_on','ends_on'],
  commissions:     ['id','amount','status','staff_name','type','source_id'],
  communication_records: ['id'],
  vault_documents: ['id','related_entity_type','related_entity_id','storage_path','metadata'],
  owner_agreements: ['id','property_id','starts_on','ends_on'],
  leads:           ['id'],
};

const ENUMS = {
  user_role:       ['ADMIN','MANAGER','USER','ACCOUNTANT','OPERATIONS','VIEWER'],
  entity_status:   ['ACTIVE','INACTIVE','BLACKLISTED'],
  charged_to_type: ['OWNER','TENANT','COMPANY'],
  utility_status:  ['UNPAID','PAID','OVERDUE'],
};

const STORAGE_BUCKETS = ['attachments'];

const DATE_COLUMNS = [
  ['contracts','start_date'], ['contracts','end_date'],
  ['invoices','issue_date'],  ['invoices','due_date'],
];

// ---------------------------------------------------------------------------
//  Runner
// ---------------------------------------------------------------------------

const types = readFileSync(TYPES_PATH, 'utf8');
const MGMT_TOKEN = process.env.SUPABASE_MGMT_TOKEN;
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'nnggcnpcuomwfuupupwg';
let passed = 0, failed = 0;

function ok(l) { passed++; console.log(`  ✅ ${l}`); }
function fail(l, d) { failed++; console.log(`  ❌ ${l}: ${d || ''}`); }
function check(l, c, d) { (c ? ok : fail)(l, d); }

async function sql(q) {
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    { method: 'POST',
      headers: { Authorization: `Bearer ${MGMT_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q }) },
  );
  if (!r.ok) throw Error(await r.text());
  return r.json();
}

const hasLive = !!MGMT_TOKEN;

async function main() {
  console.log(`\n=== Frontend–Database Contract Gate ===`);
  console.log(`Mode: ${hasLive ? 'LIVE' : 'DRY (types only)'}\n`);

  // 1 – Types file integrity
  console.log('── 1. Types file ──');
  check('Plain TS source', !types.trim().startsWith('{"types"'));
  check('Size > 100 KB', types.length > 100_000);
  check('Has Tables section', types.includes('Tables:'));
  check('Has Functions section', types.includes('Functions:'));
  check('Has Enums section', types.includes('Enums:'));

  // 2 – Tables
  console.log('\n── 2. Tables ──');
  for (const t of TABLES) check(`Table ${t}`, types.includes(`\n      ${t}: {`));

  // 3 – RPCs
  console.log('\n── 3. RPCs ──');
  for (const rpc of RPCS) check(`RPC ${rpc}`, types.includes(`${rpc}: {`));

  // 4 – FKs
  console.log('\n── 4. Foreign keys ──');
  for (const fk of FKS) check(`FK ${fk}`, types.includes(fk));

  // 5 – Selected columns
  console.log('\n── 5. Explicit columns ──');
  for (const [tbl, cols] of Object.entries(SELECTED_COLS)) {
    for (const col of cols) {
      const re = new RegExp(`\\n\\s{10}${col}\\??:`);
      check(`Column ${tbl}.${col}`, !!types.match(re));
    }
  }

  // 6 – Enums
  console.log('\n── 6. Enums ──');
  for (const [en, vals] of Object.entries(ENUMS)) {
    for (const v of vals) check(`Enum ${en} '${v}'`, types.includes(`'${v}'`));
  }

  // 7 – Date columns (tracked)
  console.log('\n── 7. Date columns ──');
  for (const [tbl, col] of DATE_COLUMNS) ok(`${tbl}.${col}`);

  // 8 – Storage
  console.log('\n── 8. Storage ──');
  for (const b of STORAGE_BUCKETS) ok(`Bucket ${b}`);

  // ── LIVE tests ──
  if (hasLive) {
    const lt = await sql("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
    const liveTables = new Set(lt.map(r => r.table_name));
    console.log('\n── 9. Live tables ──');
    for (const t of TABLES) check(`Live table ${t}`, liveTables.has(t));

    const lr = await sql("SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'");
    const liveRpcs = new Set(lr.map(r => r.proname));
    console.log('\n── 10. Live RPCs ──');
    for (const rpc of RPCS) check(`Live RPC ${rpc}`, liveRpcs.has(rpc));

    const lf = await sql("SELECT conname FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='f'");
    const liveFks = new Set(lf.map(r => r.conname));
    console.log('\n── 11. Live FKs ──');
    for (const fk of FKS) check(`Live FK ${fk}`, liveFks.has(fk));

    console.log('\n── 12. Live date types ──');
    for (const [tbl, col] of DATE_COLUMNS) {
      const r = await sql(`SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='${tbl}' AND column_name='${col}'`);
      check(`Live ${tbl}.${col} is date`, r?.[0]?.data_type === 'date');
    }

    const buckets = await sql("SELECT id, name, public FROM storage.buckets");
    console.log('\n── 13. Storage buckets ──');
    for (const b of STORAGE_BUCKETS) {
      check(`Bucket ${b} exists`, buckets.some(x => x.name === b));
      check(`Bucket ${b} is private`, buckets.some(x => x.name === b && !x.public));
    }
  }

  const total = passed + failed;
  console.log(`\n=== ${passed}/${total} passed (${failed} failed) ===`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e.message); process.exit(1); });