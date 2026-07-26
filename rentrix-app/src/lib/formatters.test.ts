import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CURRENCY,
  currencyMetadata,
  formatDate,
  formatDateTime,
  formatLatinDate,
  formatLatinDateTime,
  formatLatinNumber,
  formatLatinTime,
  formatMoney,
  formatNumber,
  getCurrencyMetadata,
  getCurrencyMinorUnit,
  normalizeCurrency,
  normalizeLocale,
  supportedCurrencies,
  toLatinLocaleDateString,
  toLatinLocaleString,
  toLatinLocaleTimeString,
} from './formatters';

describe('shared formatter design-system utilities', () => {
  it('keeps the required supported currencies and OMR default', () => {
    expect(supportedCurrencies).toEqual(['OMR', 'AED', 'SAR', 'QAR', 'KWD', 'BHD', 'USD', 'EGP']);
    expect(DEFAULT_CURRENCY).toBe('OMR');
  });

  it('defines metadata for every supported currency', () => {
    for (const currency of supportedCurrencies) {
      expect(currencyMetadata[currency].code).toBe(currency);
      expect(currencyMetadata[currency].label.length).toBeGreaterThan(0);
      expect(currencyMetadata[currency].minorUnit).toBeGreaterThanOrEqual(2);
    }
  });

  it('normalizes unsupported currencies to OMR', () => {
    expect(normalizeCurrency('USD')).toBe('USD');
    expect(normalizeCurrency('XYZ')).toBe('OMR');
    expect(getCurrencyMetadata('XYZ').code).toBe('OMR');
  });

  it('uses configured minor units for GCC currencies', () => {
    expect(getCurrencyMinorUnit('OMR')).toBe(3);
    expect(getCurrencyMinorUnit('KWD')).toBe(3);
    expect(getCurrencyMinorUnit('BHD')).toBe(3);
    expect(getCurrencyMinorUnit('AED')).toBe(2);
    expect(getCurrencyMinorUnit('SAR')).toBe(2);
  });

  it('formats money with currency code and metadata precision', () => {
    expect(formatMoney({ amount: 12.3, currency: 'OMR', locale: 'en' }).replaceAll('\u00a0', ' ')).toBe('OMR 12.300');
    expect(formatMoney({ amount: 12.3, currency: 'USD', locale: 'en' }).replaceAll('\u00a0', ' ')).toBe('USD 12.30');
  });

  it('safely formats invalid amounts as zero using the default currency', () => {
    expect(formatMoney({ amount: Number.NaN, currency: null, locale: 'en' }).replaceAll('\u00a0', ' ')).toBe('OMR 0.000');
  });

  it('formats numbers and dates through the shared locale-safe formatters', () => {
    expect(formatNumber({ value: 1234, locale: 'ar-EG' })).toMatch(/1,234|١٬٢٣٤/);
    expect(formatDate({ value: '2026-07-01T00:00:00Z', locale: 'en-GB', timeZone: 'UTC' })).toBe('1 Jul 2026');
    expect(formatDateTime({ value: '2026-07-01T09:30:00Z', locale: 'en-GB', timeZone: 'UTC' })).toContain('1 Jul 2026');
  });

  it('uses an em dash for invalid date values instead of broken locale output', () => {
    expect(formatDate({ value: 'not-a-date' })).toBe('—');
    expect(formatDateTime({ value: null })).toBe('—');
  });
});

describe('Latin numeral enforcement — formatLatinNumber', () => {
  it('formats numbers with Latin digits in ar locale', () => {
    const result = formatLatinNumber(1234, 'ar');
    // Must contain only ASCII digits 0-9, no Arabic-Indic digits
    expect(result).toMatch(/^[^\u0660-\u0669\u06F0-\u06F9]*$/);
    expect(result).toContain('1');
    expect(result).toContain('234');
  });

  it('formats numbers with Latin digits in ar-OM locale', () => {
    const result = formatLatinNumber(5678, 'ar-OM');
    expect(result).toMatch(/^[^\u0660-\u0669\u06F0-\u06F9]*$/);
    expect(result).toContain('5');
  });

  it('handles Unicode locale extensions without double-adding', () => {
    const result = formatLatinNumber(999, 'ar-u-nu-latn');
    expect(result).toContain('999');
  });

  it('handles locale arrays', () => {
    const result = formatLatinNumber(42, ['ar-OM', 'en']);
    expect(result).toMatch(/^[^\u0660-\u0669\u06F0-\u06F9]*$/);
  });

  it('formats money with Latin digits', () => {
    const result = formatMoney({ amount: 100.5, currency: 'OMR', locale: 'ar' });
    // Must not contain Arabic-Indic digits
    expect(result).not.toMatch(/[\u0660-\u0669]/);
  });

  it('formats percentages with Latin digits', () => {
    const result = formatLatinNumber(75.5, 'ar', { maximumFractionDigits: 1 });
    expect(result).not.toMatch(/[\u0660-\u0669]/);
    expect(result).toContain('75');
  });

  it('handles null and undefined gracefully', () => {
    expect(formatLatinNumber(null, 'ar')).toBe('');
    expect(formatLatinNumber(undefined, 'ar')).toBe('');
  });
});

