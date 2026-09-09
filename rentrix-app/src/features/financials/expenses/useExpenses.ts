import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { invalidateEntity } from '@/lib/query-keys';
import { useState } from 'react';
import { RetryableCommandStore } from '@/lib/retryable-command';
import { invalidateFinancialReadModels } from '@/lib/financial-cache';
import {
  createExpenseWithJournal,
  listExpenses,
  updateExpense,
  type ExpenseFilters,
  type ExpensePayload,
  type ExpenseWithJournalPayload,
} from './expenseService';

export const expenseKeys = {
  all: ['expenses'] as const,
  list: (f: ExpenseFilters) => [...expenseKeys.all, f] as const,
};
export function useExpenses(filters: ExpenseFilters) {
  return useQuery({
    queryKey: expenseKeys.list(filters),
    queryFn: () => listExpenses(filters),
  });
}

/**
 * Atomic expense creation (expense + journal entry + audit in one RPC).
 * Keeps the same user-facing result as the direct insert path.
 */
export function useCreateExpenseAtomic() {
  const qc = useQueryClient();
  // Reuse the existing mounted-workflow identity authority after uncertain writes.
  const [commands] = useState(() => new RetryableCommandStore());
  return useMutation({
    mutationFn: (p: ExpenseWithJournalPayload) =>
      p.requestId
        ? createExpenseWithJournal(p)
        : commands.run('expense-create', p, (requestId) =>
            createExpenseWithJournal({ ...p, requestId }),
          ),
    onSuccess: () => {
      toast.success('تم إضافة المصروف وترحيله محاسبياً');
    },
    onError: () =>
      toast.error('تعذر تأكيد إضافة المصروف. راجع السجل ثم أعد المحاولة.'),
    onSettled: () =>
      Promise.all([
        invalidateEntity(qc, expenseKeys.all),
        invalidateFinancialReadModels(qc),
      ]),
  });
}
export function useUpdateExpense(expenseId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      input: ExpensePayload | { id: string; payload: ExpensePayload },
    ) => {
      if ('payload' in input) return updateExpense(input.id, input.payload);
      if (!expenseId) throw new Error('معرّف المصروف مطلوب');
      return updateExpense(expenseId, input);
    },
    onSuccess: () => {
      toast.success('تم تحديث المصروف');
    },
    onError: () =>
      toast.error('تعذر تأكيد تحديث المصروف. راجع السجل ثم أعد المحاولة.'),
    onSettled: () =>
      Promise.all([
        invalidateEntity(qc, expenseKeys.all),
        invalidateFinancialReadModels(qc),
      ]),
  });
}
