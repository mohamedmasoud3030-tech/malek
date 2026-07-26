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
 * Normalizes any Arabic locale to use Latin numbers via the Unicode extension (-u-nu-latn).
 */
export function normalizeLocale(locale?: string): string {
  if (!locale) return `${DEFAULT_LOCALE}-u-nu-latn`;
  if (locale.startsWith('ar') && !locale.includes('-u-nu-')) {
    return `${locale}-u-nu-latn`;
  }
  return locale;
}

export function formatMoney({ amount, currency = DEFAULT_CURRENCY, locale = DEFAULT_LOCALE, currencyDisplay = 'code' }: MoneyFormatOptions) {
  const metadata = getCurrencyMetadata(currency);
  const safeAmount = normalizeMoneyNumber(amount);
  const targetLocale = normalizeLocale(locale);

  return new Intl.NumberFormat(targetLocale, {
    style: 'currency',
    currency: metadata.code,
    currencyDisplay,
    minimumFractionDigits: metadata.minorUnit,
    maximumFractionDigits: metadata.minorUnit,
  }).format(safeAmount);
}

export type NumberFormatOptions = {
  value: number | null | undefined;
  locale?: string;
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
  return new Intl.NumberFormat(targetLocale, {
    maximumFractionDigits,
    minimumFractionDigits,
  }).format(safeValue);
}

export type DateFormatOptions = {
  value: string | number | Date | null | undefined;
  locale?: string;
  timeZone?: string;
  dateStyle?: Intl.DateTimeFormatOptions['dateStyle'];
};

export function formatDate({ value, locale = DEFAULT_LOCALE, timeZone, dateStyle = 'medium' }: DateFormatOptions) {
  if (value === null || value === undefined || value === '') return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const targetLocale = normalizeLocale(locale);
  return new Intl.DateTimeFormat(targetLocale, { dateStyle, timeZone }).format(date);
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
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const targetLocale = normalizeLocale(locale);
  return new Intl.DateTimeFormat(targetLocale, { dateStyle, timeStyle, timeZone }).format(date);
}

// Declare global prototype methods for TypeScript type checking
declare global {
  interface Number {
    toLatinLocaleString(
      locales?: string | string[],
      options?: Intl.NumberFormatOptions
    ): string;
  }
  interface Date {
    toLatinLocaleString(
      locales?: string | string[],
      options?: Intl.DateTimeFormatOptions
    ): string;
    toLatinLocaleDateString(
      locales?: string | string[],
      options?: Intl.DateTimeFormatOptions
    ): string;
  }
}

// Standalone formatting functions that force Latin numerals for Arabic locales
export function toLatinLocaleString(
  value: number | Date | string | null | undefined,
  locales?: string | string[],
  options?: any
): string {
  if (value === null || value === undefined) return '';

  let targetLocales = locales;
  if (typeof targetLocales === 'string' && targetLocales.startsWith('ar')) {
    if (!targetLocales.includes('-u-nu-')) {
      targetLocales = `${targetLocales}-u-nu-latn`;
    }
  }

  if (value instanceof Date) {
    return value.toLocaleString(targetLocales, options);
  } else if (typeof value === 'number') {
    return value.toLocaleString(targetLocales, options);
  } else {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString(targetLocales, options);
    }
    const num = Number(value);
    if (!Number.isNaN(num)) {
      return num.toLocaleString(targetLocales, options);
    }
    return String(value);
  }
}

export function toLatinLocaleDateString(
  value: Date | string | null | undefined,
  locales?: string | string[],
  options?: Intl.DateTimeFormatOptions
): string {
  if (value === null || value === undefined) return '';

  let targetLocales = locales;
  if (typeof targetLocales === 'string' && targetLocales.startsWith('ar')) {
    if (!targetLocales.includes('-u-nu-')) {
      targetLocales = `${targetLocales}-u-nu-latn`;
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString(targetLocales, options);
}

// Patch Number and Date prototypes to make .toLatinLocaleString and .toLatinLocaleDateString globally available
if (typeof Number.prototype.toLatinLocaleString !== 'function') {
  Object.defineProperty(Number.prototype, 'toLatinLocaleString', {
    value: function (locales?: string | string[], options?: Intl.NumberFormatOptions) {
      let targetLocales = locales;
      if (typeof targetLocales === 'string' && targetLocales.startsWith('ar')) {
        if (!targetLocales.includes('-u-nu-')) {
          targetLocales = `${targetLocales}-u-nu-latn`;
        }
      }
      return this.toLocaleString(targetLocales, options);
    },
    writable: true,
    configurable: true,
  });
}

if (typeof Date.prototype.toLatinLocaleString !== 'function') {
  Object.defineProperty(Date.prototype, 'toLatinLocaleString', {
    value: function (locales?: string | string[], options?: Intl.DateTimeFormatOptions) {
      let targetLocales = locales;
      if (typeof targetLocales === 'string' && targetLocales.startsWith('ar')) {
        if (!targetLocales.includes('-u-nu-')) {
          targetLocales = `${targetLocales}-u-nu-latn`;
        }
      }
      return this.toLocaleString(targetLocales, options);
    },
    writable: true,
    configurable: true,
  });
}

if (typeof Date.prototype.toLatinLocaleDateString !== 'function') {
  Object.defineProperty(Date.prototype, 'toLatinLocaleDateString', {
    value: function (locales?: string | string[], options?: Intl.DateTimeFormatOptions) {
      let targetLocales = locales;
      if (typeof targetLocales === 'string' && targetLocales.startsWith('ar')) {
        if (!targetLocales.includes('-u-nu-')) {
          targetLocales = `${targetLocales}-u-nu-latn`;
        }
      }
      return this.toLocaleDateString(targetLocales, options);
    },
    writable: true,
    configurable: true,
  });
}
