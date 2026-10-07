import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { defineEntityKeys } from '@/lib/query-keys';
import { getActionableSupabaseErrorMessage } from '@/lib/supabase-error';
import {
  approveReceiptVoid,
  getReceiptDetail,
  listPendingReceiptVoidRequests,
  listReceipts,
  requestReceiptVoid,
  type ReceiptListParams,
} from './receiptService';

const receiptBase = defineEntityKeys('receipts');

export const receiptKeys = {
  ...receiptBase,
  pendingVoidRequests: () => [...receiptBase.all, 'void-requests', 'pending'] as const,
} as const;

export function useReceipts(params: ReceiptListParams = {}, options?: Readonly<{ enabled?: boolean }>) {
  return useQuery({
    queryKey: receiptKeys.list(params),
    queryFn: () => listReceipts(params),
    // Keep the current window visible while a larger one («عرض المزيد») loads.
    placeholderData: (previousData) => previousData,
    enabled: options?.enabled ?? true,
  });
}

export function useReceipt(receiptOrPaymentId: string) {
  return useQuery({
    queryKey: receiptKeys.detail(receiptOrPaymentId),
    queryFn: () => getReceiptDetail(receiptOrPaymentId),
    enabled: Boolean(receiptOrPaymentId),
  });
}

export function usePendingReceiptVoidRequests(enabled = true) {
  return useQuery({
    queryKey: receiptKeys.pendingVoidRequests(),
    queryFn: listPendingReceiptVoidRequests,
    enabled,
  });
}

export function useRequestReceiptVoid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: requestReceiptVoid,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: receiptKeys.all });
      toast.success('تم إرسال طلب إلغاء الإيصال للمراجعة');
    },
    onError: (error: unknown) => {
      toast.error(getActionableSupabaseErrorMessage(error, 'تعذّر إرسال طلب إلغاء الإيصال'));
    },
  });
}

export function useApproveReceiptVoid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: approveReceiptVoid,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: receiptKeys.all });
      toast.success('تم اعتماد إلغاء الإيصال وتنفيذ القيد العكسي');
    },
    onError: (error: unknown) => {
      toast.error(getActionableSupabaseErrorMessage(error, 'تعذّر اعتماد إلغاء الإيصال'));
    },
  });
}
