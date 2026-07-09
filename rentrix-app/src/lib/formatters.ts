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

export function formatMoney({ amount, currency = DEFAULT_CURRENCY, locale = DEFAULT_LOCALE, currencyDisplay = 'code' }: MoneyFormatOptions) {
  const metadata = getCurrencyMetadata(currency);
  const safeAmount = normalizeMoneyNumber(amount);

  return new Intl.NumberFormat(locale, {
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
  return new Intl.NumberFormat(locale, {
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
  return new Intl.DateTimeFormat(locale, { dateStyle, timeZone }).format(date);
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
  return new Intl.DateTimeFormat(locale, { dateStyle, timeStyle, timeZone }).format(date);
}
