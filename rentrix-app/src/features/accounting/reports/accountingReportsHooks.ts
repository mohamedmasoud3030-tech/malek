import { useQuery } from '@tanstack/react-query';
import {
  getBalanceSheetReport,
  getIncomeStatementReport,
  getTrialBalanceReport,
} from './accountingReportsFacade';

type DateRange = Readonly<{ dateFrom: string; dateTo: string }>;
type QueryOptions = Readonly<{ enabled?: boolean }>;

export const accountingReportKeys = {
  all: ['accountingReports'] as const,
  trialBalance: (asOf: string) => [...accountingReportKeys.all, 'trialBalance', asOf] as const,
  incomeStatement: (filters: DateRange) => [...accountingReportKeys.all, 'incomeStatement', filters] as const,
  balanceSheet: (asOf: string) => [...accountingReportKeys.all, 'balanceSheet', asOf] as const,
};

function hasDateRange(filters: DateRange) {
  return Boolean(filters.dateFrom && filters.dateTo);
}

/** Reports → Accounting canonical read boundary (legacy fallback lives in the facade). */
export function useAccountingTrialBalanceReport(asOf: string | undefined, options: QueryOptions = {}) {
  return useQuery({
    queryKey: accountingReportKeys.trialBalance(asOf ?? ''),
    queryFn: () => getTrialBalanceReport(asOf!),
    enabled: (options.enabled ?? true) && Boolean(asOf),
  });
}

/** Reports → Accounting canonical read boundary (legacy fallback lives in the facade). */
export function useAccountingIncomeStatementReport(filters: DateRange, options: QueryOptions = {}) {
  return useQuery({
    queryKey: accountingReportKeys.incomeStatement(filters),
    queryFn: () => getIncomeStatementReport(filters),
    enabled: (options.enabled ?? true) && hasDateRange(filters),
  });
}

/** Reports → Accounting canonical read boundary (legacy fallback lives in the facade). */
export function useAccountingBalanceSheetReport(asOf: string | undefined, options: QueryOptions = {}) {
  return useQuery({
    queryKey: accountingReportKeys.balanceSheet(asOf ?? ''),
    queryFn: () => getBalanceSheetReport(asOf!),
    enabled: (options.enabled ?? true) && Boolean(asOf),
  });
}
