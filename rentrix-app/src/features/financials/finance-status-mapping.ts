/**
 * Finance status semantics.
 *
 * Domain mapping only — no JSX, no tokens, no parallel primitives. Every
 * financial surface resolves a raw invoice status to one semantic tone through
 * `getInvoiceStatusTone` and then renders it with the canonical `StatusBadge`
 * (`@/components/ui/status-badge`), so "paid / partial / overdue / draft /
 * void" mean and look the same across invoices wherever they appear
 * (Money workspace, contract payments tab, property/tenant dossiers, reports).
 *
 * Receipt tones live next to the receipt vocabulary in
 * `components/receipt-formatters.ts` (`getReceiptStatusTone`).
 */

import type { SemanticTone } from '@/components/ui/status-badge';
import { normalizeInvoiceStatus, type CanonicalInvoiceStatus } from './components/invoice-status-labels';

const invoiceStatusTones: Readonly<Record<CanonicalInvoiceStatus, SemanticTone>> = {
  paid: 'success',
  partial: 'warning',
  overdue: 'danger',
  unpaid: 'info',
  draft: 'info',
  void: 'neutral',
  cancelled: 'neutral',
  other: 'neutral',
};

/**
 * Raw invoice statuses arrive in every casing live data produces ('issued',
 * 'UNPAID', 'PARTIALLY_PAID', …); they are normalized through the canonical
 * invoice vocabulary first so one casing can never render a different colour.
 */
export function getInvoiceStatusTone(rawStatus: string | null | undefined): SemanticTone {
  return invoiceStatusTones[normalizeInvoiceStatus(rawStatus)];
}
