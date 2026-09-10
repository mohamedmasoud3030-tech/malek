import { describe, expect, it } from 'vitest';
import {
  buildCreateOwnerFundsCutoverPayload,
  createOwnerFundsCutoverRequestId,
  describeOwnerFundsCutoverSource,
  ownerFundsCutoverStatusTone,
  parseOwnerFundsCutoverEvidence,
  parseOwnerFundsCutoverMutation,
  translateOwnerFundsCutoverError,
} from './owner-funds-cutover-service';

const validRow = {
  cutover_date: '2019-12-31',
  opening_balance: 1200.5,
  gl_line_count: 7,
  source_fingerprint: 'a'.repeat(64),
  s08_review_id: '99999999-0000-4000-8000-000000000001',
  status: 'APPROVED',
  reason: 'opening baseline',
  created_by: '99999999-0000-4000-8000-000000000002',
  approved_by: '99999999-0000-4000-8000-000000000003',
  approved_at: '2019-12-31T00:00:00.000Z',
};

describe('owner funds cutover evidence — fail-closed parsing', () => {
  it('accepts a complete APPROVED baseline and keeps OMR precision', () => {
    const parsed = parseOwnerFundsCutoverEvidence(validRow);
    expect(parsed.openingBalanceOmr).toBe(1200.5);
    expect(parsed.glLineCount).toBe(7);
    expect(parsed.status).toBe('APPROVED');
  });

  it('NEVER turns missing evidence into a zero opening balance', () => {
    const { opening_balance: _omitted, ...missing } = validRow;
    let code = '';
    try {
      parseOwnerFundsCutoverEvidence(missing);
    } catch (error) {
      code = (error as { code?: string }).code ?? '';
    }
    expect(code).toBe('OWNER_FUNDS_CUTOVER_EVIDENCE_INCOMPLETE');
  });

  it.each([
    ['boolean', true],
    ['array', []],
    ['object', {}],
    ['empty string', ''],
  ])('refuses to coerce %s into an amount', (_label, value) => {
    expect(() => parseOwnerFundsCutoverEvidence({ ...validRow, opening_balance: value })).toThrow();
  });

  it('rejects a non-3-decimal amount instead of rounding it', () => {
    let code = '';
    try {
      parseOwnerFundsCutoverEvidence({ ...validRow, opening_balance: 10.1234 });
    } catch (error) {
      code = (error as { code?: string }).code ?? '';
    }
    expect(code).toBe('OWNER_FUNDS_CUTOVER_PRECISION_VIOLATION');
  });

  it('rejects APPROVED evidence without an approver', () => {
    let code = '';
    try {
      parseOwnerFundsCutoverEvidence({ ...validRow, approved_by: null });
    } catch (error) {
      code = (error as { code?: string }).code ?? '';
    }
    expect(code).toBe('OWNER_FUNDS_CUTOVER_APPROVAL_EVIDENCE_MISSING');
  });

  it('rejects an unknown status instead of interpreting it', () => {
    let code = '';
    try {
      parseOwnerFundsCutoverEvidence({ ...validRow, status: 'PAID' });
    } catch (error) {
      code = (error as { code?: string }).code ?? '';
    }
    expect(code).toBe('OWNER_FUNDS_CUTOVER_STATUS_UNKNOWN');
  });
});

describe('owner funds cutover RPC envelope', () => {
  it('requires explicit server success and a lawful status', () => {
    expect(() => parseOwnerFundsCutoverMutation({})).toThrow();
    expect(() => parseOwnerFundsCutoverMutation({ success: false })).toThrow();
    expect(() => parseOwnerFundsCutoverMutation({ success: true, status: 'SOMETHING' })).toThrow();
    const result = parseOwnerFundsCutoverMutation({ success: true, status: 'DRAFT' });
    expect(result.status).toBe('DRAFT');
    expect(result.openingBalanceOmr).toBeNull();
    expect(result.idempotent).toBe(false);
  });

  it('reads the deployed idempotent envelope (existing row nested under cutover)', () => {
    const parsed = parseOwnerFundsCutoverMutation({
      success: true,
      idempotent: true,
      cutover: {
        cutover_date: '2019-12-31',
        opening_balance: 1200.5,
        source_fingerprint: 'a'.repeat(64),
        status: 'DRAFT',
      },
    });
    expect(parsed.idempotent).toBe(true);
    expect(parsed.status).toBe('DRAFT');
    expect(parsed.openingBalanceOmr).toBe(1200.5);
    expect(parsed.cutoverDate).toBe('2019-12-31');
  });

  it('never sends company_id and keeps the exact server payload keys', () => {
    const payload = buildCreateOwnerFundsCutoverPayload({
      cutoverDate: '2019-12-31',
      s08ReviewId: 'r1',
      reason: 'baseline',
      requestId: 'req-1',
    });
    expect(Object.keys(payload).sort()).toEqual([
      'cutover_date',
      'reason',
      'request_id',
      's08_review_id',
    ]);
    expect(JSON.stringify(payload)).not.toContain('company_id');
  });

  it('mints distinct idempotency request ids', () => {
    expect(createOwnerFundsCutoverRequestId('cutover-create')).not.toBe(
      createOwnerFundsCutoverRequestId('cutover-create'),
    );
  });
});

describe('owner funds cutover error translation', () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ['OWNER_FUNDS_CUTOVER_ROLE_REQUIRED', 'مدير أو محاسب'],
    ['OWNER_FUNDS_CUTOVER_MAKER_CHECKER_REQUIRED', 'معتمِد آخر'],
    ['OWNER_FUNDS_CUTOVER_S08_APPROVAL_REQUIRED', 'S08'],
    ['OWNER_FUNDS_CUTOVER_STALE_REVIEW_REQUIRED', '2000'],
    ['OWNER_FUNDS_CUTOVER_ALREADY_APPROVED', 'معتمد مسبقاً'],
  ];

  it.each(cases)('translates %s without claiming success', (code, fragment) => {
    const message = translateOwnerFundsCutoverError({ message: code, code: '42501' });
    expect(message).toContain(fragment);
  });

  it('fails closed for an unrecognised failure', () => {
    const message = translateOwnerFundsCutoverError({ message: 'unknown_failure' });
    expect(message).not.toContain('نجح');
    expect(message).toContain('لم يُسجَّل أي تغيير');
  });
});

describe('owner funds cutover disclosure', () => {
  it('labels a derivation from zero GL lines as not a complete total', () => {
    const evidence = parseOwnerFundsCutoverEvidence({ ...validRow, gl_line_count: 0, opening_balance: 0 });
    const disclosure = describeOwnerFundsCutoverSource(evidence);
    expect(disclosure.derivedFromEmptyEvidence).toBe(true);
    expect(disclosure.balanceCaption).toContain('لا يُعرض هذا الرقم كإجمالي كامل');
  });

  it('names the GL line evidence behind a non-zero derivation', () => {
    const disclosure = describeOwnerFundsCutoverSource(parseOwnerFundsCutoverEvidence(validRow));
    expect(disclosure.derivedFromEmptyEvidence).toBe(false);
    expect(disclosure.balanceCaption).toContain('7');
    expect(disclosure.sourceLabel).toContain('2000');
  });

  it('maps statuses onto the canonical semantic tones', () => {
    expect(ownerFundsCutoverStatusTone('APPROVED')).toBe('success');
    expect(ownerFundsCutoverStatusTone('DRAFT')).toBe('warning');
    expect(ownerFundsCutoverStatusTone('REJECTED')).toBe('danger');
  });
});
