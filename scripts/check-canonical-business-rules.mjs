import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const contractPath = join(repoRoot, 'governance', 'canonical-business-rules.json');
const checksumPath = join(repoRoot, 'governance', 'canonical-business-rules.sha256');
const constitutionPath = join(repoRoot, 'docs', 'business', 'CANONICAL_BUSINESS_AND_CONTRACT_RULES_AR.md');
const changelogPath = join(repoRoot, 'governance', 'BUSINESS_RULES_CHANGELOG.md');

function fail(message) {
  console.error(`CANONICAL_BUSINESS_RULES_GUARD_FAILED: ${message}`);
  process.exitCode = 1;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(values, expected, label) {
  if (!Array.isArray(values) || !values.includes(expected)) {
    fail(`${label}: missing ${JSON.stringify(expected)}`);
  }
}

const contractBytes = readFileSync(contractPath);
const actualChecksum = createHash('sha256').update(contractBytes).digest('hex');
const checksumFile = readFileSync(checksumPath, 'utf8').trim();
const checksumMatch = checksumFile.match(/^([a-f0-9]{64})\s+governance\/canonical-business-rules\.json$/);

if (!checksumMatch) {
  fail('checksum file must contain exactly one SHA-256 entry for governance/canonical-business-rules.json');
} else if (checksumMatch[1] !== actualChecksum) {
  fail(`checksum mismatch: expected ${checksumMatch[1]}, received ${actualChecksum}`);
}

let rules;
try {
  rules = JSON.parse(contractBytes.toString('utf8'));
} catch (error) {
  fail(`invalid JSON contract: ${String(error)}`);
  process.exit();
}

assertEqual(rules.status, 'LOCKED_CANONICAL', 'status');
assertEqual(rules.product, 'MALEK', 'product');
assertEqual(rules.repository, 'mohamedmasoud3030-tech/malik', 'repository');
assertEqual(rules.rules_owner, 'mohamedmasoud3030-tech', 'rules_owner');
assertEqual(rules.change_control?.classification, 'FOUNDATIONAL_PRODUCT_CONSTITUTION', 'change_control.classification');
assertEqual(rules.change_control?.normal_feature_pr_may_not_change_rules, true, 'change_control.normal_feature_pr_may_not_change_rules');
assertEqual(rules.change_control?.product_owner_github_login, 'mohamedmasoud3030-tech', 'change_control.product_owner_github_login');

assertEqual(rules.currency_policy?.base_currency, 'OMR', 'currency_policy.base_currency');
assertEqual(rules.currency_policy?.storage_precision, 3, 'currency_policy.storage_precision');
assertEqual(rules.currency_policy?.rounding_unit, '0.001', 'currency_policy.rounding_unit');
assertEqual(rules.currency_policy?.server_is_money_source_of_truth, true, 'currency_policy.server_is_money_source_of_truth');

assertEqual(rules.operating_models?.OWNER_AGENCY?.office_role, 'AGENT', 'OWNER_AGENCY.office_role');
assertEqual(rules.operating_models?.OWNER_AGENCY?.presentation, 'NET', 'OWNER_AGENCY.presentation');
assertEqual(rules.operating_models?.OWNER_AGENCY?.default_collection_role, 'OWNER_IS_CREDITOR', 'OWNER_AGENCY.default_collection_role');
assertEqual(rules.operating_models?.OWNER_AGENCY?.tenant_rent_is_office_revenue, false, 'OWNER_AGENCY.tenant_rent_is_office_revenue');

assertEqual(rules.operating_models?.MASTER_LEASE?.office_role, 'PRINCIPAL', 'MASTER_LEASE.office_role');
assertEqual(rules.operating_models?.MASTER_LEASE?.presentation, 'GROSS', 'MASTER_LEASE.presentation');
assertEqual(rules.operating_models?.MASTER_LEASE?.default_collection_role, 'OFFICE_IS_CREDITOR', 'MASTER_LEASE.default_collection_role');
assertEqual(rules.operating_models?.MASTER_LEASE?.separate_from_owner_settlements, true, 'MASTER_LEASE.separate_from_owner_settlements');

assertEqual(rules.owner_agreement?.active_terms_are_versioned, true, 'owner_agreement.active_terms_are_versioned');
assertEqual(rules.owner_agreement?.silent_retroactive_mutation_forbidden, true, 'owner_agreement.silent_retroactive_mutation_forbidden');
assertEqual(rules.owner_agreement?.default_rate_fee_trigger, 'ON_COLLECTION', 'owner_agreement.default_rate_fee_trigger');
assertEqual(rules.owner_agreement?.default_fixed_monthly_trigger, 'DAILY_ACCRUAL', 'owner_agreement.default_fixed_monthly_trigger');
assertIncludes(rules.owner_agreement?.collection_roles, 'OWNER_IS_CREDITOR', 'owner_agreement.collection_roles');
assertIncludes(rules.owner_agreement?.collection_roles, 'OFFICE_IS_CREDITOR', 'owner_agreement.collection_roles');

assertEqual(rules.tenant_contract?.rent_amount_semantics, 'CONTRACTUAL_INSTALLMENT_AMOUNT_PER_PAYMENT_CYCLE', 'tenant_contract.rent_amount_semantics');
assertEqual(rules.tenant_contract?.schedule_is_contractual_obligation_not_invoice, true, 'tenant_contract.schedule_is_contractual_obligation_not_invoice');
assertEqual(rules.tenant_contract?.active_contract_changes_require_amendment_or_new_version, true, 'tenant_contract.active_contract_changes_require_amendment_or_new_version');
assertIncludes(rules.tenant_contract?.activation_gates, 'NO_OVERLAPPING_OCCUPANCY', 'tenant_contract.activation_gates');
assertIncludes(rules.tenant_contract?.activation_gates, 'BILLING_SCHEDULE_MATERIALIZED', 'tenant_contract.activation_gates');

assertEqual(rules.property_onboarding?.property_cannot_activate_before_required_steps, true, 'property_onboarding.property_cannot_activate_before_required_steps');
assertEqual(rules.financial_invariants?.posted_financial_records_are_append_only, true, 'financial_invariants.posted_financial_records_are_append_only');
assertEqual(rules.financial_invariants?.corrections_use_reversal_not_delete, true, 'financial_invariants.corrections_use_reversal_not_delete');
assertEqual(rules.financial_invariants?.owner_expense_treatment, 'DUE_FROM_OWNER_NOT_OFFICE_EXPENSE', 'financial_invariants.owner_expense_treatment');
assertEqual(rules.financial_invariants?.tenant_deposit_treatment, 'LIABILITY_UNTIL_CONTRACTUALLY_APPLIED_OR_REFUNDED', 'financial_invariants.tenant_deposit_treatment');

const constitution = readFileSync(constitutionPath, 'utf8');
const changelog = readFileSync(changelogPath, 'utf8');

if (!constitution.includes(`**Schema version:** \`${rules.schema_version}\``)) {
  fail('constitution does not declare the current schema version');
}
if (!constitution.includes(`**SHA-256:** \`${actualChecksum}\``)) {
  fail('constitution does not declare the current contract checksum');
}
if (!changelog.includes(`## ${rules.schema_version} —`)) {
  fail('changelog does not contain an entry for the current schema version');
}
if (!changelog.includes(actualChecksum)) {
  fail('changelog does not contain the current contract checksum');
}

if (!process.exitCode) {
  console.log(`Canonical business rules verified: v${rules.schema_version} ${actualChecksum}`);
}
