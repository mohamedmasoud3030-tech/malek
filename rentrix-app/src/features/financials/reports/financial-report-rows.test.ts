import { describe, expect, it } from 'vitest';
import { isWithinDateRange } from './financial-report-rows';

describe('report date-range semantics — inclusive end date and local date strings', () => {
  const filters = { dateFrom: '2026-05-01', dateTo: '2026-05-31' };

  it('includes the first day of the range', () => {
    expect(isWithinDateRange('2026-05-01', filters)).toBe(true);
  });

  it('includes the last day of the range (inclusive end date)', () => {
    expect(isWithinDateRange('2026-05-31', filters)).toBe(true);
  });

  it('excludes the day before the range start', () => {
    expect(isWithinDateRange('2026-04-30', filters)).toBe(false);
  });

  it('excludes the day after the range end', () => {
    expect(isWithinDateRange('2026-06-01', filters)).toBe(false);
  });

  it('includes an ISO date inside the range', () => {
    expect(isWithinDateRange('2026-05-15', filters)).toBe(true);
  });

  it('rejects missing values instead of treating them as in-range', () => {
    expect(isWithinDateRange(null, filters)).toBe(false);
    expect(isWithinDateRange(undefined, filters)).toBe(false);
    expect(isWithinDateRange('', filters)).toBe(false);
  });

  it('works for single-day ranges (as-of semantics)', () => {
    const asOf = { dateFrom: '2026-05-15', dateTo: '2026-05-15' };
    expect(isWithinDateRange('2026-05-15', asOf)).toBe(true);
    expect(isWithinDateRange('2026-05-14', asOf)).toBe(false);
    expect(isWithinDateRange('2026-05-16', asOf)).toBe(false);
  });
});
