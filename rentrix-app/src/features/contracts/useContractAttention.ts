/**
 * Contracts register attention state.
 *
 * Presentation-only glue between the canonical batched invoice read and the
 * domain attention projection. It owns no business rule: attention semantics
 * live in `contract-attention.ts`, invoice normalisation in financials, and the
 * next step in the lifecycle rules. No mutation is performed here.
 *
 * Data flow for one register page:
 *   contracts (already loaded) → deduped ids → ONE batched invoice query
 *   → grouped by contract → attention per contract → summary counts.
 */
import { useMemo } from 'react';
import { getTodayLocalDateString } from '@/features/financials/financials-date-utils';
import { useDossierInvoicesForContracts } from '@/features/financials/invoices/useInvoices';
import {
  deriveContractAttention,
  EMPTY_CONTRACT_ATTENTION_SUMMARY,
  groupInvoicesByContractId,
  summarizeContractAttention,
  type ContractAttention,
  type ContractAttentionSummary,
} from './contract-attention';
import type { ContractListItem } from './services/contractService';

export type ContractAttentionState = Readonly<{
  attentionByContractId: ReadonlyMap<string, ContractAttention>;
  summary: ContractAttentionSummary;
  /** True while the single batched invoice read is still outstanding. */
  isLoadingInvoiceContext: boolean;
  /** True when the invoice read failed: payment attention is unknown, not clean. */
  hasInvoiceContextError: boolean;
}>;

export function useContractAttention(
  contracts: readonly ContractListItem[],
  options: Readonly<{ today?: string }> = {},
): ContractAttentionState {
  // Explicit date keeps derivation deterministic and lets tests pin "today".
  const today = options.today ?? getTodayLocalDateString();
  const contractIds = useMemo(() => contracts.map((contract) => contract.id), [contracts]);
  const invoicesQuery = useDossierInvoicesForContracts(contractIds);

  const invoiceRows = invoicesQuery.data ?? [];
  const hasInvoiceContextError = invoicesQuery.isError;
  const invoiceContextLoaded = contractIds.length === 0 || (!hasInvoiceContextError && invoicesQuery.data !== undefined);
  const isLoadingInvoiceContext = contractIds.length > 0 && !hasInvoiceContextError && invoicesQuery.data === undefined;

  const attentionByContractId = useMemo(() => {
    if (contracts.length === 0) return new Map<string, ContractAttention>();
    const invoicesByContractId = groupInvoicesByContractId(invoiceRows);
    return new Map<string, ContractAttention>(
      contracts.map((contract) => [
        contract.id,
        deriveContractAttention(contract, invoicesByContractId.get(contract.id) ?? [], today, { invoiceContextLoaded }),
      ]),
    );
  }, [contracts, invoiceContextLoaded, invoiceRows, today]);

  const summary = useMemo(
    () => (contracts.length === 0 ? EMPTY_CONTRACT_ATTENTION_SUMMARY : summarizeContractAttention(attentionByContractId.values())),
    [attentionByContractId, contracts.length],
  );

  return { attentionByContractId, summary, isLoadingInvoiceContext, hasInvoiceContextError };
}
