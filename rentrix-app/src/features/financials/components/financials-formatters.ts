import { formatCompanyDate, formatCompanyMoney } from '@/lib/companyFormatters';
import { defaultCompanyLocalSettings } from '@/lib/companySettings';
import { toFinancialNumber } from '../financialMath';

/**
 * Finance surfaces must never fall back to OMR when company settings have not
 * resolved yet. The product's accounting baseline is EGP; screens with a live
 * company-settings contract may still override this with the configured
 * currency through formatCompanyMoney at their call site.
 */
const defaultFinanceLocalSettings = {
  ...defaultCompanyLocalSettings,
  defaultCurrency: 'EGP' as const,
};

export function formatMoney(value: number | null | undefined) {
  return formatCompanyMoney(defaultFinanceLocalSettings, toFinancialNumber(value));
}

export function formatDate(value: string | number | Date) {
  return formatCompanyDate(defaultFinanceLocalSettings, value);
}

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function formatShortId(value: string | null | undefined) {
  return value ? 'مرجع تجاري غير متاح' : '—';
}

export { formatInvoiceStatusLabel, invoiceStatusLabels } from './invoice-status-labels';