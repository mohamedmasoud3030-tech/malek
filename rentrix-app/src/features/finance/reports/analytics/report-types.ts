/**
 * Finance Operational Reports — Types and Filters
 *
 * These are analytical/operational reports (NOT accounting statements).
 * Accounting statements (TB, P&L, BS, Cash Flow, VAT) live in accounting/reports/.
 */

import type { FinancialReportFilters } from '@/features/financials/reports/financial-report-rows';

export type { FinancialReportFilters };

export type ArrearsReportFilters = {
  asOf: string;
  costCenterId?: string;
  ownerId?: string;
};

export interface CollectionSummaryReport {
  invoiced: number;
  paid: number;
  outstanding: number;
  receiptsCount: number;
  invoicesCount: number;
  expensesTotal: number;
}

export interface DailyCollectionReportRow {
  paymentDate: string;
  totalPaid: number;
  paymentsCount: number;
  methodTotals: Record<string, number>;
}

export interface DailyCollectionReport {
  rows: DailyCollectionReportRow[];
  grandTotal: number;
  paymentsCount: number;
  methodTotals: Record<string, number>;
}

export interface FinancialPeriodSummaryReport {
  invoiced: number;
  paid: number;
  outstanding: number;
  expenses: number;
  netCash: number;
  invoicesCount: number;
  paymentsCount: number;
  expensesCount: number;
}

export interface FinancialCashflowReportRow {
  month: string;
  revenue: number;
  expenses: number;
}

export interface FinancialCashflowReport {
  rows: FinancialCashflowReportRow[];
  totalRevenue: number;
  totalExpenses: number;
}

export interface ExpenseBreakdownReportFilters extends FinancialReportFilters {
  category?: string;
}

export interface ExpenseBreakdownCategoryRow {
  category: string;
  total: number;
  count: number;
}

export interface ExpenseBreakdownPropertyRow {
  propertyId: string;
  propertyTitle: string | null;
  total: number;
  count: number;
}

export interface ExpenseBreakdownReport {
  totalExpenses: number;
  expensesCount: number;
  byCategory: ExpenseBreakdownCategoryRow[];
  byProperty: ExpenseBreakdownPropertyRow[];
}

export interface InvoiceTotalsReport {
  totalAmount: number;
  totalPaid: number;
  totalOutstanding: number;
  invoicesCount: number;
}

export interface PaymentTotalsReport {
  totalPaid: number;
  paymentsCount: number;
}

export interface ExpenseTotalsReport {
  totalExpenses: number;
  expensesCount: number;
}

export interface OutstandingBalanceReport {
  totalOutstanding: number;
  invoicesCount: number;
}

// Arrears types
export interface AgedReceivablesBucket {
  bucket: string;
  total: number;
  count: number;
}

export interface AgedReceivablesGroupRow {
  groupKey: string;
  groupLabel: string;
  total: number;
  count: number;
  buckets: AgedReceivablesBucket[];
}

export interface AgedReceivablesReport {
  rows: AgedReceivablesGroupRow[];
  grandTotal: number;
  totalCount: number;
}

export interface ArrearsSummaryReport {
  totalOverdue: number;
  overdueInvoicesCount: number;
  oldestOverdueDays: number;
}

export interface OverdueInvoiceReportRow {
  invoiceId: string;
  invoiceNumber: string;
  tenantName: string;
  propertyTitle: string;
  unitNumber: string;
  amount: number;
  outstanding: number;
  daysOverdue: number;
  status: string;
}

export interface OverdueInvoicesReport {
  rows: OverdueInvoiceReportRow[];
  totalOverdue: number;
  totalOutstanding: number;
}

// Funds types
export interface DepositSummaryReport {
  totalHeld: number;
  totalDeductions: number;
  totalRefunded: number;
  depositCount: number;
}

export interface OwnerSettlementReport {
  totalDue: number;
  settled: number;
  pending: number;
  settlementCount: number;
}

export interface BankReconciliationSummaryReport {
  totalLines: number;
  matchedCount: number;
  unmatchedCount: number;
  unmatchedAmount: number;
}

export interface DashboardArrearsReports {
  overdueInvoices: OverdueInvoicesReport;
  arrearsSummary: ArrearsSummaryReport;
  agedReceivables: AgedReceivablesReport;
}