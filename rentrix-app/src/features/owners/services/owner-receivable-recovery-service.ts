/**
 * G5 — cash recovery of an owner receivable.
 *
 * Data layer for the deployed `recover_owner_receivable_atomic(p_payload jsonb)`
 * RPC, which had no user-facing surface at all. Same discipline as the offset
 * service: parsers REJECT rather than coerce, no client-side money arithmetic,
 * and a "success" without GL proof is refused.
 *
 * Server contract honoured verbatim (canonical_baseline.sql:16020-16120):
 *  - required: due_from_owner_id, request_id, amount (> 0), effective_date
 *  - optional: cash_account_no, which the server restricts to '1111' or '1120'
 *  - forbidden: company_id / amount_override / target_account (22023)
 *  - role: admin/manager/accountant
 *  - refuses a REVERSED receivable and any amount above `outstanding`
 *  - posts DR cash / CR 1300 and returns `outstanding` after recovery + batch id
 *  - idempotent by request_id, fingerprinted over (id, amount, cash account, date)
 */
import { supabase } from '@/lib/supabase';
import {
  OwnerReceivableEvidenceError,
  type OwnerReceivable,
} from './owner-receivable-offset-service';

const OMR_EXACT = 1000;

/**
 * The only cash accounts the server accepts. Mirrored here so the operator is
 * stopped at the form instead of being handed a raw SQL error — the server
 * still re-checks, this never becomes the authority.
 */
export const RECOVERY_CASH_ACCOUNTS = ['1111', '1120'] as const;
export type RecoveryCashAccount = (typeof RECOVERY_CASH_ACCOUNTS)[number];

export const recoveryCashAccountLabels: Record<RecoveryCashAccount, string> = {
  '1111': 'الصندوق النقدي (1111)',
  '1120': 'الحساب البنكي (1120)',
};

/** Statuses the receivable can reach through recovery. */
export const recoveryResultStatuses = ['RECOVERED', 'PARTIALLY_RECOVERED'] as const;
export type RecoveryResultStatus = (typeof recoveryResultStatuses)[number];

export const recoveryResultStatusLabels: Record<RecoveryResultStatus, string> = {
  RECOVERED: 'محصَّلة بالكامل',
  PARTIALLY_RECOVERED: 'محصَّلة جزئياً',
};

/** One posted cash recovery against a receivable. */
export type OwnerReceivableRecovery = {
  id: string;
  dueFromOwnerId: string;
  ownerId: string;
  amount: number;
  cashAccountNo: string;
  effectiveDate: string;
  journalBatchId: string | null;
  reversalJournalBatchId: string | null;
  status: string | null;
  createdAt: string | null;
};

function fail(code: string, message: string): never {
  throw new OwnerReceivableEvidenceError(code, message);
}

function requireOmr(value: unknown, field: string): number {
  if (value === null || value === undefined || value === '') {
    fail(
      'OWNER_RECOVERY_EVIDENCE_INCOMPLETE',
      `بيانات التحصيل ناقصة: الحقل «${field}» غير موجود. لا يُعرض أي مبلغ.`,
    );
  }
  if (typeof value === 'boolean' || typeof value === 'object') {
    fail(
      'OWNER_RECOVERY_EVIDENCE_INCOMPLETE',
      `بيانات التحصيل غير صالحة: الحقل «${field}» ليس رقماً. لا يُعرض أي مبلغ.`,
    );
  }
  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(parsed)) {
    fail(
      'OWNER_RECOVERY_EVIDENCE_INCOMPLETE',
      `بيانات التحصيل غير صالحة: الحقل «${field}» ليس رقماً. لا يُعرض أي مبلغ.`,
    );
  }
  if (Math.round(parsed * OMR_EXACT) !== Number((parsed * OMR_EXACT).toFixed(6))) {
    fail(
      'OWNER_RECOVERY_PRECISION_VIOLATION',
      `الحقل «${field}» مخالف لدقة الريال العماني (3 خانات عشرية).`,
    );
  }
  return parsed;
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(
      'OWNER_RECOVERY_EVIDENCE_INCOMPLETE',
      `بيانات التحصيل ناقصة: الحقل «${field}» غير موجود.`,
    );
  }
  return value.trim();
}

