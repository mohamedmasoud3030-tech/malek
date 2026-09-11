/**
 * G5 — post-payment / post-close accounting correction (S09), with preservation
 * of the ORIGINAL SOURCE.
 *
 * Data layer for the deployed, already-granted RPC chain that had no
 * user-facing surface at all:
 *
 *   s09_create_correction_draft(p_payload jsonb)  -> DRAFT
 *   s09_validate_correction(p_correction_id uuid) -> VALIDATED
 *   s09_apply_correction(p_correction_id uuid)    -> APPLIED (posts the GL batch)
 *   s09_reverse_correction(p_correction_id, p_reason) -> REVERSED (compensating batch)
 *   s09_list_corrections(p_period_id, p_status)   -> read model
 *
 * The governing principle enforced end to end: a correction NEVER rewrites the
 * original posting. The original journal batch is referenced
 * (`original_journal_batch_id`) and preserved; the correction posts its own
 * separate balanced batch (`correction_journal_batch_id`). Both remain visible.
 * Reversal follows the same principle one level up: it NEVER deletes or edits
 * the correction batch — `reverse_journal_batch` marks it REVERSED and posts an
 * equal-and-opposite batch (`reversal_journal_batch_id`), so the full lineage
 * original → correction → reversal stays visible.
 *
 * Contract facts taken from the deployed bodies, not from documentation:
 *  - create requires review_id, source_type, source_id, reason, amount > 0 at
 *    exactly OMR 3dp, and either a debit/credit pair or explicit `lines`.
 *  - create is ADMIN/MANAGER; validate is ADMIN/MANAGER; apply is ACCOUNTANT or
 *    ADMIN (a MANAGER cannot apply). This asymmetry is deliberate and is
 *    surfaced, not smoothed over.
 *  - apply refuses unless status is exactly VALIDATED, and re-runs every
 *    invariant at apply time (including the S08 approval gate and the
 *    HARD_CLOSED period gate).
 *  - create is idempotent by request_id and returns the existing row.
 *  - reverse is ACCOUNTANT or ADMIN (same asymmetry as apply), refuses unless
 *    status is exactly APPLIED, requires a non-empty reason, and returns
 *    `{success, id, status:'REVERSED', reversal_batch_id, result}` where
 *    `result` is the nested `reverse_journal_batch` envelope.
 *  - the list RPC returns `{company_id, corrections:[...]}` — an OBJECT with
 *    the rows nested, never a bare array (regression-locked in the pglite
 *    suite; an earlier parser that expected a bare array failed closed on
 *    every real response).
 */
import { supabase } from '@/lib/supabase';
import type { SemanticTone } from '@/components/ui/status-badge';

const OMR_EXACT = 1000;

export class S09EvidenceError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'S09EvidenceError';
    this.code = code;
  }
}

function fail(code: string, message: string): never {
  throw new S09EvidenceError(code, message);
}

export const s09Statuses = ['DRAFT', 'VALIDATED', 'APPLIED', 'REVERSED'] as const;
export type S09Status = (typeof s09Statuses)[number];

export const s09StatusLabels: Record<S09Status, string> = {
  DRAFT: 'مسودة',
  VALIDATED: 'مُتحقَّق منها',
  APPLIED: 'مُطبَّقة',
  REVERSED: 'معكوسة',
};

export const s09StatusTone: Record<S09Status, SemanticTone> = {
  DRAFT: 'neutral',
  VALIDATED: 'warning',
  APPLIED: 'success',
  REVERSED: 'danger',
};

export type S09Correction = {
  id: string;
  accountingPeriodId: string | null;
  reviewId: string;
  sourceType: string;
  sourceId: string;
  reason: string;
  status: S09Status;
  amount: number;
  /** The GL batch of the correction itself. Null until APPLIED. */
  correctionBatchId: string | null;
  reversalBatchId: string | null;
  createdAt: string | null;
  validatedAt: string | null;
  appliedAt: string | null;
  reversedAt: string | null;
};

function requireText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    fail('S09_EVIDENCE_INCOMPLETE', `بيانات التصحيح ناقصة: الحقل «${field}» غير موجود.`);
  }
  return value.trim();
}

function optionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function requireOmr(value: unknown, field: string): number {
  if (value === null || value === undefined || value === '') {
    fail('S09_EVIDENCE_INCOMPLETE', `بيانات التصحيح ناقصة: الحقل «${field}» غير موجود.`);
  }
  if (typeof value === 'boolean' || typeof value === 'object') {
    fail('S09_EVIDENCE_INCOMPLETE', `بيانات التصحيح غير صالحة: الحقل «${field}» ليس رقماً.`);
  }
  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(parsed)) {
    fail('S09_EVIDENCE_INCOMPLETE', `بيانات التصحيح غير صالحة: الحقل «${field}» ليس رقماً.`);
  }
  if (Math.round(parsed * OMR_EXACT) !== Number((parsed * OMR_EXACT).toFixed(6))) {
    fail(
      'S09_AMOUNT_PRECISION_INVALID',
      `الحقل «${field}» مخالف لدقة الريال العماني (3 خانات عشرية).`,
    );
  }
  return parsed;
}

/**
 * Strict parser for a correction row. An APPLIED correction MUST carry its
 * correction batch id — otherwise the UI would be claiming a posting that has
 * no GL proof, which is exactly the failure mode this reconstruction exists to
 * prevent. A REVERSED correction MUST carry its reversal batch id for the same
 * reason: "reversed" without a posted compensating batch is an unproven claim.
 */
export function parseS09Correction(row: unknown): S09Correction {
  if (!row || typeof row !== 'object') {
    fail('S09_EVIDENCE_INCOMPLETE', 'سجل التصحيح غير صالح.');
  }
  const record = row as Record<string, unknown>;
  const status = optionalText(record.status);
  if (!status || !s09Statuses.includes(status as S09Status)) {
    fail('S09_STATUS_UNKNOWN', `حالة تصحيح غير معروفة: «${status ?? '—'}».`);
  }
  const correctionBatchId =
    optionalText(record.correction_batch_id) ?? optionalText(record.correction_journal_batch_id);
  if (status === 'APPLIED' && !correctionBatchId) {
    fail(
      'S09_APPLIED_WITHOUT_BATCH',
      'تصحيح مُطبَّق بلا قيد محاسبي مرحَّل؛ لا يُعرض كمُطبَّق.',
    );
  }
  const reversalBatchId =
    optionalText(record.reversal_batch_id) ?? optionalText(record.reversal_journal_batch_id);
  if (status === 'REVERSED' && !reversalBatchId) {
    fail(
      'S09_REVERSED_WITHOUT_BATCH',
      'تصحيح معكوس بلا قيد عكس مرحَّل؛ لا يُعرض كمعكوس.',
    );
  }
  return {
    id: requireText(record.id, 'id'),
    accountingPeriodId: optionalText(record.accounting_period_id),
    reviewId: requireText(record.review_id, 'review_id'),
    sourceType: requireText(record.source_type, 'source_type'),
    sourceId: requireText(record.source_id, 'source_id'),
    reason: requireText(record.reason, 'reason'),
    status: status as S09Status,
    amount: requireOmr(record.amount, 'amount'),
    correctionBatchId,
    reversalBatchId,
    createdAt: optionalText(record.created_at),
    validatedAt: optionalText(record.validated_at),
    appliedAt: optionalText(record.applied_at),
    reversedAt: optionalText(record.reversed_at),
  };
}

export const s09CorrectionsQueryKey = ['financials', 's09-corrections'] as const;
export const s09ApprovedReviewsQueryKey = ['financials', 's08-approved-reviews'] as const;

/**
 * Strict parser for the deployed list envelope. `s09_list_corrections` returns
 * `jsonb_build_object('company_id', …, 'corrections', […])` — an OBJECT with
 * the rows nested under `corrections`. A bare array is NOT the deployed shape
 * and is rejected rather than silently accepted: this parser was previously
 * array-only, which made every real response fail closed (defect found by
 * feeding the unmodified deployed body's output through the client parser in
 * the pglite suite).
 */
export function parseS09ListEnvelope(payload: unknown): S09Correction[] {
  if (payload === null || payload === undefined) {
    fail('S09_LIST_RESPONSE_INVALID', 'استجابة قائمة التصحيحات فارغة؛ لا تُعرض كقائمة خالية.');
  }
  if (typeof payload !== 'object' || Array.isArray(payload)) {
    fail('S09_LIST_RESPONSE_INVALID', 'استجابة قائمة التصحيحات غير صالحة.');
  }
  const rows = (payload as Record<string, unknown>).corrections;
  if (!Array.isArray(rows)) {
    fail('S09_LIST_RESPONSE_INVALID', 'استجابة قائمة التصحيحات لا تحمل سجلات التصحيحات.');
  }
  return rows.map(parseS09Correction);
}

