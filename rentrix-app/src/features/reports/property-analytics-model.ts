/**
 * Property Analytics — deterministic decision model.
 *
 * The Property Analytics workspace answers four questions and nothing else:
 * how is the property/portfolio performing, WHAT CHANGED versus the previous
 * comparable period, what needs attention, and where should the office act.
 *
 * Everything in this module is pure and deterministic. It never invents a
 * figure, never predicts, and never publishes `0` for an undefined metric:
 * an unavailable ratio (no denominator, no authoritative source, no previous
 * period) is `null`, and the presentation layer renders it as `—`.
 *
 * Financial semantics preserved here:
 *  - occupancy denominator = occupied + vacant + nonRentable (three-way);
 *    non-rentable units are never counted as vacant stock.
 *  - "reference rent" of a vacant unit is a reference value, never income
 *    and never a receivable.
 *  - overdue ≠ outstanding; the overdue figure comes from the arrears
 *    read model as-of, not from period invoicing.
 *  - maintenance cost that has not been posted as an expense is operational
 *    pressure, not a financial cost — it is never added to expenses.
 *  - rate changes are expressed in percentage POINTS; amount changes are
 *    absolute differences. No percent-of-percent anywhere.
 *  - the priority score is an operational prioritisation ordering, never a
 *    financial risk probability.
 */
import type { OccupancyChartRow, PropertyPerformanceRow } from './reports-page.helpers';

export type PropertyExpenseRow = Readonly<{
  propertyId: string;
  propertyTitle: string | null;
  total: number;
  count: number;
}>;

/** A metric that may legitimately have no value. `null` means UNAVAILABLE, never zero. */
export type MetricValue = number | null;

export type PropertyAnalyticsScope = Readonly<{
  /** Managed properties inside the current filter scope. */
  properties: number;
  units: number;
  occupied: number;
  vacant: number;
  nonRentable: number;
  /** Percent — `null` when there is no unit universe to divide by. */
  occupancyRate: MetricValue;
}>;

export type PropertyAnalyticsExecutive = Readonly<{
  scope: PropertyAnalyticsScope;
  /** Period collections from the authoritative period summary (null when unavailable). */
  collected: MetricValue;
  /** Period invoiced/due (null when unavailable). */
  due: MetricValue;
  /** Overdue as-of from the arrears read model (null when unavailable). */
  overdue: MetricValue;
  /** Posted expenses for the period (null when unavailable). */
  expenses: MetricValue;
  /** Expense per OCCUPIED unit — null when there are no occupied units. */
  expensePerOccupiedUnit: MetricValue;
  /** Open maintenance requests as-of (deterministic count). */
  openMaintenance: MetricValue;
  /** Contracts expiring inside the follow-up window. */
  expiringContracts: MetricValue;
  /** Longest current vacancy in days — null when nothing is vacant. */
  longestVacancyDays: MetricValue;
  /**
   * Reference rent of currently vacant units. This is a REFERENCE exposure
   * figure for letting decisions — it is neither income nor a receivable.
   */
  vacancyReferenceRent: MetricValue;
}>;

export type ComparisonKind = 'amount' | 'count' | 'rate';

export type PropertyAnalyticsComparisonRow = Readonly<{
  key: string;
  label: string;
  kind: ComparisonKind;
  current: MetricValue;
  previous: MetricValue;
  /** Absolute change for amounts/counts, percentage-POINT change for rates. */
  change: MetricValue;
  /** `up` / `down` / `flat`; `null` when the comparison is unavailable. */
  direction: 'up' | 'down' | 'flat' | null;
  /** Whether an increase is a good outcome for this metric. */
  higherIsBetter: boolean;
}>;

export type PropertyAnalyticsBenchmarkRow = Readonly<{
  key: string;
  label: string;
  kind: ComparisonKind;
  property: MetricValue;
  portfolio: MetricValue;
}>;

export type PropertyAnalyticsInsight = Readonly<{
  key: string;
  text: string;
  tone: 'good' | 'warning' | 'critical' | 'neutral';
}>;

export type PropertyAnalyticsPreviousPeriod = Readonly<{
  from: string;
  to: string;
  occupancyRate: MetricValue;
  due: MetricValue;
  collected: MetricValue;
  overdue: MetricValue;
  expenses: MetricValue;
}>;

