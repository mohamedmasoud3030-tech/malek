import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { defineEntityKeys } from '@/lib/query-keys';
import { financialReportKeys } from '../reports/useFinancialReports';
import { generateInvoicesFromActiveContracts, getInvoiceDetail, listDossierInvoicesForContracts, listInvoices, listInvoicesPaginated, type DossierInvoiceRow, type InvoiceListParams, type InvoicePaginationParams, type InvoiceStatusFilter } from './invoiceService';

const invoiceBase = defineEntityKeys('invoices');

export const invoiceKeys = {
  ...invoiceBase,
  paginated: (params: InvoicePaginationParams) => [...invoiceBase.lists(), 'paginated', params] as const,
  /** Contract-scoped dossier rows for a register page. `contractIds` is already deduped + sorted. */
  dossierForContracts: (contractIds: readonly string[]) => [...invoiceBase.lists(), 'dossier-for-contracts', contractIds] as const,
} as const;

/**
 * Contract ids are normalised before they become a query key: duplicates would
 * otherwise create two cache entries for the same visible page, and an unstable
 * input order would refetch on every render. Sorting + de-duplication makes the
 * key deterministic, so one page of contracts always resolves to one read.
 */
export function normalizeContractInvoiceQueryIds(contractIds: readonly string[]): string[] {
  return [...new Set(contractIds.filter((id): id is string => typeof id === 'string' && id.length > 0))].sort();
}

/**
 * Max contract ids per `.in()` filter. A register can hold thousands of rows
 * when client-side filters widen the read, and a single URL carrying that many
 * UUIDs would be rejected — so the batch is chunked into a bounded number of
 * parallel reads. This is still one logical batch, never one query per row.
 */
const CONTRACT_INVOICE_BATCH_LIMIT = 250;

async function listDossierInvoicesInBatches(contractIds: readonly string[]): Promise<DossierInvoiceRow[]> {
  const batches: string[][] = [];
  for (let index = 0; index < contractIds.length; index += CONTRACT_INVOICE_BATCH_LIMIT) {
    batches.push(contractIds.slice(index, index + CONTRACT_INVOICE_BATCH_LIMIT));
  }
  const results = await Promise.all(batches.map((batch) => listDossierInvoicesForContracts(batch)));
  return results.flat();
}

/**
 * Bounded, cached invoice context for a whole register page.
 *
 * Registers need payment attention per row but must not fan out into N+1
 * per-row queries. This reuses the canonical dossier-scoped read (no new RPC,
 * no schema change, RLS still enforced by the same client) and lets React Query
 * deduplicate concurrent callers that show the same page.
 */
export function useDossierInvoicesForContracts(contractIds: readonly string[]) {
  const stableContractIds = useMemo(() => normalizeContractInvoiceQueryIds(contractIds), [contractIds]);

  return useQuery({
    queryKey: invoiceKeys.dossierForContracts(stableContractIds),
    queryFn: () => listDossierInvoicesInBatches(stableContractIds),
    // Nothing to read: never issue an empty `in()` query.
    enabled: stableContractIds.length > 0,
    staleTime: 30_000,
  });
}

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
