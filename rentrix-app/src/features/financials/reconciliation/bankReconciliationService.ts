import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import { fetchAllRows } from '@/lib/paginatedRead';
import type { Database } from '@/types/database';
import type { BankAccount, BankMatchCandidate, BankReconciliationFilters, BankReconciliationMatch, BankReconciliationMatchValues, BankStatementImportValues, BankStatementLine, BankStatementLineFormValues, ReconciliationSummary } from './types';

type BankStatementImportInsert = Database['public']['Tables']['bank_statement_imports']['Insert'];
type BankStatementLineInsert = Database['public']['Tables']['bank_statement_lines']['Insert'];
type BankReconciliationMatchInsert = Database['public']['Tables']['bank_reconciliation_matches']['Insert'];
type ProcessBankReconciliationMatchAtomicResult = Database['public']['Functions']['process_bank_reconciliation_match_atomic']['Returns'];


const matchEntityTypes = ['payment', 'receipt', 'expense', 'manual_adjustment'] as const;

export type CanonicalBankStatementLineStatus = 'unmatched' | 'matched' | 'ignored';

/** Accept historical casing while keeping reconciliation totals and filters aligned. */
export function normalizeBankStatementLineStatus(status: unknown): CanonicalBankStatementLineStatus {
  switch (String(status ?? '').trim().toLowerCase()) {
    case 'matched': return 'matched';
    case 'ignored': return 'ignored';
    case 'unmatched':
    default: return 'unmatched';
  }
}

function getBankStatementStatusVariants(status: CanonicalBankStatementLineStatus): string[] {
  return [status, status.toUpperCase()];
}


const bankAccountIdSchema = z.string().trim().min(1, 'اختر الحساب البنكي.');
const dateInputSchema = z.string().trim().refine(isValidDateInput, 'اختر تاريخاً صحيحاً بصيغة YYYY-MM-DD.');
const requiredNonZeroNumberSchema = (label: string) => z.string().trim().transform((value, context) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: `${label} مطلوب ويجب ألا يساوي صفر.` });
    return z.NEVER;
  }
  return parsed;
});

const bankStatementLineSchema = z.object({
  bank_account_id: bankAccountIdSchema,
  transaction_date: dateInputSchema,
  description: z.string().trim().optional(),
  reference: z.string().trim().optional(),
  amount: requiredNonZeroNumberSchema('مبلغ الحركة'),
});

const bankStatementImportSchema = z.object({
  bank_account_id: bankAccountIdSchema,
  statement_name: z.string().trim().optional(),
  csv: z.string().trim().min(1, 'ملف CSV فارغ.'),
});

const bankReconciliationMatchSchema = z.object({
  statement_line_id: z.string().trim().min(1, 'اختر حركة كشف البنك.'),
  matched_entity_type: z.enum(matchEntityTypes, { message: 'اختر نوع السجل المطابق.' }),
  matched_entity_id: z.string().trim().min(1, 'أدخل معرف الحركة المسجلة المطابقة.'),
  matched_amount: requiredNonZeroNumberSchema('مبلغ المطابقة'),
  notes: z.string().trim().optional(),
});

function getValidationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? 'تحقق من البيانات المدخلة.';
}

function parseOrThrow<T extends z.ZodTypeAny>(schema: T, values: unknown): z.output<T> {
  const parsed = schema.safeParse(values);
  if (!parsed.success) throw new Error(getValidationMessage(parsed.error));
  return parsed.data;
}

