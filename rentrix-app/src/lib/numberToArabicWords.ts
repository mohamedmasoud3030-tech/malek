/**
 * Utility for converting numeric monetary amounts into formal Arabic text (تفقيط المبالغ المالية).
 * Tailored for Omani Rial (OMR) with baisa support, or generic currency fallback.
 */

const ones = [
  '',
  'واحد',
  'اثنان',
  'ثلاثة',
  'أربعة',
  'خمسة',
  'ستة',
  'سبعة',
  'ثمانية',
  'تسعة',
  'عشرة',
  'أحد عشر',
  'اثنا عشر',
  'ثلاثة عشر',
  'أربعة عشر',
  'خمسة عشر',
  'ستة عشر',
  'سبعة عشر',
  'ثمانية عشر',
  'تسعة عشر',
];

const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];

const hundreds = [
  '',
  'مائة',
  'مائتان',
  'ثلاثمائة',
  'أربعمائة',
  'خمسمائة',
  'ستمائة',
  'سبعمائة',
  'ثمانمائة',
  'تسعمائة',
];

function convertThreeDigits(n: number): string {
  if (n === 0) return '';
  const h = Math.floor(n / 100);
  const remainder = n % 100;
  let result = hundreds[h] || '';

  if (remainder > 0) {
    if (result) result += ' و';
    if (remainder < 20) {
      result += ones[remainder];
    } else {
      const unit = remainder % 10;
      const ten = Math.floor(remainder / 10);
      if (unit > 0) {
        result += `${ones[unit]} و${tens[ten]}`;
      } else {
        result += tens[ten];
      }
    }
  }
  return result;
}

function convertIntegerPart(n: number): string {
  if (n === 0) return 'صفر';

  const thousands = Math.floor((n % 1000000) / 1000);
  const remainder = n % 1000;

  let parts: string[] = [];

  if (thousands > 0) {
    if (thousands === 1) {
      parts.push('ألف');
    } else if (thousands === 2) {
      parts.push('ألفان');
    } else if (thousands >= 3 && thousands <= 10) {
      parts.push(`${convertThreeDigits(thousands)} آلاف`);
    } else {
      parts.push(`${convertThreeDigits(thousands)} ألفاً`);
    }
  }

  if (remainder > 0) {
    parts.push(convertThreeDigits(remainder));
  }

  return parts.join(' و');
}

export type CurrencyConfig = {
  mainUnitSingular: string; // e.g. "ريال عماني"
  mainUnitPlural: string;   // e.g. "ريالات عمانية"
  fractionUnitSingular: string; // e.g. "بيسة"
  fractionUnitPlural: string;   // e.g. "بيسات"
  fractionScale: number; // 1000 for OMR (3 decimal digits), 100 for USD/SAR (2 decimal digits)
};

export const OMR_CURRENCY_CONFIG: CurrencyConfig = {
  mainUnitSingular: 'ريال عماني',
  mainUnitPlural: 'ريال عماني',
  fractionUnitSingular: 'بيسة',
  fractionUnitPlural: 'بيسة',
  fractionScale: 1000,
};

/**
 * Arabic tafqeet configs for every currency the company settings screen
 * supports (`SupportedCurrency` in `lib/formatters.ts`). Callers must look
 * up the company's actual `defaultCurrency` and pass the matching config —
 * documents must never hardcode `OMR_CURRENCY_CONFIG` for a company whose
 * currency may be different.
 */
export const CURRENCY_WORD_CONFIGS: Record<string, CurrencyConfig> = {
  OMR: OMR_CURRENCY_CONFIG,
  AED: { mainUnitSingular: 'درهم إماراتي', mainUnitPlural: 'درهم إماراتي', fractionUnitSingular: 'فلس', fractionUnitPlural: 'فلساً', fractionScale: 100 },
  SAR: { mainUnitSingular: 'ريال سعودي', mainUnitPlural: 'ريال سعودي', fractionUnitSingular: 'هللة', fractionUnitPlural: 'هللة', fractionScale: 100 },
  QAR: { mainUnitSingular: 'ريال قطري', mainUnitPlural: 'ريال قطري', fractionUnitSingular: 'درهم', fractionUnitPlural: 'درهماً', fractionScale: 100 },
  KWD: { mainUnitSingular: 'دينار كويتي', mainUnitPlural: 'دينار كويتي', fractionUnitSingular: 'فلس', fractionUnitPlural: 'فلساً', fractionScale: 1000 },
  BHD: { mainUnitSingular: 'دينار بحريني', mainUnitPlural: 'دينار بحريني', fractionUnitSingular: 'فلس', fractionUnitPlural: 'فلساً', fractionScale: 1000 },
  USD: { mainUnitSingular: 'دولار أمريكي', mainUnitPlural: 'دولار أمريكي', fractionUnitSingular: 'سنت', fractionUnitPlural: 'سنتاً', fractionScale: 100 },
  EGP: { mainUnitSingular: 'جنيه مصري', mainUnitPlural: 'جنيه مصري', fractionUnitSingular: 'قرش', fractionUnitPlural: 'قرشاً', fractionScale: 100 },
};

/** Arabic currency symbols/abbreviations used in table cells and totals. */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  OMR: 'ر.ع',
  AED: 'د.إ',
  SAR: 'ر.س',
  QAR: 'ر.ق',
  KWD: 'د.ك',
  BHD: 'د.ب',
  USD: '$',
  EGP: 'ج.م',
};

export function getCurrencyWordConfig(currencyCode: string | null | undefined): CurrencyConfig {
  if (currencyCode && CURRENCY_WORD_CONFIGS[currencyCode]) return CURRENCY_WORD_CONFIGS[currencyCode];
  return OMR_CURRENCY_CONFIG;
}

export function getCurrencySymbol(currencyCode: string | null | undefined): string {
  if (currencyCode && CURRENCY_SYMBOLS[currencyCode]) return CURRENCY_SYMBOLS[currencyCode];
  return currencyCode || CURRENCY_SYMBOLS.OMR;
}

/**
 * Formats a monetary amount into formal Arabic words (Tafqeet).
 * Example: 250.500 -> "فقط مائتان وخمسون ريال عماني وخمسعمائة بيسة لا غير"
 */
export function numberToArabicWords(
  amount: number,
  config: CurrencyConfig = OMR_CURRENCY_CONFIG,
): string {
  if (!Number.isFinite(amount) || amount < 0) {
    return 'مبلغ غير صالح';
  }

  const mainPart = Math.floor(amount);
  const fractionalPart = Math.round((amount - mainPart) * config.fractionScale);

  const mainText = convertIntegerPart(mainPart);
  const mainUnit = mainPart === 1 ? config.mainUnitSingular : mainPart >= 3 && mainPart <= 10 ? config.mainUnitPlural : config.mainUnitSingular;

  let result = `فقط ${mainText} ${mainUnit}`;

  if (fractionalPart > 0) {
    const fractionText = convertIntegerPart(fractionalPart);
    const fractionUnit =
      fractionalPart === 1
        ? config.fractionUnitSingular
        : fractionalPart >= 3 && fractionalPart <= 10
        ? config.fractionUnitPlural
        : config.fractionUnitSingular;

    result += ` و${fractionText} ${fractionUnit}`;
  }

  result += ' لا غير';
  return result;
}
