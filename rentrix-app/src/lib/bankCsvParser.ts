/**
 * Bank CSV parser.
 *
 * Financial import defaults are deliberately strict:
 * - a real header row is required;
 * - ambiguous mappings are rejected;
 * - a row containing both debit and credit is rejected;
 * - invalid optional balance/currency values reject the row;
 * - quoted multiline fields are parsed as one CSV record;
 * - every accepted amount is normalized to OMR 0.001 precision.
 */

export type BankCsvDelimiter = ',' | ';';
export type BankCsvEncoding = 'UTF-8' | 'UTF-8 BOM';

export type CanonicalBankField =
  | 'transaction_date'
  | 'amount'
  | 'debit'
  | 'credit'
  | 'description'
  | 'reference'
  | 'balance'
  | 'currency';

export interface BankCsvColumnMapping {
  field: CanonicalBankField;
  header: string;
  index: number;
}

export interface ParsedBankRow {
  rawIndex: number;
  raw: string[];
  transaction_date?: string;
  amount?: number;
  description?: string;
  reference?: string;
  balance?: number;
  currency?: string;
  fingerprint?: string;
}

export interface RejectedBankRow {
  rawIndex: number;
  rowNumber: number;
  raw: string[];
  reason: string;
  field?: CanonicalBankField;
}

export type BankRowStatus = 'new' | 'exact_duplicate' | 'possible_duplicate';

export interface BankCsvParseResult {
  fileName: string;
  fileSize: number;
  encoding: BankCsvEncoding;
  delimiter: BankCsvDelimiter;
  detectedDelimiterConfidence: 'high' | 'low' | 'fallback';
  totalRows: number;
  headers: string[];
  rawHeaderRow?: string[];
  hasHeader: boolean;
  columnMapping: BankCsvColumnMapping[];
  mappingAmbiguous: boolean;
  missingMandatory: CanonicalBankField[];
  validRows: ParsedBankRow[];
  rejectedRows: RejectedBankRow[];
  duplicateWithinFile: number;
  possibleDuplicateWithinFile?: number;
  previewRows: ParsedBankRow[];
  errorSummary?: string;
}

const HEADER_SYNONYMS: Record<CanonicalBankField, string[]> = {
  transaction_date: [
    'date', 'transaction_date', 'transaction date', 'value date', 'valuedate',
    'التاريخ', 'تاريخ العملية', 'تاريخ الحركة', 'تاريخ', 'تاريخ القيد', 'تاريخ المعاملة',
    'booking date', 'posting date', 'trans date',
  ],
  amount: ['amount', 'المبلغ', 'مبلغ', 'قيمة', 'القيمة', 'amount omr', 'amount (omr)', 'total', 'المجموع'],
  debit: ['debit', 'debit amount', 'debit_amount', 'مدين', 'سحب', 'مبلغ مدين', 'withdrawal', 'dr'],
  credit: ['credit', 'credit amount', 'credit_amount', 'دائن', 'إيداع', 'ايداع', 'مبلغ دائن', 'deposit', 'cr'],
  description: [
    'description', 'details', 'narration', 'transaction description', 'particulars',
    'الوصف', 'البيان', 'التفاصيل', 'وصف العملية', 'بيان الحركة', 'memo', 'remarks', 'note',
  ],
  reference: [
    'reference', 'bank reference', 'external reference', 'reference number', 'ref', 'transaction reference',
    'المرجع', 'رقم المرجع', 'رقم العملية', 'رقم القيد', 'مرجع البنك',
  ],
  balance: ['balance', 'running balance', 'balance amount', 'الرصيد', 'الرصيد الحالي', 'رصيد', 'current balance'],
  currency: ['currency', 'curr', 'العملة', 'عملة', 'ccy'],
};

interface CsvRecord {
  lineNumber: number;
  cells: string[];
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ');
}

