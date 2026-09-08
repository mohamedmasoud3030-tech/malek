import { invalidateFinancialReadModels } from '@/lib/financial-cache';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { recordInvoicePaymentAtomic, type PaymentPayload, type PaymentResult } from './paymentService';

export type PostedPaymentUiResult = PaymentResult & { ledger_receipt_id: string };

export function toPaymentBackedReceiptResult(result: PaymentResult): PostedPaymentUiResult {
  return {
    ...result,
    ledger_receipt_id: result.receipt_id,
    receipt_id: result.payment_id,
  };
}

export function usePostPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: PaymentPayload) => toPaymentBackedReceiptResult(await recordInvoicePaymentAtomic(payload)),
    onSuccess: async () => {
      await invalidateFinancialReadModels(queryClient);
      toast.success('تم تسجيل الدفعة بنجاح');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر تسجيل الدفعة'),
  });
}
