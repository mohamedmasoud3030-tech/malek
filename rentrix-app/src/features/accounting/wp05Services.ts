/**
 * WP-05 Financial Closeout services — GAP-013..016
 * Covers deterministic reconciliation, GL-backed statements & cash flow,
 * frozen S08 reviews, and controlled S09 corrections.
 * All amounts are OMR 3dp, tolerance 0.001.
 */

import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';

type Json = Record<string, unknown>;

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

// ---------------------------------------------------------------------------
// GAP-013 — Reconciliation
// ---------------------------------------------------------------------------
export type ReconciliationRow = {
  reconciliation_class: string;
  account_no: string;
  account_name: string;
  subledger_balance: number;
  gl_balance: number;
  variance: number;
  abs_variance: number;
  currency: string;
  reconciliation_status: 'PASS' | 'FAIL';
  subledger_count: number;
  gl_count: number;
};

export async function getReconciliation(asOf?: string): Promise<ReconciliationRow[]> {
  const p_as_of = asOf ?? todayLocalDate();
  const { data, error } = await (supabase.rpc as any)('wp05_reconcile_all', { p_as_of });
  if (error) {
    handleSupabaseError(error, 'تعذر تحميل مطابقة دفتر الأستاذ');
    return [];
  }
  // data may be array directly (since function returns table)
  if (Array.isArray(data)) {
    return data.map(normalizeReconciliationRow);
  }
  const rows = asArray(asRecord(data).rows ?? data);
  return rows.map(normalizeReconciliationRow);
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

export async function assertReconciliation(asOf?: string): Promise<{ success: boolean; details?: unknown }> {
  const p_as_of = asOf ?? todayLocalDate();
  const { data, error } = await (supabase.rpc as any)('wp05_assert_reconciliation', { p_as_of });
  if (error) throw error;
  return asRecord(data) as { success: boolean; details?: unknown };
}

// ---------------------------------------------------------------------------
// GAP-014 — Cash Flow & GL statements
// ---------------------------------------------------------------------------
export type CashFlowReport = {
  period: { from: string | null; to: string | null };
  opening_cash: number;
  operating: number;
  investing: number;
  financing: number;
  unclassified: number;
  total_change: number;
  closing_cash: number;
  variance: number;
  is_balanced: boolean;
  currency: string;
};

export async function getCashFlowReport(from: string, to: string): Promise<CashFlowReport> {
  const { data, error } = await (supabase.rpc as any)('wp05_rpt_cash_flow_gl', { p_from: from, p_to: to });
  if (error) throw error;
  const r = asRecord(data);
  const period = asRecord(r.period);
  return {
    period: { from: (period.from as string) ?? from, to: (period.to as string) ?? to },
    opening_cash: asNumber(r.opening_cash),
    operating: asNumber(r.operating),
    investing: asNumber(r.investing),
    financing: asNumber(r.financing),
    unclassified: asNumber(r.unclassified),
    total_change: asNumber(r.total_change),
    closing_cash: asNumber(r.closing_cash),
    variance: asNumber(r.variance),
    is_balanced: Boolean(r.is_balanced),
    currency: asString(r.currency) || 'OMR',
  };
}

export type CashFlowDrillthroughRow = {
  classification: string;
  account_id: string;
  account_no: string;
  account_name: string;
  batch_id: string;
  source_type: string;
  source_id: string;
  event_id: string;
  effective_date: string;
  posted_at: string | null;
  debit: number;
  credit: number;
  amount: number;
  line_description: string | null;
  ref_source_id: string | null;
  ref_entity_type: string | null;
  ref_entity_id: string | null;
};

export async function getCashFlowDrillthrough(from: string, to: string, classification?: string): Promise<CashFlowDrillthroughRow[]> {
  const { data, error } = await (supabase.rpc as any)('wp05_cash_flow_drillthrough', {
    p_from: from,
    p_to: to,
    p_classification: classification ?? null,
  });
  if (error) throw error;
  const rows = Array.isArray(data) ? data : asArray(data);
  return rows.map((v) => {
    const r = asRecord(v);
    return {
      classification: asString(r.classification),
      account_id: asString(r.account_id),
      account_no: asString(r.account_no),
      account_name: asString(r.account_name),
      batch_id: asString(r.batch_id),
      source_type: asString(r.source_type),
      source_id: asString(r.source_id),
      event_id: asString(r.event_id),
      effective_date: asString(r.effective_date),
      posted_at: (r.posted_at as string) ?? null,
      debit: asNumber(r.debit),
      credit: asNumber(r.credit),
      amount: asNumber(r.amount),
      line_description: (r.line_description as string) ?? null,
      ref_source_id: (r.ref_source_id as string) ?? null,
      ref_entity_type: (r.ref_entity_type as string) ?? null,
      ref_entity_id: (r.ref_entity_id as string) ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// GAP-015 — S08 Frozen Reviews
// ---------------------------------------------------------------------------
export type FrozenReview = {
  id: string;
  company_id: string;
  accounting_period_id: string | null;
  dataset_fingerprint: string;
  dataset_lineage: string;
  analysis_version: string;
  reviewer_decision: 'CREATED' | 'ANALYZED' | 'APPROVED' | 'REJECTED';
  creation_timestamp: string;
  reviewed_at: string | null;
  evidence_reference: string | null;
  created_at: string;
};

export async function listFrozenReviews(periodId?: string): Promise<FrozenReview[]> {
  const { data, error } = await (supabase.rpc as any)('s08_list_frozen_reviews', {
    p_period_id: periodId ?? null,
  });
  if (error) throw error;
  const root = asRecord(data);
  const rows = asArray(root.reviews);
  return rows.map((v) => {
    const r = asRecord(v);
    return {
      id: asString(r.id),
      company_id: asString(r.company_id),
      accounting_period_id: (r.accounting_period_id as string) ?? null,
      dataset_fingerprint: asString(r.dataset_fingerprint),
      dataset_lineage: asString(r.dataset_lineage),
      analysis_version: asString(r.analysis_version),
      reviewer_decision: asString(r.reviewer_decision) as FrozenReview['reviewer_decision'],
      creation_timestamp: asString(r.creation_timestamp),
      reviewed_at: (r.reviewed_at as string) ?? null,
      evidence_reference: (r.evidence_reference as string) ?? null,
      created_at: asString(r.created_at),
    };
  });
}

export async function createFrozenReview(payload: {
  accounting_period_id: string;
  analysis_version?: string;
  dataset_lineage?: string;
  evidence_reference?: string;
  analysis_results?: unknown;
  reconciliation_evidence?: unknown;
  exceptions?: unknown;
  review_scope?: unknown;
}): Promise<{ id: string; status: string; fingerprint: string }> {
  const { data, error } = await (supabase.rpc as any)('s08_create_frozen_review', {
    p_payload: payload,
  });
  if (error) throw error;
  const r = asRecord(data);
  return { id: asString(r.id), status: asString(r.status), fingerprint: asString(r.fingerprint) };
}

export async function analyzeFrozenReview(reviewId: string, results?: unknown): Promise<void> {
  const { error } = await (supabase.rpc as any)('s08_analyze_frozen_review', {
    p_review_id: reviewId,
    p_analysis_results: results ?? null,
  });
  if (error) throw error;
}

export async function approveFrozenReview(reviewId: string, notes?: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('s08_approve_frozen_review', {
    p_review_id: reviewId,
    p_notes: notes ?? null,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// GAP-016 — S09 Corrections
// ---------------------------------------------------------------------------
export type Correction = {
  id: string;
  company_id: string;
  accounting_period_id: string | null;
  review_id: string;
  source_type: string;
  source_id: string;
  reason: string;
  status: 'DRAFT' | 'VALIDATED' | 'APPLIED' | 'REVERSED';
  amount: number;
  correction_batch_id: string | null;
  reversal_batch_id: string | null;
  created_at: string;
};

export async function listCorrections(periodId?: string, status?: string): Promise<Correction[]> {
  const { data, error } = await (supabase.rpc as any)('s09_list_corrections', {
    p_period_id: periodId ?? null,
    p_status: status ?? null,
  });
  if (error) throw error;
  const root = asRecord(data);
  const rows = asArray(root.corrections);
  return rows.map((v) => {
    const r = asRecord(v);
    return {
      id: asString(r.id),
      company_id: asString(r.company_id),
      accounting_period_id: (r.accounting_period_id as string) ?? null,
      review_id: asString(r.review_id),
      source_type: asString(r.source_type),
      source_id: asString(r.source_id),
      reason: asString(r.reason),
      status: asString(r.status) as Correction['status'],
      amount: asNumber(r.amount),
      correction_batch_id: (r.correction_batch_id as string) ?? null,
      reversal_batch_id: (r.reversal_batch_id as string) ?? null,
      created_at: asString(r.created_at),
    };
  });
}

export async function createCorrectionDraft(payload: {
  accounting_period_id?: string;
  review_id: string;
  source_type: string;
  source_id: string;
  reason: string;
  amount: number;
  debit_account_no?: string;
  credit_account_no?: string;
  before_evidence?: unknown;
  after_evidence?: unknown;
  request_id?: string;
}): Promise<{ id: string; status: string }> {
  const { data, error } = await (supabase.rpc as any)('s09_create_correction_draft', {
    p_payload: payload,
  });
  if (error) throw error;
  const r = asRecord(data);
  return { id: asString(r.id), status: asString(r.status) };
}

export async function validateCorrection(correctionId: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('s09_validate_correction', {
    p_correction_id: correctionId,
  });
  if (error) throw error;
}

export async function applyCorrection(correctionId: string): Promise<{ batch_id: string }> {
  const { data, error } = await (supabase.rpc as any)('s09_apply_correction', {
    p_correction_id: correctionId,
  });
  if (error) throw error;
  const r = asRecord(data);
  return { batch_id: asString(r.batch_id) };
}

export async function reverseCorrection(correctionId: string, reason: string): Promise<{ reversal_batch_id: string }> {
  const { data, error } = await (supabase.rpc as any)('s09_reverse_correction', {
    p_correction_id: correctionId,
    p_reason: reason,
  });
  if (error) throw error;
  const r = asRecord(data);
  return { reversal_batch_id: asString(r.reversal_batch_id) };
}
