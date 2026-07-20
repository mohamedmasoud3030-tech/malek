import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import type { Expense } from '@/types/domain';

export type ExpenseFilters = { propertyId: string; category: string; costCenterId?: string; from: string; to: string };
export type ExpensePayload = Pick<Expense, 'property_id' | 'category' | 'amount' | 'expense_date' | 'description'> & { attachment_url?: string | null; cost_center_id?: string | null; contract_id?: string | null; charged_to?: string | null };

export async function listExpenses(filters: ExpenseFilters): Promise<Expense[]> {
  try {
    let query = supabase.from('expenses').select('*').is('deleted_at', null).order('expense_date', { ascending: false });
    if (filters.propertyId) query = query.eq('property_id', filters.propertyId);
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.costCenterId) query = query.eq('cost_center_id', filters.costCenterId);
    if (filters.from) query = query.gte('expense_date', filters.from);
    if (filters.to) query = query.lte('expense_date', filters.to);
    const { data, error } = await query.returns<Expense[]>();
    if (error) handleSupabaseError(error);
    return data ?? [];
  } catch (error) {
    handleSupabaseError(error, 'تعذر تحميل المصاريف');
    return [];
  }
}

/**
 * Atomic expense update that persists every editable field. Amount or date
 * changes are represented by balanced reversal and replacement journal entries;
 * metadata-only changes do not duplicate ledger movements.
 */
export type UpdateExpenseResult = {
  expenseId: string;
  amountChanged: boolean;
  oldAmount: number;
  newAmount: number;
  requestId: string;
  idempotent: boolean;
};

export async function updateExpense(id: string, payload: ExpensePayload): Promise<Expense> {
  try {
    const requestId = crypto.randomUUID();

    const { data, error } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)(
      'update_expense_with_journal_atomic',
      {
        p_payload: {
          request_id: requestId,
          expense_id: id,
          property_id: payload.property_id,
          category: payload.category,
          amount: payload.amount,
          expense_date: payload.expense_date,
          cost_center_id: payload.cost_center_id ?? null,
          contract_id: payload.contract_id ?? null,
          charged_to: payload.charged_to ?? null,
          description: payload.description ?? null,
          attachment_url: payload.attachment_url ?? null,
        },
      },
    );
    if (error) throw error;

    const result = (data ?? {}) as { success?: boolean };
    if (!result.success) throw new Error('Expense update failed');

    const { data: expense, error: fetchError } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()
      .returns<Expense>();
    if (fetchError) throw fetchError;
    if (!expense) throw new Error('Expense not found after update');
    return expense;
  } catch (error) {
    handleSupabaseError(error, 'تعذر تعديل المصروف');
    throw error instanceof Error ? error : new Error('تعذر تعديل المصروف');
  }
}

/**
 * Atomic expense creation that records the expense together with its journal
 * entry and audit-log row in a single RPC. `requestId` enables idempotent retries.
 */
export type ExpenseWithJournalPayload = {
  requestId?: string;
  propertyId: string;
  category: string;
  amount: number;
  expenseDate: string;
  description?: string | null;
  costCenterId?: string | null;
  contractId?: string | null;
  chargedTo?: string | null;
  attachmentUrl?: string | null;
};

export type ExpenseWithJournalResult = {
  expenseId: string;
  expenseNo: string;
  requestId: string;
  idempotent: boolean;
};

export async function createExpenseWithJournal(payload: ExpenseWithJournalPayload): Promise<ExpenseWithJournalResult> {
  const { data, error } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)(
    'create_expense_with_journal_atomic',
    {
      p_payload: {
        request_id: payload.requestId ?? null,
        property_id: payload.propertyId,
        category: payload.category,
        amount: payload.amount,
        expense_date: payload.expenseDate,
        description: payload.description ?? null,
        cost_center_id: payload.costCenterId ?? null,
        contract_id: payload.contractId ?? null,
        charged_to: payload.chargedTo ?? null,
        attachment_url: payload.attachmentUrl ?? null,
      },
    },
  );
  if (error) throw error;

  const result = (data ?? {}) as { expense_id?: string; expense_no?: string; request_id?: string; idempotent?: boolean };
  return {
    expenseId: result.expense_id ?? '',
    expenseNo: result.expense_no ?? '',
    requestId: result.request_id ?? payload.requestId ?? '',
    idempotent: Boolean(result.idempotent),
  };
}
