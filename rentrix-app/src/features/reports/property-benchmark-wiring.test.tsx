// @vitest-environment happy-dom
/**
 * WIRING contract — property benchmark & previous-period scope.
 *
 * A model-level unit test is NOT enough here: both defects this suite guards
 * lived in the CALLER, not in the pure functions. `useReportsWorkspace`
 * narrows its occupancy/expense rows by `filters.propertyId` before building
 * the analytics input, so feeding those same scoped rows to the benchmark
 * leaves an empty "rest of the portfolio" and the benchmark silently vanishes
 * in the only scope where it exists.
 *
 * These tests therefore render the REAL hook with a real single-property
 * filter, mocking only the data sources, and assert on what the workspace
 * actually produces:
 *
 *   1. at single-property scope the benchmark is present and its portfolio
 *      side is computed from the OTHER properties (unfiltered population),
 *   2. the selected property's own figures stay scoped,
 *   3. the expense benchmark query is issued WITHOUT a propertyId filter,
 *   4. the previous-period comparison is scoped to the SAME property as the
 *      current period.
 *
 * If the scoped rows are ever passed as the benchmark population again, (1)
 * collapses to an empty benchmark and this suite fails.
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Unit } from '@/types/domain';

/** Two properties: p-01 (selected) 3 occupied / 1 vacant, p-02 1 occupied / 3 vacant. */
const ALL_UNITS = [
  { id: 'u-1', property_id: 'p-01', status: 'rented' },
  { id: 'u-2', property_id: 'p-01', status: 'rented' },
  { id: 'u-3', property_id: 'p-01', status: 'rented' },
  { id: 'u-4', property_id: 'p-01', status: 'available' },
  { id: 'u-5', property_id: 'p-02', status: 'rented' },
  { id: 'u-6', property_id: 'p-02', status: 'available' },
  { id: 'u-7', property_id: 'p-02', status: 'available' },
  { id: 'u-8', property_id: 'p-02', status: 'available' },
] as unknown as Unit[];

const EXPENSES_BY_PROPERTY = [
  { propertyId: 'p-01', propertyTitle: 'برج الشروق', total: 300, count: 2 },
  { propertyId: 'p-02', propertyTitle: 'برج النسيم', total: 900, count: 3 },
];

const okQuery = (data: unknown) => ({
  data, isLoading: false, isError: false, error: null, refetch: vi.fn(),
});

/** Every expense-report call, with the filters it was issued with. */
const expenseCalls: Array<Record<string, unknown>> = [];
/** Every overdue (arrears) call — used to prove previous-period scoping. */
const overdueCalls: Array<Record<string, unknown>> = [];
/** Every period-summary call. */
const summaryCalls: Array<Record<string, unknown>> = [];

vi.mock('@/features/units/use-units', () => ({
  useAllUnits: () => okQuery(ALL_UNITS),
}));
vi.mock('@/features/reports/reports-page.helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./reports-page.helpers')>();
  return {
    ...actual,
    usePropertyTitles: () => okQuery([
      { id: 'p-01', title: 'برج الشروق' },
      { id: 'p-02', title: 'برج النسيم' },
    ]),
  };
});
vi.mock('@/features/contracts/useContracts', () => ({
  useAllContracts: () => okQuery({ rows: [], truncated: false }),
}));
vi.mock('@/features/owners/useOwners', () => ({ useOwners: () => okQuery([]) }));
vi.mock('@/features/financials/receipts/useReceipts', () => ({ useReceipts: () => okQuery([]) }));
vi.mock('@/features/settings/useCostCenters', () => ({ useCostCenters: () => okQuery([]) }));
vi.mock('@/features/maintenance/use-maintenance', () => ({ useMaintenance: () => okQuery([]) }));
vi.mock('./reports-collection-efficiency', () => ({
  useAuthoritativeReportsCollectionRate: () => okQuery(0),
}));
vi.mock('@/features/accounting/reports/accountingReportsHooks', () => ({
  useAccountingTrialBalanceReport: () => okQuery(null),
  useAccountingIncomeStatementReport: () => okQuery(null),
  useAccountingBalanceSheetReport: () => okQuery(null),
}));
vi.mock('@/features/financials/reports/useFinancialReports', () => ({
  financialReportKeys: {
    all: ['financialReports'] as const,
    ownerStatement: (ownerId: string, filters: Record<string, unknown>) =>
      ['financialReports', 'ownerStatement', ownerId, filters] as const,
  },
  useExpenseBreakdownReport: (filters: Record<string, unknown>) => {
    expenseCalls.push(filters);
    // Mirror the real service: a propertyId filter narrows byProperty.
    const scoped = filters.propertyId
      ? EXPENSES_BY_PROPERTY.filter((row) => row.propertyId === filters.propertyId)
      : EXPENSES_BY_PROPERTY;
    return okQuery({
      totalExpenses: scoped.reduce((sum, row) => sum + row.total, 0),
      expensesCount: scoped.length,
      byCategory: [],
      byProperty: scoped,
    });
  },
  useOverdueInvoicesReport: (filters: Record<string, unknown>) => {
    overdueCalls.push(filters);
    return okQuery({ asOf: String(filters.asOf ?? ''), totalOverdue: 0, invoiceCount: 0, rows: [] });
  },
  useFinancialPeriodSummaryReport: (filters: Record<string, unknown>) => {
    summaryCalls.push(filters);
    return okQuery({
      invoiced: 1000, paid: 800, outstanding: 200, expenses: 0,
      netCash: 800, invoicesCount: 1, paymentsCount: 1, expensesCount: 0,
    });
  },
  useCollectionSummaryReport: () => okQuery(null),
  useDailyCollectionReport: () => okQuery([]),
  usePropertyCollectionBreakdownReport: () => okQuery([]),
  useFinancialCashflowReport: () => okQuery(null),
  useVatReturnReport: () => okQuery(null),
  useAgedReceivablesReport: () => okQuery(null),
  useArrearsSummaryReport: () => okQuery(null),
  useTenantStatementReport: () => okQuery(null),
  useOwnerStatementReport: () => okQuery(null),
}));

