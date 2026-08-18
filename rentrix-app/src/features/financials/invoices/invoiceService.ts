import { fetchAllRows } from '@/lib/paginatedRead';
import { supabase } from '@/lib/supabase';
import type { Invoice, Payment } from '@/types/domain';
import { getInvoiceStatusVariants } from '../components/invoice-status-labels';
import { getSafeRemainingAmount, toFinancialNumber } from '../financialMath';

export type InvoiceStatusFilter = 'unpaid' | 'partial' | 'paid' | 'overdue' | 'all';
export type InvoiceListItem = Invoice & { contracts: { id: string; property_id: string; tenant_id: string } | null };
export type InvoiceDetail = InvoiceListItem & { payments: Payment[] };
export type InvoiceListParams = { status: InvoiceStatusFilter; search?: string };
export type InvoiceSummary = { totalAmount: number; totalTax: number; totalPaid: number; totalRemaining: number; count: number };

const invoiceSelect = '*, contracts:contract_id(id,property_id,tenant_id)';
const invoiceSelectWithContractFilter = '*, contracts:contract_id!inner(id,property_id,tenant_id)';

// `supabase.from(...)` returns a query builder (insert/update/delete); only
// after `.select()` is it a filter builder exposing `.in()`/`.or()`. Typing the
// parameter as the builder that is actually passed in keeps the filter helpers
// type-safe against the generated schema instead of requiring a cast.
function applyStatusFilter<Q extends { in(column: 'status', values: string[]): Q }>(
  query: Q,
  status: InvoiceStatusFilter,
): Q {
  // Cover every casing present in live rows (legacy lowercase + modern UPPERCASE).
  if (status === 'all') return query;
  return query.in('status', getInvoiceStatusVariants(status));
}

type InvoiceGrossInput = Pick<Invoice, 'amount'> & { tax_amount?: Invoice['tax_amount'] | null };

export function getInvoiceGrossAmount(invoice: InvoiceGrossInput): number {
  return toFinancialNumber(invoice.amount) + toFinancialNumber(invoice.tax_amount);
}

export function summarizeInvoices(invoices: Array<Pick<Invoice, 'amount' | 'paid_amount'> & { tax_amount?: Invoice['tax_amount'] | null }>): InvoiceSummary {
  return invoices.reduce(
    (summary, invoice) => {
      const grossAmount = getInvoiceGrossAmount(invoice);
      summary.totalAmount += grossAmount;
      summary.totalTax += toFinancialNumber(invoice.tax_amount);
      summary.totalPaid += toFinancialNumber(invoice.paid_amount);
      summary.totalRemaining += getSafeRemainingAmount(grossAmount, invoice.paid_amount);
      summary.count += 1;
      return summary;
    },
    { totalAmount: 0, totalTax: 0, totalPaid: 0, totalRemaining: 0, count: 0 },
  );
}

function applyInvoiceSearch<Q extends { or(filters: string): Q }>(query: Q, search: string): Q {
  if (!search) return query;
  const escaped = search.replaceAll('%', '\\%').replaceAll('_', '\\_');
  const term = `"%${escaped}%"`;
  return query.or(`id.ilike.${term},status.ilike.${term}`);
}

export async function listInvoices(params: InvoiceStatusFilter | InvoiceListParams): Promise<InvoiceListItem[]> {
  const status = typeof params === 'string' ? params : params.status;
  const search = typeof params === 'string' ? '' : params.search?.trim() ?? '';

  // PostgREST silently caps a single response at 1000 rows. Walking pages
  // keeps list totals from going quietly wrong once a company exceeds that.
  const { rows } = await fetchAllRows<InvoiceListItem>(() => {
    let query = supabase.from('invoices').select(invoiceSelect).is('deleted_at', null).order('due_date', { ascending: false });
    query = applyStatusFilter(query, status);
    query = applyInvoiceSearch(query, search);
    return query as never;
  });
  return rows;
}

/**
 * Property-scoped invoice read. Filters through the contract inner join so
 * the browser never downloads the company-wide invoice table and then
 * discards other properties in memory.
 */
export async function listInvoicesForProperty(propertyId: string): Promise<InvoiceListItem[]> {
  const { rows } = await fetchAllRows<InvoiceListItem>(() =>
    supabase
      .from('invoices')
      .select(invoiceSelectWithContractFilter)
      .is('deleted_at', null)
      .is('contracts.deleted_at', null)
      .eq('contracts.property_id', propertyId)
      .order('due_date', { ascending: false })
      .order('id', { ascending: false }) as never,
  );
  return rows;
}

export async function getInvoiceDetail(invoiceId: string): Promise<InvoiceDetail> {
  const { data: invoice, error: invoiceError } = await supabase.from('invoices').select(invoiceSelect).eq('id', invoiceId).is('deleted_at', null).single().returns<InvoiceListItem>();
  if (invoiceError || !invoice) throw invoiceError ?? new Error('Invoice not found');
  const { data: payments, error: paymentsError } = await supabase.from('payments').select('*').eq('invoice_id', invoiceId).is('deleted_at', null).order('payment_date', { ascending: false }).returns<Payment[]>();
  if (paymentsError) throw paymentsError;
  return Object.assign(invoice as InvoiceListItem, { payments: payments ?? [] });
}

export async function generateInvoicesFromActiveContracts(): Promise<number> {
  const { data, error } = await supabase.rpc('generate_invoices_from_active_contracts').returns<number>();
  if (error) throw error;
  return data ?? 0;
}

export type InvoicePaginationParams = {
  status: InvoiceStatusFilter;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  tenantId?: string;
  propertyId?: string;
  page: number;
  pageSize: number;
};

export type InvoicePage = {
  rows: InvoiceListItem[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Server-paginated invoice loader with optional date, status, tenant, and
 * property filters. Tenant/property filtering is performed by an inner
 * PostgREST relationship join, so the browser never has to prefetch an
 * unbounded contract-id list or send thousands of IDs through `.in(...)`.
 * The exact count and range therefore operate on the same filtered row set.
 */
export async function listInvoicesPaginated(params: InvoicePaginationParams): Promise<InvoicePage> {
  const { status, search, dateFrom, dateTo, tenantId, propertyId, page, pageSize } = params;
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;
  const hasContractFilter = Boolean(tenantId || propertyId);

  let query = supabase
    .from('invoices')
    .select(hasContractFilter ? invoiceSelectWithContractFilter : invoiceSelect, { count: 'exact' })
    .is('deleted_at', null)
    .order('due_date', { ascending: false })
    .order('id', { ascending: false });

  query = applyStatusFilter(query, status);
  if (dateFrom) query = query.gte('issue_date', dateFrom);
  if (dateTo) query = query.lte('issue_date', dateTo);
  if (hasContractFilter) query = query.is('contracts.deleted_at', null);
  if (tenantId) query = query.eq('contracts.tenant_id', tenantId);
  if (propertyId) query = query.eq('contracts.property_id', propertyId);
  query = applyInvoiceSearch(query, search?.trim() ?? '');

  const { data, error, count } = await query.range(from, to).returns<InvoiceListItem[]>();
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0, page, pageSize };
}
