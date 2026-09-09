// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RegulatorySummaryPanels } from './statement-summary-panels';
afterEach(cleanup);
const base = { cashFlow: undefined, cashFlowError: null, isCashFlowLoading: false, isLoading: false };
const tax = { period: { from: '2026-09-01', to: '2026-09-30' }, totalSalesAmount: 761.786, totalTaxAmount: 38.089, invoiceCount: 1 };
it('renders actual validated tax figures', () => {
  render(<RegulatorySummaryPanels {...base} vatReturn={tax} />);
  expect(screen.getByText(/38\.089/)).toBeTruthy();
});
it('does not invent zero tax when no report result exists', () => {
  render(<RegulatorySummaryPanels {...base} vatReturn={undefined} />);
  expect(screen.getByRole('status').textContent).toContain('لا توجد نتيجة ضريبية');
  expect(screen.queryByText('إجمالي الضريبة')).toBeNull();
});
it('hides even cached tax figures when the source review fails', () => {
  render(<RegulatorySummaryPanels {...base} vatReturn={tax} vatReturnError={new Error('VAT_REPORT_UNCLASSIFIED_POSTING')} />);
  expect(screen.getByRole('alert').textContent).toContain('تعذر تحميل ملخص الضريبة');
  expect(screen.queryByText(/38\.089/)).toBeNull();
  expect(screen.queryByText('إجمالي الضريبة')).toBeNull();
});
