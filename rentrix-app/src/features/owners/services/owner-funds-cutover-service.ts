import { supabase } from '@/lib/supabase';
import { parseS08ReviewListEnvelope } from '@/features/financials/services/s09-correction-service';

/**
 * G6 — Governed historical adoption (owner-funds cutover) read/write authority.
 *
 * This module is the single client-side authority for the two RPCs that already
 * exist in the database and are granted to `authenticated`:
 *   - `public.create_owner_funds_cutover_atomic(p_payload jsonb)`
 *   - `public.approve_owner_funds_cutover_atomic(p_payload jsonb)`
 *
 * NOTHING here invents an accounting rule. The rules are fixed by the deployed
 * function bodies and are copied exactly:
 *
 *  - The opening balance is DERIVED SERVER-SIDE from GL account `2000`
 *    (`wp05_gl_balance`) at the cutover date, together with the account line
 *    count, and hashed into `source_fingerprint`. A client can never submit an
 *    amount, and must never send `company_id` (the server rejects it with
 *    `OWNER_FUNDS_CUTOVER_COMPANY_SERVER_DERIVED`).
 *  - Adoption requires an S08 frozen review whose `reviewer_decision` is
 *    `APPROVED` for the same company (`OWNER_FUNDS_CUTOVER_S08_APPROVAL_REQUIRED`).
 *  - Maker/checker: the approver must be a DIFFERENT authorized user from the
 *    draft creator (`OWNER_FUNDS_CUTOVER_MAKER_CHECKER_REQUIRED`).
 *  - If GL 2000 or its line count changed after the draft baseline, approval
 *    fails closed (`OWNER_FUNDS_CUTOVER_STALE_REVIEW_REQUIRED`) instead of
 *    adopting a balance that no longer matches its evidence.
 *  - The only lawful statuses are `DRAFT | APPROVED | REJECTED`.
 *
 * Fail-closed discipline: the absence of a cutover is NOT a zero opening
 * balance. Any response missing evidence, carrying a non-OMR-precision amount,
 * or contradicting itself (e.g. APPROVED without an approver) is REJECTED and
 * surfaced as a gap — never coerced to `0`, never presented as a full total.
 */

export const ownerFundsCutoverStatuses = ['DRAFT', 'APPROVED', 'REJECTED'] as const;
export type OwnerFundsCutoverStatus = (typeof ownerFundsCutoverStatuses)[number];

export const ownerFundsCutoverStatusLabels: Record<OwnerFundsCutoverStatus, string> = {
  DRAFT: 'مسودة — بانتظار اعتماد طرف آخر',
  APPROVED: 'معتمد',
  REJECTED: 'مرفوض',
};

/** The GL account whose derived balance IS the adopted opening baseline. */
export const OWNER_FUNDS_GL_ACCOUNT = '2000';

const OMR_EXACT = 1000;

export class OwnerFundsCutoverEvidenceError extends Error {
  readonly code: string;
  constructor(code: string, messageAr: string) {
    super(messageAr);
    this.name = 'OwnerFundsCutoverEvidenceError';
    this.code = code;
  }
}

export type OwnerFundsCutoverEvidence = {
  /** Governed effective date of the adopted baseline. */
  cutoverDate: string;
  /** DERIVED server-side from GL 2000 at `cutoverDate`. Never entered by a user. */
  openingBalanceOmr: number;
  /** Line count of GL 2000 at `cutoverDate` — the evidence behind the balance. */
  glLineCount: number;
  /** sha256 of company + date + balance + line count + S08 review id. */
  sourceFingerprint: string;
  /** Approved S08 frozen review that authorizes adoption. */
  s08ReviewId: string;
  status: OwnerFundsCutoverStatus;
  reason: string | null;
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
};

export type OwnerFundsCutoverReadState =
  | {
      /** No baseline exists yet: every pre-cutover position must fail closed. */
      adopted: false;
      evidence: null;
    }
  | { adopted: true; evidence: OwnerFundsCutoverEvidence };

export type ApprovedS08ReviewOption = {
  id: string;
  datasetLineage: string;
  reviewedAt: string | null;
};

