import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import { parseBankCsv, computeFileFingerprint, type BankCsvParseResult } from '@/lib/bankCsvParser';

export type { BankCsvParseResult } from '@/lib/bankCsvParser';

export interface BankImportPreview extends BankCsvParseResult {
  fileFingerprint: string;
}

export async function previewBankCsvFile(file: File): Promise<BankImportPreview> {
  if (file.size <= 0) throw new Error('ملف كشف البنك فارغ.');
  if (file.size > 5 * 1024 * 1024) throw new Error('حجم الملف يتجاوز 5MB.');

  const text = await file.text();
  const fingerprint = await computeFileFingerprint(text);
  const parsed = parseBankCsv(text, file.name, file.size);
  return { ...parsed, fileFingerprint: fingerprint };
}

export interface BankImportPayloadRow {
  transaction_date: string;
  amount: number;
  description: string;
  reference?: string;
  balance?: number;
  currency?: string;
}

export interface BankImportRequest {
  bank_account_id: string;
  file_name: string;
  file_fingerprint: string;
  file_size: number;
  source_total_rows: number;
  rejected_rows: number;
  rows: BankImportPayloadRow[];
}

export interface BankImportResult {
  id: string;
  reference: string | null;
  bank_account_id: string;
  file_name: string | null;
  file_fingerprint: string | null;
  normalized_payload_fingerprint?: string | null;
  total_rows: number;
  accepted_rows: number;
  rejected_rows: number;
  duplicate_rows: number;
  possible_duplicate_rows: number;
  status: string;
  is_duplicate_file: boolean;
}

export async function importBankStatementBatch(request: BankImportRequest): Promise<BankImportResult> {
  assertFailClosedImportRequest(request);

  const payload = {
    bank_account_id: request.bank_account_id,
    file_name: request.file_name,
    file_fingerprint: request.file_fingerprint,
    file_size: request.file_size,
    source_total_rows: request.source_total_rows,
    rejected_rows: request.rejected_rows,
    rows: request.rows,
  };

  const { data, error } = await supabase.rpc('import_bank_statement_batch_atomic', {
    payload,
  } as any);

  if (error) {
    handleSupabaseError(error, 'تعذر استيراد كشف البنك');
    throw error;
  }

  const result = data as any;
  if (!result || typeof result !== 'object') {
    throw new Error('استجابة غير متوقعة من الخادم');
  }

  const normalized: BankImportResult = {
    id: result.id,
    reference: result.reference ?? null,
    bank_account_id: result.bank_account_id,
    file_name: result.file_name ?? request.file_name,
    file_fingerprint: result.file_fingerprint ?? request.file_fingerprint,
    normalized_payload_fingerprint: result.normalized_payload_fingerprint ?? null,
    total_rows: Number(result.total_rows ?? 0),
    accepted_rows: Number(result.accepted_rows ?? 0),
    rejected_rows: Number(result.rejected_rows ?? 0),
    duplicate_rows: Number(result.duplicate_rows ?? 0),
    possible_duplicate_rows: Number(result.possible_duplicate_rows ?? 0),
    status: result.status ?? 'completed',
    is_duplicate_file: Boolean(result.is_duplicate_file),
  };

  if (
    normalized.total_rows < 0
    || normalized.accepted_rows < 0
    || normalized.rejected_rows < 0
    || normalized.duplicate_rows < 0
    || normalized.accepted_rows + normalized.rejected_rows + normalized.duplicate_rows !== normalized.total_rows
  ) {
    throw new Error('الخادم أعاد ملخص استيراد غير متوازن؛ لم يتم اعتماد النتيجة في الواجهة.');
  }

  return normalized;
}

export function assertImportPreviewReady(parsed: BankCsvParseResult): void {
  if (parsed.missingMandatory.length > 0) {
    throw new Error(`أعمدة إلزامية مفقودة: ${parsed.missingMandatory.join(', ')}`);
  }
  if (parsed.mappingAmbiguous) {
    throw new Error('تعيين الأعمدة غامض. صحح رؤوس الملف قبل الاستيراد.');
  }
  if (!parsed.hasHeader) {
    throw new Error('يجب أن يحتوي الملف على صف رؤوس واضح؛ لا يُسمح بالتخمين الصامت.');
  }
  if (parsed.rejectedRows.length > 0) {
    throw new Error(`يوجد ${parsed.rejectedRows.length} صف مرفوض. صحح الملف بالكامل قبل الاستيراد.`);
  }
  if (parsed.validRows.length === 0) {
    throw new Error('لا توجد صفوف صالحة للاستيراد.');
  }
  if (parsed.totalRows !== parsed.validRows.length) {
    throw new Error('عدد صفوف المصدر لا يطابق الصفوف الصالحة؛ تم منع الاستيراد الجزئي.');
  }
  if (parsed.totalRows > 10_000) {
    throw new Error('لا يمكن استيراد أكثر من 10000 صف في دفعة واحدة.');
  }
}

export function toImportPayloadRows(parsed: BankCsvParseResult): BankImportPayloadRow[] {
  assertImportPreviewReady(parsed);

  return parsed.validRows.map((row) => ({
    transaction_date: row.transaction_date!,
    amount: row.amount!,
    description: row.description?.trim() || 'حركة مستوردة',
    reference: row.reference || undefined,
    balance: row.balance,
    currency: row.currency ?? 'OMR',
  }));
}

function assertFailClosedImportRequest(request: BankImportRequest): void {
  if (!request.bank_account_id) throw new Error('اختر الحساب البنكي.');
  if (!/^[0-9a-f]{64}$/i.test(request.file_fingerprint)) {
    throw new Error('تعذر إنشاء بصمة SHA-256 موثوقة للملف.');
  }
  if (request.file_size <= 0 || request.file_size > 5 * 1024 * 1024) {
    throw new Error('حجم الملف يجب أن يكون بين 1 بايت و5MB.');
  }
  if (request.rejected_rows !== 0) {
    throw new Error('لا يُسمح باستيراد دفعة تحتوي صفوفًا مرفوضة.');
  }
  if (
    request.source_total_rows <= 0
    || request.source_total_rows > 10_000
    || request.source_total_rows !== request.rows.length
  ) {
    throw new Error('تم منع استيراد جزئي أو عدد صفوف غير صالح.');
  }
}
