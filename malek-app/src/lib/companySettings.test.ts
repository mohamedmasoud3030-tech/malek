import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COMPANY_LOCALE,
  DEFAULT_COUNTRY,
  DEFAULT_LANGUAGE,
  DEFAULT_TIMEZONE,
  defaultCompanySettingsContract,
  languageFromCompanyLocale,
  normalizeCompanyLocale,
  normalizeCompanyLocalSettings,
  normalizeCompanyLogoUrl,
  normalizeCompanySettingsContract,
  normalizeCountry,
  normalizeTimezone,
} from './companySettings';
import { formatCompanyDate, formatCompanyMoney, getCompanyLocale } from './companyFormatters';

describe('company settings runtime contract', () => {
  it('keeps Master Plan defaults for language, country, timezone, and currency', () => {
    expect(DEFAULT_LANGUAGE).toBe('ar');
    expect(DEFAULT_COMPANY_LOCALE).toBe('ar-OM');
    expect(DEFAULT_COUNTRY).toBe('OM');
    expect(DEFAULT_TIMEZONE).toBe('Asia/Muscat');
    expect(defaultCompanySettingsContract).toMatchObject({
      defaultLanguage: 'ar',
      defaultCurrency: 'OMR',
      country: 'OM',
      timezone: 'Asia/Muscat',
      locale: 'ar-OM',
      direction: 'rtl',
    });
  });

  it('bridges persisted locale values to the default language contract', () => {
    expect(languageFromCompanyLocale('en-OM')).toBe('en');
    expect(languageFromCompanyLocale('ar-OM')).toBe('ar');
    expect(normalizeCompanySettingsContract({ locale: 'en-OM' })).toMatchObject({
      defaultLanguage: 'en',
      locale: 'en-OM',
      direction: 'ltr',
    });
    expect(normalizeCompanySettingsContract({ locale: 'ar-OM' })).toMatchObject({
      defaultLanguage: 'ar',
      locale: 'ar-OM',
      direction: 'rtl',
    });
  });

  it('falls unsupported locale, currency, country, and timezone values back safely', () => {
    expect(normalizeCompanyLocale('fr-FR')).toBe('ar-OM');
    expect(normalizeCountry('unsupported')).toBe('OM');
    expect(normalizeTimezone('Europe/Paris')).toBe('Asia/Muscat');
    expect(normalizeCompanyLocalSettings({
      defaultLanguage: 'fr' as never,
      defaultCurrency: 'XYZ' as never,
      country: 'unsupported' as never,
      timezone: 'Europe/Paris' as never,
    })).toMatchObject({
      defaultLanguage: 'ar',
      defaultCurrency: 'OMR',
      country: 'OM',
      timezone: 'Asia/Muscat',
    });
  });


  it('normalizes logo URLs safely and falls document prefixes back to defaults', () => {
    expect(normalizeCompanyLogoUrl(' https://example.test/logo.png ')).toBe('https://example.test/logo.png');
    expect(normalizeCompanyLogoUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeCompanyLogoUrl('not a url')).toBeNull();
    expect(normalizeCompanySettingsContract({
      logoUrl: 'ftp://example.test/logo.png',
      invoicePrefix: ' ',
      receiptPrefix: '',
    })).toMatchObject({
      logoUrl: null,
      invoicePrefix: 'INV',
      receiptPrefix: 'REC',
    });
  });

  it('normalizes legacy Oman display country values to the ISO country code', () => {
    expect(normalizeCountry('Oman')).toBe('OM');
    expect(normalizeCountry('om')).toBe('OM');
    expect(normalizeCompanySettingsContract({ country: ' Oman ' })).toMatchObject({ country: 'OM' });
  });

  it('lets company formatters consume unsafe partial settings through the normalized contract', () => {
    const unsafeSettings = {
      locale: 'fr-FR',
      defaultCurrency: 'XYZ',
      timezone: 'Europe/Paris',
    } as never;

    expect(getCompanyLocale(unsafeSettings)).toBe('ar-OM');
    expect(formatCompanyMoney(unsafeSettings, Number.NaN)).toContain('OMR');
    expect(formatCompanyDate(unsafeSettings, '2026-05-18T00:00:00.000Z')).toBeTruthy();
  });
});
