import { DEFAULT_CURRENCY } from '@/lib/formatters';
import { APP_BRAND_FILE_SLUG } from '@/lib/brand';
import { formatDefaultCompanyMoney } from '@/lib/companyFormatters';
import { getTodayLocalDateString } from '@/features/financials/financials-date-utils';
import type { Property } from '@/types/domain';
import { propertyStatusLabels } from './property-schema';

const CSV_HEADERS = [
  'العنوان',
  'النوع',
  'العنوان التفصيلي',
  'المالك',
  'الحالة',
  'قيمة الشراء',
  'القيمة الحالية',
  'العملة',
] as const;

function escapeCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildPropertiesCsv(properties: Property[]) {
  const rows = properties.map((property) => [
    property.title ?? '',
    property.type ?? '',
    property.address ?? '',
    property.owner_name ?? '',
    propertyStatusLabels[property.status as keyof typeof propertyStatusLabels] ?? property.status ?? '',
    formatDefaultCompanyMoney(property.purchase_value),
    formatDefaultCompanyMoney(property.current_value),
    DEFAULT_CURRENCY,
  ]);

  return [CSV_HEADERS, ...rows].map((row) => row.map(escapeCell).join(',')).join('\n');
}

export function buildPropertiesCsvBlob(properties: Property[]) {
  return new Blob([`\uFEFF${buildPropertiesCsv(properties)}`], { type: 'text/csv;charset=utf-8' });
}

export function buildPropertiesCsvFilename(date: Date) {
  return `${APP_BRAND_FILE_SLUG}-properties-${getTodayLocalDateString(date)}.csv`;
}
