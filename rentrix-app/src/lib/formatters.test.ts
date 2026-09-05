import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CURRENCY,
  currencyMetadata,
  formatDate,
  formatDateTime,
  formatFileSize,
  formatLatinDate,
  formatLatinDateTime,
  formatLatinNumber,
  formatLatinTime,
  formatMoney,
  formatCount,
  formatNumber,
  getCurrencyMetadata,
  getCurrencyMinorUnit,
  normalizeCurrency,
  normalizeLocale,
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

describe('formatCount — one canonical count formatter for every register', () => {
  // Eight registers used to declare a private `new Intl.NumberFormat('en-US')`
  // helper. These assertions lock the dedup to the SAME rendered output so the
  // consolidation is provably behaviour-neutral.
  it('matches the per-register en-US helper it replaced', () => {
    for (const value of [0, 1, 7, 42, 1000, 12345, 1234567]) {
      expect(formatCount(value, 'en-US')).toBe(new Intl.NumberFormat('en-US').format(value));
    }
  });

  it('groups thousands and never shows fraction digits', () => {
    expect(formatCount(1234567, 'en-US')).toBe('1,234,567');
    expect(formatCount(0, 'en-US')).toBe('0');
  });

  it('keeps Latin numerals for the default Arabic locale, like money does', () => {
    expect(formatCount(12345)).toBe('12,345');
    expect(formatCount(12345)).not.toMatch(/[٠-٩]/);
  });

  it('treats null and undefined as zero instead of rendering NaN', () => {
    expect(formatCount(null, 'en-US')).toBe('0');
    expect(formatCount(undefined, 'en-US')).toBe('0');
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

  // The aliases are gone; the prototype pollution they once wrapped must not return.
  it('Date.prototype has no Latin formatting methods', () => {
    expect((Date.prototype as any).toLatinLocaleTimeString).toBeUndefined();
  });

  it('formatters does not re-export the retired aliases', () => {
    const source = readFileSync(resolve(import.meta.dirname, 'formatters.ts'), 'utf8');
    expect(source).not.toMatch(/toLatinLocale/);
  });
});

describe('formatFileSize', () => {
  const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

  it('yields nothing to show when there is no measurable size', () => {
    for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, null, undefined]) {
      expect(formatFileSize(value)).toBeNull();
    }
  });

  it('keeps sub-kilobyte files in bytes instead of showing a fraction', () => {
    expect(formatFileSize(1)).toBe('1 B');
    expect(formatFileSize(900)).toBe('900 B');
    expect(formatFileSize(1023)).toBe('1023 B');
  });

  it('scales to the largest unit that keeps the number at or above one', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(12_700)).toBe('12.4 KB');
    expect(formatFileSize(3_758_096_384)).toBe('3.5 GB');
  });

  it('keeps a second decimal above the megabyte so 2.25 MB does not read as 2.3 MB', () => {
    expect(formatFileSize(2.25 * 1024 * 1024)).toBe('2.25 MB');
    expect(formatFileSize(5 * 1024 * 1024 + 1)).toBe('5.0 MB');
  });

  it('promotes a value whose rounding reaches the next base', () => {
    expect(formatFileSize(1_048_550)).toBe('1.0 MB');
  });

  it('honours the caller fraction digits', () => {
    expect(formatFileSize(MAX_ATTACHMENT_BYTES, { fractionDigits: 0 })).toBe('5 MB');
    expect(formatFileSize(1_572_864, { fractionDigits: 2 })).toBe('1.50 MB');
  });

  it('renders Arabic unit words for prose and Latin units for data surfaces', () => {
    expect(
      formatFileSize(MAX_ATTACHMENT_BYTES, { unitLabels: 'arabic', fractionDigits: 0 }),
    ).toBe('5 ميغابايت');
  });

  it('always uses Latin digits so a size reads the same in any locale', () => {
    expect(formatFileSize(12_700, { locale: 'ar-OM' })).toBe('12.4 KB');
    expect(formatFileSize(1_536, { locale: 'en' })).toBe('1.5 KB');
  });

  it('caps the top unit rather than inventing a petabyte tier', () => {
    expect(formatFileSize(2_000 * 1024 ** 4)).toBe('2000.0 TB');
  });

  // Consolidation guard: these surfaces once divided by 1024 themselves, which is
  // how «12.4 KB» and «12.4 ك.ب» ended up describing the same uploaded document,
  // and how a literal “5MB” drifted from the constant the check actually uses.
  it('is the only byte formatter behind the migrated surfaces', () => {
    const consumers = [
      '../components/documents/contextual-documents-section.tsx',
      '../components/ui/file-attachment-field.tsx',
      '../features/documents-vault/components/documents-vault-workspace.tsx',
      '../features/documents-vault/documents-vault-service.ts',
      '../features/financials/reconciliation/bank-csv-import-workflow.tsx',
      '../features/settings/office-launch/import/office-import.ts',
    ];
    for (const relative of consumers) {
      const source = readFileSync(resolve(import.meta.dirname, relative), 'utf8');
      expect(source).not.toMatch(/\/ 1024/);
      expect(source).not.toMatch(/\.toFixed\(\d\)\s*}\s*(KB|ك\.ب|MB)/);
      expect(source).toContain('formatFileSize');
    }
  });
});
