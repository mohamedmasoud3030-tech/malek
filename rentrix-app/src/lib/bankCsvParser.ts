/**
 * Bank CSV Parser — S02 fail-closed preview parser.
 *
 * The browser preview mirrors the server contract but never authorizes writes:
 * ambiguous/missing mappings and invalid rows are surfaced before any import call.
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

const MANDATORY_FIELDS: CanonicalBankField[] = ['transaction_date', 'amount'];

const HEADER_SYNONYMS: Record<CanonicalBankField, string[]> = {
  transaction_date: [
    'date', 'transaction_date', 'transaction date', 'value date', 'valuedate',
    'التاريخ', 'تاريخ العملية', 'تاريخ الحركة', 'تاريخ', 'تاريخ القيد', 'تاريخ المعاملة',
    'booking date', 'posting date', 'trans date',
  ],
  amount: [
    'amount', 'المبلغ', 'مبلغ', 'قيمة', 'القيمة',
    'amount omr', 'amount (omr)', 'total', 'المجموع',
  ],
  debit: [
    'debit', 'debit amount', 'debit_amount', 'مدين', 'سحب', 'مبلغ مدين', 'withdrawal', 'dr',
  ],
  credit: [
    'credit', 'credit amount', 'credit_amount', 'دائن', 'إيداع', 'ايداع', 'مبلغ دائن', 'deposit', 'cr',
  ],
  description: [
    'description', 'details', 'narration', 'transaction description', 'particulars',
    'الوصف', 'البيان', 'التفاصيل', 'وصف العملية', 'بيان الحركة', 'memo', 'remarks', 'note',
  ],
  reference: [
    'reference', 'bank reference', 'external reference', 'reference number', 'ref', 'transaction reference',
    'المرجع', 'رقم المرجع', 'رقم العملية', 'رقم القيد', 'مرجع البنك',
  ],
  balance: [
    'balance', 'running balance', 'balance amount',
    'الرصيد', 'الرصيد الحالي', 'رصيد', 'current balance',
  ],
  currency: [
    'currency', 'curr', 'العملة', 'عملة', 'ccy',
  ],
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ');
}

function matchHeaderToField(header: string): CanonicalBankField | null {
  const norm = normalizeHeader(header);
  if (!norm) return null;
  for (const [field, synonyms] of Object.entries(HEADER_SYNONYMS) as [CanonicalBankField, string[]][]) {
    if (synonyms.some((syn) => norm === normalizeHeader(syn))) return field;
  }
  return null;
}

function parseCsvLine(line: string, delimiter: BankCsvDelimiter): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function stripBom(text: string): { text: string; encoding: BankCsvEncoding } {
  return text.charCodeAt(0) === 0xfeff
    ? { text: text.slice(1), encoding: 'UTF-8 BOM' }
    : { text, encoding: 'UTF-8' };
}

function countDelimiterOutsideQuotes(line: string, delimiter: BankCsvDelimiter): number {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (line[i + 1] === '"') { i++; continue; }
      inQuotes = !inQuotes;
    } else if (!inQuotes && c === delimiter) {
      count++;
    }
  }
  return count;
}

function detectDelimiter(sampleLines: string[]): { delimiter: BankCsvDelimiter; confidence: 'high' | 'low' | 'fallback' } {
  const commaCount = sampleLines.slice(0, 5).reduce((sum, line) => sum + countDelimiterOutsideQuotes(line, ','), 0);
  const semicolonCount = sampleLines.slice(0, 5).reduce((sum, line) => sum + countDelimiterOutsideQuotes(line, ';'), 0);
  if (semicolonCount > 0 && commaCount === 0) return { delimiter: ';', confidence: 'high' };
  if (commaCount > 0 && semicolonCount === 0) return { delimiter: ',', confidence: 'high' };
  if (semicolonCount > commaCount) return { delimiter: ';', confidence: semicolonCount >= commaCount * 2 ? 'high' : 'low' };
  if (commaCount > semicolonCount) return { delimiter: ',', confidence: commaCount >= semicolonCount * 2 ? 'high' : 'low' };
  return { delimiter: ',', confidence: 'fallback' };
}

function normalizeDigits(value: string): string {
  const arabicIndicMap: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  };
  return value.replace(/[٠-٩]/g, (d) => arabicIndicMap[d] ?? d);
}

function normalizeAmountString(value: string): number | null {
  if (!value) return null;
  let v = normalizeDigits(value).trim();
  if (!v) return null;

  v = v.replace(/OMR|ر\.?ع\.?|﷼/gi, '').trim();
  const isParenNegative = v.startsWith('(') && v.endsWith(')');
  if (isParenNegative) v = '-' + v.slice(1, -1);
  v = v.replace(/[\s,']/g, '');

  if (!/^-?\d+(?:\.\d{1,3})?$/.test(v)) return null;
  const num = Number(v);
  if (!Number.isFinite(num) || num === 0) return null;
  return num;
}

function parseDateFlexible(value: string): string | null {
  if (!value) return null;
  const v = normalizeDigits(value).trim();
  if (!v) return null;

  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (iso) {
    const [, yRaw, mRaw, dRaw] = iso;
    const y = Number(yRaw), m = Number(mRaw), d = Number(dRaw);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
      ? `${yRaw}-${mRaw}-${dRaw}`
      : null;
  }

  const sepMatch = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (sepMatch) {
    const day = Number(sepMatch[1]);
    const month = Number(sepMatch[2]);
    const year = Number(sepMatch[3]);
    const dt = new Date(Date.UTC(year, month - 1, day));
    if (dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day) {
      return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
  }

  return null;
}

function stableHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) hash = (hash * 33) ^ input.charCodeAt(i);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function computeRowFingerprint(row: { transaction_date: string; amount: number; currency: string; reference: string; description: string }): string {
  const normalized = [
    row.transaction_date,
    row.amount.toFixed(3),
    row.currency.toUpperCase(),
    row.reference.toLowerCase().trim(),
    row.description.toLowerCase().trim(),
  ].join('|');
  return `bank-row-v1:${stableHash(normalized)}:${normalized.length}`;
}

function markAllDataRowsRejected(
  result: BankCsvParseResult,
  parsedLines: { lineNumber: number; cells: string[] }[],
  dataStartIndex: number,
  reason: string,
): BankCsvParseResult {
  for (let i = dataStartIndex; i < parsedLines.length; i++) {
    result.rejectedRows.push({ rawIndex: i, rowNumber: parsedLines[i].lineNumber, raw: parsedLines[i].cells, reason });
  }
  result.totalRows = Math.max(0, parsedLines.length - dataStartIndex);
  result.validRows = [];
  result.previewRows = [];
  return result;
}

export function parseBankCsv(fileContent: string, fileName: string, fileSize: number): BankCsvParseResult {
  const { text: withoutBom, encoding } = stripBom(fileContent);
  const rawLines = withoutBom.split(/\r?\n/);
  const nonEmptyForDelim = rawLines.filter((l) => l.trim().length > 0).slice(0, 10);
  const { delimiter, confidence } = detectDelimiter(nonEmptyForDelim);

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

  if (nonEmptyForDelim.length === 0) {
    result.errorSummary = 'الملف فارغ';
    result.missingMandatory = MANDATORY_FIELDS;
    return result;
  }

  const parsedLines = rawLines
    .map((raw, idx) => ({ lineNumber: idx + 1, cells: parseCsvLine(raw, delimiter), raw }))
    .filter((line) => line.raw.trim() !== '');

  const firstRowCells = parsedLines[0].cells;
  const headerMatches = firstRowCells.map((cell) => matchHeaderToField(cell));
  const hasHeader = headerMatches.some(Boolean);
  if (!hasHeader) {
    result.errorSummary = 'لم يتم العثور على صف رؤوس؛ التعيين الاستنتاجي ممنوع في الاستيراد الآمن';
    result.missingMandatory = MANDATORY_FIELDS;
    return markAllDataRowsRejected(result, parsedLines, 0, result.errorSummary);
  }

  result.hasHeader = true;
  result.headers = firstRowCells;
  result.rawHeaderRow = firstRowCells;

  const normalizedHeaders = firstRowCells.map((h) => normalizeHeader(h)).filter(Boolean);
  const repeatedRawHeaders = normalizedHeaders.filter((header, index) => normalizedHeaders.indexOf(header) !== index);
  if (repeatedRawHeaders.length > 0) {
    result.errorSummary = `رؤوس مكررة: ${Array.from(new Set(repeatedRawHeaders)).join(', ')}`;
    result.missingMandatory = MANDATORY_FIELDS;
    return markAllDataRowsRejected(result, parsedLines, 1, result.errorSummary);
  }

  const mappingMap = new Map<CanonicalBankField, BankCsvColumnMapping>();
  const ambiguousFields = new Set<CanonicalBankField>();
  firstRowCells.forEach((header, index) => {
    const field = matchHeaderToField(header);
    if (!field) return;
    if (mappingMap.has(field)) ambiguousFields.add(field);
    else mappingMap.set(field, { field, header, index });
  });

  result.columnMapping = Array.from(mappingMap.values());
  result.mappingAmbiguous = ambiguousFields.size > 0;

  const missing: CanonicalBankField[] = [];
  if (!mappingMap.has('transaction_date')) missing.push('transaction_date');
  if (!mappingMap.has('amount') && !(mappingMap.has('debit') || mappingMap.has('credit'))) missing.push('amount');
  result.missingMandatory = missing;

  if (result.mappingAmbiguous) {
    result.errorSummary = `تعيين أعمدة غامض: ${Array.from(ambiguousFields).join(', ')}`;
    return markAllDataRowsRejected(result, parsedLines, 1, result.errorSummary);
  }
  if (missing.length > 0) {
    result.errorSummary = `أعمدة إلزامية مفقودة: ${missing.join(', ')}`;
    return markAllDataRowsRejected(result, parsedLines, 1, result.errorSummary);
  }

  const mappingByField = new Map<CanonicalBankField, number>();
  for (const m of result.columnMapping) mappingByField.set(m.field, m.index);

  const fingerprintSeen = new Map<string, number>();
  for (let i = 1; i < parsedLines.length; i++) {
    const pl = parsedLines[i];
    result.totalRows++;
    const cells = pl.cells;
    const getCell = (field: CanonicalBankField): string | undefined => {
      const idx = mappingByField.get(field);
      return idx === undefined ? undefined : cells[idx];
    };

    const dateRaw = getCell('transaction_date') ?? '';
    const parsedDate = parseDateFlexible(dateRaw);
    if (!parsedDate) {
      result.rejectedRows.push({ rawIndex: i, rowNumber: pl.lineNumber, raw: cells, reason: `تاريخ غير صالح: "${dateRaw}"`, field: 'transaction_date' });
      continue;
    }

    const amountRaw = getCell('amount');
    const debitRaw = getCell('debit');
    const creditRaw = getCell('credit');
    const debitVal = debitRaw !== undefined && debitRaw.trim() !== '' ? normalizeAmountString(debitRaw) : null;
    const creditVal = creditRaw !== undefined && creditRaw.trim() !== '' ? normalizeAmountString(creditRaw) : null;

    if ((debitRaw?.trim() && debitVal === null) || (creditRaw?.trim() && creditVal === null)) {
      result.rejectedRows.push({ rawIndex: i, rowNumber: pl.lineNumber, raw: cells, reason: `مبلغ مدين/دائن غير صالح`, field: 'amount' });
      continue;
    }
    if (debitVal !== null && creditVal !== null) {
      result.rejectedRows.push({ rawIndex: i, rowNumber: pl.lineNumber, raw: cells, reason: 'لا يجوز وجود قيمتي مدين ودائن معًا في نفس الصف', field: 'amount' });
      continue;
    }

    let amount: number | null = null;
    if (amountRaw !== undefined && amountRaw.trim() !== '') {
      amount = normalizeAmountString(amountRaw);
      if (amount === null) {
        result.rejectedRows.push({ rawIndex: i, rowNumber: pl.lineNumber, raw: cells, reason: `مبلغ غير صالح: "${amountRaw}"`, field: 'amount' });
        continue;
      }
      if ((debitVal !== null || creditVal !== null) && Math.sign(amount) !== Math.sign(creditVal ?? -Math.abs(debitVal ?? 0))) {
        result.rejectedRows.push({ rawIndex: i, rowNumber: pl.lineNumber, raw: cells, reason: 'تعارض بين عمود المبلغ وأعمدة مدين/دائن', field: 'amount' });
        continue;
      }
    } else if (debitVal !== null) {
      amount = -Math.abs(debitVal);
    } else if (creditVal !== null) {
      amount = Math.abs(creditVal);
    }

    if (amount === null || amount === 0 || !Number.isFinite(amount)) {
      result.rejectedRows.push({ rawIndex: i, rowNumber: pl.lineNumber, raw: cells, reason: `مبلغ غير صالح: "${amountRaw ?? debitRaw ?? creditRaw ?? ''}"`, field: 'amount' });
      continue;
    }

    const balRaw = getCell('balance');
    let balance: number | undefined;
    if (balRaw !== undefined && balRaw.trim() !== '') {
      const parsedBalance = normalizeAmountString(balRaw);
      if (parsedBalance === null) {
        result.rejectedRows.push({ rawIndex: i, rowNumber: pl.lineNumber, raw: cells, reason: `رصيد غير صالح: "${balRaw}"`, field: 'balance' });
        continue;
      }
      balance = parsedBalance;
    }

    const currRaw = getCell('currency');
    let currency = 'OMR';
    if (currRaw !== undefined && currRaw.trim() !== '') {
      currency = currRaw.trim().toUpperCase();
      if (currency !== 'OMR') {
        result.rejectedRows.push({ rawIndex: i, rowNumber: pl.lineNumber, raw: cells, reason: `عملة غير مدعومة أو متعارضة: "${currRaw}"`, field: 'currency' });
        continue;
      }
    }

    const description = (getCell('description') ?? '').trim() || 'حركة مستوردة';
    const reference = (getCell('reference') ?? '').trim();
    const fingerprint = computeRowFingerprint({ transaction_date: parsedDate, amount, currency, reference, description });
    if (fingerprintSeen.has(fingerprint)) {
      result.duplicateWithinFile++;
      result.rejectedRows.push({ rawIndex: i, rowNumber: pl.lineNumber, raw: cells, reason: 'مكرر مطابق داخل الملف' });
      continue;
    }
    fingerprintSeen.set(fingerprint, i);

    result.validRows.push({
      rawIndex: i,
      raw: cells,
      transaction_date: parsedDate,
      amount,
      description,
      reference,
      balance,
      currency,
      fingerprint,
    });
  }

  result.previewRows = result.validRows.slice(0, 10);
  if (result.rejectedRows.length > 0) {
    result.errorSummary = result.errorSummary ?? 'يوجد صف واحد أو أكثر مرفوض؛ الاستيراد الآمن يرفض الدفعة كاملة حتى التصحيح';
  } else if (result.validRows.length === 0) {
    result.errorSummary = 'لا توجد صفوف صالحة للاستيراد';
  }

  return result;
}

export async function computeFileFingerprint(content: string): Promise<string> {
  const canonical = stripBom(content).text.replace(/\r\n/g, '\n');
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(`bank-csv-file-v1\n${canonical}`);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // fallback below
  }
  return `fallback-${stableHash(`bank-csv-file-v1\n${canonical}`)}-${canonical.length}`;
}

export function formatBankAmount(amount: number): string {
  return amount.toFixed(3);
}
