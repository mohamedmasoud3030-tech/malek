import { describe, expect, it } from 'vitest';
import {
  arabicMonthLabel,
  formatPointChange,
  formatSignedAmountChange,
  isFullCalendarMonth,
  monthEndIso,
  monthKeyOf,
  previousPeriodRange,
} from './report-period';

describe('report-period utilities', () => {
  describe('previousPeriodRange', () => {
    it('maps a full calendar month to the PREVIOUS calendar month (Feb → Jan)', () => {
      expect(previousPeriodRange('2026-02-01', '2026-02-28')).toEqual({ from: '2026-01-01', to: '2026-01-31' });
    });

    it('maps a full March to the previous February (previous month may be shorter)', () => {
      expect(previousPeriodRange('2026-03-01', '2026-03-31')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    });

    it('wraps across the year boundary (January → previous December)', () => {
      expect(previousPeriodRange('2026-01-01', '2026-01-31')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    });

    it('handles leap-year February (2028 → previous January)', () => {
      expect(previousPeriodRange('2028-02-01', '2028-02-29')).toEqual({ from: '2028-01-01', to: '2028-01-31' });
    });

    it('returns the equal-duration window for an arbitrary (non-full-month) range', () => {
      // 2026-02-10 → 2026-02-20 is 11 inclusive days; previous window is 11 days ending 2026-02-09.
      expect(previousPeriodRange('2026-02-10', '2026-02-20')).toEqual({ from: '2026-01-30', to: '2026-02-09' });
    });

    it('returns null for missing or inverted ranges', () => {
      expect(previousPeriodRange(null, '2026-02-28')).toBeNull();
      expect(previousPeriodRange('2026-02-28', '2026-02-01')).toBeNull();
      expect(previousPeriodRange('not-a-date', '2026-02-28')).toBeNull();
    });
  });

  describe('isFullCalendarMonth', () => {
    it('recognises first-day-to-last-day months', () => {
      expect(isFullCalendarMonth('2026-02-01', '2026-02-28')).toBe(true);
      expect(isFullCalendarMonth('2026-01-01', '2026-01-31')).toBe(true);
      expect(isFullCalendarMonth('2028-02-01', '2028-02-29')).toBe(true);
    });

    it('rejects partial ranges and non-first-day starts', () => {
      expect(isFullCalendarMonth('2026-02-05', '2026-02-28')).toBe(false);
      expect(isFullCalendarMonth('2026-02-01', '2026-02-27')).toBe(false);
    });
  });

  describe('monthEndIso / monthKeyOf / arabicMonthLabel', () => {
    it('computes the last day of each month deterministically (UTC)', () => {
      expect(monthEndIso('2026-01')).toBe('2026-01-31');
      expect(monthEndIso('2026-02')).toBe('2026-02-28');
      expect(monthEndIso('2026-03')).toBe('2026-03-31');
      expect(monthEndIso('2028-02')).toBe('2028-02-29');
    });

    it('extracts month keys from ISO dates', () => {
      expect(monthKeyOf('2026-02-15')).toBe('2026-02');
      expect(monthKeyOf('2026-12-31T23:59:59Z')).toBe('2026-12');
      expect(monthKeyOf(null)).toBeNull();
      expect(monthKeyOf('garbage')).toBeNull();
    });

    it('labels months in Arabic', () => {
      expect(arabicMonthLabel('2026-02')).toBe('فبراير 2026');
      expect(arabicMonthLabel('2026-12')).toBe('ديسمبر 2026');
    });
  });

  describe('delta formatters', () => {
    it('formats signed absolute amount changes', () => {
      expect(formatSignedAmountChange(100, 80)).toBe('+20');
      expect(formatSignedAmountChange(80, 100)).toBe('-20');
      expect(formatSignedAmountChange(80, 80)).toBe('0');
      expect(formatSignedAmountChange(null, 80)).toBeNull();
      expect(formatSignedAmountChange(80, null)).toBeNull();
    });

    it('formats percentage-POINT changes (never percent-of-percent)', () => {
      expect(formatPointChange(94, 90)).toBe('+4 نقاط');
      expect(formatPointChange(90, 94)).toBe('-4 نقاط');
      expect(formatPointChange(92.5, 92.5)).toBe('0 نقاط');
      expect(formatPointChange(94.6, 90)).toBe('+4.6 نقاط');
      expect(formatPointChange(null, 90)).toBeNull();
    });
  });
});
