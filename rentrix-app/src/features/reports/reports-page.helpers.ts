import type { ContractListItem } from '@/features/contracts/services/contractService';
import { isContractStatus, normalizeContractStatus } from '@/lib/contractStatus';
import type {
  AgedReceivablesBucket,
  DailyCollectionReportRow,
  OverdueInvoicesReport,
} from '@/features/financials/reports/financialReportsService';
import { listPropertyTitles, type PropertyTitleRow } from '@/features/properties/property-service';
import type { Unit } from '@/types/domain';
import { buildCsv, withUtf8Bom, type CsvRow } from '@/lib/csvExport';
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
};
export type PaymentsTrendRow = { month: string; collections: number; overdue: number };
export type RentRollReportRow = {
  contractId: string;
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
export const contractStatusLabels: Record<ContractListItem['status'], string> = {
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

export function createReceiptPrintHref(receiptId: string) {
  return `/receipts?receiptId=${encodeURIComponent(receiptId)}`;
}

export function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
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

function toDateOnlyTimestamp(value: string) {
  return Date.parse(`${value}T00:00:00.000Z`);
}

export function buildExpiringContractsRows(contracts: ContractListItem[], fromDate: Date) {
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
    }));
}

export function usePropertyTitles() {
  return useQuery({
    queryKey: ['reports', 'propertyTitles'],
    queryFn: async (): Promise<PropertyTitleRow[]> => listPropertyTitles(),
    staleTime: 60_000,
  });
}

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
    const existing = rowsByProperty.get(id);
    if (existing) {
      if (unit.status === 'occupied') existing.occupied += 1;
      else existing.vacant += 1;
      continue;
    }
    const row: OccupancyChartRow = {
      property: hasTitle ? title! : 'عقار بدون اسم',
      propertyId: id,
      shortPropertyId: id.slice(0, 8),
      hasTitle,
      occupied: unit.status === 'occupied' ? 1 : 0,
      vacant: unit.status === 'occupied' ? 0 : 1,
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
  statusLabels: Record<ContractListItem['status'], string>,
): RentRollReportRow[] {
  return contracts
    .map((contract) => ({
      contractId: contract.id,
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
