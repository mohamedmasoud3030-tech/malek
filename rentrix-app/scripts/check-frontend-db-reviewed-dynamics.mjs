#!/usr/bin/env node
/**
 * Fail-closed review gate for Supabase usages that cannot be fully resolved by
 * the fast source scanner. The primary gate still auto-discovers ordinary
 * .from()/.rpc() calls. This file owns only the small, explicit remainder.
 *
 * Rules:
 * - known scanner noise (comment-only examples) is ignored deterministically;
 * - literal table names hidden behind a simple TS `as` assertion are resolved
 *   and validated against generated database types;
 * - every genuinely dynamic mutation/RPC payload must match the reviewed
 *   inventory below, including the expected occurrence count;
 * - the one generic receipt lookup helper is constrained to an explicit set of
 *   tables + columns and those contracts are validated against database.ts;
 * - any new, removed, moved-to-another-file, or count-changed dynamic usage
 *   fails CI until reviewed.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  discoverFrontendUsage,
  parseDatabaseTypes,
} from './frontend-db-contract-lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SOURCE_ROOT = join(ROOT, 'src');
const TYPES_PATH = join(SOURCE_ROOT, 'types', 'database.ts');

const REVIEWED = new Map([
  ['mutation|features/units/unit-service.ts|units|insert', 1],
  // Only updateProperty's payload is dynamic (its columns come from
  // normalizePropertyPayload at runtime). softDeleteProperty's
  // `updatePayload: PropertyUpdate = { deleted_at: ... }` is a static
  // literal that the primary checker resolves automatically, so it is not
  // counted here.
  ['mutation|features/properties/property-service.ts|properties|update', 1],
  ['mutation|features/people/people-service.ts|people|insert', 1],
  ['mutation|features/owners/services/owner-service.ts|owners|insert', 1],
  ['mutation|features/owners/services/owner-service.ts|owners|update', 1],
  ['mutation|features/lands/services/lands-service.ts|lands|insert', 1],
  ['mutation|features/lands/services/lands-service.ts|lands|update', 1],
  ['mutation|features/communication/services/communication-service.ts|communication_records|insert', 1],
  ['mutation|features/communication/services/communication-service.ts|communication_records|update', 1],
  // bankReconciliationService no longer performs a direct bank_statement_lines
  // insert: the manual-line write path moved to the governed RPC
  // create_bank_statement_line_governed (migration 00057), which the primary
  // scanner auto-discovers as a literal .rpc() call.
  ['mutation|features/leads/services/leads-service.ts|leads|insert', 1],
  ['mutation|features/leads/services/leads-service.ts|leads|update', 1],
  ['mutation|features/maintenance/maintenance-service.ts|maintenance_records|update', 1],
  ['mutation|features/owners/services/owner-service.ts|property_owners|insert', 1],
  ['mutation|features/owners/services/owner-service.ts|property_owners|update', 1],
  // property-service no longer performs a direct property_owners update: the
  // whole ownership split (primary share + co-owner rows) moved into the
  // atomic creation RPC create_property_with_ownership_atomic (migration
  // 00069), which the primary scanner auto-discovers as a literal .rpc() call.
  ['mutation|features/settings/companySettingsService.ts|company_settings|update', 1],
  ['mutation|features/settings/costCenterService.ts|cost_centers|insert', 1],
  ['mutation|features/settings/costCenterService.ts|cost_centers|update', 2],
  ['mutation|features/settings/paymentTermsService.ts|payment_terms_templates|insert', 1],
  ['mutation|features/settings/paymentTermsService.ts|payment_terms_templates|update', 2],
  ['rpc-payload|features/reports/reports-collection-efficiency.ts|rpt_dashboard_snapshot', 1],
  // The dynamic resolve_active_tax_profile browser payload is gone: the dead
  // getActiveTaxProfile / getActiveTaxProfileForCompany helpers were deleted and
  // tax readiness now flows through the single governed boundary
  // features/financials/tax-authority/tax-readiness-boundary.ts, whose literal
  // rpc payload the primary scanner resolves automatically.
  ['rpc-payload|features/owners/services/owner-settlements-service.ts|create_owner_settlement_draft_atomic', 1],
]);

const RECEIPT_DYNAMIC_TARGET = {
  path: 'features/financials/receipts/receiptService.ts',
  expression: 'table as any',
  targets: {
    invoices: ['id', 'reference', 'contract_id', 'status', 'deleted_at'],
    contracts: ['id', 'property_id', 'unit_id', 'tenant_id', 'deleted_at'],
    units: ['id', 'unit_number', 'deleted_at'],
    properties: ['id', 'title', 'deleted_at'],
    people: ['id', 'full_name', 'deleted_at'],
  },
};

function sourceLine(path, line) {
  const source = readFileSync(join(SOURCE_ROOT, path), 'utf8');
  return source.split(/\r?\n/)[line - 1] ?? '';
}

function isCommentOnlyDynamic(item) {
  const line = sourceLine(item.path, item.line).trimStart();
  return line.startsWith('//') || line.startsWith('*') || line.startsWith('/*');
}

function assertedLiteral(expression) {
  const match = expression.trim().match(/^(?:'([^']+)'|"([^"]+)"|`([^`$]+)`)\s+as\s+[A-Za-z_$][\w$<>, .\[\]|&]*$/);
  return match ? (match[1] ?? match[2] ?? match[3]) : null;
}

function increment(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function validateRelationColumns(database, relation, columns, errors) {
  const contract = database.tables.get(relation);
  if (!contract) {
    errors.push(`Reviewed dynamic target '${relation}' no longer exists in database.ts`);
    return;
  }
  for (const column of columns) {
    if (!contract.row.has(column)) {
      errors.push(`Reviewed dynamic target column '${relation}.${column}' no longer exists in database.ts`);
    }
  }
}

const database = parseDatabaseTypes(readFileSync(TYPES_PATH, 'utf8'));
const usage = discoverFrontendUsage(SOURCE_ROOT);
const actual = new Map();
const errors = [];
const notes = [];
let scannerNoise = 0;
let assertedLiteralCount = 0;
let reviewedDynamicTargetCount = 0;

for (const [relation, entry] of usage.tables) {
  for (const mutation of entry.mutations) {
    if (!mutation.known) {
      increment(actual, `mutation|${mutation.path}|${relation}|${mutation.method}`);
    }
  }
}

for (const [rpc, entry] of usage.rpcs) {
  for (const call of entry.calls) {
    if (!call.argShape.known) increment(actual, `rpc-payload|${call.path}|${rpc}`);
  }
}

for (const item of usage.dynamic) {
  if (isCommentOnlyDynamic(item)) {
    scannerNoise++;
    continue;
  }

  const literal = assertedLiteral(item.expression);
  if (literal) {
    assertedLiteralCount++;
    if (!database.tables.has(literal)) {
      errors.push(`Type-asserted Supabase target '${literal}' at ${item.path}:${item.line} is missing from database.ts`);
    }
    continue;
  }

  if (
    item.method === 'from'
    && item.path === RECEIPT_DYNAMIC_TARGET.path
    && item.expression.trim() === RECEIPT_DYNAMIC_TARGET.expression
  ) {
    reviewedDynamicTargetCount++;
    continue;
  }

  errors.push(`Unreviewed dynamic Supabase target at ${item.path}:${item.line}: ${item.expression}`);
}

for (const [key, expectedCount] of REVIEWED) {
  const count = actual.get(key) ?? 0;
  if (count !== expectedCount) {
    errors.push(`Reviewed dynamic contract '${key}' expected ${expectedCount} occurrence(s), found ${count}`);
  }
}
for (const [key, count] of actual) {
  if (!REVIEWED.has(key)) errors.push(`Unreviewed dynamic contract '${key}' found ${count} occurrence(s)`);
}

if (reviewedDynamicTargetCount !== 1) {
  errors.push(`Receipt dynamic target helper expected exactly 1 occurrence, found ${reviewedDynamicTargetCount}`);
}
for (const [relation, columns] of Object.entries(RECEIPT_DYNAMIC_TARGET.targets)) {
  validateRelationColumns(database, relation, columns, errors);
}

notes.push(`${actual.size} reviewed dynamic mutation/RPC signature groups`);
notes.push(`${[...actual.values()].reduce((sum, value) => sum + value, 0)} reviewed dynamic mutation/RPC occurrences`);
notes.push(`${reviewedDynamicTargetCount} reviewed generic table helper`);
notes.push(`${assertedLiteralCount} type-asserted literal target resolved automatically`);
notes.push(`${scannerNoise} comment-only scanner false positive(s) excluded`);

console.log('\n=== MALEK Reviewed Dynamic Contract Gate ===');
for (const note of notes) console.log(`  ℹ️  ${note}`);
if (errors.length > 0) {
  for (const error of errors) console.error(`  ❌ ${error}`);
  console.error(`\n=== FAIL: ${errors.length} unreviewed/stale dynamic contract issue(s) ===`);
  process.exit(1);
}
console.log('  ✅ 0 unreviewed dynamic contracts');
console.log('  ✅ Reviewed receipt helper targets/columns still match database.ts');
console.log('\n=== PASS: dynamic contract inventory is closed and fail-closed ===');
