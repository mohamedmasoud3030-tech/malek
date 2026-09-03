/**
 * Contracts — operational attention.
 *
 * The contracts register could previously answer "what status is this?" but not
 * the two questions an operator actually opens it for: *why does this contract
 * need me*, and *what happens next*. Expiry lived in one column hint and payment
 * trouble was invisible entirely, because the contracts list read carries no
 * invoice data.
 *
 * This module is the domain-owned projection that answers both. It is strictly
 * read-only presentation:
 *
 * - invoice status comes from the canonical `normalizeInvoiceStatus` (live rows
 *   mix 'issued'/'partial' with 'UNPAID'/'PARTIALLY_PAID');
 * - lateness comes from the canonical `calculateDaysOverdue`;
 * - amounts come from the canonical `getInvoiceGrossAmount` /
 *   `getSafeRemainingAmount` helpers;
 * - expiry comes from the canonical `isExpiringSoon` window;
 * - the next step comes from the canonical lifecycle rules.
 *
 * It performs no write, defines no transition, and never becomes a second
 * financial truth engine — the arrears/financial reports stay authoritative for
 * money. Note the batched dossier read selects no `tax_amount`, so the exposure
 * shown here is the receivable principal of the visible contracts, not a
 * ledger-accurate arrears figure.
 */
import { getSafeRemainingAmount } from '@/features/financials/financialMath';
import { normalizeInvoiceStatus } from '@/features/financials/components/invoice-status-labels';
import { calculateDaysOverdue } from '@/features/financials/reports/arrears-reports-service';
import type { DossierInvoiceRow } from '@/features/financials/invoices/invoiceService';
import { getInvoiceGrossAmount } from '@/features/financials/invoices/invoiceService';
import { isContractStatus } from '@/lib/contractStatus';
import { parseContractDisplayDate } from './contractDisplayFormatters';
import { getDaysUntilEnd, isExpiringSoon } from './hooks/useContractFilters';
import {
  getContractNextAction,
  isContractApprovalPending,
  isContractApproved,
  isContractRejected,
  type ContractNextAction,
} from './lifecycle/contractLifecycleRules';
import type { ContractListItem } from './services/contractService';

export type ContractAttentionFlag =
  | 'expired'
  | 'expiring_soon'
  | 'overdue_invoice'
  | 'outstanding_balance'
  | 'approval_pending'
  | 'approved_pending_activation'
  | 'approval_rejected';

export type ContractAttentionSeverity = 'danger' | 'warning' | 'info';

export type ContractAttentionReason = Readonly<{
  flag: ContractAttentionFlag;
  /** Short, card-safe wording. */
  label: string;
  /** Supporting detail; null when the label already says everything. */
  detail: string | null;
  severity: ContractAttentionSeverity;
}>;

export type ContractAttention = Readonly<{
  contractId: string;
  daysUntilEnd: number | null;
  isExpired: boolean;
  isExpiringSoon: boolean;
  /**
   * Payment flags are only meaningful once the batched invoice read has settled.
   * While it is in flight (or if it failed) the register must not claim a
   * contract has no payment problem, so callers can distinguish "clean" from
   * "unknown".
   */
  invoiceContextLoaded: boolean;
  /** Invoices still owed (unpaid / partially paid / overdue). */
  receivableInvoiceCount: number;
  overdueInvoiceCount: number;
  /** Days since the oldest past-due receivable fell due; 0 when none. */
  oldestOverdueDays: number;
  outstandingInvoiceCount: number;
  /** Receivable principal still owed across the visible invoices. */
  outstandingAmount: number;
  /** Receivable principal that is already past its due date. */
  overdueAmount: number;
  /** Every reason this contract needs attention, most severe first. */
  reasons: readonly ContractAttentionReason[];
  /** Highest-severity reason, or null when nothing is due. */
  primaryReason: ContractAttentionReason | null;
  severity: ContractAttentionSeverity | null;
  /** Canonical lifecycle next step, or null when nothing is due. */
  nextAction: ContractNextAction | null;
}>;

