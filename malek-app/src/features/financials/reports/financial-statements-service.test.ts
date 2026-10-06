import { expect, it, vi } from 'vitest';
import { normalizeVatReturnReport } from './financial-statements-service';
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
const valid = { period: { from: '2026-09-01', to: '2026-09-30' }, total_sales_amount: '-100.125', total_tax_amount: '-5.006', invoice_count: '1' };
it('retains signed original-basis credit totals at OMR precision', () => {
  expect(normalizeVatReturnReport(valid)).toEqual({ period: valid.period, totalSalesAmount: -100.125, totalTaxAmount: -5.006, invoiceCount: 1 });
});
it.each([null, {}, [], { ...valid, total_tax_amount: null }, { ...valid, total_tax_amount: 'unknown' },
  { ...valid, total_sales_amount: '' }, { ...valid, invoice_count: 1.5 }, { ...valid, period: null }])('rejects malformed tax evidence: %j', payload => {
  expect(() => normalizeVatReturnReport(payload)).toThrow();
});
