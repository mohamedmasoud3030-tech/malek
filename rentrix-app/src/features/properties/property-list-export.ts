import { buildCsvMatrix, withUtf8Bom } from '@/lib/csvExport';
import { DEFAULT_CURRENCY } from '@/lib/formatters';
import { APP_BRAND_FILE_SLUG } from '@/lib/brand';
import { formatDefaultCompanyMoney } from '@/lib/companyFormatters';
import { getTodayLocalDateString } from '@/features/financials/financials-date-utils';
import { buildXlsxBlob } from '@/lib/xlsx-export';
import type { Property } from '@/types/domain';
import { propertyStatusLabels } from './property-schema';

const EXPORT_HEADERS = [
  'العنوان',
  'النوع',
  'العنوان التفصيلي',
  'المالك',
  'الحالة',
  'قيمة الشراء',
  'القيمة الحالية',
  'العملة',
] as const;


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

  return buildCsvMatrix([EXPORT_HEADERS, ...rows], { quoteText: false });
}

export function buildPropertiesCsvBlob(properties: Property[]) {
  return new Blob([withUtf8Bom(buildPropertiesCsv(properties))], { type: 'text/csv;charset=utf-8' });
}

export function buildPropertiesCsvFilename(date: Date) {
  return `${APP_BRAND_FILE_SLUG}-properties-${getTodayLocalDateString(date)}.csv`;
}

export function buildPropertiesXlsxBlob(properties: Property[]) {
  return buildXlsxBlob({
    name: 'العقارات',
    headers: EXPORT_HEADERS,
    rows: properties.map((property) => [
      property.title ?? '',
      property.type ?? '',
      property.address ?? '',
      property.owner_name ?? '',
      propertyStatusLabels[property.status as keyof typeof propertyStatusLabels] ?? property.status ?? '',
      property.purchase_value == null ? null : Number(property.purchase_value),
      property.current_value == null ? null : Number(property.current_value),
      DEFAULT_CURRENCY,
    ]),
  });
}

export function buildPropertiesXlsxFilename(date: Date) {
  return `${APP_BRAND_FILE_SLUG}-properties-${getTodayLocalDateString(date)}.xlsx`;
}
