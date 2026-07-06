import { useQuery } from '@tanstack/react-query';
import {
  getAgedReceivablesReport,
  getArrearsSummaryReport,
  getCashFlowStatementReport,
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
  getTenantStatementReport,
  getVatReturnReport,
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
  financialPeriodSummary: (filters: FinancialReportFilters) => [...financialReportKeys.all, 'financialPeriodSummary', filters] as const,
  financialCashflow: (filters: FinancialReportFilters) => [...financialReportKeys.all, 'financialCashflow', filters] as const,
  cashFlowStatement: (filters: Pick<FinancialReportFilters, 'dateFrom' | 'dateTo'>) => [...financialReportKeys.all, 'cashFlowStatement', filters] as const,
  vatReturn: (filters: Pick<FinancialReportFilters, 'dateFrom' | 'dateTo'>) => [...financialReportKeys.all, 'vatReturn', filters] as const,
  invoiceTotals: (filters: FinancialReportFilters) => [...financialReportKeys.all, 'invoiceTotals', filters] as const,
  paymentTotals: (filters: FinancialReportFilters) => [...financialReportKeys.all, 'paymentTotals', filters] as const,
  expenseTotals: (filters: FinancialReportFilters) => [...financialReportKeys.all, 'expenseTotals', filters] as const,
  expenseBreakdown: (filters: ExpenseBreakdownReportFilters) => [...financialReportKeys.all, 'expenseBreakdown', filters] as const,
  outstandingBalance: (filters: FinancialReportFilters) => [...financialReportKeys.all, 'outstandingBalance', filters] as const,
  tenantStatement: (contractId: string) => [...financialReportKeys.all, 'tenantStatement', contractId] as const,
  ownerStatement: (ownerId: string, filters: Pick<FinancialReportFilters, 'dateFrom' | 'dateTo'>) => [...financialReportKeys.all, 'ownerStatement', ownerId, filters] as const,
};

function hasRequiredDateRange(filters: Pick<FinancialReportFilters, 'dateFrom' | 'dateTo'>) {
  return Boolean(filters.dateFrom && filters.dateTo);
}

function hasRequiredAsOf(filters: Pick<ArrearsReportFilters, 'asOf'>) {
  return Boolean(filters.asOf);
}

export function useCollectionSummaryReport(filters: FinancialReportFilters) {
  return useQuery({
    queryKey: financialReportKeys.collectionSummary(filters),
    queryFn: () => getCollectionSummaryReport(filters),
    enabled: hasRequiredDateRange(filters),
  });
}

export function useDailyCollectionReport(filters: FinancialReportFilters) {
  return useQuery({
    queryKey: financialReportKeys.dailyCollection(filters),
    queryFn: () => getDailyCollectionReport(filters),
    enabled: hasRequiredDateRange(filters),
  });
}

export function useFinancialPeriodSummaryReport(filters: FinancialReportFilters) {
  return useQuery({
    queryKey: financialReportKeys.financialPeriodSummary(filters),
    queryFn: () => getFinancialPeriodSummaryReport(filters),
    enabled: hasRequiredDateRange(filters),
  });
}

export function useFinancialCashflowReport(filters: FinancialReportFilters) {
  return useQuery({
    queryKey: financialReportKeys.financialCashflow(filters),
    queryFn: () => getFinancialCashflowReport(filters),
    enabled: hasRequiredDateRange(filters),
  });
}

export function useCashFlowStatementReport(filters: Pick<FinancialReportFilters, 'dateFrom' | 'dateTo'>) {
  return useQuery({
    queryKey: financialReportKeys.cashFlowStatement(filters),
    queryFn: () => getCashFlowStatementReport(filters),
    enabled: hasRequiredDateRange(filters),
  });
}

export function useVatReturnReport(filters: Pick<FinancialReportFilters, 'dateFrom' | 'dateTo'>) {
  return useQuery({
    queryKey: financialReportKeys.vatReturn(filters),
    queryFn: () => getVatReturnReport(filters),
    enabled: hasRequiredDateRange(filters),
  });
}

export function useInvoiceTotalsReport(filters: FinancialReportFilters) {
  return useQuery({
    queryKey: financialReportKeys.invoiceTotals(filters),
    queryFn: () => getInvoiceTotalsReport(filters),
    enabled: hasRequiredDateRange(filters),
  });
}

export function usePaymentTotalsReport(filters: FinancialReportFilters) {
  return useQuery({
    queryKey: financialReportKeys.paymentTotals(filters),
    queryFn: () => getPaymentTotalsReport(filters),
    enabled: hasRequiredDateRange(filters),
  });
}

export function useExpenseTotalsReport(filters: FinancialReportFilters) {
  return useQuery({
    queryKey: financialReportKeys.expenseTotals(filters),
    queryFn: () => getExpenseTotalsReport(filters),
    enabled: hasRequiredDateRange(filters),
  });
}

export function useExpenseBreakdownReport(filters: ExpenseBreakdownReportFilters) {
  return useQuery({
    queryKey: financialReportKeys.expenseBreakdown(filters),
    queryFn: () => getExpenseBreakdownReport(filters),
    enabled: hasRequiredDateRange(filters),
  });
}

export function useOutstandingBalanceReport(filters: FinancialReportFilters) {
  return useQuery({
    queryKey: financialReportKeys.outstandingBalance(filters),
    queryFn: () => getOutstandingBalanceReport(filters),
    enabled: hasRequiredDateRange(filters),
  });
}

export function useOverdueInvoicesReport(filters: ArrearsReportFilters) {
  return useQuery({
    queryKey: financialReportKeys.overdueInvoices(filters),
    queryFn: () => getOverdueInvoicesReport(filters),
    enabled: hasRequiredAsOf(filters),
  });
}

export function useAgedReceivablesReport(filters: ArrearsReportFilters) {
  return useQuery({
    queryKey: financialReportKeys.agedReceivables(filters),
    queryFn: () => getAgedReceivablesReport(filters),
    enabled: hasRequiredAsOf(filters),
  });
}

export function useArrearsSummaryReport(filters: ArrearsReportFilters) {
  return useQuery({
    queryKey: financialReportKeys.arrearsSummary(filters),
    queryFn: () => getArrearsSummaryReport(filters),
    enabled: hasRequiredAsOf(filters),
  });
}


export function useTenantStatementReport(contractId: string | undefined) {
  return useQuery({
    queryKey: financialReportKeys.tenantStatement(contractId ?? ''),
    queryFn: () => getTenantStatementReport(contractId!),
    enabled: Boolean(contractId),
  });
}

export function useOwnerStatementReport(ownerId: string | undefined, filters: Pick<FinancialReportFilters, 'dateFrom' | 'dateTo'>) {
  return useQuery({
    queryKey: financialReportKeys.ownerStatement(ownerId ?? '', filters),
    queryFn: () => getOwnerStatementReport({ ownerId: ownerId!, ...filters }),
    enabled: Boolean(ownerId) && hasRequiredDateRange(filters),
  });
}
