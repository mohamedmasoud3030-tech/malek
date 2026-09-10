/**
 * Owner receivable — lawful offset against an APPROVED owner payable (G5).
 *
 * WHY THIS EXISTS
 * `public.offset_owner_receivable_atomic(jsonb)` and
 * `public.recover_owner_receivable_atomic(jsonb)` are live in production and
 * granted to `authenticated`, but no user-facing surface called either one.
 * The capability was backend-complete and UI-absent: an operator could not
 * apply a lawful offset, and — more importantly — could not SEE the effect an
 * offset has on the ORIGINAL receivable. This module is that one canonical
 * surface's data layer. It is not a parallel implementation: no other module
 * calls these RPCs.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 * - It does NOT decide whether an offset is lawful. `lawful_offset_right` is a
 *   stored property of the receivable, set through the governed source. This
 *   layer only *reads* it and refuses to offer the action when it is false.
 *   A field name or an accounting classification never confers the right.
 * - It does NOT compute or adjust any balance. Every figure shown comes from
 *   the database; the server owns `outstanding`, `offset_amount`,
 *   `recovered_amount` and the GL posting.
 * - It does NOT coerce a missing/невalid figure to zero. A contradictory row is
 *   rejected so the UI can disclose the gap instead of rendering a false total.
 */
import { supabase } from '@/lib/supabase';

const OMR_EXACT = 1000;

/** Server-owned fields the RPC explicitly forbids in the payload. */
const SERVER_OWNED_FIELDS = ['company_id', 'amount_override', 'target_account'] as const;

export const ownerReceivableStatuses = ['OPEN', 'OFFSET', 'RECOVERED', 'CLOSED', 'REVERSED'] as const;
export type OwnerReceivableStatus = (typeof ownerReceivableStatuses)[number];

export const ownerReceivableStatusLabels: Record<OwnerReceivableStatus, string> = {
  OPEN: 'قائم',
  OFFSET: 'مقاصّ جزئياً',
  RECOVERED: 'محصّل',
  CLOSED: 'مقفل',
  REVERSED: 'معكوس',
};

export class OwnerReceivableEvidenceError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'OwnerReceivableEvidenceError';
    this.code = code;
  }
}

/**
 * A receivable owed BY an owner, as stored. Every money field is authoritative
 * server state — never recomputed here.
 */
export type OwnerReceivable = {
  id: string;
  ownerId: string;
  propertyId: string | null;
  sourceType: string;
  sourceId: string | null;
  /** The original amount of the receivable. Never mutated by an offset. */
  amount: number;
  recoveredAmount: number;
  offsetAmount: number;
  waivedAmount: number;
  /** Server-maintained remainder. This is the "effect on the original source". */
  outstanding: number;
  /** Stored legal/contractual right. Not inferable from anything else. */
  lawfulOffsetRight: boolean;
  status: OwnerReceivableStatus;
  journalBatchId: string | null;
  createdAt: string | null;
};

/** One posted offset movement against a receivable. */
export type OwnerReceivableOffset = {
  id: string;
  dueFromOwnerId: string;
  ownerSettlementId: string;
  amount: number;
  effectiveDate: string;
  lawfulOffsetEvidence: string;
  journalBatchId: string | null;
  reversalJournalBatchId: string | null;
  status: string | null;
  createdAt: string | null;
};

function requireOmr(value: unknown, field: string): number {
  if (value === null || value === undefined || value === '') {
    throw new OwnerReceivableEvidenceError(
      'OWNER_RECEIVABLE_EVIDENCE_INCOMPLETE',
      `بيانات المديونية ناقصة: الحقل «${field}» غير موجود. لا يُعرض أي مبلغ.`,
    );
  }
  if (typeof value === 'boolean' || typeof value === 'object') {
    throw new OwnerReceivableEvidenceError(
      'OWNER_RECEIVABLE_EVIDENCE_INCOMPLETE',
      `بيانات المديونية غير صالحة: الحقل «${field}» ليس رقماً. لا يُعرض أي مبلغ.`,
    );
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    throw new OwnerReceivableEvidenceError(
      'OWNER_RECEIVABLE_EVIDENCE_INCOMPLETE',
      `بيانات المديونية غير صالحة: الحقل «${field}» ليس رقماً منتهياً. لا يُعرض أي مبلغ.`,
    );
  }
  if (Math.round(numeric * OMR_EXACT) !== numeric * OMR_EXACT) {
    throw new OwnerReceivableEvidenceError(
      'OWNER_RECEIVABLE_PRECISION_VIOLATION',
      `بيانات المديونية مخالفة لدقة الريال العماني (3 خانات عشرية) في الحقل «${field}». لا يُعرض المبلغ.`,
    );
  }
  return numeric;
}