export type ContractAttentionSummary = Readonly<{
  /** Distinct contracts carrying at least one attention reason. */
  needingAttention: number;
  /** Contracts with overdue or otherwise unpaid invoices. */
  paymentAttention: number;
  overdueInvoices: number;
  /** Contracts that are expired or inside the expiring-soon window. */
  expiryAttention: number;
  /** Contracts waiting on an approval-stage step. */
  lifecycleAttention: number;
  overdueAmount: number;
  outstandingAmount: number;
}>;

export const EMPTY_CONTRACT_ATTENTION_SUMMARY: ContractAttentionSummary = {
  needingAttention: 0,
  paymentAttention: 0,
  overdueInvoices: 0,
  expiryAttention: 0,
  lifecycleAttention: 0,
  overdueAmount: 0,
  outstandingAmount: 0,
};

export const contractAttentionLabels: Record<ContractAttentionFlag, string> = {
  expired: 'العقد منتهي',
  expiring_soon: 'ينتهي قريبًا',
  overdue_invoice: 'فواتير متأخرة',
  outstanding_balance: 'رصيد غير مسدد',
  approval_pending: 'بانتظار الاعتماد',
  approved_pending_activation: 'معتمد بانتظار التفعيل',
  approval_rejected: 'الاعتماد مرفوض',
};

const flagSeverity: Record<ContractAttentionFlag, ContractAttentionSeverity> = {
  overdue_invoice: 'danger',
  expired: 'danger',
  approval_rejected: 'danger',
  expiring_soon: 'warning',
  outstanding_balance: 'warning',
  approval_pending: 'warning',
  approved_pending_activation: 'info',
};

/** Most severe first, so the register shows one reason and the expansion the rest. */
const flagRank: readonly ContractAttentionFlag[] = [
  'overdue_invoice',
  'expired',
  'approval_rejected',
  'outstanding_balance',
  'expiring_soon',
  'approval_pending',
  'approved_pending_activation',
];

export const paymentAttentionFlags: readonly ContractAttentionFlag[] = ['overdue_invoice', 'outstanding_balance'];
export const expiryAttentionFlags: readonly ContractAttentionFlag[] = ['expired', 'expiring_soon'];
export const lifecycleAttentionFlags: readonly ContractAttentionFlag[] = [
  'approval_rejected',
  'approval_pending',
  'approved_pending_activation',
];

/**
 * Mirrors the arrears report's receivable set: an invoice still owed is unpaid,
 * partially paid, or already overdue. Paid, void, cancelled and draft rows never
 * contribute — which is what keeps a settled invoice from reading as arrears.
 */
function isReceivableInvoice(status: string): boolean {
  const canonical = normalizeInvoiceStatus(status);
  return canonical === 'unpaid' || canonical === 'partial' || canonical === 'overdue';
}

function invoiceRemainingAmount(invoice: DossierInvoiceRow): number {
  return getSafeRemainingAmount(getInvoiceGrossAmount(invoice), invoice.paid_amount);
}

function formatDayCount(days: number): string {
  return days === 1 ? 'يوم واحد' : `${days} يوم`;
}

function buildReason(flag: ContractAttentionFlag, detail: string | null = null): ContractAttentionReason {
  return { flag, label: contractAttentionLabels[flag], detail, severity: flagSeverity[flag] };
}

/**
 * Derive one contract's operational attention.
 *
 * `invoices` is that contract's slice of the single batched read, and `today`
 * is an explicit `YYYY-MM-DD` so callers (and tests) get a deterministic result
 * instead of depending on the wall clock.
 */
