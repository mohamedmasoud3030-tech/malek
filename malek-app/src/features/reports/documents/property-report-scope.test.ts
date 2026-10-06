/**
 * WIRING contract — Property Golden Report scope integrity.
 *
 * `loadPropertyReportData` mixes two populations on purpose: the selected
 * property (current figures) and the whole portfolio (benchmark). Two defects
 * are possible and both are silent:
 *
 *   A. the previous period is built from ALL units/contracts while the current
 *      period is scoped to one property — comparing one property NOW against
 *      the whole portfolio THEN,
 *   B. the benchmark population is derived from the workspace's occupancy
 *      rows, which are ALREADY filtered to the selected property — leaving no
 *      "rest of the portfolio" and making the benchmark disappear.
 *
 * These tests exercise the real loader with a two-property universe where the
 * property figure and the portfolio figure are deliberately different, so
 * either defect produces a wrong number rather than an ambiguous one.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ContractListItem } from '@/features/contracts/services/contractService';
import type { Unit } from '@/types/domain';
import type { ReportsFilterState } from '../reports-workspace-filters';
import type { ReportsWorkspaceModel } from '../use-reports-workspace';

/**
 * p-01 (selected): 3 occupied / 1 vacant → 75%.
 * p-02:            1 occupied / 3 vacant → 25%.
 * Whole portfolio: 4 occupied / 4 vacant → 50%.
 * The three rates are distinct, so a scope mix-up cannot pass by coincidence.
 */
const ALL_UNITS = [
  { id: 'u-1', property_id: 'p-01', unit_number: '101', status: 'occupied' },
  { id: 'u-2', property_id: 'p-01', unit_number: '102', status: 'occupied' },
  { id: 'u-3', property_id: 'p-01', unit_number: '103', status: 'occupied' },
  { id: 'u-4', property_id: 'p-01', unit_number: '104', status: 'available' },
  { id: 'u-5', property_id: 'p-02', unit_number: '201', status: 'occupied' },
  { id: 'u-6', property_id: 'p-02', unit_number: '202', status: 'available' },
  { id: 'u-7', property_id: 'p-02', unit_number: '203', status: 'available' },
  { id: 'u-8', property_id: 'p-02', unit_number: '204', status: 'available' },
] as unknown as Unit[];

const contract = (id: string, unitId: string, propertyId: string) => ({
  id,
  unit_id: unitId,
  property_id: propertyId,
  tenant_id: `t-${id}`,
  start_date: '2025-01-01',
  end_date: '2026-12-31',
  status: 'active',
  monthly_rent: 400,
  deleted_at: null,
  properties: { id: propertyId, title: propertyId === 'p-01' ? 'برج الشروق' : 'برج النسيم' },
  units: { id: unitId, unit_number: unitId },
  tenants: { id: `t-${id}`, full_name: 'مستأجر' },
}) as unknown as ContractListItem;

const ALL_CONTRACTS = [
  contract('c-1', 'u-1', 'p-01'),
  contract('c-2', 'u-2', 'p-01'),
  contract('c-3', 'u-3', 'p-01'),
  contract('c-4', 'u-5', 'p-02'),
];

const expenseCalls: Array<Record<string, unknown>> = [];

vi.mock('@/features/financials/reports/financial-reporting/report-loaders', () => ({
  loadInvoices: vi.fn().mockResolvedValue([]),
  loadPayments: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/features/units/unit-service', () => ({
  listUnits: vi.fn(async () => ALL_UNITS),
}));
vi.mock('@/features/financials/reports/financialReportsService', () => ({
  // The document's own expense query for the benchmark: unscoped calls see
  // both properties, a scoped call would only ever see the selected one.
  getExpenseBreakdownReport: vi.fn(async (filters: Record<string, unknown>) => {
    expenseCalls.push(filters);
    const rows = [
      { propertyId: 'p-01', propertyTitle: 'برج الشروق', total: 300, count: 2 },
      { propertyId: 'p-02', propertyTitle: 'برج النسيم', total: 900, count: 3 },
    ];
    const scoped = filters.propertyId ? rows.filter((row) => row.propertyId === filters.propertyId) : rows;
    return {
      totalExpenses: scoped.reduce((sum, row) => sum + row.total, 0),
      expensesCount: scoped.length,
      byCategory: [],
      byProperty: scoped,
    };
  }),
  getFinancialPeriodSummaryReport: vi.fn().mockResolvedValue({
    invoiced: 1000, paid: 800, outstanding: 200, expenses: 0,
    netCash: 800, invoicesCount: 1, paymentsCount: 1, expensesCount: 0,
  }),
  getOverdueInvoicesReport: vi.fn().mockResolvedValue({ asOf: '2026-01-31', totalOverdue: 0, invoiceCount: 0, rows: [] }),
}));
vi.mock('../reports-collection-efficiency', () => ({
  getAuthoritativeReportsCollectionRate: vi.fn().mockResolvedValue(null),
}));

const { loadPropertyReportData } = await import('./professional-property-report');

/**
 * The workspace model handed to the document is ALREADY scoped by the active
 * filters — this fixture reproduces that faithfully (only p-01's occupancy row
 * is present), which is exactly the condition that made the benchmark vanish.
 */