function parseCsvRow(row: string) {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];
    const next = row[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function normalizeCsvAmount(value: string) {
  return Number(value.replace(/,/g, '').replace(/[()]/g, (match) => match === '(' ? '-' : ''));
}

function isValidDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function parseBankStatementCsv(csv: string, bankAccountId: string): BankStatementLineInsert[] {
  const normalizedAccountId = parseOrThrow(bankAccountIdSchema, bankAccountId);
  const rows = csv.trim().split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
  if (rows.length === 0) throw new Error('ملف CSV فارغ.');
  const firstCells = parseCsvRow(rows[0]).map((cell) => cell.toLowerCase());
  const hasHeader = firstCells.some((cell) => ['date', 'transaction_date', 'amount', 'description', 'reference'].includes(cell));
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const parsed = dataRows.map((row, index) => {
    const [transactionDate, description = '', reference = '', amountText = ''] = parseCsvRow(row);
    if (!isValidDateInput(transactionDate)) throw new Error(`تاريخ غير صحيح في صف CSV رقم ${index + 1}. استخدم YYYY-MM-DD.`);
    const amount = normalizeCsvAmount(amountText);
    if (!Number.isFinite(amount) || amount === 0) throw new Error(`مبلغ غير صحيح في صف CSV رقم ${index + 1}.`);
    return {
      bank_account_id: normalizedAccountId,
      transaction_date: transactionDate,
      description: description || 'حركة مستوردة',
      reference: reference || null,
      amount,
      status: 'unmatched' as const,
    } satisfies BankStatementLineInsert;
  });
  if (parsed.length === 0) throw new Error('لا توجد حركات صالحة للاستيراد.');
  return parsed;
}

function toCandidate(entity_type: BankMatchCandidate['entity_type'], row: { id: string; amount: number; date: string; label: string }): BankMatchCandidate {
  return { entity_type, entity_id: row.id, amount: row.amount, date: row.date, label: row.label };
}

export function toBankStatementLinePayload(values: BankStatementLineFormValues): BankStatementLineInsert {
  const parsed = parseOrThrow(bankStatementLineSchema, values);
  return {
    bank_account_id: parsed.bank_account_id,
    transaction_date: parsed.transaction_date,
    description: parsed.description || 'حركة بنكية',
    reference: parsed.reference || null,
    amount: parsed.amount,
    status: 'unmatched',
  };
}

export function toBankReconciliationMatchPayload(values: BankReconciliationMatchValues): BankReconciliationMatchInsert {
  const parsed = parseOrThrow(bankReconciliationMatchSchema, values);
  return {
    statement_line_id: parsed.statement_line_id,
    matched_entity_type: parsed.matched_entity_type,
    matched_entity_id: parsed.matched_entity_id,
    matched_amount: parsed.matched_amount,
    notes: parsed.notes || null,
  };
}


export function summarizeReconciliation(lines: readonly Pick<BankStatementLine, 'amount' | 'status'>[]): ReconciliationSummary {
  return lines.reduce<ReconciliationSummary>((summary, line) => {
    const status = normalizeBankStatementLineStatus(line.status);
    return {
      totalLines: summary.totalLines + 1,
      unmatchedCount: summary.unmatchedCount + (status === 'unmatched' ? 1 : 0),
      matchedCount: summary.matchedCount + (status === 'matched' ? 1 : 0),
      ignoredCount: summary.ignoredCount + (status === 'ignored' ? 1 : 0),
      unmatchedAmount: summary.unmatchedAmount + (status === 'unmatched' ? Number(line.amount) || 0 : 0),
    };
  }, { totalLines: 0, unmatchedCount: 0, matchedCount: 0, ignoredCount: 0, unmatchedAmount: 0 });
}

export async function listBankAccounts(): Promise<BankAccount[]> {
  const { data, error } = await supabase.from('bank_accounts').select('*').is('deleted_at', null).order('account_name', { ascending: true }).returns<BankAccount[]>();
  if (error) handleSupabaseError(error, 'تعذر تحميل الحسابات البنكية');
  return data ?? [];
}

export async function listBankStatementLines(filters: BankReconciliationFilters): Promise<BankStatementLine[]> {
  try {
    const { rows } = await fetchAllRows<BankStatementLine>(() => {
      let query: any = supabase.from('bank_statement_lines').select('*').is('deleted_at', null).order('transaction_date', { ascending: false });
      if (filters.bankAccountId) query = query.eq('bank_account_id', filters.bankAccountId);
      if (filters.status !== 'all') query = query.in('status', getBankStatementStatusVariants(normalizeBankStatementLineStatus(filters.status)));
      if (filters.from) query = query.gte('transaction_date', filters.from);
      if (filters.to) query = query.lte('transaction_date', filters.to);
      return query.returns();
    });
    // Database types predate some live rows; normalize status at this boundary.
    return rows.map((row) => ({ ...row, status: normalizeBankStatementLineStatus(row.status) } as BankStatementLine));
  } catch (error) {
    handleSupabaseError(error, 'تعذر تحميل حركات كشف البنك');
    throw error;
  }
}

export async function createBankStatementLine(values: BankStatementLineFormValues): Promise<BankStatementLine> {
  const payload = toBankStatementLinePayload(values);
  const { data, error } = await supabase.from('bank_statement_lines').insert(payload).select('*').single().returns<BankStatementLine>();
  if (error) handleSupabaseError(error, 'تعذر إضافة حركة كشف البنك');
  if (!data) throw new Error('لم يتم إرجاع حركة البنك بعد الحفظ.');
  return data;
}


export async function createBankStatementImportFromCsv(values: BankStatementImportValues): Promise<BankStatementLine[]> {
  const parsedImport = parseOrThrow(bankStatementImportSchema, values);
  const lines = parseBankStatementCsv(parsedImport.csv, parsedImport.bank_account_id);
  const dates = lines.map((line) => line.transaction_date).sort((left, right) => left.localeCompare(right));
  const importPayload: BankStatementImportInsert = {
    bank_account_id: parsedImport.bank_account_id,
    statement_name: parsedImport.statement_name || `استيراد ${getTodayForImportName()}`,
    statement_from: dates[0] ?? null,
    statement_to: dates[dates.length - 1] ?? null,
  };
  const { data: imported, error: importError } = await supabase.from('bank_statement_imports').insert(importPayload).select('*').single().returns<Database['public']['Tables']['bank_statement_imports']['Row']>();
  if (importError) handleSupabaseError(importError, 'تعذر إنشاء سجل استيراد كشف البنك');
  const payload = lines.map((line) => ({ ...line, import_id: imported?.id ?? null }));
  const { data, error } = await supabase.from('bank_statement_lines').insert(payload).select('*').returns<BankStatementLine[]>();
  if (error) handleSupabaseError(error, 'تعذر استيراد حركات كشف البنك');
  return data ?? [];
}

function getTodayForImportName() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export async function listSuggestedBankMatches(line: Pick<BankStatementLine, 'amount' | 'transaction_date'>): Promise<BankMatchCandidate[]> {
  const signedAmount = Number(line.amount);
  const amount = Math.abs(signedAmount);
  if (!Number.isFinite(amount) || amount === 0) return [];
  const candidates: BankMatchCandidate[] = [];

  if (signedAmount > 0) {
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('id, amount, payment_date, payment_method, reference_number')
      .is('deleted_at', null)
      .eq('payment_date', line.transaction_date)
      .eq('amount', amount)
      .limit(10);
    if (paymentsError) handleSupabaseError(paymentsError, 'تعذر تحميل اقتراحات الدفعات');
    for (const payment of payments ?? []) {
      candidates.push(toCandidate('payment', { id: payment.id, amount: payment.amount, date: payment.payment_date, label: `دفعة ${payment.payment_method ?? ''} ${payment.reference_number ?? ''}`.trim() }));
      candidates.push(toCandidate('receipt', { id: payment.id, amount: payment.amount, date: payment.payment_date, label: `إيصال مرتبط بالدفعة ${payment.reference_number ?? payment.id}` }));
    }
  }

  if (signedAmount < 0) {
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('id, amount, expense_date, category, description')
      .is('deleted_at', null)
      .eq('expense_date', line.transaction_date)
      .eq('amount', amount)
      .limit(10);
    if (expensesError) handleSupabaseError(expensesError, 'تعذر تحميل اقتراحات المصروفات');
    for (const expense of expenses ?? []) {
      candidates.push(toCandidate('expense', { id: expense.id, amount: -Math.abs(expense.amount), date: expense.expense_date, label: `${expense.category ?? 'مصروف'} ${expense.description ?? ''}`.trim() }));
    }
  }

  return candidates;
}

export async function matchBankStatementLine(values: BankReconciliationMatchValues): Promise<BankReconciliationMatch> {
  const payload = toBankReconciliationMatchPayload(values);
  const { data, error } = await supabase
    .rpc('process_bank_reconciliation_match_atomic', { payload })
    .returns<ProcessBankReconciliationMatchAtomicResult>();
  if (error) handleSupabaseError(error, 'تعذر تسجيل المطابقة البنكية');
  if (!data) throw new Error('لم يتم إرجاع سجل المطابقة بعد الحفظ.');
  return data;
}

export async function ignoreBankStatementLine(statementLineId: string): Promise<void> {
  const { error } = await supabase.from('bank_statement_lines').update({ status: 'ignored', updated_at: new Date().toISOString() }).eq('id', statementLineId);
  if (error) handleSupabaseError(error, 'تعذر تجاهل حركة كشف البنك');
}
