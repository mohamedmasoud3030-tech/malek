import { supabase } from '@/lib/supabase';
import type { Payment } from '@/types/domain';
import { sumFinancialValues, toFinancialNumber } from '../financialMath';
import {
  type ExpenseReportRow,
  type FinancialReportFilters,
  type InvoiceReportRow,
  type PaymentReportRow,
  type PaymentWithInvoiceContext,
  type PropertyContext,
  getInvoiceReportGrossAmount,
  getInvoiceReportRemainingAmount,
  hasStatusFilter,
  isWithinDateRange,
  loadPropertiesById,
  matchesInvoiceContext,
  matchesPaymentContext,
  uniqueStrings,
} from './financial-report-rows';

export type { FinancialReportFilters, FinancialReportStatus } from './financial-report-rows';

export type InvoiceTotalsReport = {
  totalAmount: number;
  totalPaid: number;
  totalOutstanding: number;
  invoicesCount: number;
};

export type PaymentTotalsReport = {
  totalPaid: number;
  paymentsCount: number;
};

export type ExpenseTotalsReport = {
  totalExpenses: number;
  expensesCount: number;
};

export type OutstandingBalanceReport = {
  totalOutstanding: number;
  invoicesCount: number;
};

export type CollectionSummaryReport = {
  invoiced: number;
  paid: number;
  outstanding: number;
  receiptsCount: number;
  invoicesCount: number;
  expensesTotal: number;
};

export type PaymentMethodTotals = Record<Payment['payment_method'], number>;

export type DailyCollectionReportRow = {
  paymentDate: string;
  totalPaid: number;
  paymentsCount: number;
  methodTotals: PaymentMethodTotals;
};

export type DailyCollectionReport = {
  rows: DailyCollectionReportRow[];
  grandTotal: number;
  paymentsCount: number;
  methodTotals: PaymentMethodTotals;
};

export type FinancialPeriodSummaryReport = {
  invoiced: number;
  paid: number;
  outstanding: number;
  expenses: number;
  netCash: number;
  invoicesCount: number;
  paymentsCount: number;
  expensesCount: number;
};

export type FinancialCashflowReportRow = {
  month: string;
  revenue: number;
  expenses: number;
};

export type FinancialCashflowReport = {
  rows: FinancialCashflowReportRow[];
  totalRevenue: number;
  totalExpenses: number;
};

export type ExpenseBreakdownReportFilters = FinancialReportFilters & {
  category?: string;
};

export type ExpenseBreakdownCategoryRow = {
  category: string;
  total: number;
  count: number;
};

export type ExpenseBreakdownPropertyRow = {
  propertyId: string;
  propertyTitle: string | null;
  total: number;
  count: number;
};

export type ExpenseBreakdownReport = {
  totalExpenses: number;
  expensesCount: number;
  byCategory: ExpenseBreakdownCategoryRow[];
  byProperty: ExpenseBreakdownPropertyRow[];
};

// Foundation note: report loaders below intentionally use bounded, batched
// current-app hydration. Base invoice/payment/expense queries are constrained by
// required date filters first, then related invoices/contracts are fetched by
// grouped id lists to avoid N+1 requests. This keeps PR #453 merge-safe while
// schema relationships settle; these loaders can later move behind Supabase
// views/RPCs or typed nested relational selects once those relationships are
// confirmed.
const invoiceReportSelect = 'id, contract_id, issue_date, due_date, amount, paid_amount, status, deleted_at, contracts:contract_id(id, property_id, tenant_id, unit_id)';
const paymentReportSelect = 'id, invoice_id, amount, payment_date, payment_method, status, deleted_at';
const expenseReportSelect = 'id, property_id, category, amount, expense_date, deleted_at';

function matchesExpenseFilters(expense: ExpenseReportRow, filters: ExpenseBreakdownReportFilters) {
  if (expense.deleted_at) return false;
  if (!isWithinDateRange(expense.expense_date, filters)) return false;
  if (filters.propertyId && expense.property_id !== filters.propertyId) return false;
  if (filters.category && expense.category !== filters.category) return false;
  if (filters.costCenterId && expense.cost_center_id !== filters.costCenterId) return false;
  return true;
}

export function filterInvoicesForReport(invoices: InvoiceReportRow[], filters: FinancialReportFilters) {
  return invoices.filter((invoice) => {
    // These guards duplicate the Supabase filters on purpose for direct helper
    // callers/tests and as a defensive boundary around manually hydrated rows.
    if (invoice.deleted_at) return false;
    if (!isWithinDateRange(invoice.issue_date, filters)) return false;
    if (hasStatusFilter(filters.status) && invoice.status !== filters.status) return false;
    return matchesInvoiceContext(invoice, filters);
  });
}

