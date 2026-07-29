import { normalizeInvoiceStatus } from '../../components/invoice-status-labels';
import type { ExpenseReportRow, FinancialReportFilters, InvoiceReportRow, PaymentWithInvoiceContext } from '../financial-report-rows';
import { hasStatusFilter, isWithinDateRange, matchesInvoiceContext, matchesPaymentContext } from '../financial-report-rows';
import type { ExpenseBreakdownReportFilters } from './report-types';

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
    // Live statuses mix legacy lowercase with modern UPPERCASE — compare canonically.
    if (hasStatusFilter(filters.status) && normalizeInvoiceStatus(invoice.status) !== normalizeInvoiceStatus(filters.status)) return false;
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
