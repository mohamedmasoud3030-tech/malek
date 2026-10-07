import { expect, it } from 'vitest';
import { normalizeMoneyInput } from './moneyNormalization';

it('normalizes money input values', () => {
  expect(normalizeMoneyInput('125.50')).toBe(125.5);
  expect(normalizeMoneyInput('1,250.50')).toBe(1250.5);
  expect(normalizeMoneyInput(undefined)).toBe(0);
});

it('keeps fallback values finite', () => {
  expect(normalizeMoneyInput('not-money', { fallback: Number.NaN })).toBe(0);
  expect(normalizeMoneyInput('not-money', { fallback: Number.POSITIVE_INFINITY })).toBe(0);
});

it('rejects malformed grouped money input', () => {
  expect(normalizeMoneyInput('12,34', { fallback: 9 })).toBe(9);
  expect(normalizeMoneyInput('1,2,3', { fallback: 9 })).toBe(9);
});