export function filterPaymentsForReport(payments: PaymentWithInvoiceContext[], filters: FinancialReportFilters) {
  return payments.filter((payment) => {
    if (payment.deleted_at) return false;
    if (payment.status?.toUpperCase() === 'VOID') return false;
    if (!isWithinDateRange(payment.payment_date, filters)) return false;
    return matchesPaymentContext(payment, filters);
  });
}

export function filterExpensesForReport(expenses: ExpenseReportRow[], filters: ExpenseBreakdownReportFilters) {
  return expenses.filter((expense) => matchesExpenseFilters(expense, filters));
}

export function summarizeInvoiceTotals(invoices: Array<Pick<InvoiceReportRow, 'amount' | 'paid_amount'> & Partial<Pick<InvoiceReportRow, 'tax_amount'>>>): InvoiceTotalsReport {
  return {
    totalAmount: sumFinancialValues(invoices.map((invoice) => getInvoiceReportGrossAmount(invoice))),
    totalPaid: sumFinancialValues(invoices.map((invoice) => invoice.paid_amount)),
    totalOutstanding: sumFinancialValues(invoices.map((invoice) => getInvoiceReportRemainingAmount(invoice))),
    invoicesCount: invoices.length,
  };
}

export function summarizePaymentTotals(payments: Pick<PaymentReportRow, 'amount'>[]): PaymentTotalsReport {
  return {
    totalPaid: sumFinancialValues(payments.map((payment) => payment.amount)),
    paymentsCount: payments.length,
  };
}

export function summarizeExpenseTotals(expenses: Pick<ExpenseReportRow, 'amount'>[]): ExpenseTotalsReport {
  return {
    totalExpenses: sumFinancialValues(expenses.map((expense) => expense.amount)),
    expensesCount: expenses.length,
  };
}

export function summarizeOutstandingBalance(invoices: Array<Pick<InvoiceReportRow, 'amount' | 'paid_amount'> & Partial<Pick<InvoiceReportRow, 'tax_amount'>>>): OutstandingBalanceReport {
  const outstandingInvoices = invoices.filter((invoice) => getInvoiceReportRemainingAmount(invoice) > 0);
  return {
    totalOutstanding: sumFinancialValues(outstandingInvoices.map((invoice) => getInvoiceReportRemainingAmount(invoice))),
    invoicesCount: outstandingInvoices.length,
  };
}

export function summarizeCollectionReport(params: {
  invoiceTotals: InvoiceTotalsReport;
  paymentTotals: PaymentTotalsReport;
  outstandingBalance: OutstandingBalanceReport;
  expenseTotals: ExpenseTotalsReport;
}): CollectionSummaryReport {
  return {
    invoiced: toFinancialNumber(params.invoiceTotals.totalAmount),
    paid: toFinancialNumber(params.paymentTotals.totalPaid),
    outstanding: toFinancialNumber(params.outstandingBalance.totalOutstanding),
    receiptsCount: params.paymentTotals.paymentsCount,
    invoicesCount: params.invoiceTotals.invoicesCount,
    expensesTotal: toFinancialNumber(params.expenseTotals.totalExpenses),
  };
}

function createEmptyPaymentMethodTotals(): PaymentMethodTotals {
  return {
    cash: 0,
    bank_transfer: 0,
    card: 0,
    check: 0,
    other: 0,
  };
}

function addPaymentAmountByMethod(totals: PaymentMethodTotals, method: Payment['payment_method'], amount: unknown) {
  totals[method] = toFinancialNumber(totals[method]) + toFinancialNumber(amount);
}

export function summarizeDailyCollectionReport(payments: Pick<PaymentReportRow, 'amount' | 'payment_date' | 'payment_method'>[]): DailyCollectionReport {
  const grandMethodTotals = createEmptyPaymentMethodTotals();
  const rowsByDate = new Map<string, DailyCollectionReportRow>();

  for (const payment of payments) {
    const paymentDate = payment.payment_date;
    if (!paymentDate) continue;

    const amount = toFinancialNumber(payment.amount);
    const row = rowsByDate.get(paymentDate) ?? {
      paymentDate,
      totalPaid: 0,
      paymentsCount: 0,
      methodTotals: createEmptyPaymentMethodTotals(),
    };

    row.totalPaid = toFinancialNumber(row.totalPaid) + amount;
    row.paymentsCount += 1;
    addPaymentAmountByMethod(row.methodTotals, payment.payment_method, amount);
    rowsByDate.set(paymentDate, row);

    addPaymentAmountByMethod(grandMethodTotals, payment.payment_method, amount);
  }

  const rows = Array.from(rowsByDate.values()).sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
  return {
    rows,
    grandTotal: sumFinancialValues(rows.map((row) => row.totalPaid)),
    paymentsCount: rows.reduce((count, row) => count + row.paymentsCount, 0),
    methodTotals: grandMethodTotals,
  };
}