function requireText(value: unknown, field: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    throw new OwnerReceivableEvidenceError(
      'OWNER_RECEIVABLE_EVIDENCE_INCOMPLETE',
      `بيانات المديونية ناقصة: الحقل «${field}» غير موجود.`,
    );
  }
  return text;
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function requireStatus(value: unknown): OwnerReceivableStatus {
  const text = requireText(value, 'status');
  if (!(ownerReceivableStatuses as readonly string[]).includes(text)) {
    throw new OwnerReceivableEvidenceError(
      'OWNER_RECEIVABLE_STATUS_UNKNOWN',
      `حالة المديونية «${text}» غير معروفة. لا تُعرض بياناتها.`,
    );
  }
  return text as OwnerReceivableStatus;
}

/**
 * Strict parser for a `due_from_owners` row.
 *
 * Beyond per-field validation this enforces the row's own internal arithmetic:
 * `outstanding` must equal `amount − recovered − offset − waived`. A row that
 * contradicts itself is REJECTED rather than displayed, because showing a
 * plausible-but-wrong outstanding is worse than showing an explicit error.
 */
export function parseOwnerReceivable(row: unknown): OwnerReceivable {
  if (!row || typeof row !== 'object') {
    throw new OwnerReceivableEvidenceError(
      'OWNER_RECEIVABLE_EVIDENCE_INCOMPLETE',
      'بيانات المديونية غير موجودة.',
    );
  }
  const r = row as Record<string, unknown>;

  const amount = requireOmr(r.amount, 'amount');
  const recoveredAmount = requireOmr(r.recovered_amount, 'recovered_amount');
  const offsetAmount = requireOmr(r.offset_amount, 'offset_amount');
  const waivedAmount = requireOmr(r.waived_amount, 'waived_amount');
  const outstanding = requireOmr(r.outstanding, 'outstanding');

  const expected = Math.round((amount - recoveredAmount - offsetAmount - waivedAmount) * OMR_EXACT);
  if (Math.round(outstanding * OMR_EXACT) !== expected) {
    throw new OwnerReceivableEvidenceError(
      'OWNER_RECEIVABLE_ARITHMETIC_CONTRADICTION',
      'بيانات المديونية متناقضة: المتبقي لا يساوي الأصل ناقص المحصّل والمقاصّ والمتنازل عنه. لا يُعرض أي رصيد.',
    );
  }

  if (typeof r.lawful_offset_right !== 'boolean') {
    throw new OwnerReceivableEvidenceError(
      'OWNER_RECEIVABLE_OFFSET_RIGHT_UNPROVEN',
      'حق المقاصة على هذه المديونية غير مُثبت في المصدر. لا تُعرض المقاصة كخيار متاح.',
    );
  }

  return {
    id: requireText(r.id, 'id'),
    ownerId: requireText(r.owner_id, 'owner_id'),
    propertyId: optionalText(r.property_id),
    sourceType: requireText(r.source_type, 'source_type'),
    sourceId: optionalText(r.source_id),
    amount,
    recoveredAmount,
    offsetAmount,
    waivedAmount,
    outstanding,
    lawfulOffsetRight: r.lawful_offset_right,
    status: requireStatus(r.status),
    journalBatchId: optionalText(r.journal_batch_id),
    createdAt: optionalText(r.created_at),
  };
}

