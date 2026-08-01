import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { archiveCommission, createCommission, listCommissions, payCommissionAtomic, reverseCommissionAtomic, updateCommission } from './services/commissions-service';
import type { CommissionFilters, CommissionFormValues } from './types';

export const commissionKeys = { all: ['commissions'] as const, list: (filters: CommissionFilters) => [...commissionKeys.all, filters] as const };

export function useCommissions(filters: CommissionFilters) {
  return useQuery({ queryKey: commissionKeys.list(filters), queryFn: () => listCommissions(filters) });
}

export function useSaveCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: CommissionFormValues }) => (id ? updateCommission(id, values) : createCommission(values)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: commissionKeys.all });
      toast.success('تم حفظ العمولة');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر حفظ العمولة'),
  });
}

export function useArchiveCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveCommission,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: commissionKeys.all });
      toast.success('تم إلغاء العمولة');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر إلغاء العمولة'),
  });
}

export function useCommissionApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (commission: { id: string; values: CommissionFormValues }) =>
      updateCommission(commission.id, { ...commission.values, status: 'approved' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: commissionKeys.all });
      toast.success('تم اعتماد العمولة');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر اعتماد العمولة'),
  });
}

export function usePayCommissionAtomic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      paymentDate,
      accountId,
    }: {
      id: string;
      paymentDate?: string;
      accountId?: string;
    }) => payCommissionAtomic(id, { paymentDate, accountId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: commissionKeys.all });
      await queryClient.invalidateQueries({ queryKey: ['expenses'] });
      await queryClient.invalidateQueries({ queryKey: ['accounts'] });
      await queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast.success('تم صرف العمولة مالياً وتسجيل القيد والمصروف بنجاح');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر صرف العمولة مالياً'),
  });
}

export function useReverseCommissionAtomic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      reverseCommissionAtomic(id, reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: commissionKeys.all });
      await queryClient.invalidateQueries({ queryKey: ['expenses'] });
      await queryClient.invalidateQueries({ queryKey: ['accounts'] });
      await queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast.success('تم عكس صرف العمولة والقيد المحاسبي بنجاح');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر عكس العمولة مالياً'),
  });
}
