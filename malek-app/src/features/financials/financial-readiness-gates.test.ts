import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { filterPaymentsForReport, summarizeDailyCollectionReport } from './reports/financialReportsService';

describe('financial readiness gates', () => {
  it('derives chart and payment-method readiness from one checked account snapshot', () => {
    const source = readFileSync(fileURLToPath(new URL('./tax-authority/finance-readiness-service.ts', import.meta.url)), 'utf8');
    const accountReadCalls = source.match(/rpc\('list_chart_of_accounts'\)/gu) ?? [];

    expect(accountReadCalls).toHaveLength(1);
    expect(source).toContain('if (error) throw error');
    expect(source).toContain("paymentMethods = { state: 'BLOCKED' }");
  });

  it('filters deleted and voided payments before report totals are summarized', () => {
    const rows = filterPaymentsForReport([
      { id: 'p-1', invoice_id: 'i-1', amount: 100, payment_date: '2026-07-01', payment_method: 'cash', status: 'posted', deleted_at: null, invoice: { id: 'i-1', contract_id: 'c-1' }, contract: null },
      { id: 'p-2', invoice_id: 'i-2', amount: 999, payment_date: '2026-07-01', payment_method: 'card', status: 'VOID', deleted_at: null, invoice: { id: 'i-2', contract_id: 'c-2' }, contract: null },
      { id: 'p-3', invoice_id: 'i-3', amount: 777, payment_date: '2026-07-01', payment_method: 'bank_transfer', status: 'posted', deleted_at: '2026-07-02T00:00:00Z', invoice: { id: 'i-3', contract_id: 'c-3' }, contract: null },
      { id: 'p-4', invoice_id: 'i-4', amount: 50, payment_date: '2026-07-02', payment_method: 'card', status: null, deleted_at: null, invoice: { id: 'i-4', contract_id: 'c-4' }, contract: null },
    ], { dateFrom: '2026-07-01', dateTo: '2026-07-31' });

    expect(rows.map((row) => row.id)).toEqual(['p-1', 'p-4']);

    const report = summarizeDailyCollectionReport(rows);
    expect(report.grandTotal).toBe(150);
    expect(report.paymentsCount).toBe(2);
    expect(report.methodTotals.cash).toBe(100);
    expect(report.methodTotals.card).toBe(50);
    expect(report.rows.map((row) => row.totalPaid)).toEqual([100, 50]);
    expect(report.rows.reduce((sum, row) => sum + row.totalPaid, 0)).toBe(report.grandTotal);
  });
});
