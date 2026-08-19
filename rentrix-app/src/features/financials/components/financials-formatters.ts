import { formatCompanyDate, formatCompanyMoney } from '@/lib/companyFormatters';
import { defaultCompanyLocalSettings } from '@/lib/companySettings';
import { toFinancialNumber } from '../financialMath';

/**
 * Finance surfaces render money through the company-settings contract.
 * The canonical default currency is OMR (DEFAULT_CURRENCY in lib/formatters);
 * a live company-settings contract overrides it at the call site through
 * formatCompanyMoney. No screen hard-codes a currency.
 */
export function formatMoney(value: number | null | undefined) {
  return formatCompanyMoney(defaultCompanyLocalSettings, toFinancialNumber(value));
}

export function formatDate(value: string | number | Date) {
  return formatCompanyDate(defaultCompanyLocalSettings, value);
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