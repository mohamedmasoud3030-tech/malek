import { DEFAULT_CURRENCY } from '@/lib/formatters';
import { formatDefaultCompanyMoney } from '@/lib/companyFormatters';
import { getTodayLocalDateString } from '@/features/financials/financials-date-utils';
import { normalizeContractStatus } from '@/lib/contractStatus';
import { contractStatusLabels, paymentCycleLabels } from './contractSchema';
import type { ContractListItem } from './services/contractService';

const CSV_HEADERS = [
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

export function getContractNumber(contract: Pick<ContractListItem, 'id'>) {
  return `#${contract.id.slice(0, 8)}`;
}

export function escapeContractCsvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
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

  return [CSV_HEADERS, ...rows].map((row) => row.map(escapeContractCsvCell).join(',')).join('\n');
}

export function buildContractsCsvBlob(contracts: ContractListItem[]) {
  return new Blob([`\uFEFF${buildContractsCsv(contracts)}`], { type: 'text/csv;charset=utf-8' });
}

export function buildContractsCsvFilename(date: Date) {
  return `rentrix-contracts-${getTodayLocalDateString(date)}.csv`;
}
