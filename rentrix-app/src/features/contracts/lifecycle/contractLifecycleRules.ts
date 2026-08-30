import { isContractStatus } from '@/lib/contractStatus';
import { toDateOnlyISO as toDateInputValue } from '@/lib/formatters';
import type { ContractDetail } from '../services/contractService';
import type { RenewalPayload } from '../contractSchema';

const addDays = (value: string, days: number) => { const date = new Date(`${value}T00:00:00`); date.setDate(date.getDate() + days); return date; };
const addYear = (date: Date) => { const nextDate = new Date(date); nextDate.setFullYear(nextDate.getFullYear() + 1); nextDate.setDate(nextDate.getDate() - 1); return nextDate; };

// Compare canonically: legacy rows may store 'ACTIVE'/'ENDED' and must keep
// their renew/terminate actions instead of silently locking the lifecycle UI.
export const canRenewContract = (contract: ContractDetail) => isContractStatus(contract.status, 'active') || isContractStatus(contract.status, 'expired');
export const canTerminateContract = (contract: ContractDetail) => isContractStatus(contract.status, 'active') || isContractStatus(contract.status, 'draft');
export const canExtendShortStayContract = (contract: ContractDetail, today = new Date()) => (
  contract.lease_mode === 'short_stay'
  && isContractStatus(contract.status, 'active')
  && contract.end_date > toDateInputValue(today)
);
export const getRenewalDefaults = (contract: ContractDetail): RenewalPayload => {
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

export const isDraftContract = (contract: ContractDetail) => isContractStatus(contract.status, 'draft');
export const isContractApprovalPending = (contract: ContractDetail) => isDraftContract(contract) && normalizeApprovalStatus(contract.approval_status) === 'PENDING';
export const isContractApproved = (contract: ContractDetail) => isDraftContract(contract) && normalizeApprovalStatus(contract.approval_status) === 'APPROVED';
export const isContractRejected = (contract: ContractDetail) => isDraftContract(contract) && normalizeApprovalStatus(contract.approval_status) === 'REJECTED';

/** A draft can be submitted when it has never been approved (fresh or rejected). */
export const canSubmitContractForApproval = (contract: ContractDetail) =>
  isDraftContract(contract) && !isContractApprovalPending(contract) && !isContractApproved(contract);

export const canApproveContract = (contract: ContractDetail) => isContractApprovalPending(contract);
export const canRejectContract = (contract: ContractDetail) => isContractApprovalPending(contract);
export const canActivateContract = (contract: ContractDetail) => isContractApproved(contract);