/** Read model via the deployed list RPC (never a hand-rolled table query). */
export async function loadS09Corrections(options?: {
  periodId?: string | null;
  status?: S09Status | null;
}): Promise<S09Correction[]> {
  const { data, error } = await supabase.rpc('s09_list_corrections', {
    p_period_id: options?.periodId ?? null,
    p_status: options?.status ?? null,
  });
  if (error) throw error;
  return parseS09ListEnvelope(data);
}

/** APPROVED S08 reviews — the only lawful anchor for a correction. */
export type S08ApprovedReview = {
  id: string;
  accountingPeriodId: string | null;
  createdAt: string | null;
};

/**
 * Strict parser for the deployed `s08_list_frozen_reviews` envelope
 * `{company_id, reviews:[…]}` (same class as `parseS09ListEnvelope`, F13).
 * A malformed response fails closed with an Arabic reason; it is never
 * shown as an empty list.
 */
export function parseS08ReviewListEnvelope(payload: unknown): Array<Record<string, unknown>> {
  if (payload === null || payload === undefined) {
    fail('S08_LIST_RESPONSE_INVALID', 'استجابة قائمة المراجعات المجمدة فارغة؛ لا تُعرض كقائمة خالية.');
  }
  if (typeof payload !== 'object' || Array.isArray(payload)) {
    fail('S08_LIST_RESPONSE_INVALID', 'استجابة قائمة المراجعات المجمدة غير صالحة.');
  }
  const rows = (payload as Record<string, unknown>).reviews;
  if (!Array.isArray(rows)) {
    fail('S08_LIST_RESPONSE_INVALID', 'استجابة قائمة المراجعات المجمدة لا تحمل سجلات المراجعات.');
  }
  return rows.map((row) => {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      fail('S08_LIST_RESPONSE_INVALID', 'سجل مراجعة مجمدة غير صالح داخل الاستجابة.');
    }
    return row as Record<string, unknown>;
  });
}

/**
 * Read model via the deployed list RPC — never a hand-rolled table query.
 * The RPC is the authoritative metadata read path (granted to `authenticated`,
 * company-scoped server-side, metadata-only by construction: it never exposes
 * analysis_results / reconciliation_evidence / exceptions / expense snapshots).
 * A direct table SELECT would instead depend on the migration-11 RLS gate
 * (`financial.reports.view`), which is stricter than the server's own S09
 * anchor contract and can be revoked per-employee — breaking the panel for
 * users the server would still accept.
 */
