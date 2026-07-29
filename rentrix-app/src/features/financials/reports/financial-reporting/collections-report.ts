import { supabase } from '@/lib/supabase';
import type { FinancialReportFilters, PropertyContext } from '../financial-report-rows';
import { loadPropertiesById, uniqueStrings } from '../financial-report-rows';
import type {
  CollectionSummaryReport,
  DailyCollectionReport,
  ExpenseBreakdownReport,
  ExpenseBreakdownReportFilters,
  ExpenseTotalsReport,
  FinancialCashflowReport,
  FinancialPeriodSummaryReport,
  InvoiceTotalsReport,
  OutstandingBalanceReport,
  PaymentTotalsReport,
} from './report-types';
import {
  summarizeCollectionReport,
  summarizeDailyCollectionReport,
  summarizeExpenseBreakdownReport,
  summarizeExpenseTotals,
  summarizeFinancialCashflowReport,
  summarizeFinancialPeriodSummaryReport,
  summarizeInvoiceTotals,
  summarizeOutstandingBalance,
  summarizePaymentTotals,
} from './report-calculations';
import { loadExpenses, loadInvoices, loadPayments } from './report-loaders';

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
