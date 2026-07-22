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

function applyStatusFilter(query: ReturnType<typeof supabase.from>, status: InvoiceStatusFilter) {
  // Cover every casing present in live rows (legacy lowercase + modern UPPERCASE).
  if (status === 'all') return query;
  return query.in('status', getInvoiceStatusVariants(status));
}

export function getInvoiceGrossAmount(invoice: Pick<Invoice, 'amount'> & Partial<Pick<Invoice, 'tax_amount'>>): number {
  return toFinancialNumber(invoice.amount) + toFinancialNumber(invoice.tax_amount);
}

export function summarizeInvoices(invoices: Array<Pick<Invoice, 'amount' | 'paid_amount'> & Partial<Pick<Invoice, 'tax_amount'>>>): InvoiceSummary {
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

export async function listInvoices(params: InvoiceStatusFilter | InvoiceListParams): Promise<InvoiceListItem[]> {
  const status = typeof params === 'string' ? params : params.status;
  const search = typeof params === 'string' ? '' : params.search?.trim() ?? '';
  let query = supabase.from('invoices').select(invoiceSelect).is('deleted_at', null).order('due_date', { ascending: false });

  query = applyStatusFilter(query, status);

  if (search) {
    const escaped = search.replaceAll('%', '\\%').replaceAll('_', '\\_');
    const term = `"%${escaped}%"`;
    query = query.or(`id.ilike.${term},status.ilike.${term}`);
  }

  const { data, error } = await query.returns<InvoiceListItem[]>();
  if (error) throw error;
  return data ?? [];
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
 * Resolve contracts matching tenant/property filters so invoices can be
 * server-filtered by tenant or property (invoices reference contracts, not
 * tenants/properties directly). Returns null when no tenant/property filter is
 * active, and a non-matching sentinel when filters match no contract so the
 * caller's `.in('contract_id', ...)` returns an empty page rather than all rows.
 */
async function resolveContractIds(filters: { tenantId?: string; propertyId?: string }): Promise<string[] | null> {
  if (!filters.tenantId && !filters.propertyId) return null;

  let query = supabase.from('contracts').select('id').is('deleted_at', null);
  if (filters.tenantId) query = query.eq('tenant_id', filters.tenantId);
  if (filters.propertyId) query = query.eq('property_id', filters.propertyId);

  const { data, error } = await query.returns<{ id: string }[]>();
  if (error) throw error;
  const ids = (data ?? []).map((row) => row.id);
  return ids.length > 0 ? ids : ['__no_matching_contract__'];
}

/**
 * Server-paginated invoice loader with optional date, status, tenant, and
 * property filters. Range queries run against the filtered set so the returned
 * `total` reflects the full filtered result, enabling correct pagination.
 */
export async function listInvoicesPaginated(params: InvoicePaginationParams): Promise<InvoicePage> {
  const { status, search, dateFrom, dateTo, tenantId, propertyId, page, pageSize } = params;
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;

  const contractIds = await resolveContractIds({ tenantId, propertyId });

  let query = supabase
    .from('invoices')
    .select(invoiceSelect, { count: 'exact' })
    .is('deleted_at', null)
    .order('due_date', { ascending: false });

  query = applyStatusFilter(query, status);
  if (dateFrom) query = query.gte('issue_date', dateFrom);
  if (dateTo) query = query.lte('issue_date', dateTo);
  if (contractIds) query = query.in('contract_id', contractIds);

  if (search) {
    const escaped = search.replaceAll('%', '\\%').replaceAll('_', '\\_');
    const term = `"%${escaped}%"`;
    query = query.or(`id.ilike.${term},status.ilike.${term}`);
  }

  const { data, error, count } = await query.range(from, to).returns<InvoiceListItem[]>();
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0, page, pageSize };
}
