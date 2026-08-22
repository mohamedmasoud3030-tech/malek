import { describe, expect, it } from 'vitest';
import type { ReconciliationRow } from '@/features/accounting/wp05Services';
import { summarizeReconciliationReadiness } from './accounting-report-authority';

function row(overrides: Partial<ReconciliationRow> = {}): ReconciliationRow {
  return {
    reconciliation_class: 'TENANT_AR',
    account_no: '1201',
    account_name: 'Tenant Receivable',
    subledger_balance: 100,
    gl_balance: 100,
    variance: 0,
    abs_variance: 0,
    currency: 'OMR',
    reconciliation_status: 'PASS',
    subledger_count: 1,
    gl_count: 1,
    ...overrides,
  };
}

describe('reports accounting authority readiness', () => {
  it('does not treat missing reconciliation evidence as PASS', () => {
    expect(summarizeReconciliationReadiness([])).toEqual({
      state: 'NO_EVIDENCE',
      total: 0,
      failed: 0,
      maxAbsVariance: 0,
    });
  });

  it('passes only when every returned subledger/GL class is reconciled within OMR 0.001', () => {
    expect(summarizeReconciliationReadiness([
      row(),
      row({ reconciliation_class: 'OWNER_PAYABLE', account_no: '2000', abs_variance: 0.001, variance: 0.001 }),
    ])).toEqual({
      state: 'PASS',
      total: 2,
      failed: 0,
      maxAbsVariance: 0.001,
    });
  });

  it('fails when the server status fails even if the numeric variance is zero', () => {
    expect(summarizeReconciliationReadiness([
      row({ reconciliation_status: 'FAIL' }),
    ])).toEqual({
      state: 'FAIL',
      total: 1,
      failed: 1,
      maxAbsVariance: 0,
    });
  });

  it('fails when absolute variance exceeds the OMR 0.001 accounting tolerance', () => {
    expect(summarizeReconciliationReadiness([
      row(),
      row({ reconciliation_class: 'TENANT_DEPOSIT', account_no: '2200', variance: -0.002, abs_variance: 0.002 }),
    ])).toEqual({
      state: 'FAIL',
      total: 2,
      failed: 1,
      maxAbsVariance: 0.002,
    });
  });
});
