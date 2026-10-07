const unpaidStatusLabel = 'غير مدفوعة';

export const invoiceStatusLabels: Record<string, string> = {
  draft: 'مسودة',
  issued: unpaidStatusLabel,
  UNPAID: unpaidStatusLabel,
  unpaid: unpaidStatusLabel,
  partial: 'مدفوعة جزئياً',
  PARTIALLY_PAID: 'مدفوعة جزئياً',
  overdue: 'متأخرة',
  OVERDUE: 'متأخرة',
  paid: 'مدفوعة',
  PAID: 'مدفوعة',
  void: 'ملغاة',
  VOID: 'ملغاة',
};

export function formatInvoiceStatusLabel(status: string) {
  return invoiceStatusLabels[status] ?? status;
}

/**
 * Canonical invoice statuses. Live rows mix the legacy lowercase values
 * ('issued', 'partial', ...) with the modern UPPERCASE ones the schema
 * default and the write RPCs produce ('UNPAID', 'PARTIALLY_PAID', ...) —
 * every status comparison must normalize first or one casing silently wins.
 */
export type CanonicalInvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'overdue' | 'void' | 'cancelled' | 'draft' | 'other';

const canonicalInvoiceStatusByRaw: Record<string, CanonicalInvoiceStatus> = {
  UNPAID: 'unpaid',
  unpaid: 'unpaid',
  issued: 'unpaid',
  PARTIALLY_PAID: 'partial',
  partial: 'partial',
  PAID: 'paid',
  paid: 'paid',
  OVERDUE: 'overdue',
  overdue: 'overdue',
  VOID: 'void',
  void: 'void',
  CANCELLED: 'cancelled',
  cancelled: 'cancelled',
  DRAFT: 'draft',
  draft: 'draft',
};

export function normalizeInvoiceStatus(status: string | null | undefined): CanonicalInvoiceStatus {
  if (!status) return 'other';
  return canonicalInvoiceStatusByRaw[status]
    ?? canonicalInvoiceStatusByRaw[status.toLowerCase()]
    ?? canonicalInvoiceStatusByRaw[status.toUpperCase()]
    ?? 'other';
}

const rawInvoiceStatusGroups: Readonly<Record<Exclude<CanonicalInvoiceStatus, 'other'>, readonly string[]>> = {
  unpaid: ['unpaid', 'UNPAID', 'issued'],
  partial: ['partial', 'PARTIALLY_PAID'],
  paid: ['paid', 'PAID'],
  overdue: ['overdue', 'OVERDUE'],
  void: ['void', 'VOID'],
  cancelled: ['cancelled', 'CANCELLED'],
  draft: ['draft', 'DRAFT'],
};

/** Every raw casing a case-sensitive Supabase status filter must cover. */
export function getInvoiceStatusVariants(status: string): string[] {
  const canonical = normalizeInvoiceStatus(status);
  if (canonical === 'other') return [status];
  return [...rawInvoiceStatusGroups[canonical]];
}
