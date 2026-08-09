import { createReceiptPrintHref } from '../receipts/receipt-print';

export const paymentMethodLabels: Record<string, string> = {
  cash: 'نقداً',
  bank_transfer: 'تحويل بنكي',
  card: 'بطاقة',
  check: 'شيك',
  other: 'أخرى',
};

export const receiptStatusLabels: Record<string, string> = {
  posted: 'مرحّل',
  void: 'ملغي',
  VOID: 'ملغي',
};

export function formatReceiptContext(receipt: { tenant_name: string | null; unit_number: string | null; property_title: string | null }) {
  const parts = [receipt.tenant_name, receipt.unit_number ? `وحدة ${receipt.unit_number}` : null, receipt.property_title].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

/**
 * Legacy payment rows may lack the server-generated receipt reference. Never
 * turn their internal payment identifier into a user-facing document number.
 */
export function formatReceiptNumber(paymentId: string) {
  return paymentId ? 'إيصال بلا مرجع تجاري' : '—';
}

export type PaymentReceiptBinding = {
  /** Deep link into the receipt print view (opened in a new tab). */
  printHref: string;
  receiptNumber: string;
  isVoid: boolean;
  statusLabel: string;
};

/**
 * Binds an invoice payment-log row to its receipt so the collector can
 * print the exact سند قبض for any historical payment — not just the one
 * recorded in the current session.
 */
export function getPaymentReceiptBinding(payment: { id: string; status?: string | null }): PaymentReceiptBinding {
  const isVoid = payment.status === 'VOID';
  return {
    printHref: createReceiptPrintHref(payment.id),
    receiptNumber: formatReceiptNumber(payment.id),
    isVoid,
    statusLabel: isVoid ? 'ملغي' : (receiptStatusLabels.posted ?? 'مرحّل'),
  };
}
