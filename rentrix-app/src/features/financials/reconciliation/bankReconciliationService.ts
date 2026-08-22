import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import { fetchAllRows } from '@/lib/paginatedRead';
import type { Database } from '@/types/database';
import type {
  BankAccount,
  BankMatchCandidate,
  BankReconciliationFilters,
  BankReconciliationMatch,
  BankReconciliationMatchValues,
  BankStatementImportValues,
  BankStatementLine,
  BankStatementLineFormValues,
  ReconciliationSummary,
} from './types';

type BankStatementImportInsert = Database['public']['Tables']['bank_statement_imports']['Insert'];
type BankStatementLineInsert = Database['public']['Tables']['bank_statement_lines']['Insert'];
type BankReconciliationMatchInsert = Database['public']['Tables']['bank_reconciliation_matches']['Insert'];
type ProcessBankReconciliationMatchAtomicResult = Database['public']['Functions']['process_bank_reconciliation_match_atomic']['Returns'];

// Expanded to cover every governed 1111/1120 movement per FOM-013
const matchEntityTypes = [
  'payment',
  'receipt',
  'expense',
  'manual_adjustment',
  'owner_payout',
  'deposit_receipt',
  'deposit_refund',
  'commission_payment',
  'owner_expense',
] as const;

export type CanonicalBankStatementLineStatus = 'unmatched' | 'matched' | 'ignored';

export function normalizeBankStatementLineStatus(status: unknown): CanonicalBankStatementLineStatus {
  switch (String(status ?? '').trim().toLowerCase()) {
    case 'matched':
      return 'matched';
    case 'ignored':
      return 'ignored';
    case 'unmatched':
    default:
      return 'unmatched';
  }
}

function getBankStatementStatusVariants(status: CanonicalBankStatementLineStatus): string[] {
  return [status, status.toUpperCase()];
}

