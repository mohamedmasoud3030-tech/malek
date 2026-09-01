import { describe, expect, it } from 'vitest';
import {
  buildPropertyAnalyticsBenchmark,
  buildPropertyAnalyticsComparison,
  buildPropertyAnalyticsExecutive,
  buildPropertyAnalyticsInsights,
  buildPropertyAnalyticsScope,
  perUnit,
  rateOf,
  selectAttentionProperties,
  type PropertyAnalyticsInput,
} from './property-analytics-model';
import type { OccupancyChartRow, PropertyPerformanceRow } from './reports-page.helpers';

const occupancyRow = (over: Partial<OccupancyChartRow> & { propertyId: string }): OccupancyChartRow => ({
  property: over.property ?? over.propertyId,
  propertyId: over.propertyId,
  shortPropertyId: '',
  hasTitle: true,
  occupied: over.occupied ?? 0,
  vacant: over.vacant ?? 0,
  nonRentable: over.nonRentable ?? 0,
});

const baseInput: PropertyAnalyticsInput = {
  occupancyRows: [
    occupancyRow({ propertyId: 'p1', property: 'برج الخوير', occupied: 6, vacant: 2, nonRentable: 2 }),
    occupancyRow({ propertyId: 'p2', property: 'مجمع الموالح', occupied: 8, vacant: 2, nonRentable: 0 }),
  ],
  expenseRows: [
    { propertyId: 'p1', propertyTitle: 'برج الخوير', total: 900, count: 4 },
    { propertyId: 'p2', propertyTitle: 'مجمع الموالح', total: 300, count: 2 },
  ],
  performanceRows: [],
  periodSummary: { invoiced: 5000, paid: 4000, outstanding: 1000 },
  overdueTotal: 800,
  expenseTotal: 1200,
  openMaintenanceCount: 3,
  expiringContractsCount: 2,
  longestVacancyDays: 75,
  vacancyReferenceRent: 1500,
};

describe('property analytics — unavailable is never zero', () => {
  it('returns null for a ratio without a valid denominator', () => {
    expect(rateOf(5, 0)).toBeNull();
    expect(rateOf(5, null)).toBeNull();
    expect(rateOf(null, 10)).toBeNull();
    expect(rateOf(5, 10)).toBe(50);
  });

  it('returns null for expense-per-occupied-unit when there are no occupied units', () => {
    expect(perUnit(1200, 0)).toBeNull();
    expect(perUnit(null, 10)).toBeNull();
    expect(perUnit(1200, 10)).toBe(120);
  });

  it('reports occupancy as unavailable when no unit universe exists', () => {
    expect(buildPropertyAnalyticsScope([]).occupancyRate).toBeNull();
  });

  it('keeps missing authoritative sources unavailable rather than zero', () => {
    const executive = buildPropertyAnalyticsExecutive({
      occupancyRows: [],
      expenseRows: [],
      performanceRows: [],
    });
    expect(executive.collected).toBeNull();
    expect(executive.due).toBeNull();
    expect(executive.overdue).toBeNull();
    expect(executive.expenses).toBeNull();
    expect(executive.expensePerOccupiedUnit).toBeNull();
    expect(executive.openMaintenance).toBeNull();
    expect(executive.vacancyReferenceRent).toBeNull();
  });
});

describe('property analytics — three-way occupancy semantics', () => {
  it('includes non-rentable units in the occupancy denominator without calling them vacant', () => {
    const scope = buildPropertyAnalyticsScope(baseInput.occupancyRows);
    expect(scope.units).toBe(20);
    expect(scope.occupied).toBe(14);
    expect(scope.vacant).toBe(4);
    expect(scope.nonRentable).toBe(2);
    expect(scope.occupancyRate).toBe(70);
  });
});

describe('property analytics — comparison semantics', () => {
  it('omits the comparison entirely when no previous period is available', () => {
    expect(buildPropertyAnalyticsComparison(baseInput)).toEqual([]);
  });

  it('uses percentage POINTS for rates and absolute differences for amounts', () => {
    const rows = buildPropertyAnalyticsComparison({
      ...baseInput,
      previous: { from: '2026-01-01', to: '2026-01-31', occupancyRate: 80, due: 4500, collected: 3500, overdue: 600, expenses: 1000 },
    });
    const occupancy = rows.find((row) => row.key === 'occupancy')!;
    expect(occupancy.kind).toBe('rate');
    expect(occupancy.change).toBe(-10); // 70% vs 80% → -10 POINTS, not -12.5%
    expect(occupancy.direction).toBe('down');

    const collected = rows.find((row) => row.key === 'collected')!;
    expect(collected.kind).toBe('amount');
    expect(collected.change).toBe(500);
    expect(collected.higherIsBetter).toBe(true);

    const overdue = rows.find((row) => row.key === 'overdue')!;
    expect(overdue.change).toBe(200);
    expect(overdue.higherIsBetter).toBe(false);
  });

  it('marks a comparison row unavailable rather than zero when one side is missing', () => {
    const rows = buildPropertyAnalyticsComparison({
      ...baseInput,
      expenseTotal: null,
      previous: { from: '2026-01-01', to: '2026-01-31', occupancyRate: null, due: null, collected: 3500, overdue: null, expenses: 1000 },
    });
    const occupancy = rows.find((row) => row.key === 'occupancy')!;
    expect(occupancy.change).toBeNull();
    expect(occupancy.direction).toBeNull();
    const expenses = rows.find((row) => row.key === 'expenses')!;
    expect(expenses.current).toBeNull();
    expect(expenses.change).toBeNull();
  });
});