function scopedModel(): ReportsWorkspaceModel {
  return {
    filters: { costCenterRows: [], ownerRows: [], contractRows: ALL_CONTRACTS },
    hero: { summary: null, collectionRate: 0 },
    sections: {
      overview: { summary: null },
      collections: { rows: [], collectionRate: null },
      overdue: { rows: [], agedReport: null },
      expenses: {
        report: {
          totalExpenses: 300,
          expensesCount: 2,
          byCategory: [],
          byProperty: [{ propertyId: 'p-01', propertyTitle: 'برج الشروق', total: 300, count: 2 }],
        },
      },
      occupancy: {
        // Scoped: the selected property only. This is the real shape.
        occupancyRows: [{
          property: 'برج الشروق', propertyId: 'p-01', shortPropertyId: 'p-01',
          hasTitle: true, occupied: 3, vacant: 1, nonRentable: 0,
        }],
        expiringRows: [],
        vacancyAnalytics: null,
      },
      maintenance: { rows: [] },
      propertyPerformance: {
        // The in-app benchmark is itself computed from the unfiltered
        // portfolio (see property-benchmark-wiring.test.tsx); the document
        // reuses it so screen and print can never disagree.
        benchmark: [
          { key: 'expense_per_occupied', label: 'مصروف لكل وحدة مشغولة', kind: 'amount', property: 100, portfolio: 900 },
        ],
      },
    },
  } as unknown as ReportsWorkspaceModel;
}

const filters = {
  from: '2026-02-01',
  to: '2026-02-28',
  asOf: '2026-02-28',
  propertyId: 'p-01',
} as unknown as ReportsFilterState;

describe('Property Golden Report — previous period uses the SAME scope as the current period', () => {
  it('reports the selected property\'s prior occupancy, not the portfolio\'s', async () => {
    const data = await loadPropertyReportData({ model: scopedModel(), filters });

    expect(data.previous).not.toBeNull();
    // p-01 alone = 75%. The portfolio = 50%. Reading 50 here is the bug.
    expect(data.previous?.occupancyRate).toBeCloseTo(75, 1);
    expect(data.previous?.occupancyRate).not.toBeCloseTo(50, 1);
  });

  it('derives the previous window from the same 4-unit population, not the 8-unit portfolio', async () => {
    const data = await loadPropertyReportData({ model: scopedModel(), filters });
    // Nothing changed between the windows in this fixture, so a correctly
    // scoped previous period must reproduce the current period exactly.
    const currentRate = (data.occupancy.occupied / data.occupancy.units) * 100;
    expect(currentRate).toBeCloseTo(75, 1);
    expect(data.previous?.occupancyRate).toBeCloseTo(currentRate, 1);
  });

  it('keeps the current period scoped to the same property (comparison is like-for-like)', async () => {
    const data = await loadPropertyReportData({ model: scopedModel(), filters });
    expect(data.occupancy.occupied).toBe(3);
    expect(data.occupancy.units).toBe(4);
    // The period-over-period delta must be 0 here. Any non-zero movement
    // would mean the two sides measured different populations.
    expect((data.previous?.occupancyRate ?? 0) - (data.occupancy.rate ?? 0)).toBeCloseTo(0, 1);
  });

});

describe('Property Golden Report — benchmark uses the UNFILTERED portfolio', () => {
  it('still produces a benchmark although the workspace rows are scoped to one property', async () => {
    const data = await loadPropertyReportData({ model: scopedModel(), filters });
    // Derived from the scoped rows this would be null — the exact regression.
    expect(data.portfolio).not.toBeNull();
  });

  it('benchmarks against the OTHER properties only', async () => {
    const data = await loadPropertyReportData({ model: scopedModel(), filters });
    // Rest of portfolio = p-02: 1 occupied of 4 = 25%.
    expect(data.portfolio?.occupancyRate).toBeCloseTo(25, 1);
    expect(data.portfolio?.totalUnits).toBe(4);
    expect(data.portfolio?.occupiedUnits).toBe(1);
    // Not the selected property's own 75%, and not the blended 50%.
    expect(data.portfolio?.occupancyRate).not.toBeCloseTo(75, 1);
    expect(data.portfolio?.occupancyRate).not.toBeCloseTo(50, 1);
  });

  it('benchmarks expense per occupied unit against the other properties', async () => {
    const data = await loadPropertyReportData({ model: scopedModel(), filters });
    // p-02: 900 / 1 occupied = 900. p-01's own is 300 / 3 = 100.
    expect(data.portfolio?.expensePerOccupiedUnit).toBeCloseTo(900, 1);
  });

  it('takes its expense benchmark from the unfiltered in-app benchmark, not the scoped expense report', async () => {
    const data = await loadPropertyReportData({ model: scopedModel(), filters });
    // The workspace expense report in the fixture only contains p-01 (300).
    // Reading it would give the property's own figure; the benchmark must be
    // the other properties' 900.
    expect(data.portfolio?.expensePerOccupiedUnit).toBeCloseTo(900, 1);
    expect(data.portfolio?.expensePerOccupiedUnit).not.toBeCloseTo(100, 1);
  });
});