/** Explicit 3-decimal OMR assertion. Server evidence is never silently rounded. */
function requireOmr(value: unknown, field: string): number {
  if (value === null || value === undefined || value === '') {
    throw new OwnerFundsCutoverEvidenceError(
      'OWNER_FUNDS_CUTOVER_EVIDENCE_INCOMPLETE',
      `دليل القطع المحاسبي ناقص: الحقل «${field}» غير موجود. لا يُعرض أي مبلغ.`,
    );
  }
  if (typeof value === 'boolean' || typeof value === 'object') {
    throw new OwnerFundsCutoverEvidenceError(
      'OWNER_FUNDS_CUTOVER_EVIDENCE_INCOMPLETE',
      `دليل القطع المحاسبي غير صالح: الحقل «${field}» ليس رقماً. لا يُعرض أي مبلغ.`,
    );
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    throw new OwnerFundsCutoverEvidenceError(
      'OWNER_FUNDS_CUTOVER_EVIDENCE_INCOMPLETE',
      `دليل القطع المحاسبي غير صالح: الحقل «${field}» ليس رقماً منتهياً. لا يُعرض أي مبلغ.`,
    );
  }
  if (Math.round(numeric * OMR_EXACT) !== numeric * OMR_EXACT) {
    throw new OwnerFundsCutoverEvidenceError(
      'OWNER_FUNDS_CUTOVER_PRECISION_VIOLATION',
      `دليل القطع المحاسبي مخالف لدقة الريال العماني (3 خانات عشرية) في الحقل «${field}». لا يُعرض المبلغ.`,
    );
  }
  return numeric;
}

function requireText(value: unknown, field: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    throw new OwnerFundsCutoverEvidenceError(
      'OWNER_FUNDS_CUTOVER_EVIDENCE_INCOMPLETE',
      `دليل القطع المحاسبي ناقص: الحقل «${field}» غير موجود.`,
    );
  }
  return text;
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function requireCount(value: unknown, field: string): number {
  if (value === null || value === undefined || value === '') {
    throw new OwnerFundsCutoverEvidenceError(
      'OWNER_FUNDS_CUTOVER_EVIDENCE_INCOMPLETE',
      `دليل القطع المحاسبي ناقص: الحقل «${field}» غير موجود.`,
    );
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) {
    throw new OwnerFundsCutoverEvidenceError(
      'OWNER_FUNDS_CUTOVER_EVIDENCE_INCOMPLETE',
      `دليل القطع المحاسبي غير صالح: الحقل «${field}» ليس عدداً صحيحاً غير سالب.`,
    );
  }
  return numeric;
}

/**
 * Strict parser for a `owner_funds_event_cutovers` row (or equivalent evidence
 * object). Rejects contradiction instead of coercing a value.
 */
export function parseOwnerFundsCutoverEvidence(row: unknown): OwnerFundsCutoverEvidence {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new OwnerFundsCutoverEvidenceError(
      'OWNER_FUNDS_CUTOVER_EVIDENCE_INCOMPLETE',
      'لم تُقرأ أي أدلة قطع محاسبي صالحة. لا يُعرض أي مبلغ افتتاحي.',
    );
  }
  const source = row as Record<string, unknown>;
  const status = requireText(source.status, 'status').toUpperCase();
  if (!ownerFundsCutoverStatuses.includes(status as OwnerFundsCutoverStatus)) {
    throw new OwnerFundsCutoverEvidenceError(
      'OWNER_FUNDS_CUTOVER_STATUS_UNKNOWN',
      `حالة القطع المحاسبي «${status}» غير معروفة؛ رُفض العرض بدل تفسيرها.`,
    );
  }
  const approvedBy = optionalText(source.approved_by);
  const approvedAt = optionalText(source.approved_at);
  if (status === 'APPROVED' && (!approvedBy || !approvedAt)) {
    throw new OwnerFundsCutoverEvidenceError(
      'OWNER_FUNDS_CUTOVER_APPROVAL_EVIDENCE_MISSING',
      'القطع المحاسبي مُعلَّم كمعتمد دون إثبات المعتمِد (approved_by/approved_at). رُفض العرض.',
    );
  }
  return {
    cutoverDate: requireText(source.cutover_date, 'cutover_date'),
    openingBalanceOmr: requireOmr(source.opening_balance, 'opening_balance'),
    glLineCount: requireCount(source.gl_line_count, 'gl_line_count'),
    sourceFingerprint: requireText(source.source_fingerprint, 'source_fingerprint'),
    s08ReviewId: requireText(source.s08_review_id, 's08_review_id'),
    status: status as OwnerFundsCutoverStatus,
    reason: optionalText(source.reason),
    createdBy: optionalText(source.created_by),
    approvedBy,
    approvedAt,
  };
}

