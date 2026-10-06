/**
 * Assistant speech-text normalization — TTS-only, display-safe.
 *
 * The assistant response text shown in the bubble is canonical and is NEVER
 * modified by this module. This layer derives a speech-friendly variant:
 *
 *  - Markdown syntax, table separators, URLs and UI-only artifacts are
 *    removed before anything reaches the speech engine.
 *  - Monetary values (OMR first — 3 decimal places / baisa) are spoken as
 *    words with the correct sub-unit, so `12.345 ر.ع` is read as
 *    "اثنا عشر ريال عماني وثلاثمائة وخمسة وأربعين بيسة" instead of
 *    "اثنا عشر نقطة ثلاثة أربعة خمسة" (which would read 12.345 as a
 *    decimal point value and lose the three-decimal OMR precision).
 *  - Percentages and ISO/dotted dates are spoken naturally.
 *
 * Plain text without any of those tokens passes through unchanged
 * (modulo whitespace normalization), so ordinary Arabic answers are spoken
 * verbatim.
 */
import { CURRENCY_WORD_CONFIGS, integerToArabicWords, type CurrencyConfig } from '@/lib/numberToArabicWords';

const ARABIC_INDIC_DIGITS: Readonly<Record<string, string>> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
] as const;

/**
 * Number literal that may carry thousand separators and up to 3 decimals.
 *
 * The comma-grouped and plain shapes are mutually exclusive via the
 * `(?!\d{1,3},)` guard, so the engine never explores both branches (and never
 * unwinds one of them) for the same digits — matching stays linear instead of
 * super-linear under backtracking.
 */
const NUM = String.raw`(-?(?:\d{1,3}(?:,\d{3})+(?:\.\d{1,3})?|(?!\d{1,3},)\d+(?:\.\d{1,3})?))`;

/** Numbers must not start mid-number (digit/dot already consumed). */
const NOT_MID_NUMBER = String.raw`(?<![\d.])`;
/** Currency markers must not run into the next word (Arabic punctuation is fine). */
const NOT_WORD_AFTER = String.raw`(?![\p{L}\p{N}])`;

const OMNIA_MONEY_BEFORE: ReadonlyArray<Readonly<{ pattern: RegExp; currency: string }>> = [
  { pattern: new RegExp(`${NOT_MID_NUMBER}${NUM}\\s*ر\\.?\\s?ع\\.?\\.?${NOT_WORD_AFTER}`, 'gu'), currency: 'OMR' },
  { pattern: new RegExp(`OMR\\s*${NOT_MID_NUMBER}${NUM}`, 'giu'), currency: 'OMR' },
  { pattern: new RegExp(`${NOT_MID_NUMBER}${NUM}\\s*ريال(?:ات|ة)?\\s*عماني(?:ة)?`, 'gu'), currency: 'OMR' },
  { pattern: new RegExp(`${NOT_MID_NUMBER}(?<![\\p{L}])ر\\.?\\s?ع\\.?\\.?\\s*${NUM}`, 'gu'), currency: 'OMR' },
];

const OTHER_MONEY_MARKERS: ReadonlyArray<Readonly<{ pattern: RegExp; currency: string }>> = [
  { pattern: new RegExp(`${NOT_MID_NUMBER}${NUM}\\s*د\\.\\s?إ${NOT_WORD_AFTER}`, 'gu'), currency: 'AED' },
  { pattern: new RegExp(`${NOT_MID_NUMBER}${NUM}\\s*ر\\.\\s?س${NOT_WORD_AFTER}`, 'gu'), currency: 'SAR' },
  { pattern: new RegExp(`${NOT_MID_NUMBER}${NUM}\\s*ر\\.\\s?ق${NOT_WORD_AFTER}`, 'gu'), currency: 'QAR' },
  { pattern: new RegExp(`${NOT_MID_NUMBER}${NUM}\\s*د\\.\\s?ك${NOT_WORD_AFTER}`, 'gu'), currency: 'KWD' },
  { pattern: new RegExp(`${NOT_MID_NUMBER}${NUM}\\s*د\\.\\s?ب${NOT_WORD_AFTER}`, 'gu'), currency: 'BHD' },
  { pattern: new RegExp(`${NOT_MID_NUMBER}${NUM}\\s*\\$${NOT_WORD_AFTER}`, 'gu'), currency: 'USD' },
];

function toLatinDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (digit) => ARABIC_INDIC_DIGITS[digit] ?? digit);
}

function parseAmount(raw: string): number {
  return Number.parseFloat(raw.replace(/,/g, ''));
}

function wordsOrDigits(value: number): string {
  const words = integerToArabicWords(value);
  return words.length > 0 ? words : String(value);
}

/**
 * Spoken form of a monetary amount at the currency's sub-unit scale.
 * 12.345 OMR → "اثنا عشر ريال عماني وثلاثمائة وخمسة وأربعين بيسة".
 */
