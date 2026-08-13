import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useActiveCompanyId } from '@/hooks/use-company';
import {
  ACTIVE_COMPANY_REQUIRED_ERROR,
  archiveCostCenter,
  listCostCenters,
  saveCostCenter,
  type CostCenterFormValues,
} from './costCenterService';

export const costCenterKeys = {
  all: ['costCenters'] as const,
  list: () => [...costCenterKeys.all, 'list'] as const,
};

export function useCostCenters() {
  return useQuery({
    queryKey: costCenterKeys.list(),
    queryFn: listCostCenters,
  });
}

export function useSaveCostCenter() {
  const queryClient = useQueryClient();
  // cost_centers is company-scoped; its RLS policies require the active
  // company, so the write cannot be attempted without one.
  const activeCompanyId = useActiveCompanyId();
  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: CostCenterFormValues }) => {
      if (!activeCompanyId) throw new Error(ACTIVE_COMPANY_REQUIRED_ERROR);
      return saveCostCenter(values, activeCompanyId, id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: costCenterKeys.all });
      toast.success('تم حفظ مركز التكلفة');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر حفظ مركز التكلفة'),
  });
}

export function useArchiveCostCenter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveCostCenter,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: costCenterKeys.all });
      toast.success('تمت أرشفة مركز التكلفة');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر أرشفة مركز التكلفة'),
  });
}
