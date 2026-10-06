import { toFinancialNumber } from '../financialMath';
import {
  agingBucketOrder,
  getAgingBucketKeyFromDaysOverdue,
  getAgingBucketLabel,
  type AgingBucketKey,
  type OverdueInvoiceReportRow,
} from '../reports/financialReportsService';

export const ARABIC_LOCALE = 'ar';
export const EMPTY_FIELD_VALUE = '—';
export const OVER_90_BUCKET_KEY = 'days_90_plus' satisfies AgingBucketKey;

export type ArrearsBucketFilter = AgingBucketKey | 'all';

export const arrearsBucketOptions: { value: ArrearsBucketFilter; label: string }[] = [
  { value: 'all', label: 'كل الأعمار' },
  ...agingBucketOrder.map((bucketKey) => ({ value: bucketKey, label: getAgingBucketLabel(bucketKey) })),
];

export function getOverdueRowBucketKey(row: Pick<OverdueInvoiceReportRow, 'daysOverdue'> & { bucket?: AgingBucketKey | null }): AgingBucketKey {
  return row.bucket ?? getAgingBucketKeyFromDaysOverdue(row.daysOverdue);
}

export function safePercentage(value: number | null | undefined, total: number | null | undefined) {
  const safeValue = toFinancialNumber(value);
  const safeTotal = toFinancialNumber(total);
  if (safeTotal <= 0) return null;
  const percentage = (safeValue / safeTotal) * 100;
  return Number.isFinite(percentage) ? percentage : null;
}

function getOverdueInvoiceSearchValues(row: OverdueInvoiceReportRow) {
  return [
    row.invoiceId,
    row.shortInvoiceId,
    row.tenantName,
    row.propertyTitle,
    row.unitNumber,
    row.contractId,
  ];
}

function rowMatchesSearch(row: OverdueInvoiceReportRow, normalizedSearch: string) {
  if (!normalizedSearch) return true;
  return getOverdueInvoiceSearchValues(row).some((value) => value?.toLocaleLowerCase(ARABIC_LOCALE).includes(normalizedSearch));
}

function rowMatchesBucket(row: OverdueInvoiceReportRow, bucketFilter: ArrearsBucketFilter) {
  return bucketFilter === 'all' || getOverdueRowBucketKey(row) === bucketFilter;
}

export function filterOverdueInvoiceRows(rows: OverdueInvoiceReportRow[], search: string, bucketFilter: ArrearsBucketFilter) {
  const normalizedSearch = search.trim().toLocaleLowerCase(ARABIC_LOCALE);
  return rows.filter((row) => rowMatchesBucket(row, bucketFilter) && rowMatchesSearch(row, normalizedSearch));
}