export function deriveContractAttention(
  contract: ContractListItem,
  invoices: readonly DossierInvoiceRow[],
  today: string,
  options: Readonly<{ invoiceContextLoaded?: boolean }> = {},
): ContractAttention {
  const invoiceContextLoaded = options.invoiceContextLoaded ?? true;
  // A single reference instant drives expiry, lateness and the next step, so
  // the projection never disagrees with itself across a midnight boundary.
  const referenceDate = parseContractDisplayDate(today) ?? new Date();
  const daysUntilEnd = getDaysUntilEnd(contract, referenceDate);
  const isExpired = isContractStatus(contract.status, 'expired');
  const isExpiring = isExpiringSoon(contract, referenceDate);

  let receivableInvoiceCount = 0;
  let overdueInvoiceCount = 0;
  let oldestOverdueDays = 0;
  let outstandingAmount = 0;
  let overdueAmount = 0;

  for (const invoice of invoices) {
    if (!isReceivableInvoice(invoice.status)) continue;
    receivableInvoiceCount += 1;
    const remaining = invoiceRemainingAmount(invoice);
    outstandingAmount += remaining;
    // Canonical lateness: 0 while the due date is today or in the future, so a
    // status that has not been flipped to 'overdue' yet still counts correctly
    // and a future-dated unpaid invoice never reads as late.
    const daysOverdue = calculateDaysOverdue(invoice.due_date, today);
    if (daysOverdue > 0) {
      overdueInvoiceCount += 1;
      overdueAmount += remaining;
      oldestOverdueDays = Math.max(oldestOverdueDays, daysOverdue);
    }
  }

  const reasons: ContractAttentionReason[] = [];
  if (overdueInvoiceCount > 0) {
    // Deliberately terse: this string lands in a third-width mobile card cell.
    // Invoice counts and amounts belong to the row expansion and the summary
    // banner, where there is room for them.
    reasons.push(buildReason('overdue_invoice', `منذ ${formatDayCount(oldestOverdueDays)}`));
  }
  if (isExpired) reasons.push(buildReason('expired'));
  if (isContractRejected(contract)) reasons.push(buildReason('approval_rejected', 'يحتاج تصحيحًا وإعادة إرسال'));
  if (receivableInvoiceCount > overdueInvoiceCount) {
    reasons.push(buildReason(
      'outstanding_balance',
      `${receivableInvoiceCount - overdueInvoiceCount} فاتورة غير مسددة`,
    ));
  }
  if (!isExpired && isExpiring) {
    reasons.push(buildReason('expiring_soon', daysUntilEnd === null ? null : `خلال ${formatDayCount(daysUntilEnd)}`));
  }
  if (isContractApprovalPending(contract)) reasons.push(buildReason('approval_pending'));
  if (isContractApproved(contract)) reasons.push(buildReason('approved_pending_activation'));

  reasons.sort((left, right) => flagRank.indexOf(left.flag) - flagRank.indexOf(right.flag));

  return {
    contractId: contract.id,
    daysUntilEnd,
    isExpired,
    isExpiringSoon: isExpiring,
    invoiceContextLoaded,
    receivableInvoiceCount,
    overdueInvoiceCount,
    oldestOverdueDays,
    outstandingInvoiceCount: receivableInvoiceCount,
    outstandingAmount,
    overdueAmount,
    reasons,
    primaryReason: reasons[0] ?? null,
    severity: reasons[0]?.severity ?? null,
    nextAction: getContractNextAction(contract, referenceDate),
  };
}

export function summarizeContractAttention(
  attention: Iterable<ContractAttention>,
): ContractAttentionSummary {
  const summary = { ...EMPTY_CONTRACT_ATTENTION_SUMMARY } as { -readonly [K in keyof ContractAttentionSummary]: ContractAttentionSummary[K] };

  for (const entry of attention) {
    const flags = new Set(entry.reasons.map((reason) => reason.flag));
    if (flags.size > 0) summary.needingAttention += 1;
    if (paymentAttentionFlags.some((flag) => flags.has(flag))) summary.paymentAttention += 1;
    if (expiryAttentionFlags.some((flag) => flags.has(flag))) summary.expiryAttention += 1;
    if (lifecycleAttentionFlags.some((flag) => flags.has(flag))) summary.lifecycleAttention += 1;
    summary.overdueInvoices += entry.overdueInvoiceCount;
    summary.overdueAmount += entry.overdueAmount;
    summary.outstandingAmount += entry.outstandingAmount;
  }

  return summary;
}

/** Groups a flat batched invoice read by contract so derivation stays O(n). */
export function groupInvoicesByContractId(
  invoices: readonly DossierInvoiceRow[],
): Map<string, DossierInvoiceRow[]> {
  const grouped = new Map<string, DossierInvoiceRow[]>();
  for (const invoice of invoices) {
    const bucket = grouped.get(invoice.contract_id);
    if (bucket) bucket.push(invoice);
    else grouped.set(invoice.contract_id, [invoice]);
  }
  return grouped;
}
