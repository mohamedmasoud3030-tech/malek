/**
 * G5 — client-side contract for the owner receivable offset surface.
 *
 * These tests pin the behaviour that must NOT regress: the parsers reject
 * rather than coerce, no money arithmetic happens on the client, the lawful
 * offset right is only ever read, and a "success" without GL proof is refused.
 */
import { describe, expect, it } from 'vitest';
import {
  OwnerReceivableEvidenceError,
  buildApplyOwnerOffsetPayload,
  createOwnerOffsetRequestId,
  parseApplyOwnerOffsetResult,
  parseOwnerReceivable,
  parseOwnerReceivableOffset,
  translateOwnerOffsetError,
} from './owner-receivable-offset-service';

const RECEIVABLE = 'a1000000-0000-4000-8000-000000000001';
const SETTLEMENT = 'settlement-1';

const storedRow = (overrides: Record<string, unknown> = {}) => ({
  id: RECEIVABLE,
  owner_id: 'o1',
  property_id: null,
  source_type: 'MANUAL',
  source_id: null,
  amount: '200.000',
  recovered_amount: '0.000',
  offset_amount: '25.000',
  waived_amount: '0.000',
  outstanding: '175.000',
  lawful_offset_right: true,
  status: 'OFFSET',
  journal_batch_id: 'b1',
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('parseOwnerReceivable', () => {
  it('reads the stored row without recomputing any figure', () => {
    const parsed = parseOwnerReceivable(storedRow());
    expect(parsed.amount).toBe(200);
    expect(parsed.offsetAmount).toBe(25);
    expect(parsed.outstanding).toBe(175);
    expect(parsed.lawfulOffsetRight).toBe(true);
  });

  it('rejects a row whose components contradict the outstanding remainder', () => {
    expect(() => parseOwnerReceivable(storedRow({ outstanding: '100.000' }))).toThrow(
      OwnerReceivableEvidenceError,
    );
  });

  it('refuses to treat a missing amount as zero', () => {
    expect(() => parseOwnerReceivable(storedRow({ amount: null }))).toThrow(/ناقصة|غير موجود/);
  });

  it('refuses a non-numeric amount instead of coercing it', () => {
    expect(() => parseOwnerReceivable(storedRow({ amount: 'abc' }))).toThrow(
      OwnerReceivableEvidenceError,
    );
    expect(() => parseOwnerReceivable(storedRow({ amount: true }))).toThrow(
      OwnerReceivableEvidenceError,
    );
  });

  it('never infers the lawful offset right from a missing field', () => {
    expect(() => parseOwnerReceivable(storedRow({ lawful_offset_right: null }))).toThrow(
      /OWNER_RECEIVABLE_OFFSET_RIGHT_UNPROVEN|حق المقاصة/,
    );
    expect(() => parseOwnerReceivable(storedRow({ lawful_offset_right: 'yes' }))).toThrow(
      OwnerReceivableEvidenceError,
    );
  });

  it('rejects an unknown status rather than displaying it as normal', () => {
    expect(() => parseOwnerReceivable(storedRow({ status: 'WEIRD' }))).toThrow(
      /OWNER_RECEIVABLE_STATUS_UNKNOWN|حالة/,
    );
  });

  it('rejects a stored amount finer than one baisa', () => {
    expect(() =>
      parseOwnerReceivable(
        storedRow({ amount: '200.00049', outstanding: '175.00049' }),
      ),
    ).toThrow(OwnerReceivableEvidenceError);
  });
});

describe('buildApplyOwnerOffsetPayload', () => {
  const valid = {
    dueFromOwnerId: RECEIVABLE,
    ownerSettlementId: SETTLEMENT,
    amount: 25,
    effectiveDate: '2026-02-01',
    lawfulOffsetEvidence: 'Clause 7',
    requestId: 'req-1',
  };

  it('sends exactly the six fields the server contract requires', () => {
    expect(Object.keys(buildApplyOwnerOffsetPayload(valid)).sort()).toEqual(
      [
        'amount',
        'due_from_owner_id',
        'effective_date',
        'lawful_offset_evidence',
        'owner_settlement_id',
        'request_id',
      ].sort(),
    );
  });

  it('never sends a server-owned field', () => {
    const payload = buildApplyOwnerOffsetPayload(valid) as Record<string, unknown>;
    expect(payload.company_id).toBeUndefined();
    expect(payload.amount_override).toBeUndefined();
    expect(payload.target_account).toBeUndefined();
  });

  it('rejects a non-positive amount', () => {
    expect(() => buildApplyOwnerOffsetPayload({ ...valid, amount: 0 })).toThrow();
    expect(() => buildApplyOwnerOffsetPayload({ ...valid, amount: -5 })).toThrow();
  });

  it('rejects a sub-baisa amount before it reaches the server', () => {
    expect(() => buildApplyOwnerOffsetPayload({ ...valid, amount: 1.00049 })).toThrow(
      /PRECISION_VIOLATION|دقة/,
    );
  });

  it('rejects evidence shorter than the server minimum of three characters', () => {
    expect(() =>
      buildApplyOwnerOffsetPayload({ ...valid, lawfulOffsetEvidence: 'ab' }),
    ).toThrow(/سند المقاصة/);
  });

  it('requires an effective date and a request id', () => {
    expect(() => buildApplyOwnerOffsetPayload({ ...valid, effectiveDate: '' })).toThrow();
    expect(() => buildApplyOwnerOffsetPayload({ ...valid, requestId: '' })).toThrow();
  });
});

describe('parseApplyOwnerOffsetResult', () => {
  const ok = {
    success: true,
    idempotent: false,
    due_from_owner_id: RECEIVABLE,
    owner_settlement_id: SETTLEMENT,
    amount: 25,
    outstanding: 175,
    journal_batch_id: 'batch-1',
    status: 'OFFSET',
    request_id: 'req-1',
  };

  it('accepts a fully posted response and surfaces the effect on the source', () => {
    const parsed = parseApplyOwnerOffsetResult(ok);
    expect(parsed.outstanding).toBe(175);
    expect(parsed.journalBatchId).toBe('batch-1');
    expect(parsed.status).toBe('OFFSET');
  });

  it('rejects a success that carries no journal batch', () => {
    expect(() => parseApplyOwnerOffsetResult({ ...ok, journal_batch_id: null })).toThrow(
      /UNPOSTED|لم تُرحّل/,
    );
  });

  it('rejects a response missing the outstanding remainder', () => {
    expect(() => parseApplyOwnerOffsetResult({ ...ok, outstanding: undefined })).toThrow();
  });
});

describe('translateOwnerOffsetError', () => {
  it('explains that the offset right must be stored, not inferred', () => {
    const message = translateOwnerOffsetError(
      new Error('DUE_FROM_OWNER_OFFSET_RIGHT_MISSING'),
    );
    expect(message).toContain('حق مقاصة');
  });

  it('maps the over-offset and owner-mismatch guards', () => {
    expect(
      translateOwnerOffsetError(new Error('DUE_FROM_OWNER_OFFSET_EXCEEDS_OUTSTANDING')),
    ).toContain('المتبقي');
    expect(
      translateOwnerOffsetError(new Error('DUE_FROM_OWNER_OFFSET_OWNER_MISMATCH')),
    ).toContain('مالك آخر');
  });

  it('states that a reused idempotency key posted nothing new', () => {
    expect(
      translateOwnerOffsetError(new Error('IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST')),
    ).toContain('لم يُنفَّذ');
  });

  it('surfaces an unknown error verbatim instead of hiding it', () => {
    expect(translateOwnerOffsetError(new Error('SOME_NEW_SERVER_GUARD'))).toContain(
      'SOME_NEW_SERVER_GUARD',
    );
  });
});

describe('parseOwnerReceivableOffset', () => {
  it('requires the lawful offset evidence to be present on a stored movement', () => {
    expect(() =>
      parseOwnerReceivableOffset({
        id: 'm1',
        due_from_owner_id: RECEIVABLE,
        owner_settlement_id: SETTLEMENT,
        amount: '25.000',
        effective_date: '2026-02-01',
        lawful_offset_evidence: null,
        journal_batch_id: 'b1',
        status: 'POSTED',
        created_at: null,
      }),
    ).toThrow(OwnerReceivableEvidenceError);
  });
});

describe('createOwnerOffsetRequestId', () => {
  it('produces a distinct id per call so retries are never conflated', () => {
    expect(createOwnerOffsetRequestId()).not.toBe(createOwnerOffsetRequestId());
  });
});
