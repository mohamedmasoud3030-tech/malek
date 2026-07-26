import { normalizeMoneyNumber } from './moneyNormalization';

export const supportedCurrencies = ['OMR', 'AED', 'SAR', 'QAR', 'KWD', 'BHD', 'USD', 'EGP'] as const;

export type SupportedCurrency = (typeof supportedCurrencies)[number];

export type CurrencyMetadata = Readonly<{
  code: SupportedCurrency;
  label: string;
  minorUnit: number;
}>;

export const currencyMetadata = {
  OMR: { code: 'OMR', label: 'Omani Rial', minorUnit: 3 },
  AED: { code: 'AED', label: 'UAE Dirham', minorUnit: 2 },
  SAR: { code: 'SAR', label: 'Saudi Riyal', minorUnit: 2 },
  QAR: { code: 'QAR', label: 'Qatari Riyal', minorUnit: 2 },
  KWD: { code: 'KWD', label: 'Kuwaiti Dinar', minorUnit: 3 },
  BHD: { code: 'BHD', label: 'Bahraini Dinar', minorUnit: 3 },
  USD: { code: 'USD', label: 'US Dollar', minorUnit: 2 },
  EGP: { code: 'EGP', label: 'Egyptian Pound', minorUnit: 2 },
} as const satisfies Record<SupportedCurrency, CurrencyMetadata>;

export const DEFAULT_CURRENCY: SupportedCurrency = 'OMR';
export const DEFAULT_LOCALE = 'ar';

export type MoneyFormatOptions = {
  amount: number | null | undefined;
  currency?: SupportedCurrency | null;
  locale?: string;
  currencyDisplay?: 'symbol' | 'code' | 'name';
};

export function isSupportedCurrency(value: unknown): value is SupportedCurrency {
  return typeof value === 'string' && supportedCurrencies.includes(value as SupportedCurrency);
}

export function normalizeCurrency(value: unknown): SupportedCurrency {
  return isSupportedCurrency(value) ? value : DEFAULT_CURRENCY;
}

export function getCurrencyMetadata(value: unknown): CurrencyMetadata {
  return currencyMetadata[normalizeCurrency(value)];
}

export function getCurrencyMinorUnit(value: unknown): number {
  return getCurrencyMetadata(value).minorUnit;
}

/**
 * Ensures Latin (Western Arabic) numerals for any locale by appending -u-nu-latn
 * when the locale is Arabic-based and does not already specify a numbering system.
 * Supports bare locales, locales with Unicode extensions, and locale arrays.
 */
export function normalizeLocale(locale?: string | string[]): string | string[] {
  if (Array.isArray(locale)) {
    return locale.map((l) => normalizeLocaleString(l));
  }
  return normalizeLocaleString(locale);
}

function normalizeLocaleString(locale?: string): string {
  if (!locale) return `${DEFAULT_LOCALE}-u-nu-latn`;
  // Already has Unicode numbering extension — don't override
  if (locale.includes('-u-') && locale.includes('-nu-')) {
    return locale;
  }
  // Check if it's an Arabic locale
  if (/^ar(-|$)/i.test(locale)) {
    if (locale.includes('-u-')) {
      return `${locale}-nu-latn`;
    }
    return `${locale}-u-nu-latn`;
  }
  return locale;
}

export function formatMoney({ amount, currency = DEFAULT_CURRENCY, locale = DEFAULT_LOCALE, currencyDisplay = 'code' }: MoneyFormatOptions) {
  const metadata = getCurrencyMetadata(currency);
  const safeAmount = normalizeMoneyNumber(amount);
  const targetLocale = normalizeLocale(locale);
  return new Intl.NumberFormat(targetLocale as string, {
    style: 'currency',
    currency: metadata.code,
    currencyDisplay,
    minimumFractionDigits: metadata.minorUnit,
    maximumFractionDigits: metadata.minorUnit,
  }).format(safeAmount);
}

export type NumberFormatOptions = {
  value: number | null | undefined;
  locale?: string | string[];
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
};

export function formatNumber({
  value,
  locale = DEFAULT_LOCALE,
  maximumFractionDigits = 0,
  minimumFractionDigits,
}: NumberFormatOptions) {
  const safeValue = normalizeMoneyNumber(value);
  const targetLocale = normalizeLocale(locale);
  return new Intl.NumberFormat(targetLocale as string, {
    maximumFractionDigits,
    minimumFractionDigits,
  }).format(safeValue);
}

