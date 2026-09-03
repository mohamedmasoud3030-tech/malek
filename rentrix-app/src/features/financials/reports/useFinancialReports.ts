import { useQuery } from '@tanstack/react-query';
import {
  getAgedReceivablesReport,
  getArrearsSummaryReport,
  getCollectionSummaryReport,
  getDailyCollectionReport,
  getExpenseBreakdownReport,
  getExpenseTotalsReport,
  getFinancialCashflowReport,
  getFinancialPeriodSummaryReport,
  getInvoiceTotalsReport,
  getOverdueInvoicesReport,
  getOwnerStatementReport,
  getOutstandingBalanceReport,
  getPaymentTotalsReport,
  getPropertyCollectionBreakdownReport,
  getTenantStatementReport,
  getVatReturnReport,
  getTrialBalanceReport,
  getIncomeStatementReport,
  getBalanceSheetReport,
  type ArrearsReportFilters,
  type ExpenseBreakdownReportFilters,
  type FinancialReportFilters,
} from './financialReportsService';

export const financialReportKeys = {
  all: ['financialReports'] as const,
  collectionSummary: (filters: FinancialReportFilters) => [...financialReportKeys.all, 'collectionSummary', filters] as const,
  overdueInvoices: (filters: ArrearsReportFilters) => [...financialReportKeys.all, 'overdueInvoices', filters] as const,
  agedReceivables: (filters: ArrearsReportFilters) => [...financialReportKeys.all, 'agedReceivables', filters] as const,
  arrearsSummary: (filters: ArrearsReportFilters) => [...financialReportKeys.all, 'arrearsSummary', filters] as const,
  dailyCollection: (filters: FinancialReportFilters) => [...financialReportKeys.all, 'dailyCollection', filters] as const,
  propertyCollectionBreakdown: (filters: FinancialReportFilters) => [...financialReportKeys.all, 'propertyCollectionBreakdown', filters] as const,
  financialPeriodSummary: (filters: FinancialReportFilters) => [...financialReportKeys.all, 'financialPeriodSummary', filters] as const,
  financialCashflow: (filters: FinancialReportFilters) => [...financialReportKeys.all, 'financialCashflow', filters] as const,
  vatReturn: (filters: Pick<FinancialReportFilters, 'dateFrom' | 'dateTo'>) => [...financialReportKeys.all, 'vatReturn', filters] as const,
  invoiceTotals: (filters: FinancialReportFilters) => [...financialReportKeys.all, 'invoiceTotals', filters] as const,
  paymentTotals: (filters: FinancialReportFilters) => [...financialReportKeys.all, 'paymentTotals', filters] as const,
  expenseTotals: (filters: FinancialReportFilters) => [...financialReportKeys.all, 'expenseTotals', filters] as const,
  expenseBreakdown: (filters: ExpenseBreakdownReportFilters) => [...financialReportKeys.all, 'expenseBreakdown', filters] as const,
  outstandingBalance: (filters: FinancialReportFilters) => [...financialReportKeys.all, 'outstandingBalance', filters] as const,
  tenantStatement: (contractId: string) => [...financialReportKeys.all, 'tenantStatement', contractId] as const,
  ownerStatement: (ownerId: string, filters: Pick<FinancialReportFilters, 'dateFrom' | 'dateTo'>) => [...financialReportKeys.all, 'ownerStatement', ownerId, filters] as const,
  trialBalance: (asOf: string) => [...financialReportKeys.all, 'trialBalance', asOf] as const,
  incomeStatement: (filters: Pick<FinancialReportFilters, 'dateFrom' | 'dateTo'>) => [...financialReportKeys.all, 'incomeStatement', filters] as const,
  balanceSheet: (asOf: string) => [...financialReportKeys.all, 'balanceSheet', asOf] as const,
};

/**
 * Reports read models: every hook accepts { enabled } so the workspace fetches
 * only the open report, never the whole catalog up-front. `enabled` composes
 * with input-completeness gates.
 */
export type ReportQueryOptions = Readonly<{ enabled?: boolean }>;

function hasRequiredDateRange(filters: Pick<FinancialReportFilters, 'dateFrom' | 'dateTo'>) {
  return Boolean(filters.dateFrom && filters.dateTo);
}

function hasRequiredAsOf(filters: Pick<ArrearsReportFilters, 'asOf'>) {
  return Boolean(filters.asOf);
}

export function useCollectionSummaryReport(filters: FinancialReportFilters, options: ReportQueryOptions = {}) {
  return useQuery({
    queryKey: financialReportKeys.collectionSummary(filters),
    queryFn: () => getCollectionSummaryReport(filters),
    enabled: (options.enabled ?? true) && (hasRequiredDateRange(filters)),
  });
}

export function useDailyCollectionReport(filters: FinancialReportFilters, options: ReportQueryOptions = {}) {
  return useQuery({
    queryKey: financialReportKeys.dailyCollection(filters),
    queryFn: () => getDailyCollectionReport(filters),
    enabled: (options.enabled ?? true) && (hasRequiredDateRange(filters)),
  });
}

export function usePropertyCollectionBreakdownReport(filters: FinancialReportFilters, options: ReportQueryOptions = {}) {
  return useQuery({
    queryKey: financialReportKeys.propertyCollectionBreakdown(filters),
    queryFn: () => getPropertyCollectionBreakdownReport(filters),
    enabled: (options.enabled ?? true) && (hasRequiredDateRange(filters)),
  });
}

export function useFinancialPeriodSummaryReport(filters: FinancialReportFilters, options: ReportQueryOptions = {}) {
  return useQuery({
    queryKey: financialReportKeys.financialPeriodSummary(filters),
    queryFn: () => getFinancialPeriodSummaryReport(filters),
    enabled: (options.enabled ?? true) && (hasRequiredDateRange(filters)),
  });
}

