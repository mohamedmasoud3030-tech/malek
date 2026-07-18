import { DEFAULT_CURRENCY, normalizeCurrency, type SupportedCurrency } from './formatters';

export const supportedLanguages = ['ar', 'en'] as const;
export const supportedCompanyLocales = ['ar-OM', 'en-OM', 'ar', 'en'] as const;
export const supportedCountries = ['OM', 'AE', 'SA', 'QA', 'KW', 'BH', 'US', 'EG'] as const;
export const supportedTimezones = ['Asia/Muscat', 'Asia/Dubai', 'Asia/Riyadh', 'UTC'] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number];
export type SupportedCompanyLocale = (typeof supportedCompanyLocales)[number];
export type SupportedCountry = (typeof supportedCountries)[number];
export type SupportedTimezone = (typeof supportedTimezones)[number];
export type TextDirection = 'rtl' | 'ltr';

export const DEFAULT_LANGUAGE: SupportedLanguage = 'ar';
export const DEFAULT_COMPANY_LOCALE: SupportedCompanyLocale = 'ar-OM';
export const DEFAULT_COUNTRY: SupportedCountry = 'OM';
export const DEFAULT_TIMEZONE: SupportedTimezone = 'Asia/Muscat';
export const DEFAULT_RECEIPT_PREFIX = 'REC';
export const DEFAULT_INVOICE_PREFIX = 'INV';
export const DEFAULT_CONTRACT_PREFIX = 'CON';

export type CompanyLocalSettings = {
  companyName: string;
  logoUrl?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  taxNumber?: string | null;
  registrationNumber?: string | null;
  defaultLanguage: SupportedLanguage;
  defaultCurrency: SupportedCurrency;
  country: SupportedCountry;
  timezone: SupportedTimezone;
  receiptPrefix: string;
  invoicePrefix: string;
  contractPrefix: string;
};

export type CompanySettingsContract = CompanyLocalSettings & {
  locale: SupportedCompanyLocale;
  direction: TextDirection;
};

type CompanySettingsInput = Readonly<Partial<{
  companyName: unknown;
  logoUrl: unknown;
  address: unknown;
  phone: unknown;
  email: unknown;
  taxNumber: unknown;
  registrationNumber: unknown;
  defaultLanguage: unknown;
  defaultCurrency: unknown;
  country: unknown;
  timezone: unknown;
  receiptPrefix: unknown;
  invoicePrefix: unknown;
  contractPrefix: unknown;
  locale: unknown;
}>>;

const countryAliases: Readonly<Record<string, SupportedCountry>> = {
  OMAN: 'OM',
  'سلطنة عمان': 'OM',
  'الإمارات': 'AE',
  'UNITED ARAB EMIRATES': 'AE',
  UAE: 'AE',
  'SAUDI ARABIA': 'SA',
  'المملكة العربية السعودية': 'SA',
  QATAR: 'QA',
  قطر: 'QA',
  KUWAIT: 'KW',
  الكويت: 'KW',
  BAHRAIN: 'BH',
  البحرين: 'BH',
  'UNITED STATES': 'US',
  USA: 'US',
  EGYPT: 'EG',
  مصر: 'EG',
};

export const defaultCompanyLocalSettings: CompanyLocalSettings = {
  companyName: 'Rentrix',
  logoUrl: null,
  address: null,
  phone: null,
  email: null,
  taxNumber: null,
  registrationNumber: null,
  defaultLanguage: DEFAULT_LANGUAGE,
  defaultCurrency: DEFAULT_CURRENCY,
  country: DEFAULT_COUNTRY,
  timezone: DEFAULT_TIMEZONE,
  receiptPrefix: DEFAULT_RECEIPT_PREFIX,
  invoicePrefix: DEFAULT_INVOICE_PREFIX,
  contractPrefix: DEFAULT_CONTRACT_PREFIX,
};

export const defaultCompanySettingsContract: CompanySettingsContract = {
  ...defaultCompanyLocalSettings,
  locale: DEFAULT_COMPANY_LOCALE,
  direction: 'rtl',
};

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === 'string' && supportedLanguages.includes(value as SupportedLanguage);
}

export function normalizeLanguage(value: unknown): SupportedLanguage {
  return isSupportedLanguage(value) ? value : DEFAULT_LANGUAGE;
}

export function languageFromCompanyLocale(value: unknown): SupportedLanguage {
  if (typeof value !== 'string') return DEFAULT_LANGUAGE;

  return value.trim().toLowerCase().startsWith('en') ? 'en' : DEFAULT_LANGUAGE;
}

export function getLanguageDirection(language: unknown): TextDirection {
  return normalizeLanguage(language) === 'ar' ? 'rtl' : 'ltr';
}

export function getLanguageLocale(language: unknown): string {
  return normalizeLanguage(language);
}

