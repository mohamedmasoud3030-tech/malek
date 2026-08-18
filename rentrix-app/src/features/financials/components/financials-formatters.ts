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

/**
 * Short reference fallback for entity IDs that lack a human-readable reference.
 *
 * Returns a truncated reference (`#…`) derived from the UUID so users can
 * distinguish records in a list without exposing the full 36‑character UUID.
 * When no ID is available the dash `—` signals the absence of any reference.
 *
 * Note: the previous implementation returned 'مرجع تجاري غير متاح' (commercial
 * reference unavailable) for truthy values, which was misleading: a real ID
 * exists, we just choose not to display the raw UUID. A short prefix is more
 * informative than a label that implies something is broken.
 */
export function formatShortId(value: string | null | undefined) {
  if (!value) return '—';
  // Show first 8 hex chars as a human-friendly reference fragment.
  return `#${value.slice(0, 8).toUpperCase()}`;
}

export { formatInvoiceStatusLabel, invoiceStatusLabels } from './invoice-status-labels';