/**
 * WP-05 Financial Closeout services — GAP-018
 * The variance diagnostics / correction-proposal governance lane.
 * Reconciliation and GL statements/cash flow live in
 * `@/features/accounting/reports/accountingReportsFacade` (single authority).
 * The S08 frozen-review and S09 correction engines (GAP-015/016) are
 * DB-owned `s08_*` / `s09_*` RPCs with no browser workspace yet; browser
 * wrappers are added together with that workspace, not ahead of it.
 * All amounts are OMR 3dp, tolerance 0.001.
 */

import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import type { ReconciliationRow } from '@/features/accounting/reports/contracts';

function asRecord(v: unknown): Record<string, unknown> {
  return (v && typeof v === 'object' && !Array.isArray(v) ? v : {}) as Record<string, unknown>;
}
function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function asNumber(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0;
}
function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function todayLocalDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeReconciliationRow(v: unknown): ReconciliationRow {
  const r = asRecord(v);
  return {
    reconciliation_class: asString(r.reconciliation_class),
    account_no: asString(r.account_no),
    account_name: asString(r.account_name),
    subledger_balance: asNumber(r.subledger_balance),
    gl_balance: asNumber(r.gl_balance),
    variance: asNumber(r.variance),
    abs_variance: asNumber(r.abs_variance),
    currency: asString(r.currency) || 'OMR',
    reconciliation_status: (asString(r.reconciliation_status) === 'PASS' ? 'PASS' : 'FAIL') as 'PASS' | 'FAIL',
    subledger_count: asNumber(r.subledger_count),
    gl_count: asNumber(r.gl_count),
  };
}

// ---------------------------------------------------------------------------
// GAP-018 — Variance diagnostics & pending-approval correction proposals
//
// This lane is analysis + governance only. Nothing here posts to the general
// ledger: generation raises PENDING_APPROVAL rows, and approval only authorises
// Accounting to open an S09 correction through the existing S08→S09 gate.
// ---------------------------------------------------------------------------
export type VarianceReasonCode =
  | 'RECONCILED'
  | 'GL_ACCOUNT_MISSING_IN_COA'
  | 'GL_NO_POSTINGS_FOR_ACCOUNT'
  | 'SUBLEDGER_MOVEMENT_NOT_POSTED_TO_GL'
  | 'GL_CONTRA_BALANCE_ON_DEBIT_NORMAL'
  | 'SUBLEDGER_OMITS_CREDIT_BALANCE_ROWS'
  | 'GL_POSTINGS_WITHOUT_SUBLEDGER_ROWS'
  | 'SUBLEDGER_SNAPSHOT_NOT_AS_OF'
  | 'UNCLASSIFIED_VARIANCE';

export type ProposalType = 'MAPPING_FIX' | 'MISSING_GL_POSTING' | 'SUBLEDGER_DATA_FIX' | 'INVESTIGATE_ONLY' | 'NONE';

export type ProposalStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED';

export type VarianceDiagnosticRow = ReconciliationRow & {
  reason_code: VarianceReasonCode;
  reason_detail: string;
  proposal_type: ProposalType;
  recommended_action: string;
  evidence: Record<string, unknown>;
};

export async function getVarianceDiagnostics(asOf?: string): Promise<VarianceDiagnosticRow[]> {
  const p_as_of = asOf ?? todayLocalDate();
  const { data, error } = await supabase.rpc('wp05_variance_diagnostics', { p_as_of });
  if (error) {
    handleSupabaseError(error, 'تعذر تحميل تشخيص فروقات المطابقة');
    return [];
  }
  const rows = Array.isArray(data) ? data : asArray(asRecord(data).rows ?? data);
  return rows.map((v) => {
    const r = asRecord(v);
    return {
      ...normalizeReconciliationRow(r),
      reason_code: asString(r.reason_code) as VarianceReasonCode,
      reason_detail: asString(r.reason_detail),
      proposal_type: asString(r.proposal_type) as ProposalType,
      recommended_action: asString(r.recommended_action),
      evidence: asRecord(r.evidence),
    };
  });
}

export type CorrectionProposal = {
  id: string;
  company_id: string;
  as_of: string;
  reconciliation_class: string;
  account_no: string | null;
  reason_code: VarianceReasonCode;
  reason_detail: string;
  proposal_type: ProposalType;
  recommended_action: string;
  status: ProposalStatus;
  subledger_balance: number;
  gl_balance: number;
  variance_amount: number;
  evidence: Record<string, unknown>;
  maker_user_id: string | null;
  checker_user_id: string | null;
  decided_at: string | null;
  decision_note: string | null;
  s09_correction_id: string | null;
  created_at: string;
};