export function isSupportedCompanyLocale(value: unknown): value is SupportedCompanyLocale {
  return typeof value === 'string' && supportedCompanyLocales.includes(value as SupportedCompanyLocale);
}

export function normalizeCompanyLocale(value: unknown, language: unknown = undefined): SupportedCompanyLocale {
  if (typeof value === 'string') {
    const trimmedLocale = value.trim();
    const exactLocale = supportedCompanyLocales.find((locale) => locale.toLowerCase() === trimmedLocale.toLowerCase());

    if (exactLocale) return exactLocale;
  }

  return normalizeLanguage(language) === 'en' ? 'en-OM' : DEFAULT_COMPANY_LOCALE;
}

export function isSupportedCountry(value: unknown): value is SupportedCountry {
  return typeof value === 'string' && supportedCountries.includes(value as SupportedCountry);
}

export function normalizeCountry(value: unknown): SupportedCountry {
  if (typeof value !== 'string') return DEFAULT_COUNTRY;

  const trimmedCountry = value.trim();
  const uppercaseCountry = trimmedCountry.toUpperCase();

  if (isSupportedCountry(uppercaseCountry)) return uppercaseCountry;

  return countryAliases[uppercaseCountry] ?? countryAliases[trimmedCountry] ?? DEFAULT_COUNTRY;
}

export function isSupportedTimezone(value: unknown): value is SupportedTimezone {
  return typeof value === 'string' && supportedTimezones.includes(value as SupportedTimezone);
}

export function normalizeTimezone(value: unknown): SupportedTimezone {
  if (typeof value !== 'string') return DEFAULT_TIMEZONE;

  const trimmedTimezone = value.trim();
  const exactTimezone = supportedTimezones.find((timezone) => timezone === trimmedTimezone);

  return exactTimezone ?? DEFAULT_TIMEZONE;
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null;
}

export function normalizeCompanyLogoUrl(value: unknown): string | null {
  const trimmedUrl = normalizeOptionalString(value);

  if (!trimmedUrl) return null;

  try {
    const url = new URL(trimmedUrl);
    if (['http:', 'https:'].includes(url.protocol)) return url.href;
    if (url.protocol === 'data:' && /^data:image\/(?:png|jpeg|webp|svg\+xml);base64,/i.test(trimmedUrl)) return trimmedUrl;
    return null;
  } catch {
    return null;
  }
}

export function normalizeCompanySettingsContract(value: CompanySettingsInput | null | undefined): CompanySettingsContract {
  const defaultLanguage = isSupportedLanguage(value?.defaultLanguage)
    ? value.defaultLanguage
    : languageFromCompanyLocale(value?.locale);
  const locale = normalizeCompanyLocale(value?.locale, defaultLanguage);
  const normalizedLanguage = languageFromCompanyLocale(locale);

  return {
    companyName: normalizeOptionalString(value?.companyName) || defaultCompanySettingsContract.companyName,
    logoUrl: normalizeCompanyLogoUrl(value?.logoUrl),
    address: normalizeOptionalString(value?.address),
    phone: normalizeOptionalString(value?.phone),
    email: normalizeOptionalString(value?.email),
    taxNumber: normalizeOptionalString(value?.taxNumber),
    registrationNumber: normalizeOptionalString(value?.registrationNumber),
    defaultLanguage: normalizedLanguage,
    defaultCurrency: normalizeCurrency(value?.defaultCurrency),
    country: normalizeCountry(value?.country),
    timezone: normalizeTimezone(value?.timezone),
    receiptPrefix: normalizeOptionalString(value?.receiptPrefix) || defaultCompanySettingsContract.receiptPrefix,
    invoicePrefix: normalizeOptionalString(value?.invoicePrefix) || defaultCompanySettingsContract.invoicePrefix,
    contractPrefix: normalizeOptionalString(value?.contractPrefix) || defaultCompanySettingsContract.contractPrefix,
    locale,
    direction: getLanguageDirection(normalizedLanguage),
  };
}

export function normalizeCompanyLocalSettings(value: Partial<CompanyLocalSettings> | null | undefined): CompanyLocalSettings {
  const contract = normalizeCompanySettingsContract(value);

  return {
    companyName: contract.companyName,
    logoUrl: contract.logoUrl,
    address: contract.address,
    phone: contract.phone,
    email: contract.email,
    taxNumber: contract.taxNumber,
    registrationNumber: contract.registrationNumber,
    defaultLanguage: contract.defaultLanguage,
    defaultCurrency: contract.defaultCurrency,
    country: contract.country,
    timezone: contract.timezone,
    receiptPrefix: contract.receiptPrefix,
    invoicePrefix: contract.invoicePrefix,
    contractPrefix: contract.contractPrefix,
  };
}