describe('Latin numeral enforcement — dates', () => {
  it('formatLatinDate produces Latin digits for ar-OM', () => {
    const d = new Date('2026-07-15T12:00:00Z');
    const result = formatLatinDate(d, 'ar-OM');
    expect(result).not.toMatch(/[\u0660-\u0669]/);
  });

  it('formatLatinDateTime produces Latin digits for ar', () => {
    const d = new Date('2026-07-15T12:30:00Z');
    const result = formatLatinDateTime(d, 'ar');
    expect(result).not.toMatch(/[\u0660-\u0669]/);
  });

  it('formatLatinTime produces Latin digits', () => {
    const d = new Date('2026-07-15T14:45:00Z');
    const result = formatLatinTime(d, 'ar');
    expect(result).not.toMatch(/[\u0660-\u0669]/);
  });

  it('handles invalid dates gracefully', () => {
    expect(formatLatinDate('not-a-date', 'ar')).toBe('not-a-date');
    expect(formatLatinDateTime('not-a-date', 'ar')).toBe('not-a-date');
    expect(formatLatinTime('not-a-date', 'ar')).toBe('not-a-date');
  });

  it('handles null/undefined gracefully', () => {
    expect(formatLatinDate(null, 'ar')).toBe('');
    expect(formatLatinDateTime(undefined, 'ar')).toBe('');
    expect(formatLatinTime(null, 'ar')).toBe('');
  });
});

describe('numeric strings — not interpreted as dates before numbers', () => {
  it('toLatinLocaleString treats pure numeric strings as numbers', () => {
    const result = toLatinLocaleString('1234', 'ar');
    expect(result).not.toMatch(/[\u0660-\u0669]/);
    expect(result).toContain('1');
  });
});

describe('normalizeLocale — Unicode extension handling', () => {
  it('adds -u-nu-latn to bare ar locale', () => {
    expect(normalizeLocale('ar')).toBe('ar-u-nu-latn');
  });

  it('adds -u-nu-latn to ar-OM locale', () => {
    expect(normalizeLocale('ar-OM')).toBe('ar-OM-u-nu-latn');
  });

  it('preserves existing -u-nu- extension', () => {
    expect(normalizeLocale('ar-u-nu-latn')).toBe('ar-u-nu-latn');
  });

  it('does not modify non-Arabic locales', () => {
    expect(normalizeLocale('en')).toBe('en');
    expect(normalizeLocale('fr')).toBe('fr');
  });

  it('handles locale arrays', () => {
    const result = normalizeLocale(['ar-OM', 'en']);
    expect(Array.isArray(result)).toBe(true);
    expect((result as string[])[0]).toBe('ar-OM-u-nu-latn');
    expect((result as string[])[1]).toBe('en');
  });
});

describe('backwards-compatible aliases', () => {
  it('toLatinLocaleString works for numbers', () => {
    const result = toLatinLocaleString(42, 'ar');
    expect(result).not.toMatch(/[\u0660-\u0669]/);
  });

  it('toLatinLocaleDateString works for dates', () => {
    const d = new Date('2026-07-01T00:00:00Z');
    const result = toLatinLocaleDateString(d, 'ar-OM');
    expect(result).not.toMatch(/[\u0660-\u0669]/);
  });

  it('toLatinLocaleTimeString works for dates', () => {
    const d = new Date('2026-07-01T12:00:00Z');
    const result = toLatinLocaleTimeString(d, 'ar');
    expect(result).not.toMatch(/[\u0660-\u0669]/);
  });
});

describe('no prototype side effects', () => {
  it('Number.prototype does not have toLatinLocaleString', () => {
    expect((Number.prototype as any).toLatinLocaleString).toBeUndefined();
  });

  it('Date.prototype does not have toLatinLocaleString', () => {
    expect((Date.prototype as any).toLatinLocaleString).toBeUndefined();
  });

  it('Date.prototype does not have toLatinLocaleDateString', () => {
    expect((Date.prototype as any).toLatinLocaleDateString).toBeUndefined();
  });

  it('Date.prototype does not have toLatinLocaleTimeString', () => {
    expect((Date.prototype as any).toLatinLocaleTimeString).toBeUndefined();
  });
});
