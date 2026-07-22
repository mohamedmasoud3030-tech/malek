import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getReceiptDetail, listReceipts, type ReceiptListParams } from './receiptService';
import { voidReceipt } from './receiptService';

export const receiptKeys = {
  all: ['receipts'] as const,
  list: (params: ReceiptListParams = {}) => [...receiptKeys.all, 'list', params] as const,
  detail: (receiptOrPaymentId: string) => [...receiptKeys.all, 'detail', receiptOrPaymentId] as const,
};

export function useReceipts(params: ReceiptListParams = {}) {
  return useQuery({
    queryKey: receiptKeys.list(params),
    queryFn: () => listReceipts(params),
    // Keep the current window visible while a larger one («عرض المزيد») loads.
    placeholderData: (previousData) => previousData,
  });
}

export function useReceipt(receiptOrPaymentId: string) {
  return useQuery({
    queryKey: receiptKeys.detail(receiptOrPaymentId),
    queryFn: () => getReceiptDetail(receiptOrPaymentId),
    enabled: Boolean(receiptOrPaymentId),
  });
}

export function useVoidReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: voidReceipt,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: receiptKeys.all });
      toast.success('تم إلغاء الإيصال بنجاح');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'تعذّر إلغاء الإيصال');
    },
  });
}