export function amountToSpeechWords(rawAmount: string, currencyCode: string): string {
  const config: CurrencyConfig = CURRENCY_WORD_CONFIGS[currencyCode] ?? CURRENCY_WORD_CONFIGS.OMR;
  const value = parseAmount(rawAmount);
  if (!Number.isFinite(value)) return rawAmount;

  const negative = value < 0;
  const absolute = Math.abs(value);
  const mainPart = Math.floor(absolute);
  const fractionPart = Math.round((absolute - mainPart) * config.fractionScale);

  const parts: string[] = [];
  if (mainPart > 0) {
    parts.push(`${wordsOrDigits(mainPart)} ${config.mainUnitSingular}`);
  }
  if (fractionPart > 0) {
    parts.push(`${wordsOrDigits(fractionPart)} ${config.fractionUnitSingular}`);
  }
  if (parts.length === 0) parts.push(`${config.mainUnitSingular} صفر`);

  return (negative ? 'سالب ' : '') + parts.join(' و');
}

/** Spoken form of a percentage: 75.5 → "خمسة وسبعون وخمسون بالمئة". */
function percentToSpeechWords(rawPercent: string): string {
  const value = parseAmount(rawPercent);
  if (!Number.isFinite(value)) return rawPercent;

  const negative = value < 0;
  const absolute = Math.abs(value);
  const mainPart = Math.floor(absolute);
  const subPart = Math.round((absolute - mainPart) * 100);

  const text = subPart > 0 ? `${wordsOrDigits(mainPart)} و${wordsOrDigits(subPart)}` : wordsOrDigits(mainPart);
  return (negative ? 'سالب ' : '') + text + ' بالمئة';
}

/** Spoken form of a plain decimal without a unit: 3.141 → "ثلاثة ونقطة واحد وأربعة وواحد". */
function plainDecimalToSpeechWords(integerRaw: string, fractionRaw: string): string {
  const integer = Number.parseInt(integerRaw, 10);
  const digitWords = fractionRaw.split('').map((digit) => wordsOrDigits(Number(digit))).join(' و');
  return `${wordsOrDigits(integer)} ونقطة ${digitWords}`;
}

function isoDateToSpeechWords(yearRaw: string, monthRaw: string, dayRaw: string): string {
  const monthIndex = Number.parseInt(monthRaw, 10) - 1;
  const monthName = ARABIC_MONTHS[monthIndex] ?? monthRaw;
  const day = String(Number.parseInt(dayRaw, 10));
  return `${day} ${monthName} ${yearRaw}`;
}

function isSpaceOrTab(char: string): boolean {
  return char === ' ' || char === '\t';
}

/**
 * True for Markdown table separator rows (| --- | :---: |): the line consists
 * solely of spaces, tabs, colons, dashes and pipes, and contains a pipe.
 */
function isTableSeparatorRow(line: string): boolean {
  let hasPipe = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line.charAt(index);
    if (char === '|') hasPipe = true;
    else if (!isSpaceOrTab(char) && char !== ':' && char !== '-') return false;
  }
  return hasPipe;
}

/** Removes a leading bullet marker (•, ‣, ◦, -, *, +) plus its whitespace. */
function stripListBulletMarker(line: string): string {
  let index = 0;
  while (index < line.length && isSpaceOrTab(line.charAt(index))) index += 1;
  if (index >= line.length) return line;
  const marker = line.charAt(index);
  if (marker !== '•' && marker !== '‣' && marker !== '◦' && marker !== '-' && marker !== '*' && marker !== '+') return line;
  let after = index + 1;
  let whitespace = 0;
  while (after < line.length && isSpaceOrTab(line.charAt(after))) {
    after += 1;
    whitespace += 1;
  }
  // A marker alone at end-of-line also loses its newline in the original
  // pattern (`\s+`), so drop it too.
  if (whitespace === 0 && after < line.length) return line;
  return line.slice(after);
}

/** Turns "12. text" / "12) text" list prefixes into "12 text". */
function stripOrderedBulletMarker(line: string): string {
  let index = 0;
  while (index < line.length && isSpaceOrTab(line.charAt(index))) index += 1;
  let digitsEnd = index;
  while (digitsEnd < line.length && line.charAt(digitsEnd) >= '0' && line.charAt(digitsEnd) <= '9') digitsEnd += 1;
  if (digitsEnd === index || digitsEnd >= line.length) return line;
  const punct = line.charAt(digitsEnd);
  if (punct !== '.' && punct !== ')') return line;
  let after = digitsEnd + 1;
  let whitespace = 0;
  while (after < line.length && isSpaceOrTab(line.charAt(after))) {
    after += 1;
    whitespace += 1;
  }
  if (whitespace === 0 && after < line.length) return line;
  return `${line.slice(index, digitsEnd)} ${line.slice(after)}`;
}

/** True for lines that are a Markdown horizontal rule (---, ***, ___). */
function isMarkdownHorizontalRule(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 3) return false;
  const marker = trimmed.charAt(0);
  if (marker !== '-' && marker !== '*' && marker !== '_') return false;
  for (let index = 1; index < trimmed.length; index += 1) {
    if (trimmed.charAt(index) !== marker) return false;
  }
  return true;
}

