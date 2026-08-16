/**
 * R3 — Money Contract unit proof: OMR precision (3dp) semantics identical to
 * the server's public._r3, plus parser/validator behaviour.
 */
import { describe, expect, it } from 'vitest';
import {
  MONEY_MINOR_UNIT,
  MONEY_MIN_POSITIVE,
  MONEY_STEP,
  getCurrencyMinorUnit,
  getCurrencyStep,
  moneyInputProps,
  parseMoneyInput,
  roundMoney,
  validateMoney,
} from './money';

describe('R3 money contract (OMR = 3 decimals)', () => {
  it('pins OMR to 3 minor-unit digits and step 0.001', () => {
    expect(MONEY_MINOR_UNIT).toBe(3);
    expect(MONEY_STEP).toBe('0.001');
    expect(MONEY_MIN_POSITIVE).toBe('0.001');
    expect(getCurrencyMinorUnit('OMR')).toBe(3);
    expect(getCurrencyStep('OMR')).toBe('0.001');
    // 2dp currencies keep their own contract (the contract is per-currency,
    // not hardcoded to 3 everywhere).
    expect(getCurrencyStep('AED')).toBe('0.01');
    expect(getCurrencyMinorUnit('KWD')).toBe(3);
  });

  it('roundMoney matches server _r3 semantics (round to 3dp, half away from artifacts)', () => {
    expect(roundMoney(1.2344)).toBe(1.234);
    expect(roundMoney(1.2345)).toBe(1.235);
    expect(roundMoney(0.0004)).toBe(0);
    expect(roundMoney(0.0005)).toBe(0.001);
    expect(roundMoney(100)).toBe(100);
    // Binary float artifact: 1.0005 can be stored as 1.00049999…;
    // the EPSILON compensation keeps the business expectation.
    expect(roundMoney(1.0005)).toBe(1.001);
    expect(roundMoney(-1.2345)).toBe(-1.235);
    expect(roundMoney(Number.NaN)).toBe(0);
    expect(roundMoney(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('parseMoneyInput accepts plain and comma-grouped input at 3dp', () => {
    expect(parseMoneyInput('1,234.5678')).toBe(1234.568);
    expect(parseMoneyInput('0.001')).toBe(0.001);
    expect(parseMoneyInput('')).toBe(0);
    expect(parseMoneyInput('abc')).toBe(0);
    expect(parseMoneyInput('abc', { fallback: 5 })).toBe(5);
    expect(parseMoneyInput(-3, { min: 0 })).toBe(0);
  });

  it('validateMoney enforces bounds and the 3dp precision contract', () => {
    expect(validateMoney(10.5)).toEqual({ ok: true, value: 10.5 });
    expect(validateMoney(0.001)).toEqual({ ok: true, value: 0.001 });
    expect(validateMoney(0.0001)).toEqual({ ok: false, reason: 'precision' });
    expect(validateMoney('not money')).toEqual({ ok: false, reason: 'invalid' });
    expect(validateMoney(-1, { min: 0 })).toEqual({ ok: false, reason: 'below_min' });
    expect(validateMoney(101, { max: 100 })).toEqual({ ok: false, reason: 'above_max' });
    // 2dp currency: 3dp value violates its precision.
    expect(validateMoney(1.005, { currency: 'AED' })).toEqual({ ok: false, reason: 'precision' });
  });

  it('moneyInputProps binds the canonical form contract', () => {
    expect(moneyInputProps()).toEqual({ step: '0.001', min: '0', inputMode: 'decimal', dir: 'ltr' });
    expect(moneyInputProps({ positive: true }).min).toBe('0.001');
    expect(moneyInputProps({ currency: 'AED' }).step).toBe('0.01');
  });
});
