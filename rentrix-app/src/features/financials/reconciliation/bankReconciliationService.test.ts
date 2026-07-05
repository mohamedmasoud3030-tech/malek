import { describe, expect, it } from 'vitest';
import { parseBankStatementCsv, summarizeReconciliation } from './bankReconciliationService';

describe('bank reconciliation helpers', () => {
  it('summarizes unmatched, matched, and ignored statement lines', () => {
    expect(summarizeReconciliation([
      { amount: 100, status: 'unmatched' },
      { amount: -25, status: 'unmatched' },
      { amount: 50, status: 'matched' },
      { amount: 10, status: 'ignored' },
    ])).toEqual({
      totalLines: 4,
      unmatchedCount: 2,
      matchedCount: 1,
      ignoredCount: 1,
      unmatchedAmount: 75,
    });
  });

  it('parses bank statement CSV rows into unmatched statement line payloads', () => {
    expect(parseBankStatementCsv('date,description,reference,amount\n2026-07-01,تحصيل,REC-1,250.50\n2026-07-02,رسوم,BANK-FEE,-10', 'bank-1')).toEqual([
      { bank_account_id: 'bank-1', transaction_date: '2026-07-01', description: 'تحصيل', reference: 'REC-1', amount: 250.5, status: 'unmatched' },
      { bank_account_id: 'bank-1', transaction_date: '2026-07-02', description: 'رسوم', reference: 'BANK-FEE', amount: -10, status: 'unmatched' },
    ]);
  });

  it('rejects missing bank accounts, invalid calendar dates, and invalid amounts', () => {
    expect(() => parseBankStatementCsv('2026-07-01,تحصيل,REC-1,250', '')).toThrow('اختر الحساب البنكي');
    expect(() => parseBankStatementCsv('2026-02-30,تحصيل,REC-1,250', 'bank-1')).toThrow('تاريخ غير صحيح');
    expect(() => parseBankStatementCsv('2026-07-01,تحصيل,REC-1,0', 'bank-1')).toThrow('مبلغ غير صحيح');
  });
});