const cutoverColumns =
  'cutover_date, opening_balance, gl_line_count, source_fingerprint, s08_review_id, status, reason, created_by, approved_by, approved_at';

/**
 * Reads the company's adopted baseline. No row is the legitimate
 * "not adopted yet" state — it is NOT a zero balance; any other error is
 * re-thrown so the caller fails closed.
 */
export async function loadOwnerFundsCutover(): Promise<OwnerFundsCutoverReadState> {
  const { data, error } = await supabase
    .from('owner_funds_event_cutovers')
    .select(cutoverColumns)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { adopted: false, evidence: null };
  return { adopted: true, evidence: parseOwnerFundsCutoverEvidence(data) };
}

/**
 * Read model via the deployed `s08_list_frozen_reviews` RPC — never a
 * hand-rolled table query. The RPC is the authoritative metadata read path
 * (granted to `authenticated`, company-scoped server-side, metadata-only:
 * no analysis results, evidence, exceptions, or expense snapshots). A direct
 * table SELECT would instead depend on the migration-11 RLS gate
 * (`financial.reports.view`), which is stricter than this panel's own
 * governance gate (`financial.owner_settlements.approve`) and can be revoked
 * per-employee — breaking cutover adoption for users the server accepts.
 */
export async function loadApprovedS08Reviews(): Promise<ApprovedS08ReviewOption[]> {
  const { data, error } = await supabase.rpc('s08_list_frozen_reviews', {
    p_period_id: null,
  });
  if (error) throw error;
  return parseS08ReviewListEnvelope(data)
    .filter((record) => record.reviewer_decision === 'APPROVED')
    .flatMap((record) => {
      const id = optionalText(record.id);
      if (!id) return [];
      return [
        {
          id,
          datasetLineage: optionalText(record.dataset_lineage) ?? '',
          reviewedAt: optionalText(record.reviewed_at),
        },
      ];
    })
    // Preserve the prior UI ordering (reviewed_at desc); the RPC orders by
    // creation_timestamp desc, both fields immutable post-creation.
    .sort((a, b) => (b.reviewedAt ?? '').localeCompare(a.reviewedAt ?? ''));
}