export function parseOwnerReceivableOffset(row: unknown): OwnerReceivableOffset {
  if (!row || typeof row !== 'object') {
    throw new OwnerReceivableEvidenceError(
      'OWNER_RECEIVABLE_EVIDENCE_INCOMPLETE',
      'بيانات حركة المقاصة غير موجودة.',
    );
  }
  const r = row as Record<string, unknown>;
  return {
    id: requireText(r.id, 'id'),
    dueFromOwnerId: requireText(r.due_from_owner_id, 'due_from_owner_id'),
    ownerSettlementId: requireText(r.owner_settlement_id, 'owner_settlement_id'),
    amount: requireOmr(r.amount, 'amount'),
    effectiveDate: requireText(r.effective_date, 'effective_date'),
    lawfulOffsetEvidence: requireText(r.lawful_offset_evidence, 'lawful_offset_evidence'),
    journalBatchId: optionalText(r.journal_batch_id),
    reversalJournalBatchId: optionalText(r.reversal_journal_batch_id),
    status: optionalText(r.status),
    createdAt: optionalText(r.created_at),
  };
}

export const ownerReceivablesQueryKey = ['owners', 'due-from-owners'] as const;
export const ownerReceivableOffsetsQueryKey = ['owners', 'due-from-owner-offsets'] as const;

/**
 * Receivables for one owner. RLS scopes the company; this never sends a
 * company_id (the RPC rejects a client-supplied one, and the same discipline
 * applies to reads).
 */
export async function loadOwnerReceivables(ownerId: string): Promise<OwnerReceivable[]> {
  const { data, error } = await supabase
    .from('due_from_owners')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(parseOwnerReceivable);
}

/** Posted offset movements for one receivable — the audit trail of the effect. */
export async function loadOwnerReceivableOffsets(dueFromOwnerId: string): Promise<OwnerReceivableOffset[]> {
  const { data, error } = await supabase
    .from('due_from_owner_offsets')
    .select('*')
    .eq('due_from_owner_id', dueFromOwnerId)
    .order('effective_date', { ascending: false })
    .order('id', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(parseOwnerReceivableOffset);
}

export function createOwnerOffsetRequestId(prefix = 'offset'): string {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}

export type ApplyOwnerOffsetInput = {
  dueFromOwnerId: string;
  ownerSettlementId: string;
  amount: number;
  effectiveDate: string;
  lawfulOffsetEvidence: string;
  requestId: string;
};

/**
 * Build the RPC payload. Mirrors the server contract exactly:
 * all six fields required, evidence >= 3 chars, amount > 0, and none of the
 * server-owned fields present (the RPC raises 22023 if any appears).
 */
export function buildApplyOwnerOffsetPayload(input: ApplyOwnerOffsetInput) {
  // Identifiers and the effective date are as mandatory as the amount: an empty
  // one must never be forwarded for the server to reject later, because a
  // blank effective date would otherwise reach the ledger as a posting date.
  const identifiers: ReadonlyArray<readonly [string, string]> = [
    ['due_from_owner_id', input.dueFromOwnerId],
    ['owner_settlement_id', input.ownerSettlementId],
    ['effective_date', input.effectiveDate],
    ['request_id', input.requestId],
  ];
  for (const [field, value] of identifiers) {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new OwnerReceivableEvidenceError(
        'DUE_FROM_OWNER_OFFSET_REQUEST_AMOUNT_DATE_EVIDENCE_REQUIRED',
        `الحقل «${field}» مطلوب لتنفيذ المقاصة.`,
      );
    }
  }
  const evidence = input.lawfulOffsetEvidence.trim();
  if (evidence.length < 3) {
    throw new OwnerReceivableEvidenceError(
      'DUE_FROM_OWNER_OFFSET_REQUEST_AMOUNT_DATE_EVIDENCE_REQUIRED',
      'سند المقاصة القانوني مطلوب (3 أحرف على الأقل).',
    );
  }
  if (!(input.amount > 0)) {
    throw new OwnerReceivableEvidenceError(
      'DUE_FROM_OWNER_OFFSET_REQUEST_AMOUNT_DATE_EVIDENCE_REQUIRED',
      'مبلغ المقاصة يجب أن يكون أكبر من صفر.',
    );
  }
  if (Math.round(input.amount * OMR_EXACT) !== input.amount * OMR_EXACT) {
    throw new OwnerReceivableEvidenceError(
      'OWNER_RECEIVABLE_PRECISION_VIOLATION',
      'مبلغ المقاصة مخالف لدقة الريال العماني (3 خانات عشرية).',
    );
  }
  const payload = {
    due_from_owner_id: input.dueFromOwnerId,
    owner_settlement_id: input.ownerSettlementId,
    amount: input.amount,
    effective_date: input.effectiveDate,
    lawful_offset_evidence: evidence,
    request_id: input.requestId,
  };
  for (const forbidden of SERVER_OWNED_FIELDS) {
    if (forbidden in payload) {
      throw new OwnerReceivableEvidenceError(
        'DUE_FROM_OWNER_OFFSET_SERVER_OWNED_FIELDS_FORBIDDEN',
        `الحقل «${forbidden}» يملكه الخادم ولا يجوز إرساله.`,
      );
    }
  }
  return payload;
}

