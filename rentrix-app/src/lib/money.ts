/**
 * R3 — Money Contract (single source of monetary precision truth).
 *
 * MALEK operates in OMR: 3 decimal places (1 OMR = 1000 baisa). The server
 * accounting layer enforces this via public._r3 / numeric(18,3) columns and
 * journal_lines_precision_chk. The frontend must NEVER apply a different
 * monetary precision:
 *
 *   - Money inputs use MONEY_STEP (0.001), never a hardcoded 2dp step.
 *   - Client-side monetary rounding (when a display subtotal is unavoidable)
 *     uses roundMoney — identical semantics to public._r3.
 *   - 2dp monetary rounding helpers (fixed-2 formatting, cent-based rounding)
 *     are FORBIDDEN for money.
 *   - Percentages, areas, file sizes etc. are NOT money and do not use this
 *     module's step (they keep their own domain precision).
 *
 * Display formatting already flows through lib/formatters.ts currency
 * metadata (minorUnit per currency); this module is the INPUT/derivation
 * side of the same contract.
 */
import { currencyMetadata, DEFAULT_CURRENCY, type SupportedCurrency } from './formatters';
import { normalizeMoneyInput, type MoneyNormalizationOptions } from './moneyNormalization';

/** Minor-unit digits for a currency (OMR = 3). */
export function getCurrencyMinorUnit(currency: SupportedCurrency = DEFAULT_CURRENCY): number {
  return currencyMetadata[currency]?.minorUnit ?? currencyMetadata[DEFAULT_CURRENCY].minorUnit;
}

/** Smallest representable monetary step for a currency ("0.001" for OMR). */
export function getCurrencyStep(currency: SupportedCurrency = DEFAULT_CURRENCY): string {
  return (10 ** -getCurrencyMinorUnit(currency)).toFixed(getCurrencyMinorUnit(currency));
}

/** The company currency is OMR; forms bind these constants. */
export const MONEY_MINOR_UNIT = getCurrencyMinorUnit('OMR');
export const MONEY_STEP = getCurrencyStep('OMR');
/** Smallest positive amount (min for strictly-positive money inputs). */
export const MONEY_MIN_POSITIVE = MONEY_STEP;

/**
 * Round to the currency minor unit with the same half-up-away-from-artifact
 * semantics as the server (public._r3 = round(numeric, 3)). EPSILON absorbs
 * binary float artifacts (e.g. 1.0005 stored as 1.00049999…).
 */
export function roundMoney(value: number, currency: SupportedCurrency = 'OMR'): number {
  const factor = 10 ** getCurrencyMinorUnit(currency);
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON * Math.sign(value)) * factor) / factor;
}

/**
 * Parse free-form user money input (plain or comma-grouped) into a number at
 * the currency's precision. Invalid input resolves to the fallback (0 unless
 * overridden) — the VALIDATOR decides whether that is acceptable.
 */
export function parseMoneyInput(
  value: unknown,
  options: MoneyNormalizationOptions & { currency?: SupportedCurrency } = {},
): number {
  const { currency = 'OMR', ...normalization } = options;
  return roundMoney(normalizeMoneyInput(value, normalization), currency);
}

export type MoneyValidationResult =
  | { ok: true; value: number }
  | { ok: false; reason: 'invalid' | 'below_min' | 'above_max' | 'precision' };

/**
 * Validate a money amount against the currency contract:
 * finite, within bounds, and at most minorUnit decimals.
 */
export function validateMoney(
  value: unknown,
  options: { min?: number; max?: number; currency?: SupportedCurrency } = {},
): MoneyValidationResult {
  const currency = options.currency ?? 'OMR';
  const numeric = typeof value === 'number' ? value : Number(String(value ?? '').replaceAll(',', ''));
  if (!Number.isFinite(numeric)) return { ok: false, reason: 'invalid' };
  if (options.min !== undefined && numeric < options.min) return { ok: false, reason: 'below_min' };
  if (options.max !== undefined && numeric > options.max) return { ok: false, reason: 'above_max' };
  if (roundMoney(numeric, currency) !== numeric) return { ok: false, reason: 'precision' };
  return { ok: true, value: numeric };
}

/**
 * Canonical props for a money <Input type="number">. Spread them instead of
 * hand-writing step/min/inputMode so the precision can never drift:
 *   <Input type="number" {...moneyInputProps()} {...register('amount')} />
 */
export function moneyInputProps(options: { positive?: boolean; currency?: SupportedCurrency } = {}) {
  const currency = options.currency ?? 'OMR';
  return {
    step: getCurrencyStep(currency),
    min: options.positive ? getCurrencyStep(currency) : '0',
    inputMode: 'decimal' as const,
    dir: 'ltr' as const,
  };
}