export type PropertyAnalyticsInput = Readonly<{
  /** Current report scope only. */
  occupancyRows: readonly OccupancyChartRow[];
  /** Current report scope only. */
  expenseRows: readonly PropertyExpenseRow[];
  performanceRows: readonly PropertyPerformanceRow[];
  /**
   * Optional full managed-portfolio population used only for single-property
   * benchmarking. It must remain unscoped by `selectedPropertyId`; otherwise
   * the selected property would be compared with an empty population.
   */
  benchmarkOccupancyRows?: readonly OccupancyChartRow[];
  /** Optional full-portfolio expense population. Omit when that authority is not loaded. */
  benchmarkExpenseRows?: readonly PropertyExpenseRow[];
  /** Authoritative period summary (already scoped by the workspace filters). */
  periodSummary?: Readonly<{ invoiced: number; paid: number; outstanding: number }> | null;
  /** Overdue as-of total; `null`/undefined when the arrears source is unavailable. */
  overdueTotal?: MetricValue;
  /** Posted expenses total; `null`/undefined when the expense source is unavailable. */
  expenseTotal?: MetricValue;
  openMaintenanceCount?: MetricValue;
  expiringContractsCount?: MetricValue;
  longestVacancyDays?: MetricValue;
  vacancyReferenceRent?: MetricValue;
  previous?: PropertyAnalyticsPreviousPeriod | null;
  /** Set when a single property is selected — enables the portfolio benchmark. */
  selectedPropertyId?: string | null;
}>;

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** Ratio helper: returns `null` (unavailable) instead of a fake zero. */
export function rateOf(numerator: number | null | undefined, denominator: number | null | undefined): MetricValue {
  if (numerator == null || denominator == null) return null;
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return round1((numerator / denominator) * 100);
}

/** Per-unit helper: `null` when there is no valid unit denominator. */
export function perUnit(total: number | null | undefined, units: number | null | undefined): MetricValue {
  if (total == null || units == null || units <= 0) return null;
  return total / units;
}

export function buildPropertyAnalyticsScope(rows: readonly OccupancyChartRow[]): PropertyAnalyticsScope {
  const occupied = rows.reduce((sum, row) => sum + row.occupied, 0);
  const vacant = rows.reduce((sum, row) => sum + row.vacant, 0);
  const nonRentable = rows.reduce((sum, row) => sum + (row.nonRentable ?? 0), 0);
  const units = occupied + vacant + nonRentable;
  return {
    properties: rows.length,
    units,
    occupied,
    vacant,
    nonRentable,
    occupancyRate: rateOf(occupied, units),
  };
}

export function buildPropertyAnalyticsExecutive(input: PropertyAnalyticsInput): PropertyAnalyticsExecutive {
  const scope = buildPropertyAnalyticsScope(input.occupancyRows);
  const expenses = input.expenseTotal ?? null;
  return {
    scope,
    collected: input.periodSummary?.paid ?? null,
    due: input.periodSummary?.invoiced ?? null,
    overdue: input.overdueTotal ?? null,
    expenses,
    expensePerOccupiedUnit: perUnit(expenses, scope.occupied),
    openMaintenance: input.openMaintenanceCount ?? null,
    expiringContracts: input.expiringContractsCount ?? null,
    longestVacancyDays: input.longestVacancyDays ?? null,
    vacancyReferenceRent: input.vacancyReferenceRent ?? null,
  };
}

function comparisonRow(params: {
  key: string;
  label: string;
  kind: ComparisonKind;
  current: MetricValue;
  previous: MetricValue;
  higherIsBetter: boolean;
}): PropertyAnalyticsComparisonRow {
  const { current, previous } = params;
  const available = current != null && previous != null;
  const change = available ? round1(current - previous) : null;
  return {
    key: params.key,
    label: params.label,
    kind: params.kind,
    current,
    previous,
    change,
    direction: change == null ? null : change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
    higherIsBetter: params.higherIsBetter,
  };
}

/**
 * Current vs previous comparable period. Returns an EMPTY list when no
 * previous period is available — a missing comparison is omitted, never
 * rendered as a change of zero.
 */
