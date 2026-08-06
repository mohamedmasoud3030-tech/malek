/**
 * Currency precision tests.
 *
 * Locks the ISO-4217 minor-unit contract: three-decimal currencies render
 * 3 digits, common currencies 2, zero-decimal currencies 0 — always derived
 * from the REAL company_settings currency code, never hard-coded to OMR.
 */
import { describe, expect, it } from 'vitest';
import { currencyFractionDigits } from './currencyPrecision';
import { documentEngine } from './DocumentEngine';
import type { DocumentCompanySettings } from './companyIdentity';

describe('currencyFractionDigits — ISO 4217 minor units', () => {
  it('uses 3 decimals for three-decimal currencies (OMR/KWD/BHD/…)', () => {
    for (const code of ['OMR', 'KWD', 'BHD', 'TND', 'JOD', 'IQD', 'LYD']) {
      expect(currencyFractionDigits(code), code).toBe(3);
    }
  });

  it('uses 2 decimals for common currencies (USD/EUR/EGP/SAR/AED/GBP)', () => {
    for (const code of ['USD', 'EUR', 'EGP', 'SAR', 'AED', 'GBP', 'CHF', 'INR']) {
      expect(currencyFractionDigits(code), code).toBe(2);
    }
  });

  it('uses 0 decimals for zero-decimal currencies (JPY/KRW/XAF/CLP/…)', () => {
    for (const code of ['JPY', 'KRW', 'XAF', 'XOF', 'CLP', 'VND', 'ISK']) {
      expect(currencyFractionDigits(code), code).toBe(0);
    }
  });

  it('normalizes case/whitespace and falls back to 2 for unknown or blank codes', () => {
    expect(currencyFractionDigits(' omr ')).toBe(3);
    expect(currencyFractionDigits('usd')).toBe(2);
    expect(currencyFractionDigits('XXX')).toBe(2);
    expect(currencyFractionDigits('')).toBe(2);
    expect(currencyFractionDigits(null)).toBe(2);
    expect(currencyFractionDigits(undefined)).toBe(2);
  });
});

describe('engine money rendering follows the real currency', () => {
  const settingsFor = (currency: string, symbol: string): DocumentCompanySettings => ({
    companyName: 'شركة الأفق لإدارة الأملاك',
    currency,
    currencySymbol: symbol,
    documentPrefixes: {},
  });

  const renderedAmount = (settings: DocumentCompanySettings, amount: number): string => {
    const model = documentEngine.buildDocument('expense_voucher', {
      settings,
      payload: { amount, description: 'مصروف تشغيلي', date: '2026-07-01', kind: 'expense' },
    });
    const amountRow = model.tables[0].rows.find((row) => row[0] === 'المبلغ المصروف');
    return amountRow?.[1] ?? '';
  };

  it('formats OMR with three decimals (existing OMR contract preserved)', () => {
    expect(renderedAmount(settingsFor('OMR', 'ر.ع'), 12.5)).toBe('12.500 ر.ع');
  });

  it('formats USD with two decimals — never silently three', () => {
    expect(renderedAmount(settingsFor('USD', '$'), 12.5)).toBe('12.50 $');
    expect(renderedAmount(settingsFor('USD', '$'), 12.567)).toBe('12.57 $');
  });

  it('formats EGP with two decimals', () => {
    expect(renderedAmount(settingsFor('EGP', 'ج.م'), 1250)).toBe('1,250.00 ج.م');
  });

  it('formats JPY with zero decimals', () => {
    expect(renderedAmount(settingsFor('JPY', '¥'), 1250.4)).toBe('1,250 ¥');
  });

  it('renders a non-finite optional figure as zero with the currency precision', () => {
    // Required amounts are rejected up-front by payload validation; the
    // money() guard still protects optional pass-through figures (e.g. VAT).
    const vatRowOf = (settings: DocumentCompanySettings, vat: number) => {
      const model = documentEngine.buildDocument('invoice', {
        settings,
        payload: { amount: 10, vatAmount: vat, totalAmount: 10, description: 'مطالبة' },
      });
      return model.tables[0].rows.find((row) => row[0] === 'ضريبة القيمة المضافة')?.[1];
    };
    expect(vatRowOf(settingsFor('OMR', 'ر.ع'), Number.NaN)).toBe('0.000 ر.ع');
    expect(vatRowOf(settingsFor('USD', '$'), Number.POSITIVE_INFINITY)).toBe('0.00 $');
  });
});
