import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import { parseBankCsv, computeFileFingerprint, type BankCsvParseResult } from '@/lib/bankCsvParser';
import type { Json } from '@/types/database';

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

function toRpcPayload(request: BankImportRequest): Json {
  return {
    bank_account_id: request.bank_account_id,
    file_name: request.file_name,
    file_fingerprint: request.file_fingerprint,
    file_size: request.file_size,
    rows: request.rows.map((row) => ({
      transaction_date: row.transaction_date,
      amount: row.amount,
      description: row.description,
      ...(row.reference === undefined ? {} : { reference: row.reference }),
      ...(row.balance === undefined ? {} : { balance: row.balance }),
      ...(row.currency === undefined ? {} : { currency: row.currency }),
    })),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapImportResult(result: unknown, request: BankImportRequest): BankImportResult {
  if (!result || typeof result !== 'object') {
    throw new Error('استجابة غير متوقعة من الخادم');
  }

  const row = asRecord(result);
  return {
    id: asNullableString(row.id) ?? '',
    reference: asNullableString(row.reference),
    bank_account_id: asNullableString(row.bank_account_id) ?? request.bank_account_id,
    file_name: asNullableString(row.file_name) ?? request.file_name,
    file_fingerprint: asNullableString(row.file_fingerprint) ?? request.file_fingerprint,
    total_rows: asNumber(row.total_rows),
    accepted_rows: asNumber(row.accepted_rows),
    rejected_rows: asNumber(row.rejected_rows),
    duplicate_rows: asNumber(row.duplicate_rows),
    possible_duplicate_rows: asNumber(row.possible_duplicate_rows),
    status: asNullableString(row.status) ?? 'completed',
    is_duplicate_file: row.is_duplicate_file === true,
  };
}

export async function previewBankStatementBatch(request: BankImportRequest): Promise<BankImportResult> {
  const { data, error } = await supabase.rpc('preview_bank_statement_batch_atomic', {
    payload: toRpcPayload(request),
  });

  if (error) {
    handleSupabaseError(error, 'تعذر معاينة كشف البنك');
    throw error;
  }

  return mapImportResult(data, request);
}

export async function importBankStatementBatch(request: BankImportRequest): Promise<BankImportResult> {
  const { data, error } = await supabase.rpc('import_bank_statement_batch_atomic', {
    payload: toRpcPayload(request),
  });

  if (error) {
    handleSupabaseError(error, 'تعذر استيراد كشف البنك');
    throw error;
  }

  return mapImportResult(data, request);
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
