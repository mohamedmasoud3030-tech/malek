import { summarizeInvoices, getInvoiceRemainingAmount, type InvoiceRemainingInput } from '@/features/financials/invoices/invoice-amounts';
import type { Payment } from '@/types/domain';
import { sumFinancialValues, toFinancialNumber } from '../../financialMath';
import type { ExpenseReportRow, PaymentReportRow, PaymentWithInvoiceContext, PropertyContext } from '../financial-report-rows';

import type {
  CollectionSummaryReport,
  DailyCollectionReport,
  DailyCollectionReportRow,
  ExpenseBreakdownCategoryRow,
  ExpenseBreakdownPropertyRow,
  ExpenseBreakdownReport,
  ExpenseTotalsReport,
  FinancialCashflowReport,
  FinancialCashflowReportRow,
  FinancialPeriodSummaryReport,
  InvoiceTotalsReport,
  OutstandingBalanceReport,
  PaymentMethodTotals,
  PaymentTotalsReport,
  PropertyCollectionBreakdownReport,
  PropertyCollectionBreakdownRow,
} from './report-types';

export function summarizeInvoiceTotals(invoices: readonly InvoiceRemainingInput[]): InvoiceTotalsReport {
  const summary = summarizeInvoices(invoices);
  return {
    totalAmount: summary.totalAmount,
    totalPaid: summary.totalPaid,
    totalOutstanding: summary.totalRemaining,
    invoicesCount: summary.count,
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

export function summarizeOutstandingBalance(invoices: readonly InvoiceRemainingInput[]): OutstandingBalanceReport {
  const outstandingInvoices = invoices.filter((invoice) => getInvoiceRemainingAmount(invoice) > 0);
  return {
    totalOutstanding: sumFinancialValues(outstandingInvoices.map((invoice) => getInvoiceRemainingAmount(invoice))),
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

export function summarizePropertyCollectionBreakdownReport(
  payments: Array<Pick<PaymentWithInvoiceContext, 'amount' | 'contract'>>,
  propertiesById: Map<string, PropertyContext> = new Map(),
): PropertyCollectionBreakdownReport {
  const rowsByProperty = new Map<string, PropertyCollectionBreakdownRow>();

  for (const payment of payments) {
    const propertyId = payment.contract?.property_id;
    if (!propertyId) continue;
    const row = rowsByProperty.get(propertyId) ?? {
      propertyId,
      propertyTitle: propertiesById.get(propertyId)?.title ?? null,
      totalPaid: 0,
      paymentsCount: 0,
    };
    row.totalPaid = toFinancialNumber(row.totalPaid) + toFinancialNumber(payment.amount);
    row.paymentsCount += 1;
    rowsByProperty.set(propertyId, row);
  }

  const rows = Array.from(rowsByProperty.values())
    .sort((a, b) => b.totalPaid - a.totalPaid || (a.propertyTitle ?? a.propertyId).localeCompare(b.propertyTitle ?? b.propertyId, 'ar'));

  return {
    rows,
    grandTotal: sumFinancialValues(rows.map((row) => row.totalPaid)),
    paymentsCount: rows.reduce((count, row) => count + row.paymentsCount, 0),
  };
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

/** Presentation projection of the same period snapshot, not a second invoice/payment read. */
export function collectionSummaryFromPeriod(period: FinancialPeriodSummaryReport): CollectionSummaryReport {
  return {
    invoiced: period.invoiced, paid: period.paid, outstanding: period.outstanding,
    receiptsCount: period.paymentsCount, invoicesCount: period.invoicesCount,
    expensesTotal: period.expenses,
  };
}
