import type { Payment } from '@/types/domain';
import type { FinancialReportFilters, FinancialReportStatus } from '../financial-report-rows';

export type { FinancialReportFilters, FinancialReportStatus } from '../financial-report-rows';

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
