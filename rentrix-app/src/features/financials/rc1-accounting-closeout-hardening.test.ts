import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  __dirname,
  '../../../../supabase/migrations/20260820070000_rc1_accounting_closeout_hardening.sql',
);
const migrationSql = readFileSync(migrationPath, 'utf8');

describe('RC1 accounting closeout hardening migration contract', () => {
  it('keeps zero/non-taxable fee codes semantically zero-rated', () => {
    expect(migrationSql).toMatch(/company_fee_tax_treatments_zero_code_rate_chk/i);
    expect(migrationSql).toMatch(/tax_code not in \('NON_TAXABLE','VAT_ZERO'\)/i);
    expect(migrationSql).toMatch(/tax_rate = 0\.000/i);
    expect(migrationSql).toMatch(/FEE_TAX_TREATMENT_ZERO_CODE_RATE_INVALID/i);
  });

  it('binds fee-tax creation and approval idempotency to request fingerprints and approval targets', () => {
    expect(migrationSql).toMatch(/create_fee_tax_treatment:[^']*'/i);
    expect(migrationSql).toMatch(/_request_fingerprint/i);
    expect(migrationSql).toMatch(/FEE_TAX_TREATMENT_IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST/i);
    expect(migrationSql).toMatch(/approve_fee_tax_treatment:[^']*'/i);
    expect(migrationSql).toMatch(/'_target', v_id::text/i);
    expect(migrationSql).toMatch(/FEE_TAX_TREATMENT_APPROVAL_IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST/i);
  });

  it('revalidates the frozen 2000 opening position before cutover approval', () => {
    expect(migrationSql).toMatch(/wp05_gl_balance\(v_company_id, '2000', v_cutover\.cutover_date\)/i);
    expect(migrationSql).toMatch(/wp05_gl_line_count\(v_company_id, '2000', v_cutover\.cutover_date\)/i);
    expect(migrationSql).toMatch(/v_fingerprint is distinct from v_cutover\.source_fingerprint/i);
    expect(migrationSql).toMatch(/OWNER_FUNDS_CUTOVER_STALE_REVIEW_REQUIRED/i);
  });

  it('prevents management-fee events from turning owner funds into an owner receivable', () => {
    expect(migrationSql).toMatch(/assert_owner_funds_event_solvency/i);
    expect(migrationSql).toMatch(/v_gl_2000 < -0\.001/i);
    expect(migrationSql).toMatch(/OWNER_FUNDS_CONTROL_NEGATIVE/i);
    expect(migrationSql).toMatch(/p_source_type = 'MANAGEMENT_FEE'/i);
    expect(migrationSql).toMatch(/OWNER_FUNDS_INVOICE_BALANCE_INSUFFICIENT_FOR_FEE/i);
    expect(migrationSql).toMatch(/perform public\.assert_owner_funds_event_solvency/i);
  });

  it('builds the 2100 operational basis from rent VAT plus RATE and FIXED fee VAT with reversal semantics', () => {
    expect(migrationSql).toMatch(/create or replace function public\.rc1_owner_agency_vat_payable_balance/i);
    expect(migrationSql).toMatch(/public\.management_fee_tax_snapshots/i);
    expect(migrationSql).toMatch(/upper\(coalesce\(r\.status,''\)\) = 'POSTED'/i);
    expect(migrationSql).toMatch(/public\.fixed_monthly_daily_accruals/i);
    expect(migrationSql).toMatch(/public\.fixed_monthly_daily_accrual_reversals/i);
    expect(migrationSql).toMatch(/rev\.id is null/i);
  });

  it('promotes 2100 into the authoritative 0.001 OMR WP-05 reconciliation gate', () => {
    expect(migrationSql).toMatch(/'VAT_PAYABLE'::text, '2100'::text, 'VAT Payable'::text/i);
    expect(migrationSql).toMatch(/rc1_owner_agency_vat_payable_balance\(p_company_id, p_as_of\)/i);
    expect(migrationSql).toMatch(/wp05_gl_balance\(p_company_id, '2100', p_as_of\)/i);
    expect(migrationSql).toMatch(/abs\(v_vat_bal - v_vat_gl\) <= 0\.001/i);
  });

  it('remains forward-only and never rewrites posted financial history', () => {
    expect(migrationSql).not.toMatch(/update\s+public\.journal_lines/i);
    expect(migrationSql).not.toMatch(/delete\s+from\s+public\.journal_lines/i);
    expect(migrationSql).not.toMatch(/update\s+public\.journal_batches/i);
    expect(migrationSql).not.toMatch(/delete\s+from\s+public\.journal_batches/i);
    expect(migrationSql).not.toMatch(/update\s+public\.invoices/i);
    expect(migrationSql).not.toMatch(/delete\s+from\s+public\.invoices/i);
  });
});
