import { supabase } from '@/lib/supabase';
import { getInvoiceStatusVariants } from '../../components/invoice-status-labels';
import type {
  ExpenseReportRow,
  FinancialReportFilters,
  InvoiceReportRow,
  PaymentReportRow,
  PaymentWithInvoiceContext,
} from '../financial-report-rows';
import { hasStatusFilter, uniqueStrings } from '../financial-report-rows';
import { chunkReportIds, fetchCompleteReportRows } from '../report-paginated-read';
import type { ExpenseBreakdownReportFilters } from './report-types';
import { filterExpensesForReport, filterInvoicesForReport, filterPaymentsForReport } from './report-filters';

const invoiceReportSelect = 'id, contract_id, issue_date, due_date, amount, paid_amount, status, deleted_at, contracts:contract_id(id, property_id, tenant_id, unit_id)';
const paymentReportSelect = 'id, invoice_id, amount, payment_date, payment_method, status, deleted_at';
const expenseReportSelect = 'id, property_id, category, amount, expense_date, cost_center_id, deleted_at';

export async function loadInvoices(filters: FinancialReportFilters): Promise<InvoiceReportRow[]> {
  const buildQuery = () => {
    let query = supabase
      .from('invoices')
      .select(invoiceReportSelect)
      .is('deleted_at', null)
      .gte('issue_date', filters.dateFrom)
      .lte('issue_date', filters.dateTo)
      .order('id', { ascending: true });

    // Supabase filters are exact — cover every live casing of the requested status.
    if (hasStatusFilter(filters.status)) query = query.in('status', getInvoiceStatusVariants(filters.status));
    if (filters.contractId) query = query.eq('contract_id', filters.contractId);
    return query;
  };

  const rows = await fetchCompleteReportRows<InvoiceReportRow>(
    () => buildQuery().returns<InvoiceReportRow[]>(),
    'الفواتير',
  );
  return filterInvoicesForReport(rows, filters);
}

type InvoiceContextRow = Pick<InvoiceReportRow, 'id' | 'contract_id' | 'deleted_at'>;
type ContractContextRow = { id: string; property_id: string; tenant_id: string };

async function loadInvoiceContextsById(invoiceIds: string[]): Promise<InvoiceContextRow[]> {
  const rows: InvoiceContextRow[] = [];

  for (const batch of chunkReportIds(invoiceIds)) {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, contract_id, deleted_at')
      .in('id', batch)
      .is('deleted_at', null)
      .order('id', { ascending: true })
      .returns<InvoiceContextRow[]>();
    if (error) throw error;
    rows.push(...(data ?? []));
  }

  return rows;
}

async function loadContractContextsById(contractIds: string[]): Promise<ContractContextRow[]> {
  const rows: ContractContextRow[] = [];

  for (const batch of chunkReportIds(contractIds)) {
    const { data, error } = await supabase
      .from('contracts')
      .select('id, property_id, tenant_id')
      .in('id', batch)
      .is('deleted_at', null)
      .order('id', { ascending: true })
      .returns<ContractContextRow[]>();
    if (error) throw error;
    rows.push(...(data ?? []));
  }

  return rows;
}

async function loadPaymentContexts(payments: PaymentReportRow[]): Promise<PaymentWithInvoiceContext[]> {
  if (payments.length === 0) return [];

  // Hydrate in bounded batches so a large report cannot exceed URL limits or
  // lose context rows at PostgREST's response cap.
  const invoiceIds = uniqueStrings(payments.map((payment) => payment.invoice_id));
  const invoiceRows = await loadInvoiceContextsById(invoiceIds);
  const contractIds = uniqueStrings(invoiceRows.map((invoice) => invoice.contract_id));
  const contractRows = await loadContractContextsById(contractIds);

  const invoiceById = new Map(invoiceRows.map((invoice) => [invoice.id, invoice]));
  const contractById = new Map(contractRows.map((contract) => [contract.id, contract]));

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
  const buildQuery = () => supabase
    .from('payments')
    .select(paymentReportSelect)
    .is('deleted_at', null)
    .gte('payment_date', filters.dateFrom)
    .lte('payment_date', filters.dateTo)
    .order('id', { ascending: true });

  const rows = await fetchCompleteReportRows<PaymentReportRow>(
    () => buildQuery().returns<PaymentReportRow[]>(),
    'المدفوعات',
  );
  const contexts = await loadPaymentContexts(rows);
  return filterPaymentsForReport(contexts, filters);
}

export async function loadExpenses(filters: ExpenseBreakdownReportFilters): Promise<ExpenseReportRow[]> {
  const buildQuery = () => {
    let query = supabase
      .from('expenses')
      .select(expenseReportSelect)
      .is('deleted_at', null)
      .gte('expense_date', filters.dateFrom)
      .lte('expense_date', filters.dateTo)
      .order('id', { ascending: true });

    if (filters.propertyId) query = query.eq('property_id', filters.propertyId);
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.costCenterId) query = query.eq('cost_center_id', filters.costCenterId);
    return query;
  };

  const rows = await fetchCompleteReportRows<ExpenseReportRow>(
    () => buildQuery().returns<ExpenseReportRow[]>(),
    'المصروفات',
  );
  return filterExpensesForReport(rows, filters);
}
