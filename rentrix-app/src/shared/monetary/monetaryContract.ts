/**
 * R3 — Canonical Shared Monetary Contract (OMR 3dp).
 *
 * Single source of monetary precision truth. All domains import from here.
 * OMR = Omani Rial, 3 decimal places (1 OMR = 1000 baisa).
 *
 * Rules (non-negotiable):
 *   - Money inputs use MONEY_STEP (0.001), never a hardcoded 2dp step.
 *   - roundMoney() / roundOmr3() = half-up-away-from-artifact, EPSILON-adjusted,
 *     identical to server-side public._r3 = round(numeric, 3).
 *   - parseMoneyInput() → roundMoney(normalizeMoneyInput(value), currency).
 *   - 2dp rounding helpers (fixed-2 formatting, cent-based) are FORBIDDEN for money.
 *   - Percentages, areas, file sizes are NOT money and keep their own precision.
 *   - Display formatting flows through formatters.ts currency metadata (minorUnit per currency).
 *   - This module is the INPUT/derivation side; formatters.ts is the presentation side.
 */
import { OMR_PRECISION, roundOmr3 } from '@/features/accounting/accountingDomain';

/** Minor-unit digits for a currency (OMR = 3). */
export const MONEY_MINOR_UNIT = 3;

/** Smallest representable monetary step for a currency ("0.001" for OMR). */
export const MONEY_STEP = '0.001';

/** Smallest positive amount (min for strictly-positive money inputs). */
export const MONEY_MIN_POSITIVE = MONEY_STEP;

/**
 * Round to the currency minor unit with the same half-up-away-from-artifact
 * semantics as the server (public._r3 = round(numeric, 3)). EPSILON absorbs
 * binary float artifacts (e.g. 1.0005 stored as 1.00049999…).
 */
export function roundMoney(value: number, currency: 'OMR' = 'OMR'): number {
  return roundOmr3(value);
}

/**
 * Parse free-form user money input (plain or comma-grouped) into a number at
 * the currency's precision. Invalid input resolves to the fallback (0).
 */
export function parseMoneyInput(
  value: unknown,
  options: { currency?: 'OMR' } = {},
): number {
  const { currency = 'OMR' } = options;
  return roundMoney(typeof value === 'number' && Number.isFinite(value) ? value : 0, currency);
}

/**
 * Validate a money amount against the OMR 3dp contract:
 * finite, and at most 3 decimal precision.
 */
export function validateMoney(
  value: unknown,
  options: { min?: number; max?: number } = {},
): { ok: true; value: number } | { ok: false; reason: 'invalid' | 'precision' } {
  const numeric = typeof value === 'number' ? value : Number(String(value ?? '').replaceAll(',', ''));
  if (!Number.isFinite(numeric)) return { ok: false, reason: 'invalid' };
  if (roundOmr3(numeric) !== numeric) return { ok: false, reason: 'precision' };
  return { ok: true, value: numeric };
}

/** Canonical props for a money <Input type="number">. */
export function moneyInputProps(options: { positive?: boolean } = {}) {
  const step = MONEY_STEP;
  return {
    step,
    min: options.positive ? MONEY_STEP : '0',
    inputMode: 'decimal' as const,
    dir: 'ltr' as const,
  };
}

/** Normalize any value to OMR 3dp using canonical rounding. */
export function normalizeOm3(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return roundMoney(n); // EPSILON-adjusted half-up, matches server public._r3
}

/** Result of validateMoney check. */
export type MoneyValidationResult =
  | { ok: true; value: number }
  | { ok: false; reason: 'invalid' | 'precision' };