import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { defineEntityKeys } from '@/lib/query-keys';
import type { ContractPayload, RenewalPayload } from './contractSchema';
import { activateContract, approveContract, createContract, getContract, listAllContracts, listContracts, rejectContract, renewContract, softDeleteContract, submitContractForApproval, terminateContract, updateContract, type ContractListParams, type ContractStatusFilter } from './services/contractService';
import { reconcileDueShortStaysBeforeRead } from './services/shortStayLifecycleService';

const contractBase = defineEntityKeys('contracts');

export const contractKeys = {
  ...contractBase,
  allPages: (status: ContractStatusFilter) => [...contractBase.lists(), 'all-pages', status] as const,
} as const;

async function withShortStayReconciliation<T>(read: () => Promise<T>): Promise<T> {
  await reconcileDueShortStaysBeforeRead();
  return read();
}

export function useAllContracts(status: ContractStatusFilter = 'all', options?: Readonly<{ enabled?: boolean }>) {
  return useQuery({
    queryKey: contractKeys.allPages(status),
    queryFn: () => withShortStayReconciliation(() => listAllContracts(status)),
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    enabled: options?.enabled ?? true,
  });
}

export function useContracts(params: ContractListParams) {
  return useQuery({
    queryKey: contractKeys.list(params),
    queryFn: () => withShortStayReconciliation(() => listContracts(params)),
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

export function useContract(contractId: string) {
  return useQuery({
    queryKey: contractKeys.detail(contractId),
    queryFn: () => withShortStayReconciliation(() => getContract(contractId)),
    enabled: Boolean(contractId),
  });
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

// ─────────────────────────────────────────────────────────────────────────────
// Canonical contract approval/activation chain (S04-T03). The maker records a
// signature on submit; a different checker signs on approve/reject; activation
// freezes the authoritative agreement snapshot server-side.
// ─────────────────────────────────────────────────────────────────────────────

async function invalidateContractDetail(queryClient: QueryClient, contractId: string): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: contractKeys.lists() });
  await queryClient.invalidateQueries({ queryKey: contractKeys.detail(contractId) });
}

export function useSubmitContractForApproval(contractId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (makerSignature: string) => submitContractForApproval(contractId, makerSignature),
    onSuccess: async () => { await invalidateContractDetail(queryClient, contractId); toast.success('تم إرسال العقد للاعتماد'); },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر إرسال العقد للاعتماد'),
  });
}

export function useApproveContract(contractId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (checkerSignature: string) => approveContract(contractId, checkerSignature),
    onSuccess: async () => { await invalidateContractDetail(queryClient, contractId); toast.success('تم اعتماد العقد'); },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر اعتماد العقد'),
  });
}

export function useRejectContract(contractId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { checkerSignature: string; reason: string }) => rejectContract(contractId, input.checkerSignature, input.reason),
    onSuccess: async () => { await invalidateContractDetail(queryClient, contractId); toast.success('تم رفض العقد'); },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر رفض العقد'),
  });
}

export function useActivateContract(contractId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => activateContract(contractId),
    onSuccess: async () => { await invalidateContractDetail(queryClient, contractId); toast.success('تم تفعيل العقد وتجميد لقطة الاتفاقية'); },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر تفعيل العقد'),
  });
}
