import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ContractPayload, RenewalPayload } from './contractSchema';
import { createContract, getContract, listContracts, renewContract, softDeleteContract, terminateContract, updateContract, type ContractListParams } from './services/contractService';

export const contractKeys = {
  all: ['contracts'] as const,
  lists: () => [...contractKeys.all, 'list'] as const,
  list: (params: ContractListParams) => [...contractKeys.lists(), params] as const,
  detail: (contractId: string) => [...contractKeys.all, 'detail', contractId] as const,
};

export function useContracts(params: ContractListParams) {
  return useQuery({
    queryKey: contractKeys.list(params),
    queryFn: () => listContracts(params),
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

export function useContract(contractId: string) {
  return useQuery({ queryKey: contractKeys.detail(contractId), queryFn: () => getContract(contractId), enabled: Boolean(contractId) });
}

export function useCreateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ContractPayload) => createContract(payload),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: contractKeys.lists() }); toast.success('تم إنشاء العقد بنجاح'); },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر إنشاء العقد'),
  });
}

export function useUpdateContract(contractId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ContractPayload) => updateContract(contractId, payload),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: contractKeys.lists() }); queryClient.removeQueries({ queryKey: contractKeys.detail(contractId) }); toast.success('تم تحديث العقد بنجاح'); },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر تحديث العقد'),
  });
}

export function useSoftDeleteContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contractId: string) => softDeleteContract(contractId),
    onSuccess: async (_data, contractId) => { await queryClient.invalidateQueries({ queryKey: contractKeys.lists() }); queryClient.removeQueries({ queryKey: contractKeys.detail(contractId) }); toast.success('تم حذف العقد أرشيفياً'); },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر حذف العقد'),
  });
}

export function useTerminateContract(contractId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => terminateContract(contractId, reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: contractKeys.lists() });
      queryClient.removeQueries({ queryKey: contractKeys.detail(contractId) });
      toast.success('تم إنهاء العقد');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر إنهاء العقد'),
  });
}

export function useRenewContract(contractId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RenewalPayload) => renewContract(contractId, payload),
    onSuccess: async (_data, _payload, _ctx) => {
      // Invalidate all contract lists so both the old (now expired) and the
      // newly created contract appear without a manual refresh.
      await queryClient.invalidateQueries({ queryKey: contractKeys.all });
      toast.success('تم تجديد العقد وإنشاء عقد جديد');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر تجديد العقد'),
  });
}