const { useReportsWorkspace } = await import('./use-reports-workspace');

const filtersFor = (propertyId: string) => ({
  from: '2026-02-01',
  to: '2026-02-28',
  asOf: '2026-02-28',
  propertyId,
  unitId: '',
  tenantId: '',
  contractId: '',
  ownerId: '',
  costCenterId: '',
  status: 'all' as const,
});

function renderWorkspace(propertyId: string) {
  expenseCalls.length = 0;
  overdueCalls.length = 0;
  summaryCalls.length = 0;
  return renderHook(() => useReportsWorkspace(
    filtersFor(propertyId) as never,
    { section: 'analytics', view: 'property_analytics' },
  ));
}

describe('property benchmark wiring — unfiltered portfolio population', () => {
  it('produces a benchmark at single-property scope (scoped rows would make it vanish)', () => {
    const { result } = renderWorkspace('p-01');
    const benchmark = result.current.sections.propertyPerformance.benchmark;
    // The regression this guards: an empty benchmark whenever a property is
    // selected, because the "others" population was derived from rows that
    // had already been filtered down to that same property.
    expect(benchmark.length).toBeGreaterThan(0);
  });

  it('compares the SELECTED property against the OTHER properties, not against itself or nothing', () => {
    const { result } = renderWorkspace('p-01');
    const benchmark = result.current.sections.propertyPerformance.benchmark;
    const occupancy = benchmark.find((row) => row.key === 'occupancy');

    // p-01: 3 occupied of 4 units = 75%. Rest of portfolio (p-02): 1 of 4 = 25%.
    expect(occupancy?.property).toBe(75);
    expect(occupancy?.portfolio).toBe(25);
    // A portfolio side equal to the property side would mean the population
    // still included the selected property itself.
    expect(occupancy?.portfolio).not.toBe(occupancy?.property);
  });

  it('benchmarks vacancy share against the rest of the portfolio too', () => {
    const { result } = renderWorkspace('p-01');
    const vacancy = result.current.sections.propertyPerformance.benchmark
      .find((row) => row.key === 'vacancy_share');
    expect(vacancy?.property).toBe(25); // 1 vacant of 4
    expect(vacancy?.portfolio).toBe(75); // 3 vacant of 4
  });

  it('issues an UNFILTERED expense query for the benchmark population', () => {
    renderWorkspace('p-01');
    // The scoped expense query must still exist (the property's own figures),
    // and alongside it an unscoped one purely for the benchmark.
    expect(expenseCalls.some((call) => call.propertyId === 'p-01')).toBe(true);
    expect(expenseCalls.some((call) => call.propertyId === undefined && call.dateFrom === '2026-02-01')).toBe(true);
  });

  it("keeps the property's OWN expense-per-occupied-unit scoped while the portfolio side is not", () => {
    const { result } = renderWorkspace('p-01');
    const row = result.current.sections.propertyPerformance.benchmark
      .find((entry) => entry.key === 'expense_per_occupied');
    expect(row?.property).toBe(100); // p-01: 300 / 3 occupied
    expect(row?.portfolio).toBe(900); // p-02: 900 / 1 occupied
  });

  it('emits no benchmark at portfolio scope (a portfolio cannot benchmark against itself)', () => {
    const { result } = renderWorkspace('');
    expect(result.current.sections.propertyPerformance.benchmark).toEqual([]);
  });
});

describe('previous-period wiring — same scope as the current period', () => {
  it('scopes every previous-period query to the selected property', () => {
    renderWorkspace('p-01');
    // Previous window = the same-length window immediately before Feb 2026.
    const previousSummary = summaryCalls.filter((call) => call.dateTo !== '2026-02-28');
    expect(previousSummary.length).toBeGreaterThan(0);
    for (const call of previousSummary) {
      expect(call.propertyId).toBe('p-01');
    }

    const previousOverdue = overdueCalls.filter((call) => call.asOf !== '2026-02-28');
    expect(previousOverdue.length).toBeGreaterThan(0);
    for (const call of previousOverdue) {
      expect(call.propertyId).toBe('p-01');
    }

    // The previous-period EXPENSE query is scoped as well — only the
    // benchmark query is allowed to be unscoped, and it is a current-period one.
    const previousExpense = expenseCalls.filter((call) => call.dateTo !== '2026-02-28');
    expect(previousExpense.length).toBeGreaterThan(0);
    for (const call of previousExpense) {
      expect(call.propertyId).toBe('p-01');
    }
  });

  it('exposes a previous period whose occupancy is the selected property, not the portfolio', () => {
    const { result } = renderWorkspace('p-01');
    const previous = result.current.sections.propertyPerformance.previousPeriod;
    expect(previous).not.toBeNull();
    // p-01 alone is 75% occupied; the whole portfolio is 50%. Reading the
    // portfolio figure here would be the cross-scope comparison bug.
    expect(previous?.occupancyRate).toBe(75);
    expect(previous?.occupancyRate).not.toBe(50);
  });
});