export type DateFormatOptions = {
  value: string | number | Date | null | undefined;
  locale?: string | string[];
  timeZone?: string;
  dateStyle?: Intl.DateTimeFormatOptions['dateStyle'];
};

export function formatDate({ value, locale = DEFAULT_LOCALE, timeZone, dateStyle = 'medium' }: DateFormatOptions) {
  if (value === null || value === undefined || value === '') return '—';
  const date = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(date.getTime())) return '—';
  const targetLocale = normalizeLocale(locale);
  return new Intl.DateTimeFormat(targetLocale as string, { dateStyle, timeZone }).format(date);
}

export type DateTimeFormatOptions = DateFormatOptions & {
  timeStyle?: Intl.DateTimeFormatOptions['timeStyle'];
};

export function formatDateTime({
  value,
  locale = DEFAULT_LOCALE,
  timeZone,
  dateStyle = 'medium',
  timeStyle = 'short',
}: DateTimeFormatOptions) {
  if (value === null || value === undefined || value === '') return '—';
  const date = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(date.getTime())) return '—';
  const targetLocale = normalizeLocale(locale);
  return new Intl.DateTimeFormat(targetLocale as string, { dateStyle, timeStyle, timeZone }).format(date);
}

// ──────────────────────────────────────────────────────────────────────────────
// Explicit standalone Latin-numeral formatters.
// These replace all former prototype patches.
// ──────────────────────────────────────────────────────────────────────────────

export function formatLatinNumber(
  value: number | null | undefined,
  locale?: string | string[],
  options?: Intl.NumberFormatOptions,
): string {
  if (value === null || value === undefined) return '';
  const targetLocale = normalizeLocale(locale);
  return new Intl.NumberFormat(targetLocale as string, options).format(value);
}

export function formatLatinDateTime(
  value: Date | string | number | null | undefined,
  locale?: string | string[],
  options?: Intl.DateTimeFormatOptions,
): string {
  if (value === null || value === undefined) return '';
  const date = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(date.getTime())) return String(value ?? '');
  const targetLocale = normalizeLocale(locale);
  return new Intl.DateTimeFormat(targetLocale as string, options).format(date);
}

export function formatLatinDate(
  value: Date | string | null | undefined,
  locale?: string | string[],
  options?: Intl.DateTimeFormatOptions,
): string {
  if (value === null || value === undefined) return '';
  const date = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(date.getTime())) return String(value ?? '');
  const targetLocale = normalizeLocale(locale);
  return new Intl.DateTimeFormat(targetLocale as string, options).format(date);
}

export function formatLatinTime(
  value: Date | string | null | undefined,
  locale?: string | string[],
  options?: Intl.DateTimeFormatOptions,
): string {
  if (value === null || value === undefined) return '';
  const date = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(date.getTime())) return String(value ?? '');
  const targetLocale = normalizeLocale(locale);
  return new Intl.DateTimeFormat(targetLocale as string, options).format(date);
}

// ──────────────────────────────────────────────────────────────────────────────
// Backwards-compatible aliases (used during the migration away from prototypes).
// New code should use the formatLatin* functions directly.
// ──────────────────────────────────────────────────────────────────────────────

export function toLatinLocaleString(
  value: number | Date | string | null | undefined,
  locales?: string | string[],
  options?: Intl.NumberFormatOptions | Intl.DateTimeFormatOptions,
): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return formatLatinDateTime(value, locales, options as Intl.DateTimeFormatOptions);
  if (typeof value === 'number') return formatLatinNumber(value, locales, options as Intl.NumberFormatOptions);
  const trimmed = String(value).trim();
  if (trimmed !== '' && !Number.isNaN(Number(trimmed))) return formatLatinNumber(Number(trimmed), locales, options as Intl.NumberFormatOptions);
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return formatLatinDateTime(parsed, locales, options as Intl.DateTimeFormatOptions);
  return String(value);
}

export function toLatinLocaleDateString(
  value: Date | string | null | undefined,
  locales?: string | string[],
  options?: Intl.DateTimeFormatOptions,
): string {
  return formatLatinDate(value, locales, options);
}

export function toLatinLocaleTimeString(
  value: Date | string | null | undefined,
  locales?: string | string[],
  options?: Intl.DateTimeFormatOptions,
): string {
  return formatLatinTime(value, locales, options);
}