export async function loadApprovedS08Reviews(): Promise<S08ApprovedReview[]> {
  const { data, error } = await supabase.rpc('s08_list_frozen_reviews', {
    p_period_id: null,
  });
  if (error) throw error;
  return parseS08ReviewListEnvelope(data)
    .filter((record) => record.reviewer_decision === 'APPROVED')
    .map((record) => ({
      id: requireText(record.id, 'id'),
      accountingPeriodId: optionalText(record.accounting_period_id),
      createdAt: optionalText(record.created_at),
    }))
    // The RPC orders by creation_timestamp desc; created_at is immutable
    // alongside it, so re-sorting client-side preserves the prior UI order.
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

export function createS09RequestId(prefix = 's09'): string {
  const unique =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${unique}`;
}

export type CreateS09DraftInput = {
  reviewId: string;
  sourceType: string;
  sourceId: string;
  reason: string;
  amount: number;
  debitAccountNo: string;
  creditAccountNo: string;
  requestId: string;
  accountingPeriodId?: string | null;
  /** The batch being corrected. Recorded, never modified. */
  originalJournalBatchId?: string | null;
};

export function buildCreateS09DraftPayload(input: CreateS09DraftInput) {
  const required: ReadonlyArray<readonly [string, string]> = [
    ['review_id', input.reviewId],
    ['source_type', input.sourceType],
    ['source_id', input.sourceId],
    ['reason', input.reason],
    ['debit_account_no', input.debitAccountNo],
    ['credit_account_no', input.creditAccountNo],
    ['request_id', input.requestId],
  ];
  for (const [field, value] of required) {
    if (typeof value !== 'string' || value.trim() === '') {
      fail('S09_REQUEST_INCOMPLETE', `الحقل «${field}» مطلوب لإنشاء مسودة التصحيح.`);
    }
  }
  if (!(input.amount > 0)) {
    fail('S09_AMOUNT_REQUIRED', 'مبلغ التصحيح يجب أن يكون أكبر من صفر.');
  }
  if (Math.round(input.amount * OMR_EXACT) !== input.amount * OMR_EXACT) {
    fail(
      'S09_AMOUNT_PRECISION_INVALID',
      'مبلغ التصحيح مخالف لدقة الريال العماني (3 خانات عشرية).',
    );
  }
  if (input.debitAccountNo.trim() === input.creditAccountNo.trim()) {
    fail(
      'S09_ACCOUNTS_IDENTICAL',
      'لا يجوز أن يكون الحساب المدين هو نفسه الحساب الدائن؛ القيد لن يعبّر عن أي تصحيح.',
    );
  }
  const payload: Record<string, string | number> = {
    review_id: input.reviewId.trim(),
    source_type: input.sourceType.trim(),
    source_id: input.sourceId.trim(),
    reason: input.reason.trim(),
    amount: input.amount,
    debit_account_no: input.debitAccountNo.trim(),
    credit_account_no: input.creditAccountNo.trim(),
    request_id: input.requestId.trim(),
  };
  if (input.accountingPeriodId) payload.accounting_period_id = input.accountingPeriodId;
  // The original batch is recorded for lineage. It is never edited, never
  // reversed implicitly, and never removed — the correction is a NEW batch.
  if (input.originalJournalBatchId) {
    payload.original_journal_batch_id = input.originalJournalBatchId;
  }
  return payload;
}

export type CreateS09DraftResult = {
  id: string;
  status: S09Status;
  idempotent: boolean;
};

export function parseCreateS09DraftResult(payload: unknown): CreateS09DraftResult {
  if (!payload || typeof payload !== 'object') {
    fail('S09_RESPONSE_INVALID', 'استجابة إنشاء المسودة غير صالحة.');
  }
  const record = payload as Record<string, unknown>;
  if (record.success !== true) {
    fail('S09_RESPONSE_INVALID', 'لم يؤكد الخادم إنشاء المسودة.');
  }
  const status = optionalText(record.status);
  if (!status || !s09Statuses.includes(status as S09Status)) {
    fail('S09_STATUS_UNKNOWN', `حالة غير معروفة للمسودة: «${status ?? '—'}».`);
  }
  return {
    id: requireText(record.id, 'id'),
    status: status as S09Status,
    idempotent: record.idempotent === true,
  };
}

export type ApplyS09Result = {
  id: string;
  status: 'APPLIED';
  /** GL proof of the correction. The original batch is untouched. */
  batchId: string;
};

export function parseApplyS09Result(payload: unknown): ApplyS09Result {
  if (!payload || typeof payload !== 'object') {
    fail('S09_RESPONSE_INVALID', 'استجابة تطبيق التصحيح غير صالحة.');
  }
  const record = payload as Record<string, unknown>;
  if (record.success !== true) {
    fail('S09_RESPONSE_INVALID', 'لم يؤكد الخادم تطبيق التصحيح.');
  }
  if (optionalText(record.status) !== 'APPLIED') {
    fail('S09_STATUS_UNKNOWN', 'لم يُرجع الخادم حالة «مُطبَّق» بعد التطبيق.');
  }
  const batchId = optionalText(record.batch_id);
  if (!batchId) {
    fail(
      'S09_APPLIED_WITHOUT_BATCH',
      'تعذّر إثبات ترحيل قيد التصحيح؛ لا تُعرض النتيجة كناجحة.',
    );
  }
  return { id: requireText(record.id, 'id'), status: 'APPLIED', batchId };
}

/**
 * Maps the authoritative server error vocabulary to operator-facing Arabic.
 * Unknown errors are surfaced verbatim rather than softened into a generic
 * message that would hide an accounting refusal.
 */
export function translateS09Error(error: unknown): string {
  const raw = [
    (error as { message?: unknown })?.message,
    (error as { code?: unknown })?.code,
    (error as { details?: unknown })?.details,
  ]
    .filter((part): part is string => typeof part === 'string')
    .join(' ');
  const map: ReadonlyArray<readonly [string, string]> = [
    [
      'S09_S08_APPROVAL_REQUIRED',
      'مراجعة S08 المرتبطة غير معتمدة؛ لا يجوز التصحيح قبل اعتمادها.',
    ],
    [
      'S09_PERIOD_HARD_CLOSED',
      'الفترة المحاسبية مقفلة نهائياً ولا تقبل أي تصحيح. لا يجوز إعادة فتحها لإخفاء الفرق.',
    ],
    [
      'S09_APPLY_STATUS_INVALID',
      'لا يمكن التطبيق إلا بعد التحقق؛ المسودة يجب أن تكون في حالة «مُتحقَّق منها».',
    ],
    [
      'S09_APPLY_REQUIRES_ACCOUNTANT',
      'تطبيق التصحيح يتطلب صلاحية محاسب أو مدير نظام (لا تكفي صلاحية المدير التشغيلي).',
    ],
    ['S09_VALIDATE_FAILED', 'التحقق فشل: المسودة ليست في حالة «مسودة» أو غير موجودة.'],
    [
      'S09_REVERSE_REQUIRES_ACCOUNTANT',
      'عكس التصحيح يتطلب صلاحية محاسب أو مدير نظام (لا تكفي صلاحية المدير التشغيلي).',
    ],
    [
      'S09_REVERSAL_REASON_REQUIRED',
      'سبب العكس مطلوب؛ لا يُعكس تصحيح مُطبَّق بدون سبب مسجَّل في الدليل.',
    ],
    [
      'S09_REVERSE_STATUS_INVALID',
      'لا يمكن العكس إلا لتصحيح في حالة «مُطبَّق»؛ العكس يتم بقيد تعويضي منفصل ولا يحذف أي سجل.',
    ],
    ['S09_REVERSE_NO_BATCH', 'التصحيح المُطبَّق لا يحمل قيداً مرحَّلاً يمكن عكسه.'],
    ['S09_CORRECTION_ID_REQUIRED', 'معرّف التصحيح مطلوب.'],
    [
      'GL_REVERSAL_STATE_INVALID',
      'قيد التصحيح ليس في حالة «مُرحَّل»؛ لا يمكن إنشاء قيد العكس التعويضي.',
    ],
    ['S09_UNBALANCED', 'قيد التصحيح غير متوازن؛ مجموع المدين لا يساوي مجموع الدائن.'],
    ['S09_AMOUNT_PRECISION_INVALID', 'مبلغ التصحيح مخالف لدقة الريال العماني (3 خانات عشرية).'],
    ['S09_ACCOUNT_COMPANY_MISMATCH', 'الحساب المحدد لا يخص شركتك.'],
    ['S09_ACCOUNT_NOT_FOUND', 'رقم الحساب غير موجود أو غير مفعَّل في شجرة حسابات شركتك.'],
    ['S09_S08_REVIEW_COMPANY_MISMATCH', 'مراجعة S08 غير موجودة ضمن نطاق شركتك.'],
    ['S09_COMPANY_MISMATCH', 'شركة التصحيح لا تطابق شركة المراجعة.'],
    ['S09_PERIOD_MISMATCH', 'الفترة المحاسبية للتصحيح لا تطابق فترة المراجعة.'],
    ['S09_LINEAGE_MISMATCH', 'سلسلة مصدر البيانات لا تطابق المراجعة المرتبطة.'],
    ['S09_CORRECTION_NOT_FOUND', 'التصحيح غير موجود ضمن نطاق شركتك.'],
    ['S09_REASON_REQUIRED', 'سبب التصحيح مطلوب.'],
    ['S09_SOURCE_REQUIRED', 'نوع المصدر ومعرّفه مطلوبان.'],
    ['S09_REVIEW_ID_REQUIRED', 'معرّف مراجعة S08 مطلوب.'],
    ['S09_AMOUNT_REQUIRED', 'مبلغ موجب مطلوب.'],
    ['ADMIN or MANAGER required', 'هذا الإجراء يتطلب صلاحية مدير نظام أو مدير.'],
  ];
  for (const [needle, message] of map) {
    if (raw.includes(needle)) return message;
  }
  return raw.trim() || 'تعذّر تنفيذ التصحيح.';
}

export async function createS09CorrectionDraft(
  input: CreateS09DraftInput,
): Promise<CreateS09DraftResult> {
  const { data, error } = await supabase.rpc('s09_create_correction_draft', {
    p_payload: buildCreateS09DraftPayload(input),
  });
  if (error) throw error;
  return parseCreateS09DraftResult(data);
}

export async function validateS09Correction(correctionId: string): Promise<S09Status> {
  const { data, error } = await supabase.rpc('s09_validate_correction', {
    p_correction_id: correctionId,
  });
  if (error) throw error;
  const record = (data ?? {}) as Record<string, unknown>;
  if (record.success !== true || optionalText(record.status) !== 'VALIDATED') {
    fail('S09_RESPONSE_INVALID', 'لم يؤكد الخادم التحقق من التصحيح.');
  }
  return 'VALIDATED';
}

export async function applyS09Correction(correctionId: string): Promise<ApplyS09Result> {
  const { data, error } = await supabase.rpc('s09_apply_correction', {
    p_correction_id: correctionId,
  });
  if (error) throw error;
  return parseApplyS09Result(data);
}

export type ReverseS09Args = {
  p_correction_id: string;
  p_reason: string;
};

/**
 * Pure, fail-closed argument builder for `s09_reverse_correction`. Mirrors the
 * deployed guards (id required, non-empty reason) so the refusal happens before
 * a request is sent; the server re-checks both regardless.
 */
export function buildReverseS09Args(correctionId: string, reason: string): ReverseS09Args {
  if (typeof correctionId !== 'string' || correctionId.trim() === '') {
    fail('S09_CORRECTION_ID_REQUIRED', 'معرّف التصحيح مطلوب لعكسه.');
  }
  if (typeof reason !== 'string' || reason.trim() === '') {
    fail(
      'S09_REVERSAL_REASON_REQUIRED',
      'سبب العكس مطلوب؛ لا يُعكس تصحيح مُطبَّق بدون سبب مسجَّل في الدليل.',
    );
  }
  return { p_correction_id: correctionId.trim(), p_reason: reason.trim() };
}

export type ReverseS09Result = {
  id: string;
  status: 'REVERSED';
  /**
   * GL proof of the compensating reversal. The correction batch itself is
   * retained (marked REVERSED) and the original source batch is untouched.
   */
  reversalBatchId: string;
  /** True only when the nested reverse_journal_batch envelope says so. */
  idempotent: boolean;
};

/**
 * Strict parser for the deployed reverse envelope:
 * `{success, id, status:'REVERSED', reversal_batch_id, result}` where `result`
 * is the nested `reverse_journal_batch` envelope carrying its own
 * `reversal_batch_id`. When both are present they MUST agree — contradictory
 * evidence is rejected, never smoothed over (same discipline as the owner
 * position cash parser).
 */
export function parseReverseS09Result(payload: unknown): ReverseS09Result {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    fail('S09_RESPONSE_INVALID', 'استجابة عكس التصحيح غير صالحة.');
  }
  const record = payload as Record<string, unknown>;
  if (record.success !== true) {
    fail('S09_RESPONSE_INVALID', 'لم يؤكد الخادم عكس التصحيح.');
  }
  if (optionalText(record.status) !== 'REVERSED') {
    fail('S09_STATUS_UNKNOWN', 'لم يُرجع الخادم حالة «معكوس» بعد العكس.');
  }
  const reversalBatchId = optionalText(record.reversal_batch_id);
  if (!reversalBatchId) {
    fail(
      'S09_REVERSED_WITHOUT_BATCH',
      'تعذّر إثبات ترحيل قيد العكس؛ لا تُعرض النتيجة كناجحة.',
    );
  }
  let idempotent = false;
  if (record.result !== null && record.result !== undefined) {
    if (typeof record.result !== 'object' || Array.isArray(record.result)) {
      fail('S09_RESPONSE_INVALID', 'استجابة عكس التصحيح تحمل نتيجة داخلية غير صالحة.');
    }
    const nested = record.result as Record<string, unknown>;
    if (nested.success !== true) {
      fail('S09_RESPONSE_INVALID', 'قيد العكس لم يؤكد نجاحه داخل نتيجة العكس.');
    }
    if (optionalText(nested.reversal_batch_id) !== reversalBatchId) {
      fail(
        'S09_RESPONSE_CONTRADICTION',
        'معرّف قيد العكس متضارب بين الاستجابة والنتيجة الداخلية؛ لا تُعرض النتيجة كناجحة.',
      );
    }
    idempotent = nested.idempotent === true;
  }
  return { id: requireText(record.id, 'id'), status: 'REVERSED', reversalBatchId, idempotent };
}

/**
 * Reverses an APPLIED correction through the deployed RPC. This NEVER deletes
 * or edits posted history: `reverse_journal_batch` marks the correction batch
 * REVERSED and posts an equal-and-opposite batch; the original source posting
 * was never touched by the correction and is not touched by the reversal.
 */
export async function reverseS09Correction(
  correctionId: string,
  reason: string,
): Promise<ReverseS09Result> {
  const args = buildReverseS09Args(correctionId, reason);
  const { data, error } = await supabase.rpc('s09_reverse_correction', args);
  if (error) throw error;
  return parseReverseS09Result(data);
}
