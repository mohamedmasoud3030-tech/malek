import { buildCsvMatrix, withUtf8Bom } from '@/lib/csvExport';
import { DEFAULT_CURRENCY } from '@/lib/formatters';
import { APP_BRAND_FILE_SLUG } from '@/lib/brand';
import { formatDefaultCompanyMoney } from '@/lib/companyFormatters';
import { getTodayLocalDateString } from '@/features/financials/financials-date-utils';
import { normalizeContractStatus } from '@/lib/contractStatus';
import { buildXlsxBlob } from '@/lib/xlsx-export';
import { contractStatusLabels, paymentCycleLabels } from './contractSchema';
import type { ContractListItem } from './services/contractService';

const EXPORT_HEADERS = [
  'رقم العقد',
  'المستأجر',
  'هاتف المستأجر',
  'الوحدة',
  'العقار',
  'عنوان العقار',
  'الإيجار',
  'العملة',
  'دورة السداد',
  'تاريخ البداية',
  'تاريخ النهاية',
  'الحالة',
] as const;

export function getContractNumber(contract: Pick<ContractListItem, 'id' | 'reference'>) {
  return contract.reference ?? 'عقد بلا مرجع تجاري';
}


export function buildContractsCsv(contracts: ContractListItem[]) {
  const rows = contracts.map((contract) => [
    getContractNumber(contract),
    contract.people?.full_name ?? '',
    contract.people?.phone ?? '',
    contract.units?.unit_number ?? '',
    contract.properties?.title ?? '',
    contract.properties?.address ?? '',
    formatDefaultCompanyMoney(contract.rent_amount),
    DEFAULT_CURRENCY,
    paymentCycleLabels[contract.payment_cycle],
    contract.start_date,
    contract.end_date,
    contractStatusLabels[normalizeContractStatus(contract.status)],
  ]);

  return buildCsvMatrix([EXPORT_HEADERS, ...rows], { quoteText: false });
}

export function buildContractsCsvBlob(contracts: ContractListItem[]) {
  return new Blob([withUtf8Bom(buildContractsCsv(contracts))], { type: 'text/csv;charset=utf-8' });
}

export function buildContractsCsvFilename(date: Date) {
  return `${APP_BRAND_FILE_SLUG}-contracts-${getTodayLocalDateString(date)}.csv`;
}

export function buildContractsXlsxBlob(contracts: ContractListItem[]) {
  return buildXlsxBlob({
    name: 'العقود',
    headers: EXPORT_HEADERS,
    rows: contracts.map((contract) => [
      getContractNumber(contract),
      contract.people?.full_name ?? '',
      contract.people?.phone ?? '',
      contract.units?.unit_number ?? '',
      contract.properties?.title ?? '',
      contract.properties?.address ?? '',
      contract.rent_amount == null ? null : Number(contract.rent_amount),
      DEFAULT_CURRENCY,
      paymentCycleLabels[contract.payment_cycle],
      contract.start_date,
      contract.end_date,
      contractStatusLabels[normalizeContractStatus(contract.status)],
    ]),
  });
}

export function buildContractsXlsxFilename(date: Date) {
  return `${APP_BRAND_FILE_SLUG}-contracts-${getTodayLocalDateString(date)}.xlsx`;
}
