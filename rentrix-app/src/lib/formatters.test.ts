import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CURRENCY,
  currencyMetadata,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  getCurrencyMetadata,
  getCurrencyMinorUnit,
  normalizeCurrency,
  supportedCurrencies,
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