export function summarizeFinancialPeriodSummaryReport(params: {
  invoiceTotals: InvoiceTotalsReport;
  paymentTotals: PaymentTotalsReport;
  outstandingBalance: OutstandingBalanceReport;
  expenseTotals: ExpenseTotalsReport;
}): FinancialPeriodSummaryReport {
  const paid = toFinancialNumber(params.paymentTotals.totalPaid);
  const expenses = toFinancialNumber(params.expenseTotals.totalExpenses);

  return {
    invoiced: toFinancialNumber(params.invoiceTotals.totalAmount),
    paid,
    outstanding: toFinancialNumber(params.outstandingBalance.totalOutstanding),
    expenses,
    netCash: paid - expenses,
    invoicesCount: params.invoiceTotals.invoicesCount,
    paymentsCount: params.paymentTotals.paymentsCount,
    expensesCount: params.expenseTotals.expensesCount,
  };
}

export function summarizeFinancialCashflowReport(params: {
  payments: Pick<PaymentReportRow, 'amount' | 'payment_date'>[];
  expenses: Pick<ExpenseReportRow, 'amount' | 'expense_date'>[];
}): FinancialCashflowReport {
  const rowsByMonth = new Map<string, FinancialCashflowReportRow>();

  for (const payment of params.payments) {
    if (!payment.payment_date) continue;
    const month = payment.payment_date.slice(0, 7);
    const row = rowsByMonth.get(month) ?? { month, revenue: 0, expenses: 0 };
    row.revenue = toFinancialNumber(row.revenue) + toFinancialNumber(payment.amount);
    rowsByMonth.set(month, row);
  }

  for (const expense of params.expenses) {
    if (!expense.expense_date) continue;
    const month = expense.expense_date.slice(0, 7);
    const row = rowsByMonth.get(month) ?? { month, revenue: 0, expenses: 0 };
    row.expenses = toFinancialNumber(row.expenses) + toFinancialNumber(expense.amount);
    rowsByMonth.set(month, row);
  }

  const rows = Array.from(rowsByMonth.values()).sort((a, b) => a.month.localeCompare(b.month));
  return {
    rows,
    totalRevenue: sumFinancialValues(rows.map((row) => row.revenue)),
    totalExpenses: sumFinancialValues(rows.map((row) => row.expenses)),
  };
}

export function summarizeExpenseBreakdownReport(
  expenses: Pick<ExpenseReportRow, 'amount' | 'category' | 'property_id'>[],
  propertiesById: Map<string, PropertyContext> = new Map(),
  includePropertyBreakdown = true,
): ExpenseBreakdownReport {
  const categoryRowsByKey = new Map<string, ExpenseBreakdownCategoryRow>();
  const propertyRowsById = new Map<string, ExpenseBreakdownPropertyRow>();

  for (const expense of expenses) {
    const amount = toFinancialNumber(expense.amount);
    const category = expense.category?.trim() || 'غير مصنف';
    const categoryRow = categoryRowsByKey.get(category) ?? { category, total: 0, count: 0 };
    categoryRow.total = toFinancialNumber(categoryRow.total) + amount;
    categoryRow.count += 1;
    categoryRowsByKey.set(category, categoryRow);

    if (includePropertyBreakdown) {
      const property = propertiesById.get(expense.property_id);
      const propertyRow = propertyRowsById.get(expense.property_id) ?? {
        propertyId: expense.property_id,
        propertyTitle: property?.title ?? null,
        total: 0,
        count: 0,
      };
      propertyRow.total = toFinancialNumber(propertyRow.total) + amount;
      propertyRow.count += 1;
      propertyRowsById.set(expense.property_id, propertyRow);
    }
  }

  const byCategory = Array.from(categoryRowsByKey.values()).sort((a, b) => a.category.localeCompare(b.category, 'ar'));
  const byProperty = Array.from(propertyRowsById.values()).sort((a, b) => (a.propertyTitle ?? a.propertyId).localeCompare(b.propertyTitle ?? b.propertyId, 'ar'));

  return {
    totalExpenses: sumFinancialValues(expenses.map((expense) => expense.amount)),
    expensesCount: expenses.length,
    byCategory,
    byProperty,
  };
}