export function buildPropertyAnalyticsComparison(input: PropertyAnalyticsInput): readonly PropertyAnalyticsComparisonRow[] {
  const previous = input.previous;
  if (!previous) return [];
  const executive = buildPropertyAnalyticsExecutive(input);
  const rows = [
    comparisonRow({ key: 'occupancy', label: 'نسبة الإشغال', kind: 'rate', current: executive.scope.occupancyRate, previous: previous.occupancyRate, higherIsBetter: true }),
    comparisonRow({ key: 'collected', label: 'المحصل للفترة', kind: 'amount', current: executive.collected, previous: previous.collected, higherIsBetter: true }),
    comparisonRow({ key: 'due', label: 'المستحق للفترة', kind: 'amount', current: executive.due, previous: previous.due, higherIsBetter: true }),
    comparisonRow({ key: 'overdue', label: 'المتأخرات', kind: 'amount', current: executive.overdue, previous: previous.overdue, higherIsBetter: false }),
    comparisonRow({ key: 'expenses', label: 'المصروفات المسجلة', kind: 'amount', current: executive.expenses, previous: previous.expenses, higherIsBetter: false }),
  ];
  // Drop rows where neither side is available: an all-unavailable row adds no
  // information and would only look like missing data twice.
  return rows.filter((row) => row.current != null || row.previous != null);
}

/**
 * Portfolio benchmark for a SINGLE selected property. The selected property's
 * current figures remain scoped, while the comparison population comes from an
 * explicitly unscoped managed-portfolio read model when supplied. This avoids
 * the subtle bug where applying `propertyId` before benchmarking made the
 * "rest of portfolio" population empty.
 */
export function buildPropertyAnalyticsBenchmark(input: PropertyAnalyticsInput): readonly PropertyAnalyticsBenchmarkRow[] {
  const propertyId = input.selectedPropertyId;
  if (!propertyId) return [];

  const occupancyUniverse = input.benchmarkOccupancyRows ?? input.occupancyRows;
  const own = input.occupancyRows.find((row) => row.propertyId === propertyId)
    ?? occupancyUniverse.find((row) => row.propertyId === propertyId);
  const others = occupancyUniverse.filter((row) => row.propertyId !== propertyId);
  if (!own || others.length === 0) return [];

  const ownUnits = own.occupied + own.vacant + (own.nonRentable ?? 0);
  const otherOccupied = others.reduce((sum, row) => sum + row.occupied, 0);
  const otherVacant = others.reduce((sum, row) => sum + row.vacant, 0);
  const otherNonRentable = others.reduce((sum, row) => sum + (row.nonRentable ?? 0), 0);
  const otherUnits = otherOccupied + otherVacant + otherNonRentable;

  const expenseUniverse = input.benchmarkExpenseRows ?? input.expenseRows;
  const ownExpenses = input.expenseRows.find((row) => row.propertyId === propertyId)?.total
    ?? expenseUniverse.find((row) => row.propertyId === propertyId)?.total
    ?? null;
  const hasOtherExpenseSource = expenseUniverse.some((row) => row.propertyId !== propertyId);
  const otherExpenses = hasOtherExpenseSource
    ? expenseUniverse.filter((row) => row.propertyId !== propertyId).reduce((sum, row) => sum + row.total, 0)
    : null;

  return [
    {
      key: 'occupancy',
      label: 'نسبة الإشغال',
      kind: 'rate',
      property: rateOf(own.occupied, ownUnits),
      portfolio: rateOf(otherOccupied, otherUnits),
    },
    {
      key: 'vacancy_share',
      label: 'نسبة الوحدات الشاغرة',
      kind: 'rate',
      property: rateOf(own.vacant, ownUnits),
      portfolio: rateOf(otherVacant, otherUnits),
    },
    {
      key: 'expense_per_occupied',
      label: 'مصروف لكل وحدة مشغولة',
      kind: 'amount',
      property: perUnit(ownExpenses, own.occupied),
      portfolio: otherExpenses != null ? perUnit(otherExpenses, otherOccupied) : null,
    },
  ];
}

/**
 * Deterministic insights. Each sentence EXPLAINS an already-computed figure —
 * no insight introduces a number that is not in the model above, and no
 * insight is generated when its inputs are unavailable.
 */
