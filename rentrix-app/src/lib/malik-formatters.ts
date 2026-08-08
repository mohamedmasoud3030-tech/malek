/*
 * ============================================
 * MALIK PRO - Currency Formatter
 * Unified currency formatting for Omani Rial (ر.ع)
 * ============================================
 */

const CURRENCY_SYMBOL = 'ر.ع';
const CURRENCY_CODE = 'OMR';
const CURRENCY_LOCALE = 'ar-OM';

/**
 * Format a number as Omani Rial currency
 * @param amount - The amount to format
 * @param options - Formatting options
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: number | string,
  options: {
    showSymbol?: boolean;
    decimals?: number;
    locale?: string;
  } = {}
): string {
  const {
    showSymbol = true,
    decimals = 3,
    locale = CURRENCY_LOCALE,
  } = options;

  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numericAmount)) {
    return showSymbol ? `${CURRENCY_SYMBOL} 0.000` : '0.000';
  }

  const formatted = numericAmount.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return showSymbol ? `${CURRENCY_SYMBOL} ${formatted}` : formatted;
}

/**
 * Format currency with compact notation for large amounts
 */
export function formatCurrencyCompact(
  amount: number,
  options: {
    showSymbol?: boolean;
  } = {}
): string {
  const { showSymbol = true } = options;

  if (amount >= 1_000_000) {
    const millions = (amount / 1_000_000).toFixed(2);
    return showSymbol ? `${CURRENCY_SYMBOL} ${millions} مليون` : `${millions} مليون`;
  }

  if (amount >= 1_000) {
    const thousands = (amount / 1_000).toFixed(2);
    return showSymbol ? `${CURRENCY_SYMBOL} ${thousands} ألف` : `${thousands} ألف`;
  }

  return formatCurrency(amount, options);
}

/**
 * Parse a currency string to number
 */
export function parseCurrency(value: string): number {
  // Remove currency symbol and whitespace
  const cleaned = value
    .replace(CURRENCY_SYMBOL, '')
    .replace(CURRENCY_CODE, '')
    .replace(/[^\d.-]/g, '');
  
  return parseFloat(cleaned) || 0;
}

/**
 * Format a number with Arabic-Indic numerals
 */
export function formatArabicNumber(num: number): string {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return num
    .toString()
    .split('')
    .map((digit) => {
      if (/\d/.test(digit)) {
        return arabicNumerals[parseInt(digit, 10)];
      }
      return digit;
    })
    .join('');
}

/**
 * Format a date in Arabic locale
 */
export function formatArabicDate(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(CURRENCY_LOCALE, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  });
}

/**
 * Format a date for input[type="date"]
 */
export function formatDateForInput(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

/**
 * Format relative time (e.g., "منذ ساعتين", "خلال 3 أيام")
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return diffMinutes <= 1 ? 'الآن' : `منذ ${diffMinutes} دقيقة`;
    }
    return diffHours === 1 ? 'منذ ساعة' : `منذ ${diffHours} ساعات`;
  }

  if (diffDays === 1) return 'أمس';
  if (diffDays < 7) return `منذ ${diffDays} أيام`;
  if (diffDays < 30) return `منذ ${Math.floor(diffDays / 7)} أسابيع`;
  if (diffDays < 365) return `منذ ${Math.floor(diffDays / 30)} شهراً`;
  return `منذ ${Math.floor(diffDays / 365)} سنوات`;
}

/**
 * Format phone number for Oman
 */
export function formatOmaniPhone(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // If starts with 00968 or +968
  if (digits.startsWith('968')) {
    const number = digits.slice(3);
    if (number.length === 8) {
      return `+968 ${number.slice(0, 4)} ${number.slice(4)}`;
    }
  }
  
  // If just 8 digits (local format)
  if (digits.length === 8) {
    return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  }
  
  return phone;
}

/**
 * Generate a unique ID with prefix
 */
export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix.toUpperCase()}-${timestamp}-${random}`.toUpperCase();
}

/**
 * Generate contract number
 */
export function generateContractNumber(year: number, sequence: number): string {
  return `CNT-${year}-${sequence.toString().padStart(4, '0')}`;
}

/**
 * Generate invoice number
 */
export function generateInvoiceNumber(year: number, sequence: number): string {
  return `INV-${year}-${sequence.toString().padStart(4, '0')}`;
}

/**
 * Generate receipt number
 */
export function generateReceiptNumber(year: number, sequence: number): string {
  return `RCP-${year}-${sequence.toString().padStart(4, '0')}`;
}

/**
 * Generate maintenance request number
 */
export function generateMaintenanceNumber(year: number, sequence: number): string {
  return `MNT-${year}-${sequence.toString().padStart(4, '0')}`;
}

// Re-export currency constant for use throughout the app
export const CURRENCY = {
  SYMBOL: CURRENCY_SYMBOL,
  CODE: CURRENCY_CODE,
  LOCALE: CURRENCY_LOCALE,
} as const;