function matchHeaderToField(header: string): CanonicalBankField | null {
  const normalized = normalizeHeader(header);
  if (!normalized) return null;

  for (const [field, synonyms] of Object.entries(HEADER_SYNONYMS) as [CanonicalBankField, string[]][]) {
    for (const synonym of synonyms) {
      const candidate = normalizeHeader(synonym);
      if (normalized === candidate) return field;
      if (normalized.length >= 3 && candidate.length >= 3 && (normalized.includes(candidate) || candidate.includes(normalized))) {
        return field;
      }
    }
  }
  return null;
}

function stripBom(text: string): { text: string; encoding: BankCsvEncoding } {
  return text.charCodeAt(0) === 0xfeff
    ? { text: text.slice(1), encoding: 'UTF-8 BOM' }
    : { text, encoding: 'UTF-8' };
}

function countDelimiterOutsideQuotes(text: string, delimiter: BankCsvDelimiter): number {
  let count = 0;
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && char === delimiter) {
      count += 1;
    }
  }
  return count;
}

function detectDelimiter(text: string): { delimiter: BankCsvDelimiter; confidence: 'high' | 'low' | 'fallback' } {
  const sample = text.split(/\r?\n/).filter((line) => line.trim()).slice(0, 8).join('\n');
  const commaCount = countDelimiterOutsideQuotes(sample, ',');
  const semicolonCount = countDelimiterOutsideQuotes(sample, ';');

  if (commaCount === 0 && semicolonCount === 0) return { delimiter: ',', confidence: 'fallback' };
  if (commaCount === 0) return { delimiter: ';', confidence: 'high' };
  if (semicolonCount === 0) return { delimiter: ',', confidence: 'high' };
  if (semicolonCount > commaCount) {
    return { delimiter: ';', confidence: semicolonCount >= commaCount * 2 ? 'high' : 'low' };
  }
  return { delimiter: ',', confidence: commaCount >= semicolonCount * 2 ? 'high' : 'low' };
}

function parseCsvRecords(text: string, delimiter: BankCsvDelimiter): { records: CsvRecord[]; error?: string } {
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let cell = '';
  let quoted = false;
  let currentLine = 1;
  let recordStartLine = 1;

  const finishRecord = () => {
    cells.push(cell.trim());
    if (cells.some((value) => value.trim() !== '')) {
      records.push({ lineNumber: recordStartLine, cells });
    }
    cells = [];
    cell = '';
    recordStartLine = currentLine + 1;
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === delimiter && !quoted) {
      cells.push(cell.trim());
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      finishRecord();
      currentLine += 1;
      continue;
    }

    if (char === '\n') currentLine += 1;
    cell += char;
  }

  if (quoted) {
    return { records, error: `علامة اقتباس غير مغلقة ابتداءً من السطر ${recordStartLine}` };
  }

  if (cell.length > 0 || cells.length > 0) finishRecord();
  return { records };
}

function normalizeDigits(value: string): string {
  const map: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  };
  return value.replace(/[٠-٩]/g, (digit) => map[digit] ?? digit);
}

function normalizeAmountString(value: string): number | null {
  if (!value?.trim()) return null;
  let normalized = normalizeDigits(value.trim())
    .replace(/OMR|ر\.?ع\.?|﷼/gi, '')
    .replace(/٫/g, '.')
    .replace(/٬/g, ',')
    .trim();

  const negativeParentheses = normalized.startsWith('(') && normalized.endsWith(')');
  if (negativeParentheses) normalized = `-${normalized.slice(1, -1)}`;
  normalized = normalized.replace(/[\s,']/g, '');

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount === 0) return null;
  return roundOmr(amount);
}

function parseDateFlexible(value: string): string | null {
  const normalized = normalizeDigits(value ?? '').trim();
  if (!normalized) return null;

  const isoPart = normalized.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoPart)) {
    const [year, month, day] = isoPart.split('-').map(Number);
    return isValidDate(year, month, day) ? formatDate(year, month, day) : null;
  }

  const match = normalized.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += 2000;
  return isValidDate(year, month, day) ? formatDate(year, month, day) : null;
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function formatDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function computeRowFingerprint(row: {
  transaction_date: string;
  amount: number;
  currency: string;
  reference: string;
  description: string;
}): string {
  const normalized = [
    row.transaction_date,
    row.amount.toFixed(3),
    row.currency.toUpperCase(),
    row.reference.toLowerCase().trim(),
    row.description.toLowerCase().trim(),
  ].join('|');

  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = ((hash << 5) - hash + normalized.charCodeAt(index)) | 0;
  }
  return `${row.transaction_date}|${row.amount.toFixed(3)}|${normalized.length}|${hash}`;
}

