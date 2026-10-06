/**
 * Shared receipt-print helpers.
 *
 * The print view lives on the receipts page (?receiptId=...). Both the
 * receipts workspace and the invoice quick-collect flow open it the same
 * way: a dedicated tab so the collector's filtered list state is preserved.
 */
export function createReceiptPrintHref(receiptId: string): string {
  return `/receipts?receiptId=${encodeURIComponent(receiptId)}`;
}

export function openReceiptPrintTab(receiptId: string): void {
  if (!receiptId) return;
  const href = createReceiptPrintHref(receiptId);
  const printWindow = globalThis.open?.(href, '_blank', 'noopener');
  if (!printWindow) globalThis.location?.assign?.(href);
}
