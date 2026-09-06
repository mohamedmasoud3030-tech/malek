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

/**
 * Canonical formatting for COUNTS (records, units, contracts, days).
 *
 * Every register used to declare its own private `new Intl.NumberFormat('en-US')`
 * helper. Counts are not money and take no currency, but they still have to
 * share one locale/numeral policy with the rest of the product, so they route
 * through formatNumber. For the default Arabic locale that resolves to
 * `ar-u-nu-latn` — Latin numerals with the same grouping the money formatter
 * produces — so this is identical in Arabic and correct in English.
 */
export function formatCount(value: number | null | undefined, locale?: string): string {
  return formatNumber({ value, locale, maximumFractionDigits: 0, minimumFractionDigits: 0 });
}


export type DateFormatOptions = {
  value: string | number | Date | null | undefined;
  locale?: string | string[];
  timeZone?: string;
  dateStyle?: Intl.DateTimeFormatOptions['dateStyle'];
};

/**
 * Date-only ISO string (YYYY-MM-DD) in the LOCAL timezone. Never use
 * toISOString() for date-only values: it serializes in UTC and shifts the
 * calendar day backwards for any timezone east of UTC.
 */
export function toDateOnlyISO(value: Date = new Date()): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
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
  options: Intl.DateTimeFormatOptions = { timeStyle: 'medium' },
): string {
  if (value === null || value === undefined) return '';
  const date = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(date.getTime())) return String(value ?? '');
  const targetLocale = normalizeLocale(locale);
  return new Intl.DateTimeFormat(targetLocale as string, options).format(date);
}

// ──────────────────────────────────────────────────────────────────────────────
// File sizes
// ──────────────────────────────────────────────────────────────────────────────

const FILE_SIZE_BASE = 1024;
const FILE_SIZE_LATIN_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
const FILE_SIZE_ARABIC_UNITS = ['بايت', 'كيلوبايت', 'ميغابايت', 'جيجابايت', 'تيرابايت'] as const;

export type FileSizeFormatOptions = {
  /** Unit vocabulary: Latin for data surfaces, Arabic words for prose. */
  unitLabels?: 'latin' | 'arabic';
  locale?: string | string[];
  /**
   * Digits after the decimal point for scaled units. Unset scales with the unit:
   * bytes are integral, KB keeps one decimal, MB and above allow a second so a
   * 2.25 MB attachment never collapses to `2.3 MB`.
   */
  fractionDigits?: number;
};

/**
 * Renders a byte count in the largest binary unit that keeps the number at or
 * above one, and returns `null` when there is no measurable size to display.
 *
 * Uploaded-file lists, upload limits and import previews each divided by 1024 by
 * hand, so the same document read «12.4 KB» in the vault and «12.4 ك.ب» in the
 * contextual panel, and quoted limits were literal text that could drift from
 * the constants they describe. Callers pass the constant and get one shape.
 */
export function formatFileSize(
  bytes: number | null | undefined,
  options: FileSizeFormatOptions = {},
): string | null {
  const value = typeof bytes === 'number' ? bytes : Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return null;

  const units = options.unitLabels === 'arabic' ? FILE_SIZE_ARABIC_UNITS : FILE_SIZE_LATIN_UNITS;
  const locale = options.locale ?? DEFAULT_LOCALE;

  // How many decimals a tier shows; the promotion rule below has to agree with it.
  const digitsFor = (exponent: number) =>
    options.fractionDigits !== undefined
      ? Math.max(0, Math.min(3, options.fractionDigits))
      : exponent === 1 ? 1 : exponent === 0 ? 0 : 2;

  let exponent = 0;
  while (exponent < units.length - 1 && value >= FILE_SIZE_BASE ** (exponent + 1)) exponent += 1;
  let scaled = value / FILE_SIZE_BASE ** exponent;
  // Rounding up to the base means the next unit is the honest one, so a
  // 1 048 550 byte file never reads as «1024.0 KB».
  while (
    exponent < units.length - 1 &&
    Number((value / FILE_SIZE_BASE ** exponent).toFixed(digitsFor(exponent))) >= FILE_SIZE_BASE
  ) {
    exponent += 1;
    scaled = value / FILE_SIZE_BASE ** exponent;
  }

  const digits = digitsFor(exponent);
  const number = formatLatinNumber(exponent === 0 ? Math.round(scaled) : scaled, locale, {
    // MB and above may use the second decimal (2.25 MB), but never pad to it.
    minimumFractionDigits: exponent === 0 ? 0 : options.fractionDigits !== undefined ? digits : 1,
    maximumFractionDigits: digits,
    // A measurement reads as a magnitude, not as a ledger figure: 1023 B and
    // 2000 TB carry no thousands separator.
    useGrouping: false,
  });
  return `${number} ${units[exponent]}`;
}