export function buildPropertyAnalyticsInsights(input: PropertyAnalyticsInput): readonly PropertyAnalyticsInsight[] {
  const executive = buildPropertyAnalyticsExecutive(input);
  const comparison = buildPropertyAnalyticsComparison(input);
  const byKey = new Map(comparison.map((row) => [row.key, row] as const));
  const insights: PropertyAnalyticsInsight[] = [];

  const occupancyChange = byKey.get('occupancy')?.change ?? null;
  if (occupancyChange != null && occupancyChange <= -1) {
    insights.push({
      key: 'occupancy_down',
      text: `تراجع الإشغال ${Math.abs(occupancyChange)} نقطة مقارنة بالفترة السابقة المماثلة؛ راجع الشواغر والتسعير.`,
      tone: 'critical',
    });
  } else if (occupancyChange != null && occupancyChange >= 1) {
    insights.push({
      key: 'occupancy_up',
      text: `تحسن الإشغال ${occupancyChange} نقطة مقارنة بالفترة السابقة المماثلة.`,
      tone: 'good',
    });
  }

  const overdueChange = byKey.get('overdue')?.change ?? null;
  if (overdueChange != null && overdueChange > 0) {
    insights.push({
      key: 'overdue_up',
      text: `ارتفعت المتأخرات بمقدار ${round1(overdueChange)} ر.ع مقارنة بالفترة السابقة؛ ابدأ بأقدم الأعمار.`,
      tone: 'critical',
    });
  } else if (overdueChange != null && overdueChange < 0) {
    insights.push({
      key: 'overdue_down',
      text: `انخفضت المتأخرات بمقدار ${Math.abs(round1(overdueChange))} ر.ع مقارنة بالفترة السابقة.`,
      tone: 'good',
    });
  }

  const expensesChange = byKey.get('expenses')?.change ?? null;
  if (expensesChange != null && expensesChange > 0) {
    insights.push({
      key: 'expenses_up',
      text: `ارتفعت المصروفات المسجلة بمقدار ${round1(expensesChange)} ر.ع مقارنة بالفترة السابقة.`,
      tone: 'warning',
    });
  }

  const totalExpenses = input.expenseRows.reduce((sum, row) => sum + row.total, 0);
  const topExpense = [...input.expenseRows].sort((a, b) => b.total - a.total)[0];
  const concentration = topExpense ? rateOf(topExpense.total, totalExpenses) : null;
  if (topExpense && concentration != null && concentration > 60 && input.expenseRows.length > 1) {
    insights.push({
      key: 'expense_concentration',
      text: `تتركز ${concentration}% من المصروفات المسجلة في ${topExpense.propertyTitle ?? 'عقار واحد'}؛ راجع أسباب التركيز قبل اعتماد قرارات صيانة أو تسعير.`,
      tone: 'warning',
    });
  }

  if (executive.longestVacancyDays != null && executive.longestVacancyDays >= 60) {
    insights.push({
      key: 'vacancy_duration',
      text: `أطول شغور قائم ${executive.longestVacancyDays} يوم؛ مدة الشغور تتجاوز نافذة المتابعة المعتادة.`,
      tone: 'warning',
    });
  }

  if (executive.openMaintenance != null && executive.openMaintenance > 0) {
    insights.push({
      key: 'maintenance_pressure',
      text: `${executive.openMaintenance} طلب صيانة مفتوح حتى تاريخ الإعداد — ضغط تشغيلي وليس مصروفًا ماليًا حتى يُرحّل كمصروف.`,
      tone: executive.openMaintenance >= 5 ? 'critical' : 'warning',
    });
  }

  if (executive.expiringContracts != null && executive.expiringContracts > 0) {
    insights.push({
      key: 'expiring_contracts',
      text: `${executive.expiringContracts} عقد يقترب من الانتهاء ضمن نافذة المتابعة؛ حدد قرار التجديد مبكرًا.`,
      tone: 'warning',
    });
  }

  if (!input.previous) {
    insights.push({
      key: 'no_comparison',
      text: 'لا تتوفر فترة سابقة قابلة للمقارنة ضمن النطاق الحالي؛ تُعرض مؤشرات الفترة الحالية دون مقارنة.',
      tone: 'neutral',
    });
  }

  if (insights.length === 0) {
    insights.push({
      key: 'stable',
      text: 'لا توجد مؤشرات تستدعي إجراءً فوريًا ضمن البيانات المعتمدة لهذا النطاق.',
      tone: 'neutral',
    });
  }

  return insights;
}

/** Properties that need attention first — operational ordering, not a risk probability. */
export function selectAttentionProperties(
  rows: readonly PropertyPerformanceRow[],
  limit = 3,
): readonly PropertyPerformanceRow[] {
  return rows.filter((row) => row.priority !== 'مستقر').slice(0, limit);
}
