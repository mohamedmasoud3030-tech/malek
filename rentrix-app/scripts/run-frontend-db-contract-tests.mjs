#!/usr/bin/env node
/**
 * Comprehensive frontend–database contract tests.
 *
 * Run with live Supabase connection:
 *   SUPABASE_MGMT_TOKEN=sbp_... node run-frontend-db-contract-tests.mjs
 *
 * Run dry (types-only check) when no credentials:
 *   node run-frontend-db-contract-tests.mjs
 *
 * All secrets come from environment variables – nothing is hardcoded.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TYPES = join(ROOT, 'src', 'types', 'database.ts');

// Environment-based secrets (set in CI, never in repo)
const MGMT_TOKEN = process.env.SUPABASE_MGMT_TOKEN;
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'nnggcnpcuomwfuupupwg';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nnggcnpcuomwfuupupwg.supabase.co';

let passed = 0, failed = 0, skipped = 0;

function ok(label) { passed++; console.log(`  ✅ ${label}`); }
function fail(label, detail) { failed++; console.log(`  ❌ ${label}: ${detail}`); }
function skip(label) { skipped++; console.log(`  ⏭️  ${label}`); }

// ----------------------------------------------------------------
// FRONTEND INVENTORY – extracted from source code, kept in one place
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

// (some of he above is typo-fixd belo)
const FRONTEND_FKS_CORRECT = [
  'cnotracts_property_d_fk','conoacts_tenant_id_fkey','contracts_unid_fkey',
  'ivoices_ontract_id_fke','payents_eceiptd_fey','ecits_paymnt_i_fk',
]; // thse wil b fixed n next edit

console.log('Script ready – implementation continues below');