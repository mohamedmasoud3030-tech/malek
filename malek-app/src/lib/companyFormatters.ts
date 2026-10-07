import {
  defaultCompanySettingsContract,
  normalizeCompanySettingsContract,
  type CompanyLocalSettings,
  type CompanySettingsContract,
} from './companySettings';
import { formatDate, formatDateTime, formatMoney, formatNumber } from './formatters';

type CompanyFormatterSettings = Partial<CompanyLocalSettings & Pick<CompanySettingsContract, 'locale'>> | null | undefined;

export function getCompanyLocale(settings: CompanyFormatterSettings) {
  return normalizeCompanySettingsContract(settings).locale;
}

export function formatCompanyMoney(settings: CompanyFormatterSettings, amount: number | null | undefined) {
  const normalized = normalizeCompanySettingsContract(settings);
  return formatMoney({ amount, currency: normalized.defaultCurrency, locale: normalized.locale });
}

export function formatDefaultCompanyMoney(amount: number | null | undefined) {
  return formatCompanyMoney(defaultCompanySettingsContract, amount);
}

export function formatCompanyDate(settings: CompanyFormatterSettings, value: string | number | Date | null | undefined) {
  const normalized = normalizeCompanySettingsContract(settings);
  return formatDate({ value, locale: normalized.locale, timeZone: normalized.timezone, dateStyle: 'medium' });
}

export function formatCompanyDateTime(settings: CompanyFormatterSettings, value: string | number | Date | null | undefined) {
  const normalized = normalizeCompanySettingsContract(settings);
  return formatDateTime({ value, locale: normalized.locale, timeZone: normalized.timezone, dateStyle: 'medium', timeStyle: 'short' });
}

export function formatCompanyNumber(settings: CompanyFormatterSettings, value: number | null | undefined, maximumFractionDigits = 0) {
  const normalized = normalizeCompanySettingsContract(settings);
  return formatNumber({ value, locale: normalized.locale, maximumFractionDigits });
}
