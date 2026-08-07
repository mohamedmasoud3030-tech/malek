import { describe, expect, it } from 'vitest';
import { reconcileSubledgerToGl } from './subledger-gl-reconciliation';

describe('reconcileSubledgerToGl', () => {
  it('matches a single balanced posting to its source', () => {
    const result = reconcileSubledgerToGl(
      [{ sourceType: 'master_lease', sourceId: 'lease-1', expectedDebitMinor: 10_000, expectedCreditMinor: 10_000 }],
      [{ sourceType: 'master_lease', sourceId: 'lease-1', eventId: 'evt-1', debitMinor: 10_000, creditMinor: 10_000 }],
    );
    expect(result.matchedCount).toBe(1);
    expect(result.exceptionCount).toBe(0);
    expect(result.rows[0]?.status).toBe('matched');
  });

  it('detects missing, duplicate, unbalanced and amount-mismatch cases', () => {
    const result = reconcileSubledgerToGl(
      [
        { sourceType: 'lease', sourceId: 'missing', expectedDebitMinor: 10, expectedCreditMinor: 10 },
        { sourceType: 'lease', sourceId: 'duplicate', expectedDebitMinor: 20, expectedCreditMinor: 20 },
        { sourceType: 'lease', sourceId: 'unbalanced', expectedDebitMinor: 30, expectedCreditMinor: 30 },
        { sourceType: 'lease', sourceId: 'mismatch', expectedDebitMinor: 40, expectedCreditMinor: 40 },
      ],
      [
        { sourceType: 'lease', sourceId: 'duplicate', eventId: 'evt-2a', debitMinor: 10, creditMinor: 10 },
        { sourceType: 'lease', sourceId: 'duplicate', eventId: 'evt-2b', debitMinor: 10, creditMinor: 10 },
        { sourceType: 'lease', sourceId: 'unbalanced', eventId: 'evt-3', debitMinor: 30, creditMinor: 29 },
        { sourceType: 'lease', sourceId: 'mismatch', eventId: 'evt-4', debitMinor: 41, creditMinor: 41 },
      ],
    );

    const byId = Object.fromEntries(result.rows.map((row) => [row.sourceId, row.status]));
    expect(byId).toEqual({
      duplicate: 'duplicate_gl_posting',
      mismatch: 'amount_mismatch',
      missing: 'missing_gl_posting',
      unbalanced: 'unbalanced_gl_posting',
    });
    expect(result.exceptionCount).toBe(4);
  });

  it('rejects duplicate source rows and duplicate event ids', () => {
    expect(() =>
      reconcileSubledgerToGl(
        [
          { sourceType: 'lease', sourceId: '1', expectedDebitMinor: 1, expectedCreditMinor: 1 },
          { sourceType: 'lease', sourceId: '1', expectedDebitMinor: 1, expectedCreditMinor: 1 },
        ],
        [],
      ),
    ).toThrow('duplicate subledger source');

    expect(() =>
      reconcileSubledgerToGl(
        [{ sourceType: 'lease', sourceId: '1', expectedDebitMinor: 1, expectedCreditMinor: 1 }],
        [
          { sourceType: 'lease', sourceId: '1', eventId: 'evt', debitMinor: 1, creditMinor: 1 },
          { sourceType: 'lease', sourceId: '1', eventId: 'evt', debitMinor: 1, creditMinor: 1 },
        ],
      ),
    ).toThrow('duplicate eventId');
  });
});
