#!/usr/bin/env node
/**
 * Comprehensive frontend–database contract tests.
 *
 * Wraps check-frontend-db-contract.mjs with a full test runner that:
 *   - Verifies the types file integrity (DRY mode, always)
 *   - Optionally verifies against the live Supabase project (LIVE mode)
 *
 * Usage (DRY – types only, no credentials needed):
 *   node rentrix-app/scripts/run-frontend-db-contract-tests.mjs
 *
 * Usage (LIVE – against hosted Supabase):
 *   SUPABASE_MGMT_TOKEN=sbp_... node rentrix-app/scripts/run-frontend-db-contract-tests.mjs
 *
 * All secrets come from environment variables. Nothing is hardcoded.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TYPES = join(ROOT, 'src', 'types', 'database.ts');

const MGMT_TOKEN = process.env.SUPABASE_MGMT_TOKEN;
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'nnggcnpcuomwfuupupwg';

let passed = 0, failed = 0, skipped = 0;

function ok(label) { passed++; console.log(`  \u2705 ${label}`); }
function fail(label, detail = '') { failed++; console.log(`  \u274c ${label}${detail ? ': ' + detail : ''}`); }
function skip(label) { skipped++; console.log(`  \u23ed\ufe0f  ${label} (skipped – no credentials)`); }

// ----------------------------------------------------------------
// FRONTEND INVENTORY – canonical list, kept in sync with check-frontend-db-contract.mjs
// ----------------------------------------------------------------

const FRONTEND_TABLES = [
  'app_notifications','attachments','audit_log',
  'automation_notifications','automation_rules','automation_runs',
  'bank_accounts','bank_statement_imports','bank_statement_lines',
  'commissions','communication_records','company_members',
  'company_settings','contract_documents','contract_inspections','contracts',
  'cost_centers','deposit_application_claims','deposit_refund_events',
  'expenses','invoices','lands','leads','maintenance_records',
  'owner_agreement_versions','owner_agreements','owner_settlements','owners',
  'payment_terms_templates','payments','people','permission_requests',
  'properties','property_owners','receipt_allocations','receipt_void_requests',
  'receipts','service_provider_categories','service_provider_category_links',
  'service_providers','tenant_deposits','units','user_permission_grants',
  'users','utility_bills','utility_meters','vault_documents',
];

const FRONTEND_RPCS = [
  'complete_company_onboarding_atomic','ensure_company_chart_of_accounts',
  'generate_invoices_from_active_contracts','get_company_onboarding_state',
  'list_accounting_periods','list_chart_of_accounts','reset_company_onboarding_atomic',
];

const FRONTEND_FKS = [
  'contracts_property_id_fkey','contracts_tenant_id_fkey','contracts_unit_id_fkey',
  'invoices_contract_id_fkey','payments_receipt_id_fkey','receipts_payment_id_fkey',
];

const FRONTEND_ENUMS = {
  user_role:       ['ADMIN','MANAGER','USER','ACCOUNTANT','OPERATIONS','VIEWER'],
  entity_status:   ['ACTIVE','INACTIVE','BLACKLISTED'],
  charged_to_type: ['OWNER','TENANT','COMPANY'],
  utility_status:  ['UNPAID','PAID','OVERDUE'],
};

// ----------------------------------------------------------------
// DRY checks (always run)
// ----------------------------------------------------------------

async function runDryChecks(types) {
  console.log('\n\u2500\u2500 1. Types file integrity \u2500\u2500');
  types.trim().startsWith('{"types"') ? fail('Plain TS source (not JSON wrapper)', 'file starts with {') : ok('Plain TS source');
  types.length > 100_000 ? ok('Size > 100 KB') : fail('Size > 100 KB', `only ${types.length} bytes`);
  types.includes('Tables:') ? ok('Has Tables section') : fail('Has Tables section');
  types.includes('Functions:') ? ok('Has Functions section') : fail('Has Functions section');
  types.includes('Enums:') ? ok('Has Enums section') : fail('Has Enums section');

  console.log('\n\u2500\u2500 2. Tables in types \u2500\u2500');
  for (const t of FRONTEND_TABLES) {
    types.includes(`\n      ${t}: {`) ? ok(`Table ${t}`) : fail(`Table ${t}`, 'not found in types');
  }

  console.log('\n\u2500\u2500 3. RPCs in types \u2500\u2500');
  for (const rpc of FRONTEND_RPCS) {
    types.includes(`${rpc}: {`) ? ok(`RPC ${rpc}`) : fail(`RPC ${rpc}`, 'not found in types');
  }

  console.log('\n\u2500\u2500 4. Foreign key names in types \u2500\u2500');
  for (const fk of FRONTEND_FKS) {
    types.includes(fk) ? ok(`FK ${fk}`) : fail(`FK ${fk}`, 'not found in types');
  }

  console.log('\n\u2500\u2500 5. Enum values in types \u2500\u2500');
  for (const [en, vals] of Object.entries(FRONTEND_ENUMS)) {
    for (const v of vals) {
      types.includes(`'${v}'`) ? ok(`Enum ${en} '${v}'`) : fail(`Enum ${en} '${v}'`, 'not found in types');
    }
  }
}

// ----------------------------------------------------------------
// LIVE checks (only when SUPABASE_MGMT_TOKEN is set)
// ----------------------------------------------------------------

async function sql(q) {
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MGMT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: q }),
    },
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function runLiveChecks() {
  console.log('\n\u2500\u2500 6. Live tables \u2500\u2500');
  const lt = await sql("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
  const liveTables = new Set(lt.map(r => r.table_name));
  for (const t of FRONTEND_TABLES) {
    liveTables.has(t) ? ok(`Live table ${t}`) : fail(`Live table ${t}`, 'not in Supabase');
  }

  console.log('\n\u2500\u2500 7. Live RPCs \u2500\u2500');
  const lr = await sql("SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'");
  const liveRpcs = new Set(lr.map(r => r.proname));
  for (const rpc of FRONTEND_RPCS) {
    liveRpcs.has(rpc) ? ok(`Live RPC ${rpc}`) : fail(`Live RPC ${rpc}`, 'not in Supabase');
  }

  console.log('\n\u2500\u2500 8. Live foreign keys \u2500\u2500');
  const lf = await sql("SELECT conname FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='f'");
  const liveFks = new Set(lf.map(r => r.conname));
  for (const fk of FRONTEND_FKS) {
    liveFks.has(fk) ? ok(`Live FK ${fk}`) : fail(`Live FK ${fk}`, 'not in Supabase');
  }

  console.log('\n\u2500\u2500 9. Live date column types \u2500\u2500');
  const dateCols = [
    ['contracts','start_date'], ['contracts','end_date'],
    ['invoices','issue_date'],  ['invoices','due_date'],
  ];
  for (const [tbl, col] of dateCols) {
    const r = await sql(`SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='${tbl}' AND column_name='${col}'`);
    r?.[0]?.data_type === 'date'
      ? ok(`${tbl}.${col} is date`)
      : fail(`${tbl}.${col} is date`, `got ${r?.[0]?.data_type ?? 'not found'}`);
  }

  console.log('\n\u2500\u2500 10. Live six-role constraint \u2500\u2500');
  const cons = await sql("SELECT pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conrelid='public.company_members'::regclass AND contype='c'");
  const def = cons?.[0]?.def ?? '';
  const sixRoles = ['ADMIN','MANAGER','ACCOUNTANT','OPERATIONS','USER','VIEWER'];
  const hasAll = sixRoles.every(r => def.includes(`'${r}'`));
  const hasLegacy = def.includes("'OWNER'") || def.includes("'MEMBER'");
  hasAll && !hasLegacy
    ? ok('company_members CHECK has exactly six canonical roles, no legacy values')
    : fail('company_members CHECK six-role model', `def: ${def.slice(0, 120)}`);

  console.log('\n\u2500\u2500 11. Storage \u2500\u2500');
  const buckets = await sql("SELECT id, name, public FROM storage.buckets");
  const hasBucket = buckets.some(x => x.name === 'attachments');
  const isPrivate = buckets.some(x => x.name === 'attachments' && !x.public);
  hasBucket ? ok('Bucket attachments exists') : fail('Bucket attachments exists');
  isPrivate  ? ok('Bucket attachments is private') : fail('Bucket attachments is private');
}

// ----------------------------------------------------------------
// Main
// ----------------------------------------------------------------

async function main() {
  const mode = MGMT_TOKEN ? 'LIVE' : 'DRY (types only)';
  console.log(`\n=== Frontend-Database Contract Tests ===`);
  console.log(`Mode: ${mode}\n`);

  let types;
  try {
    types = readFileSync(TYPES, 'utf8');
  } catch (e) {
    fail('Read database.ts', e.message);
    console.log(`\n=== 0/${1} passed (1 failed) ===`);
    process.exit(1);
  }

  await runDryChecks(types);

  if (MGMT_TOKEN) {
    await runLiveChecks();
  } else {
    console.log('\n\u2500\u2500 Live checks (skipped) \u2500\u2500');
    skip('Live table verification');
    skip('Live RPC verification');
    skip('Live FK verification');
    skip('Live date types');
    skip('Live six-role constraint');
    skip('Storage buckets');
  }

  const total = passed + failed + skipped;
  console.log(`\n=== ${passed}/${total} passed (${failed} failed, ${skipped} skipped) ===`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e.message); process.exit(1); });
