import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import { parseBankCsv, computeFileFingerprint, type BankCsvParseResult } from '@/lib/bankCsvParser';

export type { BankCsvParseResult } from '@/lib/bankCsvParser';

export interface BankImportPreview extends BankCsvParseResult {
  fileFingerprint: string;
}

export async function previewBankCsvFile(file: File): Promise<BankImportPreview> {
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
  rows: BankImportPayloadRow[];
}

export interface BankImportResult {
  id: string;
  reference: string | null;
  bank_account_id: string;
  file_name: string | null;
  file_fingerprint: string | null;
  total_rows: number;
  accepted_rows: number;
  rejected_rows: number;
  duplicate_rows: number;
  possible_duplicate_rows: number;
  status: string;
  is_duplicate_file: boolean;
}

export async function importBankStatementBatch(request: BankImportRequest): Promise<BankImportResult> {
  const payload = {
    bank_account_id: request.bank_account_id,
    file_name: request.file_name,
    file_fingerprint: request.file_fingerprint,
    file_size: request.file_size,
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

  return {
    id: result.id,
    reference: result.reference ?? null,
    bank_account_id: result.bank_account_id,
    file_name: result.file_name ?? request.file_name,
    file_fingerprint: result.file_fingerprint ?? request.file_fingerprint,
    total_rows: Number(result.total_rows ?? 0),
    accepted_rows: Number(result.accepted_rows ?? 0),
    rejected_rows: Number(result.rejected_rows ?? 0),
    duplicate_rows: Number(result.duplicate_rows ?? 0),
    possible_duplicate_rows: Number(result.possible_duplicate_rows ?? 0),
    status: result.status ?? 'completed',
    is_duplicate_file: Boolean(result.is_duplicate_file),
  };
}

export function toImportPayloadRows(parsed: BankCsvParseResult): BankImportPayloadRow[] {
  if (parsed.mappingAmbiguous || parsed.missingMandatory.length > 0 || parsed.rejectedRows.length > 0) {
    throw new Error('لا يمكن استيراد ملف يحتوي على تعيين غامض أو صفوف مرفوضة؛ الاستيراد fail-closed');
  }
  if (parsed.validRows.length === 0) {
    throw new Error('لا توجد صفوف صالحة للاستيراد');
  }

  return parsed.validRows.map((row) => ({
    transaction_date: row.transaction_date!,
    amount: row.amount!,
    description: row.description ?? 'حركة مستوردة',
    reference: row.reference || undefined,
    balance: row.balance,
    currency: row.currency ?? 'OMR',
  }));
}
