import { describe, expect, it } from 'vitest';
import { toUtcDayNumber } from './utc-day-number';

describe('toUtcDayNumber', () => {
  it('compares calendar dates as UTC day numbers, including timestamp prefixes', () => {
    expect(toUtcDayNumber('2024-02-29')).toBe(Math.floor(Date.UTC(2024, 1, 29) / 86_400_000));
    expect(toUtcDayNumber('2024-03-01T23:59:59Z')! - toUtcDayNumber('2024-02-29')!).toBe(1);
  });

  it('returns null when no ISO date prefix is present', () => {
    expect(toUtcDayNumber(null)).toBeNull();
    expect(toUtcDayNumber('')).toBeNull();
    expect(toUtcDayNumber('29/02/2024')).toBeNull();
  });
});
