import type { ContractListItem } from '@/features/contracts/services/contractService';
import type { Maintenance } from '@/features/maintenance/maintenance-service';
import type { CanonicalContractStatus } from '@/lib/contractStatus';
import { isContractStatus, normalizeContractStatus } from '@/lib/contractStatus';
import type {
  AgedReceivablesBucket,
  DailyCollectionReportRow,
  OverdueInvoiceReportRow,
  OverdueInvoicesReport,
  PropertyCollectionBreakdownRow,
} from '@/features/financials/reports/financialReportsService';
import { listPropertyTitles, type PropertyTitleRow } from '@/features/properties/property-service';
import type { Unit } from '@/types/domain';
import { buildCsv, withUtf8Bom, type CsvRow } from '@/lib/csvExport';
import { toDateOnlyISO } from '@/lib/formatters';
import { useQuery } from '@tanstack/react-query';

export type FilterState = Readonly<{ from: string; to: string; asOf: string; costCenterId: string; ownerId: string; contractId: string }>;

export type AgingBucketChartRow = { bucket: string; total: number; invoiceCount: number };
export type OccupancyChartRow = {
  /** Display label — property title when available, otherwise 'عقار بدون اسم'. */
  property: string;
  /** Raw, full property id. Used as a small helper text under the label. */
  propertyId: string;
  /** Short id (first 8 chars) used as a tiny secondary helper when no title. */
  shortPropertyId: string;
  /** Whether the row is showing the title or the unnamed fallback. */
  hasTitle: boolean;
  occupied: number;
  vacant: number;
  /**
   * Units that are not rentable right now (maintenance, reserved, or any
   * status that is neither occupied nor genuinely available for lease).
   * They are NOT vacant — a non-rentable unit must not be counted as
   * available stock or as an opportunity for letting.
   */
  nonRentable: number;
};
export type PaymentsTrendRow = { month: string; collections: number; overdue: number };

export type PropertyPerformanceRow = Readonly<{
  propertyId: string;
  propertyTitle: string;
  referenceRevenue: number;
  occupiedUnits: number;
  vacantUnits: number;
  nonRentableUnits: number;
  occupancyRate: number;
  longestVacancyDays: number;
  collected: number;
  overdue: number;
  expenses: number;
  maintenanceCost: number;
  openMaintenanceCount: number;
  riskScore: number;
  priority: 'متابعة فورية' | 'مراجعة' | 'مستقر';
}>;

type MutablePropertyPerformanceDraft = {
  propertyId: string;
  propertyTitle: string;
  referenceRevenue: number;
  occupiedUnits: number;
  vacantUnits: number;
  nonRentableUnits: number;
  longestVacancyDays: number;
  collected: number;
  overdue: number;
  expenses: number;
  maintenanceCost: number;
  openMaintenanceCount: number;
};

type PropertyPerformanceParams = Readonly<{
  occupancyRows: readonly OccupancyChartRow[];
  contracts: readonly ContractListItem[];
  /** Complete, paginated report read model for the full selected period. */
  collectionRows: readonly PropertyCollectionBreakdownRow[];
  period: Readonly<{ from: string; to: string; asOf: string }>;
  overdueRows: readonly OverdueInvoiceReportRow[];
  expenseRows: readonly { propertyId: string; propertyTitle: string | null; total: number; count: number }[];
  maintenanceRows: readonly Maintenance[];
  vacancyRows: readonly { propertyId: string; daysVacant: number }[];
}>;

function ensurePropertyPerformanceRow(
  rowsByProperty: Map<string, MutablePropertyPerformanceDraft>,
  propertyId: string | null | undefined,
  fallbackTitle: string | null | undefined,
) {
  const id = propertyId || 'unassigned';
  const existing = rowsByProperty.get(id);
  if (existing) {
    if (existing.propertyTitle === 'عقار غير محدد' && fallbackTitle?.trim()) existing.propertyTitle = fallbackTitle.trim();
    return existing;
  }
  const row = {
    propertyId: id,
    propertyTitle: fallbackTitle?.trim() || 'عقار غير محدد',
    referenceRevenue: 0,
    occupiedUnits: 0,
    vacantUnits: 0,
    nonRentableUnits: 0,
    longestVacancyDays: 0,
    collected: 0,
    overdue: 0,
    expenses: 0,
    maintenanceCost: 0,
    openMaintenanceCount: 0,
  };
  rowsByProperty.set(id, row);
  return row;
}