describe('property analytics — portfolio benchmark', () => {
  it('is omitted at portfolio scope', () => {
    expect(buildPropertyAnalyticsBenchmark(baseInput)).toEqual([]);
  });

  it('compares a selected property with the rest of the managed portfolio', () => {
    const rows = buildPropertyAnalyticsBenchmark({ ...baseInput, selectedPropertyId: 'p1' });
    const occupancy = rows.find((row) => row.key === 'occupancy')!;
    expect(occupancy.property).toBe(60); // 6 / (6+2+2)
    expect(occupancy.portfolio).toBe(80); // 8 / 10
    const expense = rows.find((row) => row.key === 'expense_per_occupied')!;
    expect(expense.property).toBe(150);
    expect(expense.portfolio).toBe(37.5);
  });

  it('keeps the selected property scoped while benchmarking against an unscoped portfolio population', () => {
    const selectedOccupancy = [baseInput.occupancyRows[0]];
    const selectedExpenses = [baseInput.expenseRows[0]];
    const rows = buildPropertyAnalyticsBenchmark({
      ...baseInput,
      occupancyRows: selectedOccupancy,
      expenseRows: selectedExpenses,
      benchmarkOccupancyRows: baseInput.occupancyRows,
      benchmarkExpenseRows: baseInput.expenseRows,
      selectedPropertyId: 'p1',
    });

    const occupancy = rows.find((row) => row.key === 'occupancy')!;
    expect(occupancy.property).toBe(60);
    expect(occupancy.portfolio).toBe(80);

    const expense = rows.find((row) => row.key === 'expense_per_occupied')!;
    expect(expense.property).toBe(150);
    expect(expense.portfolio).toBe(37.5);
  });

  it('is omitted when there is no other property to compare with', () => {
    expect(buildPropertyAnalyticsBenchmark({
      ...baseInput,
      occupancyRows: [occupancyRow({ propertyId: 'p1', occupied: 1 })],
      selectedPropertyId: 'p1',
    })).toEqual([]);
  });
});

describe('property analytics — deterministic insights', () => {
  it('explains only already-computed figures and never predicts', () => {
    const insights = buildPropertyAnalyticsInsights({
      ...baseInput,
      previous: { from: '2026-01-01', to: '2026-01-31', occupancyRate: 80, due: 4500, collected: 3500, overdue: 600, expenses: 1000 },
    });
    const keys = insights.map((insight) => insight.key);
    expect(keys).toContain('occupancy_down');
    expect(keys).toContain('overdue_up');
    expect(keys).toContain('expenses_up');
    expect(keys).toContain('vacancy_duration');
    expect(keys).toContain('maintenance_pressure');
    expect(keys).toContain('expiring_contracts');
    for (const insight of insights) {
      expect(insight.text).not.toMatch(/احتمال|توقع|تنبؤ/);
    }
  });

  it('states that a comparison is unavailable instead of implying no change', () => {
    const insights = buildPropertyAnalyticsInsights(baseInput);
    expect(insights.map((insight) => insight.key)).toContain('no_comparison');
  });

  it('falls back to a truthful neutral statement when nothing needs attention', () => {
    const insights = buildPropertyAnalyticsInsights({
      occupancyRows: [occupancyRow({ propertyId: 'p1', occupied: 10 })],
      expenseRows: [],
      performanceRows: [],
      previous: { from: '2026-01-01', to: '2026-01-31', occupancyRate: 100, due: null, collected: null, overdue: null, expenses: null },
    });
    expect(insights.map((insight) => insight.key)).toEqual(['stable']);
  });
});

describe('property analytics — operational prioritisation', () => {
  it('surfaces only properties that are not stable, in the given order', () => {
    const rows = [
      { propertyId: 'a', priority: 'متابعة فورية' },
      { propertyId: 'b', priority: 'مراجعة' },
      { propertyId: 'c', priority: 'مستقر' },
    ] as unknown as PropertyPerformanceRow[];
    expect(selectAttentionProperties(rows).map((row) => row.propertyId)).toEqual(['a', 'b']);
  });
});