export function createOwnerFundsCutoverRequestId(prefix = 'cutover'): string {
  const random =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

export type CreateOwnerFundsCutoverDraftInput = {
  cutoverDate: string;
  s08ReviewId: string;
  reason: string;
  requestId: string;
};

/** Server-derived company scope: the payload must never carry `company_id`. */
export function buildCreateOwnerFundsCutoverPayload(input: CreateOwnerFundsCutoverDraftInput) {
  return {
    cutover_date: input.cutoverDate,
    s08_review_id: input.s08ReviewId,
    reason: input.reason,
    request_id: input.requestId,
  };
}

export type OwnerFundsCutoverMutationResult = {
  idempotent: boolean;
  status: OwnerFundsCutoverStatus;
  cutoverDate: string | null;
  openingBalanceOmr: number | null;
  sourceFingerprint: string | null;
};

/**
 * Fail-closed reading of an RPC envelope: only `success: true` with a lawful
 * status is accepted. The derived balance, when present, must satisfy OMR
 * precision — it is never defaulted from a missing field.
 */
export function parseOwnerFundsCutoverMutation(payload: unknown): OwnerFundsCutoverMutationResult {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new OwnerFundsCutoverEvidenceError(
      'OWNER_FUNDS_CUTOVER_RESPONSE_INVALID',
      'استجابة الخادم لعملية القطع المحاسبي غير صالحة. لم يُسجَّل أي تغيير.',
    );
  }
  const source = payload as Record<string, unknown>;
  if (source.success !== true) {
    throw new OwnerFundsCutoverEvidenceError(
      'OWNER_FUNDS_CUTOVER_RESPONSE_INVALID',
      'لم يؤكد الخادم نجاح عملية القطع المحاسبي. لم يُسجَّل أي تغيير.',
    );
  }
  // The deployed idempotent branch returns the EXISTING row nested under a
  // `cutover` key ({success, idempotent:true, cutover:{...}}) with NO top-level
  // status. Reading only the flat shape would report a FALSE failure for a
  // legitimate idempotent re-submission, so both envelopes are read - and the
  // lawful-status requirement is never relaxed.
  const nested =
    source.cutover && typeof source.cutover === 'object' && !Array.isArray(source.cutover)
      ? (source.cutover as Record<string, unknown>)
      : null;
  const status = (optionalText(source.status) ?? optionalText(nested?.status))?.toUpperCase();
  if (!status || !ownerFundsCutoverStatuses.includes(status as OwnerFundsCutoverStatus)) {
    throw new OwnerFundsCutoverEvidenceError(
      'OWNER_FUNDS_CUTOVER_STATUS_UNKNOWN',
      'استجابة الخادم لا تحمل حالة قطع معروفة. لم يُعرض أي تغيير.',
    );
  }
  const balance = source.opening_balance ?? nested?.opening_balance ?? null;
  return {
    idempotent: source.idempotent === true,
    status: status as OwnerFundsCutoverStatus,
    cutoverDate: optionalText(source.cutover_date) ?? optionalText(nested?.cutover_date),
    openingBalanceOmr: balance === null || balance === undefined ? null : requireOmr(balance, 'opening_balance'),
    sourceFingerprint:
      optionalText(source.source_fingerprint) ?? optionalText(nested?.source_fingerprint),
  };
}

export async function createOwnerFundsCutoverDraft(
  input: CreateOwnerFundsCutoverDraftInput,
): Promise<OwnerFundsCutoverMutationResult> {
  // Canonical repo convention for jsonb RPCs: the whole envelope travels as
  // `p_payload` (see accountingPeriodsService / commissions-service).
  const { data, error } = await supabase.rpc('create_owner_funds_cutover_atomic', {
    p_payload: buildCreateOwnerFundsCutoverPayload(input),
  });
  if (error) throw error;
  return parseOwnerFundsCutoverMutation(data);
}

export async function approveOwnerFundsCutover(
  requestId: string,
): Promise<OwnerFundsCutoverMutationResult> {
  const { data, error } = await supabase.rpc('approve_owner_funds_cutover_atomic', {
    p_payload: { request_id: requestId },
  });
  if (error) throw error;
  return parseOwnerFundsCutoverMutation(data);
}

/**
 * Arabic translation of the deployed guards. An unrecognised failure is never
 * presented as success and never silently swallowed.
 */
