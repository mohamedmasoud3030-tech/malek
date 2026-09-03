import { isContractStatus } from '@/lib/contractStatus';
import { toDateOnlyISO as toDateInputValue } from '@/lib/formatters';
import type { ContractListItem } from '../services/contractService';
import type { RenewalPayload } from '../contractSchema';
import { isExpiringSoon } from '../hooks/useContractFilters';

const addDays = (value: string, days: number) => { const date = new Date(`${value}T00:00:00`); date.setDate(date.getDate() + days); return date; };
const addYear = (date: Date) => { const nextDate = new Date(date); nextDate.setFullYear(nextDate.getFullYear() + 1); nextDate.setDate(nextDate.getDate() - 1); return nextDate; };

/**
 * The narrow structural shape every rule below actually reads.
 *
 * These predicates used to demand a full `ContractDetail`, which forced the
 * register (which only holds `ContractListItem` rows) to duplicate the rules
 * locally. `ContractDetail` is `ContractListItem & { renewed_from }` and none
 * of the rules touch `renewed_from`, so widening the parameter is safe:
 * existing detail-workspace callers still typecheck unchanged, and register
 * rows now reuse the canonical rules instead of re-deriving them.
 */
export type ContractLifecycleSubject = Pick<
  ContractListItem,
  'status' | 'approval_status' | 'lease_mode' | 'end_date' | 'rent_amount' | 'agreement_id'
>;

// Compare canonically: legacy rows may store 'ACTIVE'/'ENDED' and must keep
// their renew/terminate actions instead of silently locking the lifecycle UI.
export const canRenewContract = (contract: ContractLifecycleSubject) => isContractStatus(contract.status, 'active') || isContractStatus(contract.status, 'expired');
export const canTerminateContract = (contract: ContractLifecycleSubject) => isContractStatus(contract.status, 'active') || isContractStatus(contract.status, 'draft');
export const canExtendShortStayContract = (contract: ContractLifecycleSubject, today = new Date()) => (
  contract.lease_mode === 'short_stay'
  && isContractStatus(contract.status, 'active')
  && contract.end_date > toDateInputValue(today)
);
export const getRenewalDefaults = (contract: ContractLifecycleSubject): RenewalPayload => {
  const nextStart = addDays(contract.end_date, 1);
  return { new_start: toDateInputValue(nextStart), new_end: toDateInputValue(addYear(nextStart)), new_amount: contract.rent_amount, agreement_id: contract.agreement_id };
};

// ─────────────────────────────────────────────────────────────────────────────
// Canonical approval sub-state on draft contracts (S04-T03 / DOM-005 / D11).
// The DB stores approval_status as 'PENDING' | 'APPROVED' | 'REJECTED' | NULL.
// Approval is a sub-state of `draft`: activation is the only path to 'active'.
// ─────────────────────────────────────────────────────────────────────────────

export type ContractApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export function normalizeApprovalStatus(approvalStatus: string | null | undefined): ContractApprovalStatus | null {
  const value = (approvalStatus ?? '').trim().toUpperCase();
  return value === 'PENDING' || value === 'APPROVED' || value === 'REJECTED' ? value : null;
}

export const isDraftContract = (contract: ContractLifecycleSubject) => isContractStatus(contract.status, 'draft');
export const isContractApprovalPending = (contract: ContractLifecycleSubject) => isDraftContract(contract) && normalizeApprovalStatus(contract.approval_status) === 'PENDING';
export const isContractApproved = (contract: ContractLifecycleSubject) => isDraftContract(contract) && normalizeApprovalStatus(contract.approval_status) === 'APPROVED';
export const isContractRejected = (contract: ContractLifecycleSubject) => isDraftContract(contract) && normalizeApprovalStatus(contract.approval_status) === 'REJECTED';

/** A draft can be submitted when it has never been approved (fresh or rejected). */
export const canSubmitContractForApproval = (contract: ContractLifecycleSubject) =>
  isDraftContract(contract) && !isContractApprovalPending(contract) && !isContractApproved(contract);

export const canApproveContract = (contract: ContractLifecycleSubject) => isContractApprovalPending(contract);
export const canRejectContract = (contract: ContractLifecycleSubject) => isContractApprovalPending(contract);
export const canActivateContract = (contract: ContractLifecycleSubject) => isContractApproved(contract);

// ─────────────────────────────────────────────────────────────────────────────
// Canonical "what happens next" presentation.
//
// The register needs to tell an operator the single next lifecycle step
// without re-implementing the rules above. This is a pure *projection* of
// those rules — it introduces no new transition, grants no new permission,
// and never decides whether an action succeeds (the server commands remain
// the authority). Callers still gate the affordance behind `canAccess`.
// ─────────────────────────────────────────────────────────────────────────────

export type ContractNextAction =
  | 'submit_for_approval'
  | 'approve_or_reject'
  | 'activate'
  | 'renew'
  | 'extend_short_stay'
  | 'terminate';

export const contractNextActionLabels: Record<ContractNextAction, string> = {
  submit_for_approval: 'إرسال للاعتماد',
  approve_or_reject: 'اعتماد أو رفض',
  activate: 'تفعيل العقد',
  renew: 'تجديد العقد',
  extend_short_stay: 'تمديد الإقامة',
  terminate: 'إنهاء العقد',
};

/**
 * Short register/mobile wording for the same canonical actions.
 *
 * Phrased as the step to take, not as the state — the attention column already
 * states the state, so echoing it here would put the same words twice on one
 * card.
 */
export const contractNextActionShortLabels: Record<ContractNextAction, string> = {
  submit_for_approval: 'إرسال للاعتماد',
  approve_or_reject: 'اعتماد أو رفض',
  activate: 'تفعيل',
  renew: 'تجديد',
  extend_short_stay: 'تمديد',
  terminate: 'إنهاء',
};

/**
 * The one lifecycle step this contract is waiting on, or `null` when it is
 * healthy and nothing is due.
 *
 * A routine active contract deliberately yields `null`: renewal is only the
 * next step once the canonical expiry window (`isExpiringSoon`) is reached, so
 * the register does not shout "renew" at every healthy row. Termination is
 * likewise never *recommended* — it stays a discretionary action in the row
 * menu, so a healthy contract reports "nothing due" instead of inviting the
 * operator to end it.
 */
export function getContractNextAction(
  contract: ContractLifecycleSubject,
  today = new Date(),
): ContractNextAction | null {
  if (isDraftContract(contract)) {
    if (isContractApprovalPending(contract)) return 'approve_or_reject';
    if (isContractApproved(contract)) return 'activate';
    if (canSubmitContractForApproval(contract)) return 'submit_for_approval';
    return null;
  }
  if (canExtendShortStayContract(contract, today)) return 'extend_short_stay';
  // Renewal becomes the next step only when the term is actually ending: an
  // already-expired contract, or an active one inside the canonical window.
  if (canRenewContract(contract) && (isContractStatus(contract.status, 'expired') || isExpiringSoon(contract, today))) {
    return 'renew';
  }
  return null;
}
