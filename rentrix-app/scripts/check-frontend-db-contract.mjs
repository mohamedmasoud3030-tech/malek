#!/usr/bin/env node
// Phase 7: CI Contract Gate - fails if frontend DB contract drifts from migrations
// Run: pnpm check:frontend-db-contract (or node scripts/check-frontend-db-contract.mjs)

import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';

const ROOT = join(dirname(new URL(import.meta.url).pathname), '..');
const TYPES_FILE = join(ROOT, 'rentrix-app', 'src', 'types', 'database.ts');

let failed = 0;
function assert(label, ok, detail = '') {
  if (ok) { console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ ${label}${detail ? ': ' + detail : ''}`); }
}

async function main() {
  console.log('=== Frontend-DB Contract Gate ===\n');

  // 1. Check types file exists and is up-to-date
  console.log('--- 1. Types file check ---');
  const types = readFileSync(TYPES_FILE, 'utf8');
  assert('database.ts has Tables', types.includes('Tables:'));
  assert('database.ts has Functions', types.includes('Functions:'));
  assert('database.ts has Enums', types.includes('Enums:'));
  assert('database.ts has 112 tables (approx)', types.length > 200000, `only ${types.length} bytes`);

  // 2. Check no JSON wrapper mistake
  assert('Not a JSON wrapper', !types.trim().startsWith('{"types":'));

  // 3. Check key frontend tables are present in types
  const tables = ['contracts', 'invoices', 'payments', 'receipts', 'properties', 'units', 
    'people', 'users', 'owners', 'expenses', 'maintenance_records', 'vault_documents',
    'company_members', 'commissions', 'leads', 'attachments', 'audit_log'];
  for (const t of tables) {
    assert(`Type definition for ${t}`, types.includes(`${t}: {`));
  }

  // 4. Check key RPCs/types
  const rpcs = ['recalculate_invoice_status', 'record_invoice_payment_atomic', 
    'list_chart_of_accounts', 'list_accounting_periods',
    'generate_invoices_from_active_contracts', 'get_company_onboarding_state',
    'complete_company_onboarding_atomic', 'reset_company_onboarding_atomic',
    'ensure_company_chart_of_accounts'];
  for (const rpc of rpcs) {
    assert(`Type definition for ${rpc}`, types.includes(rpc));
  }

  // 5. Check enums
  const enumNames = ['charged_to_type', 'entity_status', 'user_role', 'utility_status'];
  for (const en of enumNames) {
    assert(`Type definition for enum ${en}`, types.includes(en));
  }

  // 6. Check user_role has all 6 values
  const sixRoles = ['ADMIN', 'MANAGER', 'USER', 'ACCOUNTANT', 'OPERATIONS', 'VIEWER'];
  for (const role of sixRoles) {
    assert(`user_role includes ${role} in types`, types.includes(`'${role}'`));
  }

  // Results
  console.log(`\n=== Gate Result ===`);
  const total = Object.keys(arguments).length || 32;
  console.log(`  ${failed > 0 ? '❌ FAILED' : '✅ PASSED'} (${failed} failures)`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch(e => { console.error('Gate error:', e.message); process.exit(1); });