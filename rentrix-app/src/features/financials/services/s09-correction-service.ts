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
 *   s09_list_corrections(p_period_id, p_status)   -> read model
 *
 * The governing principle enforced end to end: a correction NEVER rewrites the
 * original posting. The original journal batch is referenced
 * (`original_journal_batch_id`) and preserved; the correction posts its own
 * separate balanced batch (`correction_journal_batch_id`). Both remain visible.
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
 * prevent.
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
    reversalBatchId:
      optionalText(record.reversal_batch_id) ?? optionalText(record.reversal_journal_batch_id),
    createdAt: optionalText(record.created_at),
    validatedAt: optionalText(record.validated_at),
    appliedAt: optionalText(record.applied_at),
    reversedAt: optionalText(record.reversed_at),
  };
}

export const s09CorrectionsQueryKey = ['financials', 's09-corrections'] as const;
export const s09ApprovedReviewsQueryKey = ['financials', 's08-approved-reviews'] as const;

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
  if (data === null || data === undefined) return [];
  if (!Array.isArray(data)) {
    fail('S09_LIST_RESPONSE_INVALID', 'استجابة قائمة التصحيحات غير صالحة.');
  }
  return data.map(parseS09Correction);
}

/** APPROVED S08 reviews — the only lawful anchor for a correction. */
export type S08ApprovedReview = {
  id: string;
  accountingPeriodId: string | null;
  createdAt: string | null;
};

export async function loadApprovedS08Reviews(): Promise<S08ApprovedReview[]> {
  const { data, error } = await supabase
    .from('s08_frozen_reviews')
    .select('id, accounting_period_id, created_at, reviewer_decision')
    .eq('reviewer_decision', 'APPROVED')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    return {
      id: requireText(record.id, 'id'),
      accountingPeriodId: optionalText(record.accounting_period_id),
      createdAt: optionalText(record.created_at),
    };
  });
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
