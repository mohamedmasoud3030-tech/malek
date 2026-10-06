import { describe, expect, it } from 'vitest';
import { numberToArabicWords, OMR_CURRENCY_CONFIG } from './numberToArabicWords';

describe('numberToArabicWords (Tafqeet)', () => {
  it('converts integer OMR amounts accurately', () => {
    expect(numberToArabicWords(250, OMR_CURRENCY_CONFIG)).toBe('فقط مائتان وخمسون ريال عماني لا غير');
    expect(numberToArabicWords(1, OMR_CURRENCY_CONFIG)).toBe('فقط واحد ريال عماني لا غير');
    expect(numberToArabicWords(1000, OMR_CURRENCY_CONFIG)).toBe('فقط ألف ريال عماني لا غير');
    expect(numberToArabicWords(1500, OMR_CURRENCY_CONFIG)).toBe('فقط ألف وخمسمائة ريال عماني لا غير');
  });

  it('converts amounts with baisa (fractional decimals)', () => {
    expect(numberToArabicWords(250.5, OMR_CURRENCY_CONFIG)).toBe('فقط مائتان وخمسون ريال عماني وخمسمائة بيسة لا غير');
    expect(numberToArabicWords(12.05, OMR_CURRENCY_CONFIG)).toBe('فقط اثنا عشر ريال عماني وخمسون بيسة لا غير');
  });

  it('handles zero gracefully', () => {
    expect(numberToArabicWords(0, OMR_CURRENCY_CONFIG)).toBe('فقط صفر ريال عماني لا غير');
  });
});
