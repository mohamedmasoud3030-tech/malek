import { describe, expect, it } from 'vitest';
import { toCompanyDateKey } from './bank-reconciliation-date';

describe('bank reconciliation company calendar date', () => {
  it('uses the company timezone instead of UTC around midnight', () => {
    const instant = Date.parse('2026-08-22T21:30:00.000Z');

    expect(toCompanyDateKey(instant, 'UTC')).toBe('2026-08-22');
    expect(toCompanyDateKey(instant, 'Asia/Muscat')).toBe('2026-08-23');
    expect(toCompanyDateKey(instant, 'Asia/Dubai')).toBe('2026-08-23');
  });

  it('formats another supported company timezone deterministically', () => {
    const instant = Date.parse('2026-08-23T00:30:00.000Z');
    expect(toCompanyDateKey(instant, 'UTC')).toBe('2026-08-23');
    expect(toCompanyDateKey(instant, 'Asia/Riyadh')).toBe('2026-08-23');
  });

  it('rejects invalid timestamps instead of guessing a bank date', () => {
    expect(() => toCompanyDateKey('not-a-date', 'Asia/Muscat')).toThrow(/Invalid reconciliation timestamp/);
  });
});
