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

// Expanded to cover every governed 1111/1120 movement per FOM-013, with honest partial coverage documented
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

  // Handle errors explicitly — fail closed, not silent incomplete set (Defect B3)
  try {
    if (signedAmount > 0) {
      // Payments (tenant collections) — filter at DB boundary deterministically (Defect B4)
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('id, amount, payment_date, payment_method, reference_number')
        .is('deleted_at', null)
        .eq('payment_date', line.transaction_date)
        .eq('amount', amount)
        .limit(20);
      if (paymentsError) throw paymentsError;
      for (const payment of (payments ?? []) as { id: string; amount: number; payment_date: string; payment_method: string | null; reference_number: string | null }[]) {
        candidates.push(
          toCandidate('payment', {
            id: payment.id,
            amount: payment.amount,
            date: payment.payment_date,
            label: `دفعة ${payment.payment_method ?? ''} ${payment.reference_number ?? ''}`.trim(),
          }),
        );
        // Receipt candidate REMOVED to avoid duplicate economic event (Defect B1)
        // If receipt matching is intentionally supported for legacy/manual workflows,
        // it must use real receipt row ID, not payment.id, and prove no duplicate match.
        // For now, prefer matching actual cash movement (payment) only.
      }

      // Receipts — real receipt rows, not payment.id masquerading as receipt (Defect B1)
      const { data: receipts, error: receiptsError } = await supabase
        .from('receipts')
        .select('id, amount, date_time')
        .eq('amount', amount)
        .gte('date_time', `${line.transaction_date}T00:00:00`)
        .lte('date_time', `${line.transaction_date}T23:59:59`)
        .is('deleted_at', null)
        .limit(20);
      if (receiptsError) throw receiptsError;
      for (const receipt of (receipts ?? []) as { id: string; amount: number; date_time: string }[]) {
        const receiptDate = receipt.date_time.slice(0, 10);
        candidates.push(
          toCandidate('receipt', {
            id: receipt.id,
            amount: receipt.amount,
            date: receiptDate,
            label: `إيصال ${receipt.id.slice(0, 8)}`,
          }),
        );
      }

      // Deposit receipts (tenant_deposits) — positive cash
      const { data: deposits, error: depositsError } = await supabase
        .from('tenant_deposits')
        .select('id, deposit_amount, received_date')
        .is('deleted_at', null)
        .eq('received_date', line.transaction_date)
        .eq('deposit_amount', amount)
        .limit(20);
      if (depositsError) throw depositsError;
      for (const dep of (deposits ?? []) as { id: string; deposit_amount: number; received_date: string }[]) {
        candidates.push(
          toCandidate('deposit_receipt', {
            id: dep.id,
            amount: dep.deposit_amount,
            date: dep.received_date,
            label: `وديعة تأمين ${dep.id.slice(0, 8)}`,
          }),
        );
      }
    }

    if (signedAmount < 0) {
      // Company expenses — use charged_to COMPANY (Defect B2)
      const { data: companyExpenses, error: companyExpensesError } = await supabase
        .from('expenses')
        .select('id, amount, expense_date, category, description, charged_to')
        .is('deleted_at', null)
        .eq('expense_date', line.transaction_date)
        .eq('amount', amount)
        .eq('charged_to', 'COMPANY')
        .limit(20);
      if (companyExpensesError) throw companyExpensesError;
      for (const expense of (companyExpenses ?? []) as { id: string; amount: number; expense_date: string; category: string | null; description: string | null; charged_to: string | null }[]) {
        candidates.push(
          toCandidate('expense', {
            id: expense.id,
            amount: -Math.abs(expense.amount),
            date: expense.expense_date,
            label: `${expense.category ?? 'مصروف'} ${expense.description ?? ''}`.trim(),
          }),
        );
      }

      // Owner expenses — charged_to OWNER (Defect B2), not free-text contains 'owner'
      const { data: ownerExpenses, error: ownerExpensesError } = await supabase
        .from('expenses')
        .select('id, amount, expense_date, category, description, charged_to')
        .is('deleted_at', null)
        .eq('expense_date', line.transaction_date)
        .eq('amount', amount)
        .eq('charged_to', 'OWNER')
        .limit(20);
      if (ownerExpensesError) throw ownerExpensesError;
      for (const expense of (ownerExpenses ?? []) as { id: string; amount: number; expense_date: string; category: string | null; description: string | null; charged_to: string | null }[]) {
        candidates.push(
          toCandidate('owner_expense', {
            id: expense.id,
            amount: -Math.abs(expense.amount),
            date: expense.expense_date,
            label: `مصروف مالك ${expense.description ?? ''}`.trim(),
          }),
        );
      }

      // Deposit refunds — filter at DB boundary (Defect B4)
      const { data: refunds, error: refundsError } = await supabase
        .from('deposit_refund_events')
        .select('id, amount, effective_date')
        .eq('effective_date', line.transaction_date)
        .eq('amount', amount)
        .eq('status', 'POSTED')
        .limit(20);
      if (refundsError) throw refundsError;
      for (const ref of (refunds ?? []) as { id: string; amount: number; effective_date: string }[]) {
        candidates.push(
          toCandidate('deposit_refund', {
            id: ref.id,
            amount: -Math.abs(ref.amount),
            date: ref.effective_date,
            label: `رد وديعة ${ref.id.slice(0, 8)}`,
          }),
        );
      }

      // Owner payouts — filter at DB boundary deterministically (Defect B4)
      // Use gte/lte for timestamp bounds, limit 100 to avoid false negatives
      const { data: settlements, error: settlementsError } = await supabase
        .from('owner_settlements')
        .select('id, net_payable, paid_at, status')
        .eq('status', 'PAID')
        .gte('paid_at', `${line.transaction_date}T00:00:00`)
        .lte('paid_at', `${line.transaction_date}T23:59:59`)
        .eq('net_payable', amount)
        .limit(100);
      if (settlementsError) throw settlementsError;
      for (const s of (settlements ?? []) as { id: string; net_payable: number; paid_at: string | null; status: string }[]) {
        if (!s.paid_at) continue;
        const paidDate = s.paid_at.slice(0, 10);
        candidates.push(
          toCandidate('owner_payout', {
            id: s.id,
            amount: -Math.abs(Number(s.net_payable)),
            date: paidDate,
            label: `صرف تسوية مالك ${s.id.slice(0, 8)}`,
          }),
        );
      }

      // Commission payments — filter at DB boundary (Defect B4)
      // paid_at is bigint (epoch ms), so we filter by amount at DB and date in memory, with larger limit to avoid false negatives
      const { data: commissions, error: commissionsError } = await supabase
        .from('commissions')
        .select('id, amount, status, paid_at')
        .eq('status', 'PAID')
        .eq('amount', amount)
        .limit(100);
      if (commissionsError) throw commissionsError;
      for (const c of (commissions ?? []) as { id: string; amount: number; paid_at: number | null; status: string }[]) {
        if (!c.paid_at) continue;
        // paid_at bigint is epoch ms, convert to date string
        const paidDate = new Date(Number(c.paid_at)).toISOString().slice(0, 10);
        if (paidDate !== line.transaction_date) continue;
        candidates.push(
          toCandidate('commission_payment', {
            id: c.id,
            amount: -Math.abs(Number(c.amount)),
            date: paidDate,
            label: `صرف عمولة ${c.id.slice(0, 8)}`,
          }),
        );
      }
    }
  } catch (error) {
    // Fail closed — do not interpret failed reads as no candidates (Defect B3)
    handleSupabaseError(error, 'تعذر تحميل اقتراحات المطابقة البنكية');
    throw error;
  }

  // Deduplicate by entity_type + entity_id to avoid duplicate economic event (Defect B1, B2)
  const seen = new Set<string>();
  const deduped: BankMatchCandidate[] = [];
  for (const cand of candidates) {
    const key = `${cand.entity_type}:${cand.entity_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(cand);
  }

  // Manual adjustment synthetic candidate REMOVED (Defect B5)
  // Previously generated manual-${date}-${amount} with no authoritative record.
  // Now, manual_adjustment must reference real persisted governed source.
  // If user needs manual adjustment, they must create it via governed RPC/table first,
  // then match to its real ID. No synthetic fake PK.

  return deduped;
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
 * Coverage documentation — honest partial coverage per B7.
 * Previously claimed complete/all while reversals marked partial — now labeled honestly.
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
    candidateEntity: 'payment / receipt (real receipt ID, not payment.id)',
    supportStatus: 'supported',
    reconciliationEffect: 'matched positive bank line to payment (preferred) or real receipt ID',
    reversalHandling: 'VOID receipt creates compensating reversal, cannot match VOIDED',
  },
  {
    movementClass: 'owner payouts',
    accountingEvent: 'Owner payout Dr 2000 Cr 1111/1120',
    sourceEntity: 'owner_settlements (PAID)',
    bankDirection: 'negative',
    candidateEntity: 'owner_payout',
    supportStatus: 'supported',
    reconciliationEffect: 'matched negative bank line to owner settlement payout via DB-filtered date+amount',
    reversalHandling: 'controlled settlement correction, post-payout refund → 1300, cannot match non-PAID',
  },
  {
    movementClass: 'tenant deposit receipts',
    accountingEvent: 'Deposit receipt Dr 1111/1120 Cr 2200',
    sourceEntity: 'tenant_deposits',
    bankDirection: 'positive',
    candidateEntity: 'deposit_receipt',
    supportStatus: 'supported',
    reconciliationEffect: 'matched positive bank line to deposit receipt',
    reversalHandling: 'refund/application/reversal transaction, cannot match deleted',
  },
  {
    movementClass: 'deposit refunds',
    accountingEvent: 'Deposit refund Dr 2200 Cr 1111/1120 via refund_deposit_governed_atomic',
    sourceEntity: 'deposit_refund_events (POSTED)',
    bankDirection: 'negative',
    candidateEntity: 'deposit_refund',
    supportStatus: 'supported',
    reconciliationEffect: 'matched negative bank line to deposit refund event via DB filter',
    reversalHandling: 'reverse_deposit_refund_atomic compensating, cannot match REVERSED',
  },
  {
    movementClass: 'broker commission payments',
    accountingEvent: 'Commission paid Dr 2300 Cr 1111/1120 via pay_commission_atomic',
    sourceEntity: 'commissions (PAID)',
    bankDirection: 'negative',
    candidateEntity: 'commission_payment',
    supportStatus: 'supported',
    reconciliationEffect: 'matched negative bank line to commission payment via DB filter',
    reversalHandling: 'reverse_commission_atomic, cannot match non-PAID',
  },
  {
    movementClass: 'company expenses',
    accountingEvent: 'Company expense Dr 6100 Cr 1111/1120',
    sourceEntity: 'expenses where charged_to=COMPANY',
    bankDirection: 'negative',
    candidateEntity: 'expense',
    supportStatus: 'supported',
    reconciliationEffect: 'matched negative bank line to company expense via charged_to=COMPANY',
    reversalHandling: 'expense reversal/adjustment, cannot match deleted',
  },
  {
    movementClass: 'owner expenses paid by office',
    accountingEvent: 'Owner expense Dr 1300 Cr 1111/1120',
    sourceEntity: 'expenses where charged_to=OWNER',
    bankDirection: 'negative',
    candidateEntity: 'owner_expense',
    supportStatus: 'supported',
    reconciliationEffect: 'matched negative bank line to owner expense via charged_to=OWNER, not free-text',
    reversalHandling: 'reversal or recovery adjustment',
  },
  {
    movementClass: 'reversals/refunds (receipt void, deposit reversal)',
    accountingEvent: 'VOID/reversal reverse original credits/debits',
    sourceEntity: 'journal_batches reversal_of_batch_id',
    bankDirection: 'positive',
    candidateEntity: 'manual_adjustment (requires real governed adjustment) or reversal batch',
    supportStatus: 'partial',
    reconciliationEffect: 'currently partial — reversal events not yet deterministic candidates, manual adjustment requires real authority',
    reversalHandling: 'reversal batch linked to original, cannot match reversed/voided',
  },
  {
    movementClass: 'manual adjustments',
    accountingEvent: 'Explicit manual bank-match source — must reference real persisted governed source',
    sourceEntity: 'bank_manual_adjustments (future) or journal_batches manual',
    bankDirection: 'positive',
    candidateEntity: 'manual_adjustment (real ID required, no synthetic manual-date-amount)',
    supportStatus: 'partial',
    reconciliationEffect: 'removed synthetic fake PK manual-${date}-${amount}, requires real governed adjustment entity/RPC',
    reversalHandling: 'compensating manual adjustment via real entity',
  },
];
