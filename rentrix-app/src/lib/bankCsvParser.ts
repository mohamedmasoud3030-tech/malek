/**
 * Bank CSV Parser — Stage 4
 * Supports UTF-8, UTF-8 BOM, Arabic/English headers, comma/semicolon delimiters,
 * quoted values, OMR 3-decimal amounts, debit/credit normalization, duplicate
 * headers, blank rows, invalid dates/amounts, etc.
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
  rawIndex: number; // 0-based in original file excluding blanks? For error reporting, 1-based row number
  raw: string[]; // original parsed cells
  transaction_date?: string; // normalized YYYY-MM-DD
  amount?: number;
  description?: string;
  reference?: string;
  balance?: number;
  currency?: string;
  fingerprint?: string; // for intra-file duplicate detection
}

export interface RejectedBankRow {
  rawIndex: number;
  rowNumber: number; // 1-based line number for UI
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
  totalRows: number; // total non-empty rows processed (excluding header)
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
  previewRows: ParsedBankRow[]; // first N valid rows
  errorSummary?: string;
}

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
    for (const syn of synonyms) {
      const synNorm = normalizeHeader(syn);
      if (norm === synNorm) return field;
      // partial contains for Arabic
      if (norm.includes(synNorm) || synNorm.includes(norm)) {
        // require at least 3 chars to avoid false positives
        if (synNorm.length >= 3 && norm.length >= 3) return field;
      }
    }
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
  if (text.charCodeAt(0) === 0xfeff) {
    return { text: text.slice(1), encoding: 'UTF-8 BOM' };
  }
  return { text, encoding: 'UTF-8' };
}

function detectDelimiter(sampleLines: string[]): { delimiter: BankCsvDelimiter; confidence: 'high' | 'low' | 'fallback' } {
  let commaCount = 0;
  let semicolonCount = 0;
  const checkLines = sampleLines.slice(0, 5);
  for (const line of checkLines) {
    // naive count outside quotes for quick detection
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        // handle escaped
        if (line[i + 1] === '"') { i++; continue; }
        inQuotes = !inQuotes;
      } else if (!inQuotes) {
        if (c === ',') commaCount++;
        else if (c === ';') semicolonCount++;
      }
    }
  }
  if (semicolonCount > 0 && commaCount === 0) return { delimiter: ';', confidence: 'high' };
  if (commaCount > 0 && semicolonCount === 0) return { delimiter: ',', confidence: 'high' };
  if (semicolonCount > commaCount && semicolonCount > 0) return { delimiter: ';', confidence: semicolonCount >= commaCount * 2 ? 'high' : 'low' };
  if (commaCount > semicolonCount) return { delimiter: ',', confidence: commaCount >= semicolonCount * 2 ? 'high' : 'low' };
  return { delimiter: ',', confidence: 'fallback' };
}

function normalizeAmountString(value: string): number | null {
  if (!value) return null;
  let v = value.trim();
  if (!v) return null;
  // Remove currency symbols and OMR text
  v = v.replace(/OMR|ر\.?ع\.?|﷼/gi, '').trim();
  // Handle parentheses as negative
  const isParenNegative = v.startsWith('(') && v.endsWith(')');
  if (isParenNegative) {
    v = '-' + v.slice(1, -1);
  }
  // Remove thousand separators: commas, spaces
  // But keep decimal point
  // Handle Arabic decimal separators? Replace Arabic comma
  v = v.replace(/[\s,']/g, '');
  // Handle Arabic-Indic digits
  const arabicIndicMap: Record<string, string> = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
  v = v.replace(/[٠-٩]/g, (d) => arabicIndicMap[d] ?? d);
  // Now v should be like -1234.567 or 1234.5
  // Support 3 decimals OMR
  const num = Number(v);
  if (!Number.isFinite(num) || num === 0) {
    // 0 is invalid per spec (non-zero)
    if (num === 0) return null;
    return Number.isFinite(num) ? num : null;
  }
  // Round to 3 decimals? Keep as is but ensure up to 3 decimals
  return Math.round(num * 1000) / 1000;
}

function parseDateFlexible(value: string): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;

  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) {
      return `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    }
    return null;
  }

  // Try DD/MM/YYYY or MM/DD/YYYY or DD-MM-YYYY with / or - or .
  const sepMatch = v.match(/^(\d{1,4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,4})$/);
  if (sepMatch) {
    let a = Number(sepMatch[1]);
    let b = Number(sepMatch[2]);
    let c = Number(sepMatch[3]);
    let year: number, month: number, day: number;

    // Determine which part is year
    if (a > 31) {
      // YYYY/MM/DD or YYYY-MM-DD already handled but just in case YYYY/MM/DD with single digit month
      year = a; month = b; day = c;
    } else if (c > 31) {
      // DD/MM/YYYY
      day = a; month = b; year = c;
    } else {
      // ambiguous DD/MM/YYYY vs MM/DD/YYYY
      // Assume DD/MM/YYYY for Omani context
      day = a; month = b; year = c;
      // If month >12, swap
      if (month > 12 && day <= 12) {
        const tmp = day; day = month; month = tmp;
      }
    }

    // 2-digit year handling
    if (year < 100) year += 2000;

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const dt = new Date(year, month - 1, day);
    if (dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day) {
      return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
    return null;
  }

  // Try ISO datetime YYYY-MM-DDTHH:MM:SS
  const isoDate = v.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return isoDate;
  }

  return null;
}

function computeFingerprint(row: { transaction_date: string; amount: number; currency: string; reference: string; description: string }): string {
  const normalized = [
    row.transaction_date,
    row.amount.toFixed(3),
    row.currency.toUpperCase(),
    row.reference.toLowerCase().trim(),
    row.description.toLowerCase().trim(),
  ].join('|');
  // simple hash for intra-file detection (not cryptographic, just for dedup)
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const chr = normalized.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return `${row.transaction_date}|${row.amount}|${normalized.length}|${hash}`;
}

export function parseBankCsv(
  fileContent: string,
  fileName: string,
  fileSize: number,
): BankCsvParseResult {
  const { text: withoutBom, encoding } = stripBom(fileContent);
  const rawLines = withoutBom.split(/\r?\n/);

  // Filter lines for delimiter detection (non-empty)
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

  if (rawLines.length === 0 || nonEmptyForDelim.length === 0) {
    result.errorSummary = 'الملف فارغ';
    result.missingMandatory = ['transaction_date', 'amount'];
    return result;
  }

  // Parse all lines with delimiter
  const parsedLines: { lineNumber: number; cells: string[]; raw: string }[] = [];
  rawLines.forEach((raw, idx) => {
    if (raw.trim() === '') return; // skip blank rows per spec (blank rows handled)
    const cells = parseCsvLine(raw, delimiter);
    // Keep even if all empty? Already filtered blank
    parsedLines.push({ lineNumber: idx + 1, cells, raw });
  });

  if (parsedLines.length === 0) {
    result.errorSummary = 'لا توجد صفوف بعد إزالة الفارغة';
    result.missingMandatory = ['transaction_date', 'amount'];
    return result;
  }

  // Header detection: first row if any cell matches known header synonym
  const firstRowCells = parsedLines[0].cells;
  const headerMatches = firstRowCells.map((cell) => matchHeaderToField(cell));
  const hasHeader = headerMatches.some((m) => m !== null);

  let dataStartIndex = 0;
  let headers: string[] = [];
  let rawHeaderRow: string[] | undefined;

  if (hasHeader) {
    headers = firstRowCells;
    rawHeaderRow = firstRowCells;
    dataStartIndex = 1;
    result.hasHeader = true;
    result.headers = headers;
    result.rawHeaderRow = rawHeaderRow;

    // Check duplicate headers (case-insensitive normalized)
    const normalizedHeaders = headers.map((h) => normalizeHeader(h)).filter(Boolean);
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const nh of normalizedHeaders) {
      if (seen.has(nh)) duplicates.push(nh);
      else seen.add(nh);
    }
    if (duplicates.length > 0) {
      result.errorSummary = `رؤوس مكررة: ${duplicates.join(', ')}`;
      // Treat as rejected header case
      result.missingMandatory = ['transaction_date', 'amount'];
      result.rejectedRows.push({
        rawIndex: 0,
        rowNumber: parsedLines[0].lineNumber,
        raw: firstRowCells,
        reason: `رؤوس مكررة: ${duplicates.join(', ')}`,
      });
      return result;
    }

    // Build column mapping
    const mappingMap = new Map<CanonicalBankField, BankCsvColumnMapping>();
    let ambiguous = false;
    firstRowCells.forEach((header, idx) => {
      const field = matchHeaderToField(header);
      if (field) {
        if (mappingMap.has(field)) {
          ambiguous = true;
        } else {
          mappingMap.set(field, { field, header, index: idx });
        }
      }
    });

    result.columnMapping = Array.from(mappingMap.values());
    result.mappingAmbiguous = ambiguous;

    if (ambiguous) {
      result.errorSummary = 'تعيين أعمدة غامض: نفس الحقل مرتبط بأكثر من عمود';
    }

    // Determine missing mandatory
    const hasAmount = mappingMap.has('amount') || (mappingMap.has('debit') && mappingMap.has('credit')) || mappingMap.has('debit') || mappingMap.has('credit');
    const hasDate = mappingMap.has('transaction_date');
    const missing: CanonicalBankField[] = [];
    if (!hasDate) missing.push('transaction_date');
    if (!hasAmount) missing.push('amount');
    result.missingMandatory = missing;

    if (missing.length > 0) {
      // Don't fail entirely yet, but mark as missing mandatory
      // Still attempt to parse? For preview, we should reject batch requiring correction per spec default
      // So we will still parse but validRows will be empty and errorSummary set
      if (!result.errorSummary) result.errorSummary = `أعمدة إلزامية مفقودة: ${missing.join(', ')}`;
    }
  } else {
    // No header: assume positional? But spec says don't silently guess ambiguous mapping
    // For backward compatibility with old format date,description,reference,amount
    // We'll treat as headerless with assumed order if 4 columns: date,description,reference,amount
    // Otherwise, mark missing mandatory and require mapping
    result.hasHeader = false;
    result.headers = [];
    // Try to infer if first row looks like data (date + amount pattern)
    // If not, we still need mapping
    result.missingMandatory = ['transaction_date', 'amount'];
    result.errorSummary = 'لم يتم العثور على صف رؤوس؛ يُرجى تأكيد تعيين الأعمدة';
    // For now, we will attempt fallback mapping for legacy format if row has 4 columns and first cell is date-like
    const sampleCells = firstRowCells;
    if (sampleCells.length >= 4) {
      const dateParsed = parseDateFlexible(sampleCells[0]);
      const amountParsed = normalizeAmountString(sampleCells[3]);
      if (dateParsed && amountParsed !== null) {
        // Legacy mapping: 0: date, 1: description, 2: reference, 3: amount
        result.columnMapping = [
          { field: 'transaction_date', header: 'date (inferred)', index: 0 },
          { field: 'description', header: 'description (inferred)', index: 1 },
          { field: 'reference', header: 'reference (inferred)', index: 2 },
          { field: 'amount', header: 'amount (inferred)', index: 3 },
        ];
        result.missingMandatory = [];
        result.errorSummary = undefined;
        result.hasHeader = false;
        result.headers = ['date', 'description', 'reference', 'amount'];
      }
    }
  }

  // If mapping still missing mandatory, we cannot produce valid rows except maybe fallback, so return early with rejected rows?
  const mappingByField = new Map<CanonicalBankField, number>();
  for (const m of result.columnMapping) {
    mappingByField.set(m.field, m.index);
  }

  const hasDateMapping = mappingByField.has('transaction_date');
  const hasAmountMapping = mappingByField.has('amount') || mappingByField.has('debit') || mappingByField.has('credit');

  if (!hasDateMapping || !hasAmountMapping) {
    // All data rows become rejected with reason missing mandatory columns
    for (let i = dataStartIndex; i < parsedLines.length; i++) {
      const pl = parsedLines[i];
      result.rejectedRows.push({
        rawIndex: i,
        rowNumber: pl.lineNumber,
        raw: pl.cells,
        reason: `أعمدة إلزامية مفقودة: ${result.missingMandatory.join(', ') || 'transaction_date, amount'}`,
      });
    }
    result.totalRows = parsedLines.length - dataStartIndex;
    return result;
  }

  // Parse data rows
  const fingerprintSeen = new Map<string, number>(); // fingerprint -> first occurrence index
  let totalRows = 0;

  for (let i = dataStartIndex; i < parsedLines.length; i++) {
    const pl = parsedLines[i];
    totalRows++;
    const cells = pl.cells;

    // Helper to get cell by mapping
    const getCell = (field: CanonicalBankField): string | undefined => {
      const idx = mappingByField.get(field);
      if (idx === undefined) return undefined;
      return cells[idx];
    };

    // Date
    const dateRaw = getCell('transaction_date') ?? '';
    const parsedDate = parseDateFlexible(dateRaw);
    if (!parsedDate) {
      result.rejectedRows.push({
        rawIndex: i,
        rowNumber: pl.lineNumber,
        raw: cells,
        reason: `تاريخ غير صالح: "${dateRaw}"`,
        field: 'transaction_date',
      });
      continue;
    }

    // Amount logic: handle amount column OR debit/credit
    let amount: number | null = null;
    const amountRaw = getCell('amount');
    const debitRaw = getCell('debit');
    const creditRaw = getCell('credit');

    if (amountRaw !== undefined) {
      amount = normalizeAmountString(amountRaw);
    } else if (debitRaw !== undefined || creditRaw !== undefined) {
      const debitVal = debitRaw ? normalizeAmountString(debitRaw) : null;
      const creditVal = creditRaw ? normalizeAmountString(creditRaw) : null;
      // OMR: debit is outflow (negative), credit inflow (positive)
      // If both present, amount = credit - debit? But debit already negative? Let's treat:
      // If debit column present alone -> amount = -abs(debit)
      // If credit alone -> +credit
      // If both -> credit - debit (if debit positive value means outflow, subtract)
      const debitAbs = debitVal !== null ? Math.abs(debitVal) : 0;
      const creditAbs = creditVal !== null ? Math.abs(creditVal) : 0;
      if (debitAbs !== 0 && creditAbs !== 0) {
        // If both present in same row, ambiguous but we compute credit - debit
        amount = creditAbs - debitAbs;
        if (amount === 0) amount = null; // will be rejected as zero
      } else if (debitAbs !== 0) {
        amount = -debitAbs;
      } else if (creditAbs !== 0) {
        amount = creditAbs;
      }
    }

    if (amount === null || !Number.isFinite(amount) || amount === 0) {
      result.rejectedRows.push({
        rawIndex: i,
        rowNumber: pl.lineNumber,
        raw: cells,
        reason: `مبلغ غير صالح: "${amountRaw ?? debitRaw ?? creditRaw ?? ''}"`,
        field: 'amount',
      });
      continue;
    }

    // Description
    const descRaw = getCell('description') ?? '';
    const description = descRaw.trim() || 'حركة مستوردة';

    // Reference
    const refRaw = getCell('reference') ?? '';
    const reference = refRaw.trim();

    // Balance
    const balRaw = getCell('balance');
    let balance: number | undefined;
    if (balRaw !== undefined && balRaw.trim() !== '') {
      const b = normalizeAmountString(balRaw);
      if (b === null) {
        // Balance invalid is not fatal? Spec says handle invalid amounts/dates, but balance is optional
        // We'll treat invalid balance as rejected? Since optional, we can ignore and keep row but note?
        // For fail-closed, optional invalid should not reject batch, just ignore. We'll set undefined.
        balance = undefined;
      } else {
        balance = b;
      }
    }

    // Currency
    const currRaw = getCell('currency');
    let currency = 'OMR';
    if (currRaw && currRaw.trim()) {
      const cur = currRaw.trim().toUpperCase();
      if (/^[A-Z]{3}$/.test(cur)) currency = cur;
    }

    // Compute fingerprint for intra-file duplicate detection
    const fp = computeFingerprint({
      transaction_date: parsedDate,
      amount,
      currency,
      reference,
      description,
    });

    // Check exact duplicate within file
    if (fingerprintSeen.has(fp)) {
      result.duplicateWithinFile++;
      result.rejectedRows.push({
        rawIndex: i,
        rowNumber: pl.lineNumber,
        raw: cells,
        reason: `مكرر داخل الملف (نفس التاريخ والمبلغ والوصف)`,
      });
      continue;
    }
    fingerprintSeen.set(fp, i);

    const parsedRow: ParsedBankRow = {
      rawIndex: i,
      raw: cells,
      transaction_date: parsedDate,
      amount,
      description,
      reference,
      balance,
      currency,
      fingerprint: fp,
    };

    result.validRows.push(parsedRow);
  }

  result.totalRows = totalRows;
  result.duplicateWithinFile = result.duplicateWithinFile;
  result.previewRows = result.validRows.slice(0, 10);
  if (result.validRows.length === 0 && result.rejectedRows.length > 0 && !result.errorSummary) {
    result.errorSummary = 'كل الصفوف مرفوضة بسبب أخطاء التحقق';
  }

  return result;
}

export async function computeFileFingerprint(content: string): Promise<string> {
  // Use SubtleCrypto if available, fallback to simple hash
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // fallback
  }
  // Fallback: simple djb2-like hash (not cryptographically secure but deterministic)
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = (hash * 33) ^ content.charCodeAt(i);
  }
  return `fallback-${(hash >>> 0).toString(16)}-${content.length}`;
}

export function formatBankAmount(amount: number): string {
  return amount.toFixed(3);
}