function optionalText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function parseOwnerReceivableRecovery(row: unknown): OwnerReceivableRecovery {
  if (!row || typeof row !== 'object') {
    fail('OWNER_RECOVERY_EVIDENCE_INCOMPLETE', 'سجل التحصيل غير صالح.');
  }
  const record = row as Record<string, unknown>;
  return {
    id: requireText(record.id, 'id'),
    dueFromOwnerId: requireText(record.due_from_owner_id, 'due_from_owner_id'),
    ownerId: requireText(record.owner_id, 'owner_id'),
    amount: requireOmr(record.amount, 'amount'),
    cashAccountNo: requireText(record.cash_account_no, 'cash_account_no'),
    effectiveDate: requireText(record.effective_date, 'effective_date'),
    // A posted recovery must carry its GL proof; the column is NOT NULL server-side.
    journalBatchId: requireText(record.journal_batch_id, 'journal_batch_id'),
    reversalJournalBatchId: optionalText(record.reversal_journal_batch_id),
    status: optionalText(record.status),
    createdAt: optionalText(record.created_at),
  };
}

export const ownerReceivableRecoveriesQueryKey = ['owners', 'due-from-owner-recoveries'] as const;

/** Posted cash recoveries for one receivable — the audit trail of the effect. */
export async function loadOwnerReceivableRecoveries(
  dueFromOwnerId: string,
): Promise<OwnerReceivableRecovery[]> {
  const { data, error } = await supabase
    .from('due_from_owner_recoveries')
    .select('*')
    .eq('due_from_owner_id', dueFromOwnerId)
    .order('effective_date', { ascending: false })
    .order('id', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(parseOwnerReceivableRecovery);
}

export function createOwnerRecoveryRequestId(prefix = 'recovery'): string {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}

export type RecoverOwnerReceivableInput = {
  dueFromOwnerId: string;
  amount: number;
  effectiveDate: string;
  cashAccountNo: RecoveryCashAccount;
  requestId: string;
};

const SERVER_OWNED_FIELDS = ['company_id', 'amount_override', 'target_account'] as const;

export function buildRecoverOwnerReceivablePayload(input: RecoverOwnerReceivableInput) {
  const identifiers: ReadonlyArray<readonly [string, string]> = [
    ['due_from_owner_id', input.dueFromOwnerId],
    ['effective_date', input.effectiveDate],
    ['request_id', input.requestId],
  ];
  for (const [field, value] of identifiers) {
    if (typeof value !== 'string' || value.trim() === '') {
      fail(
        'DUE_FROM_OWNER_RECOVERY_REQUEST_AMOUNT_DATE_REQUIRED',
        `الحقل «${field}» مطلوب لتسجيل التحصيل.`,
      );
    }
  }
  if (!(input.amount > 0)) {
    fail(
      'DUE_FROM_OWNER_RECOVERY_REQUEST_AMOUNT_DATE_REQUIRED',
      'مبلغ التحصيل يجب أن يكون أكبر من صفر.',
    );
  }
  if (Math.round(input.amount * OMR_EXACT) !== input.amount * OMR_EXACT) {
    fail(
      'OWNER_RECOVERY_PRECISION_VIOLATION',
      'مبلغ التحصيل مخالف لدقة الريال العماني (3 خانات عشرية).',
    );
  }
  if (!RECOVERY_CASH_ACCOUNTS.includes(input.cashAccountNo)) {
    fail(
      'DUE_FROM_OWNER_RECOVERY_CASH_ACCOUNT_INVALID',
      'حساب النقدية غير مقبول؛ المسموح به الصندوق (1111) أو البنك (1120).',
    );
  }
  const payload = {
    due_from_owner_id: input.dueFromOwnerId,
    amount: input.amount,
    effective_date: input.effectiveDate,
    cash_account_no: input.cashAccountNo,
    request_id: input.requestId,
  };
  for (const forbidden of SERVER_OWNED_FIELDS) {
    if (forbidden in payload) {
      fail(
        'DUE_FROM_OWNER_RECOVERY_SERVER_OWNED_FIELDS_FORBIDDEN',
        `الحقل «${forbidden}» يملكه الخادم ولا يجوز إرساله.`,
      );
    }
  }
  return payload;
}

/**
 * The result of a posted recovery. `outstanding` is the receivable's remainder
 * AFTER the recovery — the effect on the original source — and
 * `journalBatchId` is the GL proof.
 */
export type RecoverOwnerReceivableResult = {
  success: true;
  idempotent: boolean;
  dueFromOwnerId: string;
  amount: number;
  outstanding: number;
  journalBatchId: string;
  status: RecoveryResultStatus;
  requestId: string;
};

export function parseRecoverOwnerReceivableResult(
  payload: unknown,
): RecoverOwnerReceivableResult {
  if (!payload || typeof payload !== 'object') {
    fail('OWNER_RECOVERY_RESPONSE_INVALID', 'استجابة الخادم لعملية التحصيل غير صالحة.');
  }
  const record = payload as Record<string, unknown>;
  if (record.success !== true) {
    fail('OWNER_RECOVERY_RESPONSE_INVALID', 'لم يؤكد الخادم نجاح عملية التحصيل.');
  }
  const journalBatchId = optionalText(record.journal_batch_id);
  if (!journalBatchId) {
    fail(
      'OWNER_RECOVERY_UNPOSTED',
      'تعذّر إثبات ترحيل القيد المحاسبي لهذا التحصيل؛ لا تُعرض النتيجة كناجحة.',
    );
  }
  const status = optionalText(record.status);
  if (!status || !recoveryResultStatuses.includes(status as RecoveryResultStatus)) {
    fail(
      'OWNER_RECOVERY_STATUS_UNKNOWN',
      `حالة غير معروفة بعد التحصيل: «${status ?? '—'}». لا تُعرض كحالة سليمة.`,
    );
  }
  return {
    success: true,
    idempotent: record.idempotent === true,
    dueFromOwnerId: requireText(record.due_from_owner_id, 'due_from_owner_id'),
    amount: requireOmr(record.amount, 'amount'),
    outstanding: requireOmr(record.outstanding, 'outstanding'),
    journalBatchId,
    status: status as RecoveryResultStatus,
    requestId: requireText(record.request_id, 'request_id'),
  };
}

/**
 * Maps the authoritative server error vocabulary to operator-facing Arabic.
 * Every key is a literal `raise exception` in `recover_owner_receivable_atomic`;
 * an unknown error is surfaced verbatim rather than softened.
 */
export function translateOwnerRecoveryError(error: unknown): string {
  const raw = [
    (error as { message?: unknown })?.message,
    (error as { code?: unknown })?.code,
    (error as { details?: unknown })?.details,
  ]
    .filter((part): part is string => typeof part === 'string')
    .join(' ');
  const map: ReadonlyArray<readonly [string, string]> = [
    ['DUE_FROM_OWNER_RECOVERY_ROLE_REQUIRED', 'تسجيل التحصيل يتطلب صلاحية مدير أو محاسب.'],
    [
      'DUE_FROM_OWNER_RECOVERY_SERVER_OWNED_FIELDS_FORBIDDEN',
      'الطلب تضمّن حقلاً يملكه الخادم (مثل الشركة أو الحساب المستهدف) وقد رُفض.',
    ],
    [
      'DUE_FROM_OWNER_RECOVERY_REQUEST_AMOUNT_DATE_REQUIRED',
      'المبلغ وتاريخ الأثر ومعرّف الطلب حقول إلزامية.',
    ],
    [
      'DUE_FROM_OWNER_RECOVERY_CASH_ACCOUNT_INVALID',
      'حساب النقدية غير مقبول؛ المسموح به الصندوق (1111) أو البنك (1120).',
    ],
    [
      'DUE_FROM_OWNER_RECOVERY_EXCEEDS_OUTSTANDING',
      'المبلغ يتجاوز الرصيد المتبقي من المديونية الأصلية.',
    ],
    ['DUE_FROM_OWNER_RECOVERY_REVERSED', 'هذه المديونية معكوسة ولا يمكن التحصيل عليها.'],
    ['DUE_FROM_OWNER_NOT_FOUND_OR_FORBIDDEN', 'المديونية غير موجودة أو خارج نطاق شركتك.'],
    [
      'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST',
      'معرّف الطلب مستخدم سابقاً بمعطيات مختلفة. لم يُرحَّل أي قيد جديد.',
    ],
  ];
  for (const [needle, message] of map) {
    if (raw.includes(needle)) return message;
  }
  if (raw.includes('OWNER_RECOVERY_UNPOSTED')) {
    return 'تعذّر إثبات ترحيل القيد المحاسبي لهذا التحصيل. لا تُعرض النتيجة كناجحة.';
  }
  return raw.trim() || 'تعذّر تنفيذ التحصيل.';
}

export async function recoverOwnerReceivable(
  input: RecoverOwnerReceivableInput,
): Promise<RecoverOwnerReceivableResult> {
  const { data, error } = await supabase.rpc('recover_owner_receivable_atomic', {
    p_payload: buildRecoverOwnerReceivablePayload(input),
  });
  if (error) throw error;
  return parseRecoverOwnerReceivableResult(data);
}

/** Convenience: the recoverable remainder of a receivable, straight from the row. */
export function recoverableRemainder(receivable: OwnerReceivable): number {
  return receivable.outstanding;
}