/**
 * The result of a posted offset, as returned by the server. `outstanding` is
 * the receivable's remainder AFTER the offset — i.e. the effect on the
 * original source — and `journalBatchId` is the GL proof.
 */
export type ApplyOwnerOffsetResult = {
  success: true;
  idempotent: boolean;
  dueFromOwnerId: string;
  ownerSettlementId: string;
  amount: number;
  outstanding: number;
  journalBatchId: string;
  status: OwnerReceivableStatus;
  requestId: string;
};

/** Strict parser for the RPC response. A success without GL proof is rejected. */
export function parseApplyOwnerOffsetResult(payload: unknown): ApplyOwnerOffsetResult {
  if (!payload || typeof payload !== 'object') {
    throw new OwnerReceivableEvidenceError(
      'OWNER_RECEIVABLE_OFFSET_RESPONSE_INVALID',
      'استجابة المقاصة غير صالحة.',
    );
  }
  const r = payload as Record<string, unknown>;
  if (r.success !== true) {
    throw new OwnerReceivableEvidenceError(
      'OWNER_RECEIVABLE_OFFSET_RESPONSE_INVALID',
      'استجابة المقاصة لا تثبت نجاح العملية.',
    );
  }
  const journalBatchId = optionalText(r.journal_batch_id);
  if (!journalBatchId) {
    throw new OwnerReceivableEvidenceError(
      'OWNER_RECEIVABLE_OFFSET_UNPOSTED',
      'المقاصة لم تُرحّل إلى دفتر الأستاذ. لا تُعرض كعملية ناجحة.',
    );
  }
  return {
    success: true,
    idempotent: r.idempotent === true,
    dueFromOwnerId: requireText(r.due_from_owner_id, 'due_from_owner_id'),
    ownerSettlementId: requireText(r.owner_settlement_id, 'owner_settlement_id'),
    amount: requireOmr(r.amount, 'amount'),
    outstanding: requireOmr(r.outstanding, 'outstanding'),
    journalBatchId,
    status: requireStatus(r.status),
    requestId: requireText(r.request_id, 'request_id'),
  };
}

/** Post a lawful offset. The server enforces every rule; this only relays. */
export const approvedOwnerSettlementsQueryKey = ['owners', 'approved-settlements'] as const;

/** One APPROVED (unpaid) owner payable — the only lawful offset counterparty. */
export type ApprovedOwnerSettlement = {
  id: string;
  ownerId: string;
  netPayable: number;
  offsetApplied: number;
  periodStart: string | null;
  periodEnd: string | null;
};

/**
 * APPROVED settlements for one owner. The server independently re-checks the
 * status and the owner match; this list only narrows the operator's choice, it
 * never establishes the right to offset.
 */
export async function loadApprovedOwnerSettlements(
  ownerId: string,
): Promise<ApprovedOwnerSettlement[]> {
  const { data, error } = await supabase
    .from('owner_settlements')
    .select('id, owner_id, net_payable, offset_applied, period_start, period_end')
    .eq('owner_id', ownerId)
    .eq('status', 'APPROVED')
    .order('period_end', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    return {
      id: requireText(record.id, 'id'),
      ownerId: requireText(record.owner_id, 'owner_id'),
      netPayable: requireOmr(record.net_payable, 'net_payable'),
      offsetApplied: requireOmr(record.offset_applied, 'offset_applied'),
      periodStart: optionalText(record.period_start),
      periodEnd: optionalText(record.period_end),
    };
  });
}

