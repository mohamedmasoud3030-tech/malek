import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { defineEntityKeys } from '@/lib/query-keys';
import { financialReportKeys } from '../reports/useFinancialReports';
import { generateInvoicesFromActiveContracts, getInvoiceDetail, listInvoices, listInvoicesPaginated, type InvoiceListParams, type InvoicePaginationParams, type InvoiceStatusFilter } from './invoiceService';

const invoiceBase = defineEntityKeys('invoices');

export const invoiceKeys = {
  ...invoiceBase,
  paginated: (params: InvoicePaginationParams) => [...invoiceBase.lists(), 'paginated', params] as const,
} as const;

export function useInvoices(params: InvoiceStatusFilter | InvoiceListParams) {
  return useQuery({ queryKey: invoiceKeys.list(params), queryFn: () => listInvoices(params) });
}

export function useInvoicesPaginated(params: InvoicePaginationParams) {
  return useQuery({ queryKey: invoiceKeys.paginated(params), queryFn: () => listInvoicesPaginated(params) });
}

export function useInvoice(invoiceId: string) {
  return useQuery({ queryKey: invoiceKeys.detail(invoiceId), queryFn: () => getInvoiceDetail(invoiceId), enabled: Boolean(invoiceId) });
}

export function useGenerateInvoices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: generateInvoicesFromActiveContracts,
    onSuccess: async (count) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: invoiceKeys.all }),
        queryClient.invalidateQueries({ queryKey: financialReportKeys.all }),
      ]);
      toast.success(`تم إنشاء ${count} فاتورة`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر إنشاء الفواتير'),
  });
}
