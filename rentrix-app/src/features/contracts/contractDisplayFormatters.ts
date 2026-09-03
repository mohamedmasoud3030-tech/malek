import { formatCompanyDate, formatCompanyDateTime, formatCompanyMoney, formatCompanyNumber } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';

export const CONTRACT_DAY_IN_MS = 86_400_000;

export function parseContractDisplayDate(value: string): Date | null {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatContractMoney(settings: CompanySettingsContract, value: number): string {
  return formatCompanyMoney(settings, value);
}

export function formatContractDate(settings: CompanySettingsContract, value: string): string {
  const parsed = parseContractDisplayDate(value);
  return parsed ? formatCompanyDate(settings, parsed) : '—';
}

export function formatContractDateTime(settings: CompanySettingsContract, value: string): string {
  return formatCompanyDateTime(settings, value);
}

export function formatContractDayCount(settings: CompanySettingsContract, value: number): string {
  return formatCompanyNumber(settings, value);
}

export function getContractInclusiveDays(startDate: string, endDate: string): number {
  const startTime = new Date(startDate).getTime();
  const endTime = new Date(endDate).getTime();
  return Math.max(1, Math.round((endTime - startTime) / CONTRACT_DAY_IN_MS) + 1);
}

/**
 * Whole days from `referenceDate` (local midnight) to `endDate`.
 *
 * The reference date is injectable so callers that already resolved "today"
 * once — contract attention, in particular — derive expiry from the same
 * instant as every other signal instead of reading the clock a second time.
 */
export function getContractRemainingDays(endDate: string, referenceDate: Date = new Date()): number {
  const endTime = new Date(endDate).getTime();
  const referenceTime = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate()).getTime();
  return Math.ceil((endTime - referenceTime) / CONTRACT_DAY_IN_MS);
}