function dateOnly(value: string | null | undefined) {
  return value?.slice(0, 10) ?? '';
}

function dateIsOnOrBefore(value: string | null | undefined, dateTo: string) {
  const normalized = dateOnly(value);
  return Boolean(normalized && normalized <= dateTo);
}

function dateIsWithinPeriod(value: string | null | undefined, period: Pick<PropertyPerformanceParams['period'], 'from' | 'to'>) {
  const normalized = dateOnly(value);
  return Boolean(normalized && normalized >= period.from && normalized <= period.to);
}

function isOpenMaintenanceRequest(request: Maintenance) {
  return !['resolved', 'closed', 'cancelled'].includes(String(request.status ?? '').toLowerCase());
}

function isCompletedMaintenanceRequest(request: Maintenance) {
  return ['resolved', 'closed'].includes(String(request.status ?? '').toLowerCase());
}

function getMaintenanceCostDate(request: Maintenance) {
  return request.completed_at ?? request.resolved_at ?? request.request_date ?? request.created_at;
}

/**
 * Current status alone cannot answer a historical "as of" question. A request
 * closed after the selected date was still open at that date; a terminal row
 * without a terminal timestamp is deliberately excluded rather than guessed.
 */
function wasMaintenanceRequestOpenAsOf(request: Maintenance, asOf: string) {
  if (!dateIsOnOrBefore(request.request_date ?? request.created_at, asOf)) return false;
  if (isOpenMaintenanceRequest(request)) return true;

  const terminalDate = request.cancelled_at ?? request.resolved_at ?? request.completed_at;
  return Boolean(terminalDate && dateOnly(terminalDate) > asOf);
}

/**
 * Decision report model for property/unit performance. It intentionally merges
 * the operational read models that used to appear as separate report islands:
 * reference rent, occupancy/vacancy, collections, arrears, expenses, and
 * maintenance impact are all visible in one sortable row per property.
 */