function stripMarkdownSyntax(text: string): string {
  let output = text;

  // Fenced code blocks: keep the code content (read as text), drop the fences.
  output = output.replace(/```[^\n`]*\n?/g, ' ').replace(/```/g, ' ');
  // Inline code: keep the content.
  output = output.replace(/`([^`]+)`/g, '$1');
  // HTML tags.
  output = output.replace(/<[^>\n]{1,200}>/g, ' ');
  // Images → alt text, links → link text.
  output = output.replace(/!\[([^\]]*)\]\([^)\s]*\)/g, '$1');
  output = output.replace(/\[([^[\]]+)\]\([^)\s]*\)/g, '$1');
  output = output.replace(/\[([^[\]]+)\]/g, '$1');
  // Bare URLs are UI-only artifacts for speech.
  output = output.replace(/https?:\/\/[^\s)\]»،؛]+/gi, ' ');
  // Table separator rows (| --- | :---: |). Horizontal whitespace only in the
  // anchors — \s would swallow trailing newlines and glue the remaining rows.
  output = output.split('\n').map((line) => (isTableSeparatorRow(line) ? '' : line)).join('\n');
  // Remaining table rows: join cells.
  output = output.replace(/^[ \t]*\|(.+)\|[ \t]*$/gm, (_match, cells: string) =>
    cells
      .split('|')
      .map((cell) => cell.trim())
      .filter(Boolean)
      .join('، '),
  );
  // Headings (start of line, or a stray "#" marker mid-line), blockquotes,
  // horizontal rules.
  output = output.replace(/(^|\s)#{1,6}\s+/g, '$1');
  output = output.replace(/^>\s?/gm, '');
  output = output.split('\n').map((line) => (isMarkdownHorizontalRule(line) ? '' : line)).join('\n');
  // Emphasis / strikethrough markers. Single-asterisk emphasis is only
  // stripped when it is not a math multiplication (digits on both sides).
  output = output.replace(/\*\*([^*]+)\*\*/g, '$1');
  output = output.replace(/__([^_]+)__/g, '$1');
  output = output.replace(/~~([^~]+)~~/g, '$1');
  output = output.replace(/(?<![\d*])\*([^*\n]+)\*(?![\d*])/g, '$1');
  // List bullets and markers (keep ordered numbers, drop the punctuation).
  output = output.split('\n').map(stripListBulletMarker).join('\n');
  output = output.split('\n').map(stripOrderedBulletMarker).join('\n');
  // Stray table pipes and backslashes.
  output = output.replace(/\|/g, ' ');
  output = output.replace(/\\/g, '');
  return output;
}

function normalizeNumbersForSpeech(text: string): string {
  let output = text;

  // ISO dates (2026-08-01) and dotted dates (01/08/2026) before money passes.
  output = output.replace(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, (_m, y, mo, d) => isoDateToSpeechWords(y, mo, d));
  output = output.replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (_m, d, mo, y) => isoDateToSpeechWords(y, mo, d));

  // OMR first — it is MALEK's working currency and the precision-sensitive case.
  // Every OMR pattern carries exactly one capture group (the amount).
  for (const { pattern, currency } of OMNIA_MONEY_BEFORE) {
    output = output.replace(pattern, (_match, amount: string) => amountToSpeechWords(amount, currency));
  }
  // Other supported currencies.
  for (const { pattern, currency } of OTHER_MONEY_MARKERS) {
    output = output.replace(pattern, (match, amount: string) => amountToSpeechWords(amount, currency));
  }
  // Percentages (Latin % or Arabic ٪).
  output = output.replace(new RegExp(`${NOT_MID_NUMBER}${NUM}\\s*[%٪]`, 'g'), (_match, percent: string) =>
    percentToSpeechWords(percent),
  );
  // Plain decimals without a unit fall back to "word ونقطة digits".
  output = output.replace(
    new RegExp(`${NOT_MID_NUMBER}(-?\\d+)\\.(\\d{1,3})(?!\\d)`, 'g'),
    (_match, intPart: string, fracPart: string) => plainDecimalToSpeechWords(intPart, fracPart),
  );
  return output;
}

/**
 * Replaces every newline (plus surrounding spaces/tabs) with a single space
 * in one pass — the linear stand-in for the old "spaces, newlines, spaces"
 * collapse regex.
 */
function collapseLinesToSpaces(value: string): string {
  return value
    .split('\n')
    .map((segment) => {
      let start = 0;
      let end = segment.length;
      while (start < end && (segment.charAt(start) === ' ' || segment.charAt(start) === '\t')) start += 1;
      while (end > start && (segment.charAt(end - 1) === ' ' || segment.charAt(end - 1) === '\t')) end -= 1;
      return segment.slice(start, end);
    })
    .filter((segment) => segment.length > 0)
    .join(' ');
}

/**
 * Builds the speech variant of an assistant response.
 * The returned string is only ever handed to the speech engine.
 */
export function buildAssistantSpeechText(raw: string): string {
  if (!raw) return '';
  const latin = toLatinDigits(raw);
  const plain = stripMarkdownSyntax(latin);
  const spoken = normalizeNumbersForSpeech(plain);
  const cleaned = collapseLinesToSpaces(spoken)
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return cleaned;
}
