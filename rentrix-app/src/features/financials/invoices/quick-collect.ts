import type { Invoice } from '@/types/domain';
import { getSafeRemainingAmount, toFinancialNumber } from '../financialMath';
import { getInvoiceGrossAmount } from './invoiceService';

/**
 * Quick-collect (تحصيل سريع) helpers.
 *
 * The collector flow works off invoice LIST rows, so every helper here is
 * structural — it accepts any object carrying the invoice money fields and
 * stays gross-based (net + VAT − paid) for consistency with the list, the
 * summary cards and the payment validation rules.
 */
export type QuickCollectInvoiceInput = Pick<Invoice, 'amount' | 'paid_amount'> & Partial<Pick<Invoice, 'tax_amount'>>;

export const QUICK_PAYMENT_FORM_ID = 'quick-payment-form';
export const QUICK_PAYMENT_AMOUNT_INPUT_ID = 'quick-payment-amount';

/** An invoice is collectible while it still has a positive gross remaining balance. */
export function isInvoiceCollectible(invoice: QuickCollectInvoiceInput): boolean {
  return getSafeRemainingAmount(getInvoiceGrossAmount(invoice), invoice.paid_amount) > 0;
}

/** Money values display 3-decimal precision across the app — keep the preset aligned. */
export function toQuickCollectAmountString(remainingAmount: number): string {
  const safeAmount = Math.max(0, toFinancialNumber(remainingAmount));
  return String(Math.round(safeAmount * 1000) / 1000);
}

/**
 * One-tap preset for the «تحصيل» row action: prefill the FULL remaining
 * balance. Full settlement is the dominant rent-collection case; partial
 * payers still edit the input freely. Returns null when nothing is owed.
 */
export function getQuickCollectPreset(
  invoice: QuickCollectInvoiceInput & { id: string },
): { invoiceId: string; amount: string } | null {
  if (!isInvoiceCollectible(invoice)) return null;
  const remaining = getSafeRemainingAmount(getInvoiceGrossAmount(invoice), invoice.paid_amount);
  return { invoiceId: invoice.id, amount: toQuickCollectAmountString(remaining) };
}

/**
 * Next invoice to collect in the current list order (the «collector walk»),
 * skipping the invoice that was just settled. Returns null when no other
 * collectible invoice exists in the visible page.
 */
export function findNextCollectibleInvoiceId(
  invoices: readonly (QuickCollectInvoiceInput & { id: string })[],
  excludeInvoiceId?: string,
): string | null {
  const next = invoices.find(
    (invoice) => invoice.id !== excludeInvoiceId && isInvoiceCollectible(invoice),
  );
  return next ? next.id : null;
}

/**
 * Deep link into the invoice workspace pre-armed for collection: selects the
 * invoice and asks the workspace to prefill the FULL gross remaining amount
 * and focus the payment form once the invoice detail finishes loading.
 */
export function createInvoiceCollectHref(invoiceId: string): string {
  return `/invoices?invoiceId=${encodeURIComponent(invoiceId)}&collect=1`;
}

/** Parses the invoice deep-link search params (tolerates loose casing/types). */
export function parseQuickCollectSearch(search: Record<string, unknown>): { invoiceId: string; collectRequested: boolean } {
  const invoiceId = typeof search.invoiceId === 'string' ? search.invoiceId : '';
  const rawCollect = search.collect;
  const collectRequested = rawCollect === '1' || rawCollect === 1 || rawCollect === true || rawCollect === 'true';
  return { invoiceId, collectRequested };
}