export function translateOwnerFundsCutoverError(error: unknown): string {
  const raw = [
    (error as { message?: unknown })?.message,
    (error as { code?: unknown })?.code,
    (error as { details?: unknown })?.details,
  ]
    .filter((part): part is string => typeof part === 'string')
    .join(' ');
  const map: ReadonlyArray<readonly [string, string]> = [
    [
      'OWNER_FUNDS_CUTOVER_ROLE_REQUIRED',
      'إنشاء مسودة القطع المحاسبي يتطلب صلاحية مدير أو محاسب.',
    ],
    [
      'OWNER_FUNDS_CUTOVER_APPROVER_ROLE_REQUIRED',
      'اعتماد القطع المحاسبي يتطلب صلاحية مدير أو محاسب.',
    ],
    [
      'OWNER_FUNDS_CUTOVER_MAKER_CHECKER_REQUIRED',
      'لا يجوز لمن أنشأ المسودة اعتمادها. يلزم معتمِد آخر (فصل المعد عن المدقق).',
    ],
    [
      'OWNER_FUNDS_CUTOVER_S08_APPROVAL_REQUIRED',
      'يجب اختيار مراجعة S08 مجمّدة ومعتمدة لنفس الشركة قبل تبني رصيد افتتاحي.',
    ],
    [
      'OWNER_FUNDS_CUTOVER_STALE_REVIEW_REQUIRED',
      'تغيّر رصيد حساب 2000 (أو عدد حركاته) بعد إنشاء المسودة؛ رُفض الاعتماد ولم يُتبنَّ أي رصيد. تبقى المسودة المحفوظة بدليلها الأصلي، ولا تُستبدل من التطبيق (إعادة الإرسال تُعيد نفس المسودة دون تغيير)؛ تلزم مراجعة محاسبية معتمدة لمعالجة هذا الاختلاف.',
    ],
    ['OWNER_FUNDS_CUTOVER_NOT_FOUND', 'لا توجد مسودة قطع محاسبي لهذه الشركة.'],
    [
      'OWNER_FUNDS_CUTOVER_ALREADY_APPROVED',
      'القطع المحاسبي معتمد مسبقاً بطلب مختلف. لا يُعاد الاعتماد.',
    ],
    [
      'OWNER_FUNDS_CUTOVER_APPROVAL_REQUEST_REQUIRED',
      'اعتماد القطع المحاسبي يتطلب مُعرّف طلب صالحاً.',
    ],
    [
      'OWNER_FUNDS_CUTOVER_INPUT_REQUIRED',
      'تاريخ القطع ومراجعة S08 والسبب ومُعرّف الطلب حقول مطلوبة.',
    ],
    [
      'OWNER_FUNDS_CUTOVER_COMPANY_SERVER_DERIVED',
      'نطاق الشركة يُشتق في الخادم ولا يُرسَل من الواجهة.',
    ],
    [
      'OWNER_FUNDS_PRE_CUTOVER_REPORT_REVIEW_REQUIRED',
      'طلب موضع مالك قبل تاريخ القطع يتطلب قطعاً محاسبياً معتمداً مدعوماً بمراجعة S08. لا يُحتسب رصيد غير مُثبت.',
    ],
  ];
  for (const [code, message] of map) {
    if (raw.includes(code)) return message;
  }
  return 'فشلت عملية القطع المحاسبي دون تأكيد من الخادم. لم يُسجَّل أي تغيير؛ راجع الصلاحيات ومراجعة S08 ثم أعد المحاولة.';
}

/** Tones reuse the canonical semantic vocabulary — no second token system. */
export function ownerFundsCutoverStatusTone(
  status: OwnerFundsCutoverStatus,
): 'warning' | 'success' | 'danger' {
  if (status === 'APPROVED') return 'success';
  if (status === 'DRAFT') return 'warning';
  return 'danger';
}

export type OwnerFundsCutoverDisclosure = {
  sourceLabel: string;
  balanceCaption: string;
  /** True when the adopted baseline is derived from zero GL lines. */
  derivedFromEmptyEvidence: boolean;
  makerCheckerNotice: string;
  fingerprintNotice: string;
};

/**
 * Presentation facts for the adopted baseline. Every figure shown alongside this
 * disclosure is a DERIVED server figure with named evidence, and a zero-line
 * derivation is labelled instead of being presented as a complete total.
 */
export function describeOwnerFundsCutoverSource(
  evidence: OwnerFundsCutoverEvidence,
): OwnerFundsCutoverDisclosure {
  const derivedFromEmptyEvidence = evidence.glLineCount === 0;
  return {
    sourceLabel: `مشتق من حساب دفتر الأستاذ ${OWNER_FUNDS_GL_ACCOUNT} (أموال الملاك المستحقة) في تاريخ القطع ${evidence.cutoverDate}`,
    balanceCaption: derivedFromEmptyEvidence
      ? 'لا حركات مسجَّلة على حساب 2000 حتى تاريخ القطع؛ الرصيد المشتق صفر. لا يُعرض هذا الرقم كإجمالي كامل لأي حركة تاريخية.'
      : `الرصيد المشتق مبني على ${evidence.glLineCount} حركة على حساب ${OWNER_FUNDS_GL_ACCOUNT}. لا يُدخل المبلغ يدوياً من الواجهة.`,
    derivedFromEmptyEvidence,
    makerCheckerNotice:
      'اعتماد القطع يشترط معتمِداً آخر غير منشئ المسودة، ومراجعة S08 معتمدة. ويُرفض الاعتماد إن اختلف الرصيد عن دليله.',
    fingerprintNotice: `بصمة الدليل: ${evidence.sourceFingerprint}`,
  };
}
