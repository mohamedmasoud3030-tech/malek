import { formatCompanyMoney } from '@/lib/companyFormatters';
import { defaultCompanyLocalSettings } from '@/lib/companySettings';
import { getActionableSupabaseErrorMessage } from '@/lib/supabase-error';

/** Accounting-report display formatter without a cross-feature dependency on Financials. */
export function formatMoney(value: number | null | undefined) {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0;
  return formatCompanyMoney(defaultCompanyLocalSettings, numeric);
}

/** Product-facing accounting reports must never echo provider/database internals. */
export function getErrorMessage(error: unknown, fallback: string) {
  return error ? getActionableSupabaseErrorMessage(error, fallback) : fallback;
}
