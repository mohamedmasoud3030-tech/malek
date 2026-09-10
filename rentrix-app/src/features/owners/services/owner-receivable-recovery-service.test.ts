/**
 * G5 — client-side contract for the owner receivable CASH RECOVERY surface.
 */
import { describe, expect, it } from 'vitest';
import { OwnerReceivableEvidenceError } from './owner-receivable-offset-service';
import {
  RECOVERY_CASH_ACCOUNTS,
  buildRecoverOwnerReceivablePayload,
  createOwnerRecoveryRequestId,
  parseOwnerReceivableRecovery,
  parseRecoverOwnerReceivableResult,
  translateOwnerRecoveryError,
} from './owner-receivable-recovery-service';

const RECEIVABLE = 'a1000000-0000-4000-8000-000000000001';

const validInput = {
  dueFromOwnerId: RECEIVABLE,
  amount: 50,
  effectiveDate: '2026-02-01',
  cashAccountNo: '1120' as const,
  requestId: 'req-1',
};

describe('buildRecoverOwnerReceivablePayload', () => {
  it('sends exactly the five fields the server contract expects', () => {
    expect(Object.keys(buildRecoverOwnerReceivablePayload(validInput)).sort()).toEqual(
      ['amount', 'cash_account_no', 'due_from_owner_id', 'effective_date', 'request_id'].sort(),
    );
  });

  it('never sends a server-owned field', () => {
    const payload = buildRecoverOwnerReceivablePayload(validInput) as Record<string, unknown>;
    expect(payload.company_id).toBeUndefined();
    expect(payload.amount_override).toBeUndefined();
    expect(payload.target_account).toBeUndefined();
  });

  it('only permits the two cash accounts the server accepts', () => {
    expect(RECOVERY_CASH_ACCOUNTS).toEqual(['1111', '1120']);
    expect(() =>
      buildRecoverOwnerReceivablePayload({
        ...validInput,
        cashAccountNo: '4000' as unknown as '1120',
      }),
    ).toThrow(/CASH_ACCOUNT_INVALID|حساب النقدية/);
  });

  it('rejects a non-positive amount', () => {
    expect(() => buildRecoverOwnerReceivablePayload({ ...validInput, amount: 0 })).toThrow();
    expect(() => buildRecoverOwnerReceivablePayload({ ...validInput, amount: -1 })).toThrow();
  });

  it('rejects a sub-baisa amount before it reaches the ledger', () => {
    expect(() =>
      buildRecoverOwnerReceivablePayload({ ...validInput, amount: 1.00049 }),
    ).toThrow(/PRECISION|دقة/);
  });

  it('rejects an empty effective date or request id', () => {
    expect(() =>
      buildRecoverOwnerReceivablePayload({ ...validInput, effectiveDate: '' }),
    ).toThrow();
    expect(() => buildRecoverOwnerReceivablePayload({ ...validInput, requestId: '' })).toThrow();
  });
});

describe('parseRecoverOwnerReceivableResult', () => {
  const ok = {
    success: true,
    idempotent: false,
    due_from_owner_id: RECEIVABLE,
    amount: 50,
    outstanding: 150,
    journal_batch_id: 'batch-1',
    status: 'PARTIALLY_RECOVERED',
    request_id: 'req-1',
  };

  it('surfaces the remaining outstanding — the effect on the original source', () => {
    const parsed = parseRecoverOwnerReceivableResult(ok);
    expect(parsed.outstanding).toBe(150);
    expect(parsed.status).toBe('PARTIALLY_RECOVERED');
    expect(parsed.journalBatchId).toBe('batch-1');
  });

  it('rejects a success that carries no journal batch', () => {
    expect(() =>
      parseRecoverOwnerReceivableResult({ ...ok, journal_batch_id: null }),
    ).toThrow(/UNPOSTED|لم تُرحّل|تعذّر إثبات/);
  });

  it('rejects an unknown post-recovery status instead of displaying it', () => {
    expect(() => parseRecoverOwnerReceivableResult({ ...ok, status: 'WEIRD' })).toThrow(
      /STATUS_UNKNOWN|غير معروفة/,
    );
  });

  it('accepts a fully recovered result', () => {
    const parsed = parseRecoverOwnerReceivableResult({
      ...ok,
      outstanding: 0,
      status: 'RECOVERED',
    });
    expect(parsed.outstanding).toBe(0);
    expect(parsed.status).toBe('RECOVERED');
  });
});

describe('parseOwnerReceivableRecovery', () => {
  const row = {
    id: 'm1',
    due_from_owner_id: RECEIVABLE,
    owner_id: 'o1',
    amount: '50.000',
    cash_account_no: '1120',
    effective_date: '2026-02-01',
    journal_batch_id: 'b1',
    reversal_journal_batch_id: null,
    status: 'POSTED',
    created_at: null,
  };

  it('reads a stored recovery without recomputing anything', () => {
    const parsed = parseOwnerReceivableRecovery(row);
    expect(parsed.amount).toBe(50);
    expect(parsed.cashAccountNo).toBe('1120');
    expect(parsed.journalBatchId).toBe('b1');
  });

  it('refuses a posted recovery with no GL proof', () => {
    expect(() => parseOwnerReceivableRecovery({ ...row, journal_batch_id: null })).toThrow(
      OwnerReceivableEvidenceError,
    );
  });

  it('refuses to coerce a non-numeric amount', () => {
    expect(() => parseOwnerReceivableRecovery({ ...row, amount: 'abc' })).toThrow(
      OwnerReceivableEvidenceError,
    );
  });
});

describe('translateOwnerRecoveryError', () => {
  it('maps the over-recovery guard', () => {
    expect(
      translateOwnerRecoveryError(new Error('DUE_FROM_OWNER_RECOVERY_EXCEEDS_OUTSTANDING')),
    ).toContain('المتبقي');
  });

  it('maps the invalid cash account guard', () => {
    expect(
      translateOwnerRecoveryError(new Error('DUE_FROM_OWNER_RECOVERY_CASH_ACCOUNT_INVALID')),
    ).toContain('1111');
  });

  it('states that a reused idempotency key posted nothing new', () => {
    expect(
      translateOwnerRecoveryError(new Error('IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST')),
    ).toContain('لم يُرحَّل');
  });

  it('surfaces an unknown error verbatim rather than hiding it', () => {
    expect(translateOwnerRecoveryError(new Error('SOME_NEW_GUARD'))).toContain('SOME_NEW_GUARD');
  });
});

describe('createOwnerRecoveryRequestId', () => {
  it('produces a distinct id per call so retries are never conflated', () => {
    expect(createOwnerRecoveryRequestId()).not.toBe(createOwnerRecoveryRequestId());
  });
});
