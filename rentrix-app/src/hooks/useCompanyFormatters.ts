import { useMemo } from 'react';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import { formatCompanyMoney, formatCompanyDate, formatCompanyNumber } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type CompanyFormatters = CompanySettingsContract & {
  money: (value: number | null | undefined) => string;
  date: (value: string | null | undefined) => string;
  number: (value: number | null | undefined) => string;
};

/**
 * The single company-aware formatter hook for React surfaces (UX-002/UX-003).
 * Money always flows through the company-settings contract; date-only values
 * (`YYYY-MM-DD`) are anchored to local midnight so they never shift a day,
 * while full timestamps are formatted as-is.
 */
export function useCompanyFormatters(): CompanyFormatters {
  const settings = useCompanySettingsContract();

  return useMemo(
    () => ({
      ...settings,
      money: (value: number | null | undefined) => formatCompanyMoney(settings, value),
      date: (value: string | null | undefined) =>
        formatCompanyDate(settings, value && DATE_ONLY_PATTERN.test(value) ? `${value}T00:00:00` : value),
      number: (value: number | null | undefined) => formatCompanyNumber(settings, value),
    }),
    [settings],
  );
}