function normalizeProposal(v: unknown): CorrectionProposal {
  const r = asRecord(v);
  return {
    id: asString(r.id),
    company_id: asString(r.company_id),
    as_of: asString(r.as_of),
    reconciliation_class: asString(r.reconciliation_class),
    account_no: (r.account_no as string) ?? null,
    reason_code: asString(r.reason_code) as VarianceReasonCode,
    reason_detail: asString(r.reason_detail),
    proposal_type: asString(r.proposal_type) as ProposalType,
    recommended_action: asString(r.recommended_action),
    status: asString(r.status) as ProposalStatus,
    subledger_balance: asNumber(r.subledger_balance),
    gl_balance: asNumber(r.gl_balance),
    variance_amount: asNumber(r.variance_amount),
    evidence: asRecord(r.evidence),
    maker_user_id: (r.maker_user_id as string) ?? null,
    checker_user_id: (r.checker_user_id as string) ?? null,
    decided_at: (r.decided_at as string) ?? null,
    decision_note: (r.decision_note as string) ?? null,
    s09_correction_id: (r.s09_correction_id as string) ?? null,
    created_at: asString(r.created_at),
  };
}

export async function listCorrectionProposals(
  status?: ProposalStatus,
  asOf?: string,
): Promise<CorrectionProposal[]> {
  const { data, error } = await supabase.rpc('wp05_list_correction_proposals', {
    p_status: status ?? null,
    p_as_of: asOf ?? null,
  });
  if (error) throw error;
  return asArray(asRecord(data).proposals).map(normalizeProposal);
}

/** Maker step. Raises one PENDING_APPROVAL proposal per failing class. Idempotent; posts nothing. */
export async function generateCorrectionProposals(payload?: {
  as_of?: string;
  request_id?: string;
  accounting_period_id?: string;
}): Promise<{
  success: boolean;
  created: number;
  already_present: number;
  reconciled_classes: number;
  posted_to_gl: boolean;
}> {
  const { data, error } = await supabase.rpc('wp05_generate_correction_proposals', {
    p_as_of: payload?.as_of ?? todayLocalDate(),
    p_request_id: payload?.request_id ?? null,
    p_accounting_period_id: payload?.accounting_period_id ?? null,
  });
  if (error) throw error;
  const r = asRecord(data);
  return {
    success: Boolean(r.success),
    created: asNumber(r.created),
    already_present: asNumber(r.already_present),
    reconciled_classes: asNumber(r.reconciled_classes),
    posted_to_gl: Boolean(r.posted_to_gl),
  };
}

/** Checker step. Requires ACCOUNTANT or ADMIN and a different user than the maker. Posts nothing. */
export async function approveCorrectionProposal(
  proposalId: string,
  note?: string,
): Promise<{ status: ProposalStatus; posted_to_gl: boolean }> {
  const { data, error } = await supabase.rpc('wp05_approve_correction_proposal', {
    p_proposal_id: proposalId,
    p_note: note ?? null,
  });
  if (error) throw error;
  const r = asRecord(data);
  return { status: asString(r.status) as ProposalStatus, posted_to_gl: Boolean(r.posted_to_gl) };
}

export async function rejectCorrectionProposal(
  proposalId: string,
  reason: string,
): Promise<{ status: ProposalStatus }> {
  const { data, error } = await supabase.rpc('wp05_reject_correction_proposal', {
    p_proposal_id: proposalId,
    p_reason: reason,
  });
  if (error) throw error;
  return { status: asString(asRecord(data).status) as ProposalStatus };
}

/** Proof that no unapproved correction ever reached the GL. */
export async function assertNoUnapprovedCorrectionPostings(): Promise<{
  success: boolean;
  proposal_sourced_gl_batches: number;
  applied_s09_without_approved_s08: number;
  proposals_pending_approval: number;
  proposals_approved: number;
  proposals_rejected: number;
}> {
  const { data, error } = await supabase.rpc('wp05_assert_no_unapproved_correction_postings', {});
  if (error) throw error;
  const r = asRecord(data);
  return {
    success: Boolean(r.success),
    proposal_sourced_gl_batches: asNumber(r.proposal_sourced_gl_batches),
    applied_s09_without_approved_s08: asNumber(r.applied_s09_without_approved_s08),
    proposals_pending_approval: asNumber(r.proposals_pending_approval),
    proposals_approved: asNumber(r.proposals_approved),
    proposals_rejected: asNumber(r.proposals_rejected),
  };
}
