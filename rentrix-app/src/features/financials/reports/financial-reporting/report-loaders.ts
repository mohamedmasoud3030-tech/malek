import { fetchAllRows } from '@/lib/paginatedRead';
import { supabase } from '@/lib/supabase';
import { getInvoiceStatusVariants } from '../../components/invoice-status-labels';
import type { ExpenseReportRow, FinancialReportFilters, InvoiceReportRow, PaymentReportRow, PaymentWithInvoiceContext } from '../financial-report-rows';
import { hasStatusFilter, uniqueStrings } from '../financial-report-rows';
import type { ExpenseBreakdownReportFilters } from './report-types';
import { filterExpensesForReport, filterInvoicesForReport, filterPaymentsForReport } from './report-filters';

const invoiceReportSelect = 'id, contract_id, issue_date, due_date, amount, paid_amount, status, deleted_at, contracts:contract_id(id, property_id, tenant_id, unit_id)';
const paymentReportSelect = 'id, invoice_id, amount, payment_date, payment_method, status, deleted_at';
const expenseReportSelect = 'id, property_id, category, amount, expense_date, deleted_at';

export async function loadInvoices(filters: FinancialReportFilters): Promise<InvoiceReportRow[]> {
  let query = supabase
    .from('invoices')
    .select(invoiceReportSelect)
    .is('deleted_at', null)
    .gte('issue_date', filters.dateFrom)
    .lte('issue_date', filters.dateTo);

  // Supabase filters are exact — cover every live casing of the requested status.
  if (hasStatusFilter(filters.status)) query = query.in('status', getInvoiceStatusVariants(filters.status));
  if (filters.contractId) query = query.eq('contract_id', filters.contractId);

  const { data, error } = await query.returns<InvoiceReportRow[]>();
  if (error) throw error;
  return filterInvoicesForReport(data ?? [], filters);
}

async function loadPaymentContexts(payments: PaymentReportRow[]): Promise<PaymentWithInvoiceContext[]> {
  if (payments.length === 0) return [];

  // Batched hydration only: one invoice lookup for all payment invoice ids, then
  // one contract lookup for all related contract ids. Do not add per-payment
  // queries here.
  const invoiceIds = uniqueStrings(payments.map((payment) => payment.invoice_id));
  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('id, contract_id, deleted_at')
    .in('id', invoiceIds)
    .is('deleted_at', null)
    .returns<Array<Pick<InvoiceReportRow, 'id' | 'contract_id' | 'deleted_at'>>>();
  if (invoicesError) throw invoicesError;

  const invoiceRows = invoices ?? [];
  const contractIds = uniqueStrings(invoiceRows.map((invoice) => invoice.contract_id));
  const { data: contracts, error: contractsError } = contractIds.length > 0
    ? await supabase
      .from('contracts')
      .select('id, property_id, tenant_id')
      .in('id', contractIds)
      .is('deleted_at', null)
      .returns<Array<{ id: string; property_id: string; tenant_id: string }>>()
    : { data: [], error: null };
  if (contractsError) throw contractsError;

  const invoiceById = new Map(invoiceRows.map((invoice) => [invoice.id, invoice]));
  const contractById = new Map((contracts ?? []).map((contract) => [contract.id, contract]));

  return payments.map((payment) => {
    const invoice = payment.invoice_id ? (invoiceById.get(payment.invoice_id) ?? null) : null;
    return {
      ...payment,
      invoice,
      contract: invoice?.contract_id ? contractById.get(invoice.contract_id) ?? null : null,
    };
  });
}

export async function loadPayments(filters: FinancialReportFilters): Promise<PaymentWithInvoiceContext[]> {
  const { data, error } = await supabase
    .from('payments')
    .select(paymentReportSelect)
    .is('deleted_at', null)
    .gte('payment_date', filters.dateFrom)
    .lte('payment_date', filters.dateTo)
    .returns<PaymentReportRow[]>();
  if (error) throw error;

  const contexts = await loadPaymentContexts(data ?? []);
  return filterPaymentsForReport(contexts, filters);
}

export async function loadExpenses(filters: ExpenseBreakdownReportFilters): Promise<ExpenseReportRow[]> {
  const buildQuery = () => {
    let query = supabase
      .from('expenses')
      .select(expenseReportSelect)
      .is('deleted_at', null)
      .gte('expense_date', filters.dateFrom)
      .lte('expense_date', filters.dateTo);

    if (filters.propertyId) query = query.eq('property_id', filters.propertyId);
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.costCenterId) query = query.eq('cost_center_id', filters.costCenterId);
    return query;
  };

  // PostgREST silently caps a single response (default 1000 rows) — a wide
  // date range across a large portfolio could truncate the expense totals in
  // every report that reads this loader. Page forward until exhaustion.
  const { rows } = await fetchAllRows<ExpenseReportRow>(() => buildQuery().returns<ExpenseReportRow[]>());

  return filterExpensesForReport(rows, filters);
}