export function parseBankCsv(fileContent: string, fileName: string, fileSize: number): BankCsvParseResult {
  const { text, encoding } = stripBom(fileContent);
  const { delimiter, confidence } = detectDelimiter(text);
  const parsed = parseCsvRecords(text, delimiter);

  const result: BankCsvParseResult = {
    fileName,
    fileSize,
    encoding,
    delimiter,
    detectedDelimiterConfidence: confidence,
    totalRows: 0,
    headers: [],
    hasHeader: false,
    columnMapping: [],
    mappingAmbiguous: false,
    missingMandatory: [],
    validRows: [],
    rejectedRows: [],
    duplicateWithinFile: 0,
    previewRows: [],
  };

  if (parsed.error) {
    result.errorSummary = parsed.error;
    result.missingMandatory = ['transaction_date', 'amount'];
    return result;
  }
  if (parsed.records.length === 0) {
    result.errorSummary = 'الملف فارغ';
    result.missingMandatory = ['transaction_date', 'amount'];
    return result;
  }

  const headerRecord = parsed.records[0];
  const headerMatches = headerRecord.cells.map(matchHeaderToField);
  result.hasHeader = headerMatches.some(Boolean);
  result.headers = result.hasHeader ? headerRecord.cells : [];
  result.rawHeaderRow = result.hasHeader ? headerRecord.cells : undefined;

  if (!result.hasHeader) {
    result.errorSummary = 'يجب أن يحتوي الملف على صف رؤوس واضح؛ لا يُسمح بالتخمين الصامت.';
    result.missingMandatory = ['transaction_date', 'amount'];
    result.totalRows = parsed.records.length;
    parsed.records.forEach((record, index) => {
      result.rejectedRows.push({
        rawIndex: index,
        rowNumber: record.lineNumber,
        raw: record.cells,
        reason: result.errorSummary!,
      });
    });
    return result;
  }

  const normalizedHeaders = headerRecord.cells.map(normalizeHeader).filter(Boolean);
  const duplicates = normalizedHeaders.filter((header, index) => normalizedHeaders.indexOf(header) !== index);
  if (duplicates.length > 0) {
    result.errorSummary = `رؤوس مكررة: ${[...new Set(duplicates)].join(', ')}`;
    result.missingMandatory = ['transaction_date', 'amount'];
    result.rejectedRows.push({
      rawIndex: 0,
      rowNumber: headerRecord.lineNumber,
      raw: headerRecord.cells,
      reason: result.errorSummary,
    });
    return result;
  }

  const mapping = new Map<CanonicalBankField, BankCsvColumnMapping>();
  headerRecord.cells.forEach((header, index) => {
    const field = matchHeaderToField(header);
    if (!field) return;
    if (mapping.has(field)) result.mappingAmbiguous = true;
    else mapping.set(field, { field, header, index });
  });
  result.columnMapping = [...mapping.values()];

  const hasDate = mapping.has('transaction_date');
  const hasDirectAmount = mapping.has('amount');
  const hasDebitOrCredit = mapping.has('debit') || mapping.has('credit');
  if (hasDirectAmount && hasDebitOrCredit) result.mappingAmbiguous = true;
  if (!hasDate) result.missingMandatory.push('transaction_date');
  if (!hasDirectAmount && !hasDebitOrCredit) result.missingMandatory.push('amount');

  if (result.mappingAmbiguous || result.missingMandatory.length > 0) {
    result.errorSummary = result.mappingAmbiguous
      ? 'تعيين أعمدة غامض؛ لا تجمع بين amount وdebit/credit ولا تكرر نفس الحقل.'
      : `أعمدة إلزامية مفقودة: ${result.missingMandatory.join(', ')}`;
    result.totalRows = Math.max(parsed.records.length - 1, 0);
    parsed.records.slice(1).forEach((record, index) => {
      result.rejectedRows.push({
        rawIndex: index + 1,
        rowNumber: record.lineNumber,
        raw: record.cells,
        reason: result.errorSummary!,
      });
    });
    return result;
  }

  const fieldIndex = new Map<CanonicalBankField, number>();
  result.columnMapping.forEach((item) => fieldIndex.set(item.field, item.index));
  const fingerprints = new Set<string>();
  const dataRecords = parsed.records.slice(1);
  result.totalRows = dataRecords.length;

  dataRecords.forEach((record, dataIndex) => {
    const getCell = (field: CanonicalBankField): string => {
      const index = fieldIndex.get(field);
      return index === undefined ? '' : (record.cells[index] ?? '');
    };
    const reject = (reason: string, field?: CanonicalBankField) => {
      result.rejectedRows.push({
        rawIndex: dataIndex + 1,
        rowNumber: record.lineNumber,
        raw: record.cells,
        reason,
        field,
      });
    };

    const transactionDate = parseDateFlexible(getCell('transaction_date'));
    if (!transactionDate) {
      reject(`تاريخ غير صالح: "${getCell('transaction_date')}"`, 'transaction_date');
      return;
    }

    let amount: number | null = null;
    if (fieldIndex.has('amount')) {
      amount = normalizeAmountString(getCell('amount'));
    } else {
      const debit = normalizeAmountString(getCell('debit'));
      const credit = normalizeAmountString(getCell('credit'));
      const debitValue = debit === null ? 0 : Math.abs(debit);
      const creditValue = credit === null ? 0 : Math.abs(credit);
      if (debitValue > 0 && creditValue > 0) {
        reject('لا يمكن أن يحتوي الصف نفسه على مبلغ مدين ودائن معًا.', 'amount');
        return;
      }
      amount = debitValue > 0 ? -debitValue : creditValue > 0 ? creditValue : null;
    }

    if (amount === null || !Number.isFinite(amount) || amount === 0) {
      reject(`مبلغ غير صالح: "${getCell('amount') || getCell('debit') || getCell('credit')}"`, 'amount');
      return;
    }

    const description = getCell('description').trim() || 'حركة مستوردة';
    const reference = getCell('reference').trim();

    let balance: number | undefined;
    const rawBalance = getCell('balance').trim();
    if (rawBalance) {
      const parsedBalance = normalizeAmountString(rawBalance);
      if (parsedBalance === null) {
        reject(`رصيد غير صالح: "${rawBalance}"`, 'balance');
        return;
      }
      balance = parsedBalance;
    }

    const rawCurrency = getCell('currency').trim();
    const currency = rawCurrency ? rawCurrency.toUpperCase() : 'OMR';
    if (!/^[A-Z]{3}$/.test(currency)) {
      reject(`عملة غير صالحة: "${rawCurrency}"`, 'currency');
      return;
    }

    const fingerprint = computeRowFingerprint({
      transaction_date: transactionDate,
      amount,
      currency,
      reference,
      description,
    });
    if (fingerprints.has(fingerprint)) {
      result.duplicateWithinFile += 1;
      reject('مكرر داخل الملف (نفس التاريخ والمبلغ والعملة والمرجع والوصف).');
      return;
    }
    fingerprints.add(fingerprint);

    result.validRows.push({
      rawIndex: dataIndex + 1,
      raw: record.cells,
      transaction_date: transactionDate,
      amount,
      description,
      reference,
      balance,
      currency,
      fingerprint,
    });
  });

  result.previewRows = result.validRows.slice(0, 10);
  if (result.validRows.length === 0 && result.rejectedRows.length > 0) {
    result.errorSummary = 'كل الصفوف مرفوضة بسبب أخطاء التحقق.';
  }
  return result;
}

export async function computeFileFingerprint(content: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('SHA-256 غير متاح في هذا المتصفح؛ لا يمكن استيراد ملف مالي بأمان.');
  }
  const data = new TextEncoder().encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function formatBankAmount(amount: number): string {
  return roundOmr(amount).toFixed(3);
}

function roundOmr(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000) / 1_000;
}