export function useFinancialCashflowReport(filters: FinancialReportFilters, options: ReportQueryOptions = {}) {
  return useQuery({
    queryKey: financialReportKeys.financialCashflow(filters),
    queryFn: () => getFinancialCashflowReport(filters),
    enabled: (options.enabled ?? true) && (hasRequiredDateRange(filters)),
  });
}

export function useVatReturnReport(filters: Pick<FinancialReportFilters, 'dateFrom' | 'dateTo'>, options: ReportQueryOptions = {}) {
  return useQuery({
    queryKey: financialReportKeys.vatReturn(filters),
    queryFn: () => getVatReturnReport(filters),
    enabled: (options.enabled ?? true) && (hasRequiredDateRange(filters)),
  });
}

export function useInvoiceTotalsReport(filters: FinancialReportFilters, options: ReportQueryOptions = {}) {
  return useQuery({
    queryKey: financialReportKeys.invoiceTotals(filters),
    queryFn: () => getInvoiceTotalsReport(filters),
    enabled: (options.enabled ?? true) && (hasRequiredDateRange(filters)),
  });
}

export function usePaymentTotalsReport(filters: FinancialReportFilters, options: ReportQueryOptions = {}) {
  return useQuery({
    queryKey: financialReportKeys.paymentTotals(filters),
    queryFn: () => getPaymentTotalsReport(filters),
    enabled: (options.enabled ?? true) && (hasRequiredDateRange(filters)),
  });
}

export function useExpenseTotalsReport(filters: FinancialReportFilters, options: ReportQueryOptions = {}) {
  return useQuery({
    queryKey: financialReportKeys.expenseTotals(filters),
    queryFn: () => getExpenseTotalsReport(filters),
    enabled: (options.enabled ?? true) && (hasRequiredDateRange(filters)),
  });
}

export function useExpenseBreakdownReport(filters: ExpenseBreakdownReportFilters, options: ReportQueryOptions = {}) {
  return useQuery({
    queryKey: financialReportKeys.expenseBreakdown(filters),
    queryFn: () => getExpenseBreakdownReport(filters),
    enabled: (options.enabled ?? true) && (hasRequiredDateRange(filters)),
  });
}

export function useOutstandingBalanceReport(filters: FinancialReportFilters, options: ReportQueryOptions = {}) {
  return useQuery({
    queryKey: financialReportKeys.outstandingBalance(filters),
    queryFn: () => getOutstandingBalanceReport(filters),
    enabled: (options.enabled ?? true) && (hasRequiredDateRange(filters)),
  });
}

export function useOverdueInvoicesReport(filters: ArrearsReportFilters, options: ReportQueryOptions = {}) {
  return useQuery({
    queryKey: financialReportKeys.overdueInvoices(filters),
    queryFn: () => getOverdueInvoicesReport(filters),
    enabled: (options.enabled ?? true) && (hasRequiredAsOf(filters)),
  });
}

export function useAgedReceivablesReport(filters: ArrearsReportFilters, options: ReportQueryOptions = {}) {
  return useQuery({
    queryKey: financialReportKeys.agedReceivables(filters),
    queryFn: () => getAgedReceivablesReport(filters),
    enabled: (options.enabled ?? true) && (hasRequiredAsOf(filters)),
  });
}

export function useArrearsSummaryReport(filters: ArrearsReportFilters, options: ReportQueryOptions = {}) {
  return useQuery({
    queryKey: financialReportKeys.arrearsSummary(filters),
    queryFn: () => getArrearsSummaryReport(filters),
    enabled: (options.enabled ?? true) && (hasRequiredAsOf(filters)),
  });
}

export function useTenantStatementReport(contractId: string | undefined, options: ReportQueryOptions = {}) {
  return useQuery({
    queryKey: financialReportKeys.tenantStatement(contractId ?? ''),
    queryFn: () => getTenantStatementReport(contractId!),
    enabled: (options.enabled ?? true) && (Boolean(contractId)),
  });
}

export function useOwnerStatementReport(ownerId: string | undefined, filters: Pick<FinancialReportFilters, 'dateFrom' | 'dateTo'>, options: ReportQueryOptions = {}) {
  return useQuery({
    queryKey: financialReportKeys.ownerStatement(ownerId ?? '', filters),
    queryFn: () => getOwnerStatementReport({ ownerId: ownerId!, ...filters }),
    enabled: (options.enabled ?? true) && (Boolean(ownerId) && hasRequiredDateRange(filters)),
  });
}

export function useTrialBalanceReport(asOf: string | undefined, options: ReportQueryOptions = {}) {
  return useQuery({
    queryKey: financialReportKeys.trialBalance(asOf ?? ''),
    queryFn: () => getTrialBalanceReport(asOf!),
    enabled: (options.enabled ?? true) && (Boolean(asOf)),
  });
}

export function useIncomeStatementReport(filters: Pick<FinancialReportFilters, 'dateFrom' | 'dateTo'>, options: ReportQueryOptions = {}) {
  return useQuery({
    queryKey: financialReportKeys.incomeStatement(filters),
    queryFn: () => getIncomeStatementReport(filters),
    enabled: (options.enabled ?? true) && (hasRequiredDateRange(filters)),
  });
}

export function useBalanceSheetReport(asOf: string | undefined, options: ReportQueryOptions = {}) {
  return useQuery({
    queryKey: financialReportKeys.balanceSheet(asOf ?? ''),
    queryFn: () => getBalanceSheetReport(asOf!),
    enabled: (options.enabled ?? true) && (Boolean(asOf)),
  });
}
