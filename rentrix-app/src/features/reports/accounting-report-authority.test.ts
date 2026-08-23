import { describe, expect, it } from 'vitest';
import type { ReconciliationRow } from '@/features/accounting/wp05Services';
import {
  isAccountingStatementOutputReady,
  summarizeReconciliationReadiness,
} from './accounting-report-authority';

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

function completeRows(): ReconciliationRow[] {
  return [
    row(),
    row({ reconciliation_class: 'OWNER_RECEIVABLE', account_no: '1300', account_name: 'Due from Owners' }),
    row({ reconciliation_class: 'OWNER_PAYABLE', account_no: '2000', account_name: 'Owner Funds Payable' }),
    row({ reconciliation_class: 'TENANT_DEPOSIT', account_no: '2200', account_name: 'Tenant Deposits Payable' }),
    row({ reconciliation_class: 'COMMISSION_PAYABLE', account_no: '2300', account_name: 'Broker Commissions Payable' }),
  ];
}

describe('reports accounting authority readiness', () => {
  it('does not treat missing reconciliation evidence as PASS', () => {
    expect(summarizeReconciliationReadiness([])).toEqual({
      state: 'NO_EVIDENCE',
      total: 0,
      failed: 0,
      maxAbsVariance: 0,
      missingAccountNos: ['1201', '1300', '2000', '2200', '2300'],
    });
  });

  it('fails closed when even one canonical reconciliation account is missing', () => {
    const partialRows = completeRows().filter((item) => item.account_no !== '1300');

    expect(summarizeReconciliationReadiness(partialRows)).toEqual({
      state: 'FAIL',
      total: 5,
      failed: 1,
      maxAbsVariance: 0,
      missingAccountNos: ['1300'],
    });
  });

  it('passes only when all canonical subledger/GL controls reconcile within OMR 0.001', () => {
    const rows = completeRows();
    rows[2] = row({
      reconciliation_class: 'OWNER_PAYABLE',
      account_no: '2000',
      account_name: 'Owner Funds Payable',
      abs_variance: 0.001,
      variance: 0.001,
    });

    expect(summarizeReconciliationReadiness(rows)).toEqual({
      state: 'PASS',
      total: 5,
      failed: 0,
      maxAbsVariance: 0.001,
      missingAccountNos: [],
    });
  });

  it('fails when the server status fails even if the numeric variance is zero', () => {
    const rows = completeRows();
    rows[0] = row({ reconciliation_status: 'FAIL' });

    expect(summarizeReconciliationReadiness(rows)).toEqual({
      state: 'FAIL',
      total: 5,
      failed: 1,
      maxAbsVariance: 0,
      missingAccountNos: [],
    });
  });

  it('fails when absolute variance exceeds the OMR 0.001 accounting tolerance', () => {
    const rows = completeRows();
    rows[3] = row({
      reconciliation_class: 'TENANT_DEPOSIT',
      account_no: '2200',
      account_name: 'Tenant Deposits Payable',
      variance: -0.002,
      abs_variance: 0.002,
    });

    expect(summarizeReconciliationReadiness(rows)).toEqual({
      state: 'FAIL',
      total: 5,
      failed: 1,
      maxAbsVariance: 0.002,
      missingAccountNos: [],
    });
  });

  it('allows accounting statement output only after a successful completed reconciliation query', () => {
    const pass = summarizeReconciliationReadiness(completeRows());
    const failedRows = completeRows();
    failedRows[0] = row({ reconciliation_status: 'FAIL' });
    const fail = summarizeReconciliationReadiness(failedRows);
    const partial = summarizeReconciliationReadiness(completeRows().slice(0, 4));
    const noEvidence = summarizeReconciliationReadiness([]);

    expect(isAccountingStatementOutputReady(pass, { isLoading: false, isError: false })).toBe(true);
    expect(isAccountingStatementOutputReady(pass, { isLoading: true, isError: false })).toBe(false);
    expect(isAccountingStatementOutputReady(pass, { isLoading: false, isError: true })).toBe(false);
    expect(isAccountingStatementOutputReady(fail, { isLoading: false, isError: false })).toBe(false);
    expect(isAccountingStatementOutputReady(partial, { isLoading: false, isError: false })).toBe(false);
    expect(isAccountingStatementOutputReady(noEvidence, { isLoading: false, isError: false })).toBe(false);
  });
});
