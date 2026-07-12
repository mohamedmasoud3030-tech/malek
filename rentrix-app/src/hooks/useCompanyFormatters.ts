import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import { formatCompanyMoney, formatCompanyDate, formatCompanyNumber } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';

/**
 * Shared hook for company-aware formatting.
 * Eliminates inline `money()`, `date()`, `number()` helpers across components.
 * Returns an object that spreads CompanySettingsContract and adds formatter methods,
 * making it compatible with components expecting either interface.
 */
export function useCompanyFormatters(): CompanySettingsContract & {
  money: (value: number | null | undefined) => string;
  date: (value: string) => string;
  number: (value: number | null | undefined) => string;
} {
  const settings = useCompanySettingsContract();

  const money = (value: number | null | undefined) => formatCompanyMoney(settings, value);
  const date = (value: string) => formatCompanyDate(settings, `${value}T00:00:00`);
  const number = (value: number | null | undefined) => formatCompanyNumber(settings, value);

  return { ...settings, money, date, number };
}

/**
 * Hook that provides formatters without React Query dependency.
 * Use when settings are already available via context or props.
 */
export function useCompanyFormattersWith(settings: CompanySettingsContract) {
  const money = (value: number | null | undefined) => formatCompanyMoney(settings, value);
  const date = (value: string) => formatCompanyDate(settings, `${value}T00:00:00`);
  const number = (value: number | null | undefined) => formatCompanyNumber(settings, value);

  return { money, date, number };
}

/**
 * Standalone formatters for non-React contexts (e.g., utils, services).
 * Uses default company settings.
 */
import { defaultCompanyLocalSettings } from '@/lib/companySettings';

export const formatMoney = (value: number | null | undefined) =>
  formatCompanyMoney(defaultCompanyLocalSettings, value);

export const formatDate = (value: string) =>
  formatCompanyDate(defaultCompanyLocalSettings, `${value}T00:00:00`);

export const formatNumber = (value: number | null | undefined) =>
  formatCompanyNumber(defaultCompanyLocalSettings, value);