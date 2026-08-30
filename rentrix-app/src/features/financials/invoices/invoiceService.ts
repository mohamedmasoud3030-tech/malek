import { fetchAllRows } from '@/lib/paginatedRead';
import { supabase } from '@/lib/supabase';
import type { Invoice, Payment, Person, Property, Unit } from '@/types/domain';
import { getInvoiceStatusVariants } from '../components/invoice-status-labels';
import { getSafeRemainingAmount, toFinancialNumber } from '../financialMath';

export type InvoiceStatusFilter = 'unpaid' | 'partial' | 'paid' | 'overdue' | 'all';

export type InvoiceContractContext = {
  id: string;
  property_id: string;
  tenant_id: string;
  properties: Pick<Property, 'id' | 'title'> | null;
  units: Pick<Unit, 'id' | 'unit_number'> | null;
  people: Pick<Person, 'id' | 'full_name' | 'phone'> | null;
};

export type InvoiceListItem = Invoice & { contracts: InvoiceContractContext | null };
export type InvoiceDetail = InvoiceListItem & { payments: Payment[] };
export type InvoiceListParams = { status: InvoiceStatusFilter; search?: string };
export type InvoiceSummary = { totalAmount: number; totalTax: number; totalPaid: number; totalRemaining: number; count: number };

const invoiceContractContextSelect =
  'id,property_id,tenant_id,properties:properties!contracts_property_id_fkey(id,title),units:units!contracts_unit_id_fkey(id,unit_number),people:people!contracts_tenant_id_fkey(id,full_name,phone)';
const invoiceSelect = `*, contracts:contract_id(${invoiceContractContextSelect})`;
const invoiceSelectWithContractFilter = `*, contracts:contract_id!inner(${invoiceContractContextSelect})`;

function applyStatusFilter<Q extends { in(column: 'status', values: string[]): Q }>(
  query: Q,
  status: InvoiceStatusFilter,
): Q {
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

function escapeOrSearch(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('%', '\\%')
    .replaceAll('_', '\\_')
    .replaceAll('"', '\\"')
    .replaceAll(',', '\\,');
}

function applyInvoiceSearch<Q extends { or(filters: string): Q }>(
  query: Q,
  search: string,
  contextContractIds: readonly string[] = [],
): Q {
  if (!search) return query;
  const escaped = escapeOrSearch(search);
  const term = `"%${escaped}%"`;
  const filters = [
    `reference.ilike.${term}`,
    `status.ilike.${term}`,
  ];
  if (/^[0-9a-f-]{36}$/i.test(search)) filters.push(`id.eq.${search}`);
  if (contextContractIds.length > 0) {
    filters.push(`contract_id.in.(${contextContractIds.join(',')})`);
  }
  return query.or(filters.join(','));
}

export async function listInvoices(params: InvoiceStatusFilter | InvoiceListParams): Promise<InvoiceListItem[]> {
  const status = typeof params === 'string' ? params : params.status;
  const search = typeof params === 'string' ? '' : params.search?.trim() ?? '';
  const { rows } = await fetchAllRows<InvoiceListItem>(() => {
    let query = supabase.from('invoices').select(invoiceSelect).is('deleted_at', null).order('due_date', { ascending: false });
    query = applyStatusFilter(query, status);
    query = applyInvoiceSearch(query, search);
    return query as never;
  });
  return rows;
}

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

export type DossierInvoiceRow = Readonly<{
  id: string;
  reference: string | null;
  contract_id: string;
  status: string;
  amount: number;
  paid_amount: number;
  due_date: string;
}>;

/**
 * Dossier-scoped invoice read shared by the person and tenant dossier loaders.
 *
 * Both prior implementations queried the identical seven columns with the same
 * due_date-desc ordering; this is their canonical home (invoices are owned by
 * the financials/invoices feature). Kept separate from listInvoices* because
 * dossiers need a bounded contract-scoped list without search/status filters.
 */
export async function listDossierInvoicesForContracts(contractIds: readonly string[]): Promise<DossierInvoiceRow[]> {
  if (contractIds.length === 0) return [];
  const { data, error } = await supabase
    .from('invoices')
    .select('id,reference,contract_id,due_date,amount,paid_amount,status')
    .in('contract_id', contractIds as string[])
    .is('deleted_at', null)
    .order('due_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as DossierInvoiceRow[];
}

export async function getInvoiceDetail(invoiceId: string): Promise<InvoiceDetail> {
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select(invoiceSelect)
    .eq('id', invoiceId)
    .is('deleted_at', null)
    .maybeSingle()
    .returns<InvoiceListItem>();
  if (invoiceError) throw invoiceError;
  const invoiceRow = (Array.isArray(invoice) ? invoice[0] ?? null : invoice) as InvoiceListItem | null;
  if (!invoiceRow) throw new Error('الفاتورة غير موجودة أو غير متاحة لصلاحياتك.');
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .is('deleted_at', null)
    .order('payment_date', { ascending: false })
    .returns<Payment[]>();
  if (paymentsError) throw paymentsError;
  return Object.assign(invoiceRow, { payments: payments ?? [] });
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
  /** Contract ids whose tenant/property/unit context matched the unified search. */
  contextContractIds?: readonly string[];
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
 * Server-paginated invoice loader with optional date, status, tenant, property,
 * and task-search context. Search remains one user action while related-party
 * matches are resolved to canonical contract ids before the server query.
 */
export async function listInvoicesPaginated(params: InvoicePaginationParams): Promise<InvoicePage> {
  const { status, search, dateFrom, dateTo, tenantId, propertyId, contextContractIds = [], page, pageSize } = params;
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
  query = applyInvoiceSearch(query, search?.trim() ?? '', contextContractIds);

  const { data, error, count } = await query.range(from, to).returns<InvoiceListItem[]>();
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0, page, pageSize };
}
