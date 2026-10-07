import { describe, expect, it } from 'vitest';
import {
  formatCompanyDate,
  formatCompanyDateTime,
  formatCompanyMoney,
  formatDefaultCompanyMoney,
  getCompanyLocale,
} from './companyFormatters';

const enOM = { locale: 'en-OM' as const, defaultCurrency: 'OMR' as const };

function plain(value: string) {
  return value.replaceAll('\u00a0', ' ');
}

describe('company formatters', () => {
  it('resolves the canonical default locale when settings are absent', () => {
    expect(getCompanyLocale(null)).toBe('ar-OM');
    expect(getCompanyLocale(undefined)).toBe('ar-OM');
  });

  it('formats OMR money to the canonical three decimals', () => {
    expect(plain(formatCompanyMoney(enOM, 12.3))).toBe('OMR 12.300');
    expect(plain(formatCompanyMoney(enOM, 1000))).toBe('OMR 1,000.000');
  });

  it('honours the company currency and its minor-unit precision', () => {
    expect(plain(formatCompanyMoney({ ...enOM, defaultCurrency: 'USD' }, 12.3))).toBe('USD 12.30');
  });

  it('renders a missing amount as zero without throwing', () => {
    expect(plain(formatCompanyMoney(enOM, null))).toBe('OMR 0.000');
    expect(plain(formatCompanyMoney(enOM, undefined))).toBe('OMR 0.000');
  });

  it('uses the default company contract when no settings are supplied', () => {
    const result = formatDefaultCompanyMoney(12.3);
    expect(result).toContain('OMR');
    expect(result).toContain('12.300');
  });

  it('formats dates in the company locale and timezone', () => {
    const settings = { locale: 'en-OM' as const, timezone: 'UTC' as const };
    expect(formatCompanyDate(settings, '2026-07-01T00:00:00Z')).toBe('Jul 1, 2026');
  });

  it('formats date-times with a short time component', () => {
    const settings = { locale: 'en-OM' as const, timezone: 'UTC' as const };
    expect(formatCompanyDateTime(settings, '2026-07-01T09:30:00Z')).toBe('Jul 1, 2026, 9:30 AM');
  });
});