/**
 * Maps the authoritative server error vocabulary to operator-facing Arabic.
 * Every key below is a literal `raise exception` in
 * `offset_owner_receivable_atomic`; nothing here is invented, and an unknown
 * error is surfaced verbatim rather than being softened into a generic message.
 */
export function translateOwnerOffsetError(error: unknown): string {
  const raw = [
    (error as { message?: unknown })?.message,
    (error as { code?: unknown })?.code,
    (error as { details?: unknown })?.details,
  ]
    .filter((part): part is string => typeof part === 'string')
    .join(' ');
  const map: ReadonlyArray<readonly [string, string]> = [
    [
      'DUE_FROM_OWNER_OFFSET_ROLE_REQUIRED',
      'إجراء المقاصة يتطلب صلاحية مدير أو محاسب.',
    ],
    [
      'DUE_FROM_OWNER_OFFSET_RIGHT_MISSING',
      'لا يوجد حق مقاصة مثبت على هذه المديونية. لا يجوز استنتاج الحق من نوع الحساب أو من اسم الحقل؛ يجب إثباته على السجل أولاً.',
    ],
    [
      'DUE_FROM_OWNER_OFFSET_SETTLEMENT_NOT_APPROVED',
      'المقاصة لا تجوز إلا مقابل تسوية مالك معتمدة وغير مدفوعة.',
    ],
    [
      'DUE_FROM_OWNER_OFFSET_OWNER_MISMATCH',
      'لا يجوز مقاصة مديونية مالك مقابل مستحقات مالك آخر.',
    ],
    [
      'DUE_FROM_OWNER_OFFSET_EXCEEDS_OUTSTANDING',
      'المبلغ يتجاوز الرصيد المتبقي من المديونية الأصلية.',
    ],
    [
      'DUE_FROM_OWNER_OFFSET_EXCEEDS_PAYABLE',
      'المبلغ يتجاوز صافي المستحق في التسوية المختارة.',
    ],
    [
      'DUE_FROM_OWNER_OFFSET_SERVER_OWNED_FIELDS_FORBIDDEN',
      'الطلب تضمّن حقلاً يملكه الخادم (مثل الشركة أو الحساب المستهدف) وقد رُفض.',
    ],
    [
      'DUE_FROM_OWNER_OFFSET_SETTLEMENT_NOT_FOUND_OR_FORBIDDEN',
      'التسوية غير موجودة أو خارج نطاق شركتك.',
    ],
    [
      'DUE_FROM_OWNER_OFFSET_EVENT_NOT_FOUND_OR_FORBIDDEN',
      'المديونية غير موجودة أو خارج نطاق شركتك.',
    ],
    [
      'DUE_FROM_OWNER_OFFSET_REVERSED',
      'هذه المقاصة معكوسة بالفعل ولا يمكن تعديلها.',
    ],
    [
      'DUE_FROM_OWNER_OFFSET_REQUEST_AMOUNT_DATE_EVIDENCE_REQUIRED',
      'المبلغ والتاريخ وسند المقاصة حقول إلزامية.',
    ],
    [
      'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST',
      'معرّف الطلب مستخدم سابقاً بمعطيات مختلفة. لم يُنفَّذ أي قيد جديد.',
    ],
    [
      'OWNER_FUNDS_NEGATIVE',
      'المقاصة سترحّل حساب أموال الملاك إلى رصيد سالب، وقد رفضها الخادم.',
    ],
  ];
  for (const [needle, message] of map) {
    if (raw.includes(needle)) return message;
  }
  if (raw.includes('OWNER_RECEIVABLE_OFFSET_UNPOSTED')) {
    return 'تعذّر إثبات ترحيل القيد المحاسبي لهذه المقاصة. لا تُعرض النتيجة كناجحة.';
  }
  return raw.trim() || 'تعذّر تنفيذ المقاصة.';
}

export async function applyOwnerReceivableOffset(
  input: ApplyOwnerOffsetInput,
): Promise<ApplyOwnerOffsetResult> {
  const { data, error } = await supabase.rpc('offset_owner_receivable_atomic', {
    p_payload: buildApplyOwnerOffsetPayload(input),
  });
  if (error) throw error;
  return parseApplyOwnerOffsetResult(data);
}
