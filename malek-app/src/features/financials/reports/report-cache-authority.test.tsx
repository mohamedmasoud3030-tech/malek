// @vitest-environment happy-dom
import { createElement, type PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const service = vi.hoisted(() => ({ getArrearsReportSnapshot: vi.fn(), getFinancialPeriodSummaryReport: vi.fn() }));
vi.mock('./financialReportsService', () => service);
import { financialReportKeys, useAgedReceivablesReport, useArrearsSummaryReport, useOverdueInvoicesReport, useCollectionSummaryReport, useFinancialPeriodSummaryReport } from './useFinancialReports';

const period = { invoiced: 105, paid: 100, outstanding: 5, expenses: 20, netCash: 80, invoicesCount: 1, paymentsCount: 1, expensesCount: 1 };
const snapshot = { overdueInvoices: { invoiceCount: 1 }, arrearsSummary: { totalOverdue: 5 }, agedReceivables: { totalOutstanding: 5 } };
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  service.getArrearsReportSnapshot.mockResolvedValue(snapshot);
  service.getFinancialPeriodSummaryReport.mockResolvedValue(period);
});
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: 0 } } });
  const wrapper = ({ children }: PropsWithChildren) => createElement(QueryClientProvider, { client }, children);
  return { client, wrapper };
}

describe('report snapshots are a single cache/read authority', () => {
  it('shares one arrears load across three consumers, retaining their distinct projections', async () => {
    const { wrapper, client } = setup();
    const filters = { asOf: '2026-09-09', propertyId: 'p1' };
    const { result } = renderHook(() => ({
      overdue: useOverdueInvoicesReport(filters),
      summary: useArrearsSummaryReport(filters),
      aged: useAgedReceivablesReport(filters),
    }), { wrapper });
    await waitFor(() => expect(result.current.aged.isSuccess).toBe(true));
    expect(service.getArrearsReportSnapshot).toHaveBeenCalledTimes(1);
    expect(result.current.overdue.data).toEqual(snapshot.overdueInvoices);
    expect(result.current.summary.data).toEqual(snapshot.arrearsSummary);
    await client.invalidateQueries({ queryKey: financialReportKeys.all });
    expect(service.getArrearsReportSnapshot).toHaveBeenCalledTimes(2);
  });
  it('shares one period read across finance and collection summaries', async () => {
    const { wrapper } = setup();
    const filters = { dateFrom: '2026-09-01', dateTo: '2026-09-09' };
    const { result } = renderHook(() => ({ period: useFinancialPeriodSummaryReport(filters), collections: useCollectionSummaryReport(filters) }), { wrapper });
    await waitFor(() => expect(result.current.collections.isSuccess).toBe(true));
    expect(service.getFinancialPeriodSummaryReport).toHaveBeenCalledTimes(1);
    expect(result.current.collections.data).toEqual({ invoiced: 105, paid: 100, outstanding: 5, expensesTotal: 20, invoicesCount: 1, receiptsCount: 1 });
    expect(result.current.period.data?.netCash).toBe(80);
  });
  it('partitions snapshot caches by scope and respects disabled/incomplete gates', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => ({
      a: useOverdueInvoicesReport({ asOf: '2026-09-09', propertyId: 'a' }),
      b: useOverdueInvoicesReport({ asOf: '2026-09-09', propertyId: 'b' }),
      disabled: useArrearsSummaryReport({ asOf: '2026-09-09', propertyId: 'c' }, { enabled: false }),
      invalid: useArrearsSummaryReport({ asOf: '2026-02-31' }),
    }), { wrapper });
    await waitFor(() => expect(result.current.b.isSuccess).toBe(true));
    expect(service.getArrearsReportSnapshot).toHaveBeenCalledTimes(2);
    expect(result.current.disabled.fetchStatus).toBe('idle');
    expect(result.current.invalid.fetchStatus).toBe('idle');
  });
});
