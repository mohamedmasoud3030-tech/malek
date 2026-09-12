import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createAccountingPeriod,
  listAccountingPeriods,
  updateAccountingPeriodStatus,
} from './accountingPeriodsService';
import type { AccountingPeriodInput, AccountingPeriodStatusInput } from './accountingDomain';

/**
 * Stage 3 — accounting-period management query hooks.
 *
 * The service boundary (and the audited ADMIN/MANAGER-gated RPCs behind it)
 * already existed; these hooks add the react-query wiring the Settings
 * Finance Readiness surface needs. No new RPC, no new business rule.
 */
export const accountingPeriodKeys = {
  all: ['accountingPeriods'] as const,
  list: () => [...accountingPeriodKeys.all, 'list'] as const,
};

export function useAccountingPeriods() {
  return useQuery({
    queryKey: accountingPeriodKeys.list(),
    queryFn: listAccountingPeriods,
  });
}

export function useCreateAccountingPeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AccountingPeriodInput) => createAccountingPeriod(input),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: accountingPeriodKeys.all });
      toast.success(result ? `تم إنشاء الفترة المحاسبية ${result.name} (${result.start_date} ← ${result.end_date})` : 'تم إنشاء الفترة المحاسبية');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر إنشاء الفترة المحاسبية'),
  });
}

export function useUpdateAccountingPeriodStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AccountingPeriodStatusInput) => updateAccountingPeriodStatus(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accountingPeriodKeys.all });
      toast.success('تم تحديث حالة الفترة المحاسبية');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر تحديث حالة الفترة المحاسبية'),
  });
}