const bankAccountIdSchema = z.string().trim().min(1, 'اختر الحساب البنكي.');
const dateInputSchema = z.string().trim().refine(isValidDateInput, 'اختر تاريخاً صحيحاً بصيغة YYYY-MM-DD.');
const requiredNonZeroNumberSchema = (label: string) =>
  z.string().trim().transform((value, context) => {
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
  return Number(value.replace(/,/g, '').replace(/[()]/g, (match) => (match === '(' ? '-' : '')));
}

function isValidDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function parseBankStatementCsv(csv: string, bankAccountId: string): BankStatementLineInsert[] {
  const normalizedAccountId = parseOrThrow(bankAccountIdSchema, bankAccountId);
  const rows = csv
    .trim()
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);
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

function toCandidate(
  entity_type: BankMatchCandidate['entity_type'],
  row: { id: string; amount: number; date: string; label: string },
): BankMatchCandidate {
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
  return lines.reduce<ReconciliationSummary>(
    (summary, line) => {
      const status = normalizeBankStatementLineStatus(line.status);
      return {
        totalLines: summary.totalLines + 1,
        unmatchedCount: summary.unmatchedCount + (status === 'unmatched' ? 1 : 0),
        matchedCount: summary.matchedCount + (status === 'matched' ? 1 : 0),
        ignoredCount: summary.ignoredCount + (status === 'ignored' ? 1 : 0),
        unmatchedAmount: summary.unmatchedAmount + (status === 'unmatched' ? Number(line.amount) || 0 : 0),
      };
    },
    { totalLines: 0, unmatchedCount: 0, matchedCount: 0, ignoredCount: 0, unmatchedAmount: 0 },
  );
}

export async function listBankAccounts(): Promise<BankAccount[]> {
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('*')
    .is('deleted_at', null)
    .order('account_name', { ascending: true })
    .returns<BankAccount[]>();
  if (error) handleSupabaseError(error, 'تعذر تحميل الحسابات البنكية');
  return data ?? [];
}

export async function listBankStatementLines(filters: BankReconciliationFilters): Promise<BankStatementLine[]> {
  try {
    const { rows } = await fetchAllRows<BankStatementLine>(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = supabase
        .from('bank_statement_lines')
        .select('*')
        .is('deleted_at', null)
        .order('transaction_date', { ascending: false })
        .order('id', { ascending: false });
      if (filters.bankAccountId) query = query.eq('bank_account_id', filters.bankAccountId);
      if (filters.status !== 'all')
        query = query.in('status', getBankStatementStatusVariants(normalizeBankStatementLineStatus(filters.status)));
      if (filters.from) query = query.gte('transaction_date', filters.from);
      if (filters.to) query = query.lte('transaction_date', filters.to);
      return query.returns();
    });
    return rows.map((row) => ({ ...row, status: normalizeBankStatementLineStatus(row.status) }) as BankStatementLine);
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
  const { data: imported, error: importError } = await supabase
    .from('bank_statement_imports')
    .insert(importPayload)
    .select('*')
    .single()
    .returns<Database['public']['Tables']['bank_statement_imports']['Row']>();
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

  // Positive amounts: collections, deposit receipts
  if (signedAmount > 0) {
    // Payments (tenant collections)
    const { data: payments } = await supabase
      .from('payments')
      .select('id, amount, payment_date, payment_method, reference_number')
      .is('deleted_at', null)
      .eq('payment_date', line.transaction_date)
      .eq('amount', amount)
      .limit(10);
    for (const payment of (payments ?? []) as { id: string; amount: number; payment_date: string; payment_method: string | null; reference_number: string | null }[]) {
      candidates.push(
        toCandidate('payment', {
          id: payment.id,
          amount: payment.amount,
          date: payment.payment_date,
          label: `دفعة ${payment.payment_method ?? ''} ${payment.reference_number ?? ''}`.trim(),
        }),
      );
      candidates.push(
        toCandidate('receipt', {
          id: payment.id,
          amount: payment.amount,
          date: payment.payment_date,
          label: `إيصال مرتبط بالدفعة ${payment.reference_number ?? payment.id}`,
        }),
      );
    }

    // Deposit receipts (tenant_deposits)
    const { data: deposits } = await supabase
      .from('tenant_deposits')
      .select('id, deposit_amount, received_date')
      .is('deleted_at', null)
      .eq('received_date', line.transaction_date)
      .eq('deposit_amount', amount)
      .limit(10);
    for (const dep of (deposits ?? []) as { id: string; deposit_amount: number; received_date: string }[]) {
      candidates.push(
        toCandidate('deposit_receipt' as never, {
          id: dep.id,
          amount: dep.deposit_amount,
          date: dep.received_date,
          label: `وديعة تأمين ${dep.id.slice(0, 8)}`,
        }),
      );
    }
  }

  // Negative amounts: expenses, owner payouts, deposit refunds, commission payments, owner expenses
  if (signedAmount < 0) {
    // Company expenses
    const { data: expenses } = await supabase
      .from('expenses')
      .select('id, amount, expense_date, category, description')
      .is('deleted_at', null)
      .eq('expense_date', line.transaction_date)
      .eq('amount', amount)
      .limit(10);
    for (const expense of (expenses ?? []) as { id: string; amount: number; expense_date: string; category: string | null; description: string | null }[]) {
      candidates.push(
        toCandidate('expense', {
          id: expense.id,
          amount: -Math.abs(expense.amount),
          date: expense.expense_date,
          label: `${expense.category ?? 'مصروف'} ${expense.description ?? ''}`.trim(),
        }),
      );
      // Owner expense paid by office is also in expenses but with different category
      if ((expense.category ?? '').toLowerCase().includes('owner') || (expense.description ?? '').toLowerCase().includes('owner')) {
        candidates.push(
          toCandidate('owner_expense' as never, {
            id: expense.id,
            amount: -Math.abs(expense.amount),
            date: expense.expense_date,
            label: `مصروف مالك ${expense.description ?? ''}`.trim(),
          }),
        );
      }
    }

    // Deposit refunds
    const { data: refunds } = await supabase
      .from('deposit_refund_events')
      .select('id, amount, effective_date')
      .eq('effective_date', line.transaction_date)
      .eq('amount', amount)
      .eq('status', 'POSTED')
      .limit(10);
    for (const ref of (refunds ?? []) as { id: string; amount: number; effective_date: string }[]) {
      candidates.push(
        toCandidate('deposit_refund' as never, {
          id: ref.id,
          amount: -Math.abs(ref.amount),
          date: ref.effective_date,
          label: `رد وديعة ${ref.id.slice(0, 8)}`,
        }),
      );
    }

    // Owner payouts (owner_settlements)
    const { data: settlements } = await supabase
      .from('owner_settlements')
      .select('id, net_payable, paid_at, status')
      .eq('status', 'PAID')
      .limit(10);
    // Filter by date and amount in memory because paid_at may be timestamp
    for (const s of (settlements ?? []) as { id: string; net_payable: number; paid_at: string | null; status: string }[]) {
      if (!s.paid_at) continue;
      const paidDate = s.paid_at.slice(0, 10);
      if (paidDate !== line.transaction_date) continue;
      if (Math.abs(Number(s.net_payable)) !== amount) continue;
      candidates.push(
        toCandidate('owner_payout' as never, {
          id: s.id,
          amount: -Math.abs(Number(s.net_payable)),
          date: paidDate,
          label: `صرف تسوية مالك ${s.id.slice(0, 8)}`,
        }),
      );
    }

    // Commission payments (commissions where paid)
    const { data: commissions } = await supabase
      .from('commissions')
      .select('id, amount, status, paid_at')
      .eq('status', 'PAID')
      .limit(10);
    for (const c of (commissions ?? []) as { id: string; amount: number; paid_at: string | null; status: string }[]) {
      if (!c.paid_at) continue;
      const paidDate = c.paid_at.slice(0, 10);
      if (paidDate !== line.transaction_date) continue;
      if (Math.abs(Number(c.amount)) !== amount) continue;
      candidates.push(
        toCandidate('commission_payment' as never, {
          id: c.id,
          amount: -Math.abs(Number(c.amount)),
          date: paidDate,
          label: `صرف عمولة ${c.id.slice(0, 8)}`,
        }),
      );
    }
  }

  // Manual adjustments always possible
  candidates.push(
    toCandidate('manual_adjustment', {
      id: `manual-${line.transaction_date}-${amount}`,
      amount: signedAmount,
      date: line.transaction_date,
      label: `تسوية يدوية ${amount} بتاريخ ${line.transaction_date}`,
    }),
  );

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
  const { error } = await supabase
    .from('bank_statement_lines')
    .update({ status: 'ignored', updated_at: new Date().toISOString() })
    .eq('id', statementLineId);
  if (error) handleSupabaseError(error, 'تعذر تجاهل حركة كشف البنك');
}

/**
 * Coverage documentation for every governed 1111/1120 movement.
 * This is used by tests to prove reconciliation coverage.
 */
export const BANK_RECONCILIATION_COVERAGE: Array<{
  movementClass: string;
  accountingEvent: string;
  sourceEntity: string;
  bankDirection: 'positive' | 'negative';
  candidateEntity: string;
  supportStatus: 'supported' | 'partial' | 'missing';
  reconciliationEffect: string;
  reversalHandling: string;
}> = [
  {
    movementClass: 'tenant collections',
    accountingEvent: 'OWNER creditor collection Dr 1111/1120 Cr 2000 (+2100)',
    sourceEntity: 'payments / receipts',
    bankDirection: 'positive',
    candidateEntity: 'payment / receipt',
    supportStatus: 'supported',
    reconciliationEffect: 'matched positive bank line to payment',
    reversalHandling: 'VOID receipt creates compensating reversal',
  },
  {
    movementClass: 'owner payouts',
    accountingEvent: 'Owner payout Dr 2000 Cr 1111/1120',
    sourceEntity: 'owner_settlements (PAID)',
    bankDirection: 'negative',
    candidateEntity: 'owner_payout',
    supportStatus: 'supported',
    reconciliationEffect: 'matched negative bank line to owner settlement payout',
    reversalHandling: 'controlled settlement correction, post-payout refund → 1300',
  },
  {
    movementClass: 'tenant deposit receipts',
    accountingEvent: 'Deposit receipt Dr 1111/1120 Cr 2200',
    sourceEntity: 'tenant_deposits',
    bankDirection: 'positive',
    candidateEntity: 'deposit_receipt',
    supportStatus: 'supported',
    reconciliationEffect: 'matched positive bank line to deposit receipt',
    reversalHandling: 'refund/application/reversal transaction',
  },
  {
    movementClass: 'deposit refunds',
    accountingEvent: 'Deposit refund Dr 2200 Cr 1111/1120 via refund_deposit_governed_atomic',
    sourceEntity: 'deposit_refund_events (POSTED)',
    bankDirection: 'negative',
    candidateEntity: 'deposit_refund',
    supportStatus: 'supported',
    reconciliationEffect: 'matched negative bank line to deposit refund event',
    reversalHandling: 'reverse_deposit_refund_atomic compensating',
  },
  {
    movementClass: 'broker commission payments',
    accountingEvent: 'Commission paid Dr 2300 Cr 1111/1120 via pay_commission_atomic',
    sourceEntity: 'commissions (PAID)',
    bankDirection: 'negative',
    candidateEntity: 'commission_payment',
    supportStatus: 'supported',
    reconciliationEffect: 'matched negative bank line to commission payment',
    reversalHandling: 'reverse_commission_atomic',
  },
  {
    movementClass: 'company expenses',
    accountingEvent: 'Company expense Dr 6100 Cr 1111/1120',
    sourceEntity: 'expenses',
    bankDirection: 'negative',
    candidateEntity: 'expense',
    supportStatus: 'supported',
    reconciliationEffect: 'matched negative bank line to expense',
    reversalHandling: 'expense reversal/adjustment',
  },
  {
    movementClass: 'owner expenses paid by office',
    accountingEvent: 'Owner expense Dr 1300 Cr 1111/1120',
    sourceEntity: 'expenses (owner category)',
    bankDirection: 'negative',
    candidateEntity: 'owner_expense',
    supportStatus: 'supported',
    reconciliationEffect: 'matched negative bank line to owner expense',
    reversalHandling: 'reversal or recovery adjustment',
  },
  {
    movementClass: 'reversals/refunds (receipt void, deposit reversal)',
    accountingEvent: 'VOID/reversal reverse original credits/debits',
    sourceEntity: 'journal_batches reversal_of_batch_id',
    bankDirection: 'positive',
    candidateEntity: 'manual_adjustment or original entity reversal',
    supportStatus: 'partial',
    reconciliationEffect: 'manual adjustment or matched to reversal batch',
    reversalHandling: 'reversal batch linked to original',
  },
  {
    movementClass: 'manual adjustments',
    accountingEvent: 'Explicit manual bank-match source',
    sourceEntity: 'manual entry',
    bankDirection: 'positive',
    candidateEntity: 'manual_adjustment',
    supportStatus: 'supported',
    reconciliationEffect: 'explicit governed bank-match source',
    reversalHandling: 'compensating manual adjustment',
  },
];