async function loadInvoices(filters: FinancialReportFilters): Promise<InvoiceReportRow[]> {
  let query = supabase
    .from('invoices')
    .select(invoiceReportSelect)
    .is('deleted_at', null)
    .gte('issue_date', filters.dateFrom)
    .lte('issue_date', filters.dateTo);

  if (hasStatusFilter(filters.status)) query = query.eq('status', filters.status);
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

async function loadPayments(filters: FinancialReportFilters): Promise<PaymentWithInvoiceContext[]> {
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

async function loadExpenses(filters: ExpenseBreakdownReportFilters): Promise<ExpenseReportRow[]> {
  let query = supabase
    .from('expenses')
    .select(expenseReportSelect)
    .is('deleted_at', null)
    .gte('expense_date', filters.dateFrom)
    .lte('expense_date', filters.dateTo);

  if (filters.propertyId) query = query.eq('property_id', filters.propertyId);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.costCenterId) query = query.eq('cost_center_id', filters.costCenterId);

  const { data, error } = await query.returns<ExpenseReportRow[]>();
  if (error) throw error;

  return filterExpensesForReport(data ?? [], filters);
}

export async function getInvoiceTotalsReport(filters: FinancialReportFilters): Promise<InvoiceTotalsReport> {
  const invoices = await loadInvoices(filters);
  return summarizeInvoiceTotals(invoices);
}

export async function getPaymentTotalsReport(filters: FinancialReportFilters): Promise<PaymentTotalsReport> {
  const payments = await loadPayments(filters);
  return summarizePaymentTotals(payments);
}

export async function getExpenseTotalsReport(filters: FinancialReportFilters): Promise<ExpenseTotalsReport> {
  const expenses = await loadExpenses(filters);
  return summarizeExpenseTotals(expenses);
}

export async function getOutstandingBalanceReport(filters: FinancialReportFilters): Promise<OutstandingBalanceReport> {
  const invoices = await loadInvoices(filters);
  return summarizeOutstandingBalance(invoices);
}

export async function getCollectionSummaryReport(filters: FinancialReportFilters): Promise<CollectionSummaryReport> {
  const [invoices, payments, expenses] = await Promise.all([
    loadInvoices(filters),
    loadPayments(filters),
    loadExpenses(filters),
  ]);

  return summarizeCollectionReport({
    invoiceTotals: summarizeInvoiceTotals(invoices),
    // Receipts are currently read-only projections of posted payments, so the
    // collection summary uses payment totals as the canonical receipt total.
    paymentTotals: summarizePaymentTotals(payments),
    outstandingBalance: summarizeOutstandingBalance(invoices),
    expenseTotals: summarizeExpenseTotals(expenses),
  });
}

export async function getDailyCollectionReport(filters: FinancialReportFilters): Promise<DailyCollectionReport> {
  const payments = await loadPayments(filters);
  return summarizeDailyCollectionReport(payments);
}

export async function getFinancialPeriodSummaryReport(filters: FinancialReportFilters): Promise<FinancialPeriodSummaryReport> {
  const [invoices, payments, expenses] = await Promise.all([
    loadInvoices(filters),
    loadPayments(filters),
    loadExpenses(filters),
  ]);

  return summarizeFinancialPeriodSummaryReport({
    invoiceTotals: summarizeInvoiceTotals(invoices),
    paymentTotals: summarizePaymentTotals(payments),
    outstandingBalance: summarizeOutstandingBalance(invoices),
    expenseTotals: summarizeExpenseTotals(expenses),
  });
}

export async function getFinancialCashflowReport(filters: FinancialReportFilters): Promise<FinancialCashflowReport> {
  const [payments, expenses] = await Promise.all([
    loadPayments(filters),
    loadExpenses(filters),
  ]);

  return summarizeFinancialCashflowReport({ payments, expenses });
}

export async function getExpenseBreakdownReport(filters: ExpenseBreakdownReportFilters): Promise<ExpenseBreakdownReport> {
  const expenses = await loadExpenses(filters);
  const includePropertyBreakdown = !filters.propertyId;
  const propertiesById = includePropertyBreakdown
    ? await loadPropertiesById(supabase, uniqueStrings(expenses.map((expense) => expense.property_id)))
    : new Map<string, PropertyContext>();

  return summarizeExpenseBreakdownReport(expenses, propertiesById, includePropertyBreakdown);
}