export function buildPropertyPerformanceRows({
  occupancyRows,
  contracts,
  collectionRows,
  period,
  overdueRows,
  expenseRows,
  maintenanceRows,
  vacancyRows,
}: PropertyPerformanceParams): PropertyPerformanceRow[] {
  const rowsByProperty = new Map<string, MutablePropertyPerformanceDraft>();

  for (const row of occupancyRows) {
    const property = ensurePropertyPerformanceRow(rowsByProperty, row.propertyId, row.property);
    property.occupiedUnits += row.occupied;
    property.vacantUnits += row.vacant;
    property.nonRentableUnits += row.nonRentable ?? 0;
  }

  for (const contract of contracts) {
    if (!isContractStatus(contract.status, 'active')) continue;
    const property = ensurePropertyPerformanceRow(rowsByProperty, contract.property_id, contract.properties?.title);
    property.referenceRevenue += contract.rent_amount ?? 0;
  }

  for (const collection of collectionRows) {
    const property = ensurePropertyPerformanceRow(rowsByProperty, collection.propertyId, collection.propertyTitle);
    property.collected += collection.totalPaid;
  }

  for (const overdue of overdueRows) {
    const property = ensurePropertyPerformanceRow(rowsByProperty, overdue.propertyId, overdue.propertyTitle);
    property.overdue += overdue.remainingAmount;
  }

  for (const expense of expenseRows) {
    const property = ensurePropertyPerformanceRow(rowsByProperty, expense.propertyId, expense.propertyTitle);
    property.expenses += expense.total;
  }

  for (const request of maintenanceRows) {
    const property = ensurePropertyPerformanceRow(rowsByProperty, request.property_id, null);
    // Closed maintenance normally creates a real expense row. Do not add those
    // costs again here; only surface in-period maintenance cost that has not
    // been posted as an expense yet, so operational impact is visible without
    // inflating property cost.
    if (
      isCompletedMaintenanceRequest(request)
      && !request.expense_id
      && dateIsWithinPeriod(getMaintenanceCostDate(request), period)
    ) {
      property.maintenanceCost += request.cost ?? 0;
    }
    if (wasMaintenanceRequestOpenAsOf(request, period.asOf)) {
      property.openMaintenanceCount += 1;
    }
  }

  for (const vacancy of vacancyRows) {
    const property = ensurePropertyPerformanceRow(rowsByProperty, vacancy.propertyId, null);
    property.longestVacancyDays = Math.max(property.longestVacancyDays, vacancy.daysVacant);
  }

  return Array.from(rowsByProperty.values())
    .map((row) => {
      const totalUnits = row.occupiedUnits + row.vacantUnits + row.nonRentableUnits;
      const occupancyRate = totalUnits > 0 ? (row.occupiedUnits / totalUnits) * 100 : 0;
      const overduePressure = row.referenceRevenue > 0 ? Math.min(40, (row.overdue / row.referenceRevenue) * 30) : row.overdue > 0 ? 25 : 0;
      const vacancyPressure = Math.min(30, row.vacantUnits * 6 + Math.max(0, row.longestVacancyDays - 30) / 3);
      const maintenancePressure = Math.min(20, row.openMaintenanceCount * 4);
      const expensePressure = row.collected > 0 ? Math.min(10, (row.expenses / row.collected) * 8) : row.expenses > 0 ? 8 : 0;
      const riskScore = Math.round(overduePressure + vacancyPressure + maintenancePressure + expensePressure);
      return {
        ...row,
        occupancyRate,
        riskScore,
        priority: riskScore >= 45 ? 'متابعة فورية' : riskScore >= 25 ? 'مراجعة' : 'مستقر',
      } satisfies PropertyPerformanceRow;
    })
    .sort((a, b) => b.riskScore - a.riskScore || b.overdue - a.overdue || a.propertyTitle.localeCompare(b.propertyTitle, 'ar'));
}
export type RentRollReportRow = {
  contractId: string;
  contractReference?: string | null;
  tenantName: string;
  propertyTitle: string;
  unitNumber: string;
  rentAmount: number;
  paymentCycle: string;
  statusLabel: string;
  startDate: string;
  endDate: string;
};

export const latestReceiptLimit = 100;
export const expiringContractWindowDays = 60;
export const agingBucketKeys: Array<AgedReceivablesBucket['key']> = ['current', 'days_1_30', 'days_31_60', 'days_61_90', 'days_90_plus'];
// Keyed by canonical status: rows are normalised with
// `normalizeContractStatus` before lookup, so the legacy 'ACTIVE'/'ENDED'
// spellings the database still permits never reach this map.
export const contractStatusLabels: Record<CanonicalContractStatus, string> = {
  draft: 'مسودة',
  active: 'نشط',
  expired: 'منتهي',
  terminated: 'منهى',
};

const paymentCycleLabels: Record<ContractListItem['payment_cycle'], string> = {
  monthly: 'شهري',
  quarterly: 'ربع سنوي',
  semi_annual: 'نصف سنوي',
  annual: 'سنوي',
};

function monthKey(date: string) {
  return date.slice(0, 7);
}

function valueOrDash(value: string | null | undefined) {
  return value?.trim() ? value : '—';
}

export function toDateInputValue(date: Date) {
  return toDateOnlyISO(date);
}

export function getTodayLocalDateString() {
  return toDateInputValue(new Date());
}

export function buildReportCsvFilename(reportSlug: string) {
  return `${reportSlug}-${getTodayLocalDateString()}.csv`;
}

