import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { archivePaymentTerms, listPaymentTerms, savePaymentTerms, type PaymentTermsFormValues } from './paymentTermsService';

const paymentTermsKeys = {
  all: ['paymentTerms'] as const,
  list: () => [...paymentTermsKeys.all, 'list'] as const,
};

export function usePaymentTerms() {
  return useQuery({
    queryKey: paymentTermsKeys.list(),
    queryFn: listPaymentTerms,
  });
}

export function useSavePaymentTerms() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: PaymentTermsFormValues }) => savePaymentTerms(values, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: paymentTermsKeys.all });
      toast.success('تم حفظ شرط السداد');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر حفظ شرط السداد'),
  });
}

export function useArchivePaymentTerms() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archivePaymentTerms,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: paymentTermsKeys.all });
      toast.success('تمت أرشفة شرط السداد');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر أرشفة شرط السداد'),
  });
}
