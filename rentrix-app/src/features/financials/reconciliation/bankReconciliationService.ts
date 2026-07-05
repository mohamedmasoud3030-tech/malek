import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import type { Database } from '@/types/database';
import type { BankAccount, BankMatchCandidate, BankReconciliationFilters, BankReconciliationMatch, BankReconciliationMatchValues, BankStatementImportValues, BankStatementLine, BankStatementLineFormValues, ReconciliationSummary } from './types';

type BankStatementImportInsert = Database['public']['Tables']['bank_statement_imports']['Insert'];
type BankStatementLineInsert = Database['public']['Tables']['bank_statement_lines']['Insert'];
type BankReconciliationMatchInsert = Database['public']['Tables']['bank_reconciliation_matches']['Insert'];


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
  if (!bankAccountId) throw new Error('اختر الحساب البنكي قبل الاستيراد.');
  const rows = csv.split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
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
      bank_account_id: bankAccountId,
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

function requiredNumber(value: string, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed === 0) throw new Error(`${label} مطلوب ويجب ألا يساوي صفر.`);
  return parsed;
}

export function summarizeReconciliation(lines: readonly Pick<BankStatementLine, 'amount' | 'status'>[]): ReconciliationSummary {
  return lines.reduce<ReconciliationSummary>((summary, line) => ({
    totalLines: summary.totalLines + 1,
    unmatchedCount: summary.unmatchedCount + (line.status === 'unmatched' ? 1 : 0),
    matchedCount: summary.matchedCount + (line.status === 'matched' ? 1 : 0),
    ignoredCount: summary.ignoredCount + (line.status === 'ignored' ? 1 : 0),
    unmatchedAmount: summary.unmatchedAmount + (line.status === 'unmatched' ? Number(line.amount) || 0 : 0),
  }), { totalLines: 0, unmatchedCount: 0, matchedCount: 0, ignoredCount: 0, unmatchedAmount: 0 });
}

export async function listBankAccounts(): Promise<BankAccount[]> {
  const { data, error } = await supabase.from('bank_accounts').select('*').is('deleted_at', null).order('account_name', { ascending: true }).returns<BankAccount[]>();
  if (error) handleSupabaseError(error, 'تعذر تحميل الحسابات البنكية');
  return data ?? [];
}

export async function listBankStatementLines(filters: BankReconciliationFilters): Promise<BankStatementLine[]> {
  let query = supabase.from('bank_statement_lines').select('*').is('deleted_at', null).order('transaction_date', { ascending: false });
  if (filters.bankAccountId) query = query.eq('bank_account_id', filters.bankAccountId);
  if (filters.status !== 'all') query = query.eq('status', filters.status);
  if (filters.from) query = query.gte('transaction_date', filters.from);
  if (filters.to) query = query.lte('transaction_date', filters.to);
  const { data, error } = await query.returns<BankStatementLine[]>();
  if (error) handleSupabaseError(error, 'تعذر تحميل حركات كشف البنك');
  return data ?? [];
}

export async function createBankStatementLine(values: BankStatementLineFormValues): Promise<BankStatementLine> {
  if (!values.bank_account_id) throw new Error('اختر الحساب البنكي.');
  if (!values.transaction_date) throw new Error('اختر تاريخ الحركة.');
  const payload: BankStatementLineInsert = {
    bank_account_id: values.bank_account_id,
    transaction_date: values.transaction_date,
    description: values.description.trim() || 'حركة بنكية',
    reference: values.reference.trim() || null,
    amount: requiredNumber(values.amount, 'مبلغ الحركة'),
    status: 'unmatched',
  };
  const { data, error } = await supabase.from('bank_statement_lines').insert(payload).select('*').single().returns<BankStatementLine>();
  if (error) handleSupabaseError(error, 'تعذر إضافة حركة كشف البنك');
  if (!data) throw new Error('لم يتم إرجاع حركة البنك بعد الحفظ.');
  return data;
}


export async function createBankStatementImportFromCsv(values: BankStatementImportValues): Promise<BankStatementLine[]> {
  const lines = parseBankStatementCsv(values.csv, values.bank_account_id);
  const dates = lines.map((line) => line.transaction_date).sort();
  const importPayload: BankStatementImportInsert = {
    bank_account_id: values.bank_account_id,
    statement_name: values.statement_name.trim() || `استيراد ${getTodayForImportName()}`,
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
  if (!values.statement_line_id) throw new Error('اختر حركة كشف البنك.');
  if (!values.matched_entity_id.trim()) throw new Error('أدخل معرف الحركة المسجلة المطابقة.');
  const payload: BankReconciliationMatchInsert = {
    statement_line_id: values.statement_line_id,
    matched_entity_type: values.matched_entity_type,
    matched_entity_id: values.matched_entity_id.trim(),
    matched_amount: requiredNumber(values.matched_amount, 'مبلغ المطابقة'),
    notes: values.notes.trim() || null,
  };
  const { data, error } = await supabase.from('bank_reconciliation_matches').insert(payload).select('*').single().returns<BankReconciliationMatch>();
  if (error) handleSupabaseError(error, 'تعذر تسجيل المطابقة البنكية');
  const { error: lineError } = await supabase.from('bank_statement_lines').update({ status: 'matched', updated_at: new Date().toISOString() }).eq('id', values.statement_line_id);
  if (lineError) handleSupabaseError(lineError, 'تم تسجيل المطابقة لكن تعذر تحديث حالة حركة كشف البنك');
  if (!data) throw new Error('لم يتم إرجاع سجل المطابقة بعد الحفظ.');
  return data;
}

export async function ignoreBankStatementLine(statementLineId: string): Promise<void> {
  const { error } = await supabase.from('bank_statement_lines').update({ status: 'ignored', updated_at: new Date().toISOString() }).eq('id', statementLineId);
  if (error) handleSupabaseError(error, 'تعذر تجاهل حركة كشف البنك');
}