export function getCurrentMonthFilters(): FilterState {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const todayValue = getTodayLocalDateString();

  return {
    from: toDateInputValue(firstDay),
    to: todayValue,
    asOf: todayValue,
    costCenterId: '',
    ownerId: '',
    contractId: '',
  };
}

export function downloadCsv(filename: string, rows: CsvRow[]) {
  const blob = new Blob([withUtf8Bom(buildCsv(rows))], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

export function isWithinDateRange(value: string, filters: FilterState) {
  return value >= filters.from && value <= filters.to;
}

export function toFinancialSummaryCsv(summary: Readonly<{ invoiced: number; paid: number; outstanding: number; expenses: number; netCash: number }>): CsvRow[] {
  return [
    { metric: 'invoiced', amount: summary.invoiced },
    { metric: 'paid', amount: summary.paid },
    { metric: 'outstanding', amount: summary.outstanding },
    { metric: 'expenses', amount: summary.expenses },
    { metric: 'netCash', amount: summary.netCash },
  ];
}

export function toDailyCollectionCsv(rows: DailyCollectionReportRow[]): CsvRow[] {
  return rows.map((row) => ({
    paymentDate: row.paymentDate,
    totalPaid: row.totalPaid,
    paymentsCount: row.paymentsCount,
    cash: row.methodTotals.cash,
    bankTransfer: row.methodTotals.bank_transfer,
    card: row.methodTotals.card,
    check: row.methodTotals.check,
    other: row.methodTotals.other,
  }));
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function normalizeUnitStatusForOccupancy(status: unknown): 'occupied' | 'available' | 'nonRentable' {
  const normalized = String(status ?? '').trim().toLowerCase();
  if (normalized === 'occupied' || normalized === 'rented') return 'occupied';
  if (normalized === 'available') return 'available';
  return 'nonRentable';
}

function toDateOnlyTimestamp(value: string) {
  return Date.parse(`${value}T00:00:00.000Z`);
}

export type ExpiringContractRow = Readonly<{
  contractId: string;
  tenantName: string;
  propertyTitle: string;
  unitNumber: string;
  endDate: string;
  daysRemaining: number;
  monthlyRent: number;
}>;

export function buildExpiringContractsRows(contracts: ContractListItem[], fromDate: Date): ExpiringContractRow[] {
  const todayValue = toDateInputValue(fromDate);
  const cutoffValue = toDateInputValue(addDays(fromDate, expiringContractWindowDays));

  return contracts
    .filter((contract) => isContractStatus(contract.status, 'active') && contract.end_date >= todayValue && contract.end_date <= cutoffValue)
    .sort((a, b) => a.end_date.localeCompare(b.end_date))
    .slice(0, 12)
    .map((contract) => ({
      contractId: contract.id,
      tenantName: contract.people?.full_name ?? '—',
      propertyTitle: contract.properties?.title ?? '—',
      unitNumber: contract.units?.unit_number ?? '—',
      endDate: contract.end_date,
      daysRemaining: Math.max(0, Math.ceil((toDateOnlyTimestamp(contract.end_date) - toDateOnlyTimestamp(todayValue)) / (24 * 60 * 60 * 1000))),
      monthlyRent: contract.rent_amount ?? 0,
    }));
}

export function usePropertyTitles(options?: Readonly<{ enabled?: boolean }>) {
  return useQuery({
    queryKey: ['reports', 'propertyTitles'],
    queryFn: async (): Promise<PropertyTitleRow[]> => listPropertyTitles(),
    staleTime: 60_000,
    enabled: options?.enabled ?? true,
  });
}

/**
 * Per-property occupancy aggregation. Uses the canonical three-way unit
 * classification so that non-rentable units (maintenance, reserved, etc.)
 * are never silently counted as vacant. A unit is vacant only when its
 * status is `available` — genuinely ready to be leased.
 */
export function buildOccupancyRows(
  units: Pick<Unit, 'property_id' | 'status'>[] = [],
  properties: ReadonlyMap<string, string> | readonly { id: string; title: string | null }[] = new Map(),
): OccupancyChartRow[] {
  const titleById: ReadonlyMap<string, string> =
    properties instanceof Map
      ? properties
      : new Map(
          (properties as readonly { id: string; title: string | null }[])
            .map((p) => [p.id, (p.title ?? '').trim()] as const)
            .filter(([, title]) => title.length > 0),
        );

  const rowsByProperty = new Map<string, OccupancyChartRow>();

  for (const unit of units) {
    const id = unit.property_id;
    const title = titleById.get(id);
    const hasTitle = Boolean(title);
    const status = normalizeUnitStatusForOccupancy(unit.status);
    const existing = rowsByProperty.get(id);
    if (existing) {
      if (status === 'occupied') existing.occupied += 1;
      else if (status === 'available') existing.vacant += 1;
      else existing.nonRentable += 1;
      continue;
    }
    const row: OccupancyChartRow = {
      property: hasTitle ? title! : 'عقار بدون اسم',
      propertyId: id,
      shortPropertyId: '',
      hasTitle,
      occupied: status === 'occupied' ? 1 : 0,
      vacant: status === 'available' ? 1 : 0,
      nonRentable: status === 'nonRentable' ? 1 : 0,
    };
    rowsByProperty.set(id, row);
  }

  // Prefer titled rows first, then sort titled rows by Arabic title; untitled
  // rows sort by short id so the order is stable.
  return Array.from(rowsByProperty.values()).sort((a, b) => {
    if (a.hasTitle !== b.hasTitle) return a.hasTitle ? -1 : 1;
    return a.property.localeCompare(b.property, 'ar') || a.shortPropertyId.localeCompare(b.shortPropertyId);
  });
}

export function buildPaymentsTrendRows(params: {
  dailyCollections?: DailyCollectionReportRow[];
  overdueInvoices?: OverdueInvoicesReport['rows'];
}): PaymentsTrendRow[] {
  const rowsByMonth = new Map<string, PaymentsTrendRow>();

  for (const row of params.dailyCollections ?? []) {
    const month = monthKey(row.paymentDate);
    const current = rowsByMonth.get(month) ?? { month, collections: 0, overdue: 0 };
    current.collections += row.totalPaid;
    rowsByMonth.set(month, current);
  }

  for (const invoice of params.overdueInvoices ?? []) {
    const month = monthKey(invoice.dueDate);
    const current = rowsByMonth.get(month) ?? { month, collections: 0, overdue: 0 };
    current.overdue += invoice.remainingAmount;
    rowsByMonth.set(month, current);
  }

  return Array.from(rowsByMonth.values()).sort((a, b) => a.month.localeCompare(b.month));
}

export function buildAgingBucketChartRows(
  buckets: Record<string, { label: string; total: number; invoiceCount: number }> | undefined,
  bucketKeys: string[],
): AgingBucketChartRow[] {
  return bucketKeys.map((key) => {
    const bucket = buckets?.[key];
    return {
      bucket: bucket?.label ?? key,
      total: bucket?.total ?? 0,
      invoiceCount: bucket?.invoiceCount ?? 0,
    };
  });
}

export function buildRentRollRows(
  contracts: ContractListItem[],
  statusLabels: Record<CanonicalContractStatus, string>,
): RentRollReportRow[] {
  return contracts
    .map((contract) => ({
      contractId: contract.id,
      contractReference: contract.reference ?? null,
      tenantName: valueOrDash(contract.people?.full_name),
      propertyTitle: valueOrDash(contract.properties?.title),
      unitNumber: valueOrDash(contract.units?.unit_number),
      rentAmount: contract.rent_amount,
      paymentCycle: paymentCycleLabels[contract.payment_cycle],
      // Index by the canonical status so legacy 'ACTIVE'/'ENDED' rows still render labels
      statusLabel: statusLabels[normalizeContractStatus(contract.status)],
      startDate: contract.start_date,
      endDate: contract.end_date,
    }))
    .sort((a, b) => a.tenantName.localeCompare(b.tenantName, 'ar') || a.contractId.localeCompare(b.contractId));
}
