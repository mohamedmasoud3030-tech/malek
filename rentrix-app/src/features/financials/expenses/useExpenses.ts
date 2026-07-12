import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { financialReportKeys } from '../reports/useFinancialReports';
import { createExpenseWithJournal, listExpenses, updateExpense, type ExpenseFilters, type ExpensePayload, type ExpenseWithJournalPayload } from './expenseService';

export const expenseKeys = { all: ['expenses'] as const, list: (f: ExpenseFilters) => [...expenseKeys.all, f] as const };
export function useExpenses(filters: ExpenseFilters) { return useQuery({ queryKey: expenseKeys.list(filters), queryFn: () => listExpenses(filters) }); }

/**
 * Atomic expense creation (expense + journal entry + audit in one RPC).
 * Keeps the same user-facing result as the direct insert path.
 */
export function useCreateExpenseAtomic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: ExpenseWithJournalPayload) => createExpenseWithJournal(p),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: expenseKeys.all }),
        qc.invalidateQueries({ queryKey: financialReportKeys.all }),
      ]);
      toast.success('تم إضافة المصروف وترحيله محاسبياً');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر إضافة المصروف'),
  });
}
export function useUpdateExpense(expenseId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ExpensePayload | { id: string; payload: ExpensePayload }) => {
      if ('payload' in input) return updateExpense(input.id, input.payload);
      if (!expenseId) throw new Error('معرّف المصروف مطلوب');
      return updateExpense(expenseId, input);
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: expenseKeys.all }),
        qc.invalidateQueries({ queryKey: financialReportKeys.all }),
      ]);
      toast.success('تم تحديث المصروف');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر تحديث المصروف'),
  });
}
