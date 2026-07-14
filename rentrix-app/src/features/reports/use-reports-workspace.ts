import { useMemo } from 'react';
import { useContracts } from '@/features/contracts/useContracts';
import { useOwners } from '@/features/owners/useOwners';
import { useReceipts } from '@/features/financials/receipts/useReceipts';
import {
  useAgedReceivablesReport,
  useBalanceSheetReport,
  useCashFlowStatementReport,
  useDailyCollectionReport,
  useExpenseBreakdownReport,
  useFinancialCashflowReport,
  useFinancialPeriodSummaryReport,
  useIncomeStatementReport,
  useOverdueInvoicesReport,
  useOwnerStatementReport,
  useTenantStatementReport,
  useTrialBalanceReport,
  useVatReturnReport,
} from '@/features/financials/reports/useFinancialReports';
import { useCostCenters } from '@/features/settings/useCostCenters';
import { useAllUnits } from '@/features/units/use-units';
import {
  buildExpiringContractsRows,
  buildOccupancyRows,
  buildRentRollRows,
  contractStatusLabels,
  getTodayLocalDateString,
  isWithinDateRange,
  latestReceiptLimit,
  usePropertyTitles,
  type FilterState,
} from './reports-page.helpers';

export function useReportsWorkspace(filters: FilterState) {
  const financialFilters = useMemo(
    () => ({
      dateFrom: filters.from,
      dateTo: filters.to,
      costCenterId: filters.costCenterId || undefined,
    }),
    [filters.costCenterId, filters.from, filters.to],
  );
  const arrearsFilters = useMemo(() => ({ asOf: filters.asOf }), [filters.asOf]);

  const financialSummaryQuery = useFinancialPeriodSummaryReport(financialFilters);
  const financialCashflowQuery = useFinancialCashflowReport(financialFilters);
  const cashFlowStatementQuery = useCashFlowStatementReport(financialFilters);
  const vatReturnQuery = useVatReturnReport(financialFilters);
  const dailyCollectionQuery = useDailyCollectionReport(financialFilters);
  const expenseBreakdownQuery = useExpenseBreakdownReport(financialFilters);
  const overdueInvoicesQuery = useOverdueInvoicesReport(arrearsFilters);
  const agedReceivablesQuery = useAgedReceivablesReport(arrearsFilters);
  const contractsQuery = useContracts({ status: 'all', page: 1, pageSize: 1000 });
  const ownersQuery = useOwners();
  const tenantStatementQuery = useTenantStatementReport(filters.contractId || undefined);
  const ownerStatementQuery = useOwnerStatementReport(filters.ownerId || undefined, financialFilters);
  const unitsQuery = useAllUnits();
  const trialBalanceQuery = useTrialBalanceReport(filters.asOf);
  const incomeStatementQuery = useIncomeStatementReport(financialFilters);
  const balanceSheetQuery = useBalanceSheetReport(filters.asOf);
  const receiptsQuery = useReceipts({ limit: latestReceiptLimit });
  const costCentersQuery = useCostCenters();
  const propertyTitlesQuery = usePropertyTitles();

  const contracts = contractsQuery.data?.rows ?? [];
  const propertyTitlesById = useMemo(
    () => new Map((propertyTitlesQuery.data ?? []).map((row) => [row.id, row.title] as const)),
    [propertyTitlesQuery.data],
  );
  const rentRollRows = useMemo(
    () => buildRentRollRows(contracts, contractStatusLabels),
    [contracts],
  );
  const occupancyRows = useMemo(
    () => buildOccupancyRows(unitsQuery.data ?? [], propertyTitlesById),
    [propertyTitlesById, unitsQuery.data],
  );
  const expiringRows = useMemo(
    () => buildExpiringContractsRows(contracts, new Date()),
    [contracts],
  );
  const receiptRows = useMemo(
    () => (receiptsQuery.data ?? [])
      .filter((receipt) => isWithinDateRange(receipt.payment_date, filters))
      .map((receipt) => ({
        id: receipt.id,
        receipt_number: receipt.receipt_number,
        payment_date: receipt.payment_date,
        amount: receipt.amount,
        tenant_name: receipt.tenant_name,
      })),
    [filters, receiptsQuery.data],
  );

  const firstError = financialSummaryQuery.error
    ?? financialCashflowQuery.error
    ?? cashFlowStatementQuery.error
    ?? vatReturnQuery.error
    ?? dailyCollectionQuery.error
    ?? expenseBreakdownQuery.error
    ?? overdueInvoicesQuery.error
    ?? agedReceivablesQuery.error
    ?? trialBalanceQuery.error
    ?? incomeStatementQuery.error
    ?? balanceSheetQuery.error
    ?? contractsQuery.error
    ?? ownersQuery.error
    ?? tenantStatementQuery.error
    ?? ownerStatementQuery.error
    ?? unitsQuery.error
    ?? receiptsQuery.error
    ?? costCentersQuery.error
    ?? propertyTitlesQuery.error;

  return {
    today: getTodayLocalDateString(),
    firstError,
    filters: {
      costCenterRows: costCentersQuery.data ?? [],
      ownerRows: ownersQuery.data ?? [],
      contractRows: contracts,
    },
    hero: {
      summary: financialSummaryQuery.data,
      isLoading: financialSummaryQuery.isLoading,
    },
    sections: {
      overview: {
        summary: financialSummaryQuery.data,
        cashflowRows: financialCashflowQuery.data?.rows ?? [],
        isLoading: financialSummaryQuery.isLoading || financialCashflowQuery.isLoading,
      },
      collections: {
        rows: dailyCollectionQuery.data?.rows ?? [],
        receiptRows,
        rentRollRows,
        isLoading: dailyCollectionQuery.isLoading || receiptsQuery.isLoading || contractsQuery.isLoading,
      },
      overdue: {
        rows: overdueInvoicesQuery.data?.rows ?? [],
        agedReport: agedReceivablesQuery.data,
        isLoading: overdueInvoicesQuery.isLoading || agedReceivablesQuery.isLoading,
      },
      expenses: {
        report: expenseBreakdownQuery.data,
        isLoading: expenseBreakdownQuery.isLoading,
      },
      occupancy: {
        occupancyRows,
        expiringRows,
        isLoading: unitsQuery.isLoading || contractsQuery.isLoading,
      },
      accounting: {
        asOf: filters.asOf,
        from: filters.from,
        to: filters.to,
        trialBalance: trialBalanceQuery.data,
        incomeStatement: incomeStatementQuery.data,
        balanceSheet: balanceSheetQuery.data,
        isTrialBalanceLoading: trialBalanceQuery.isLoading,
        isIncomeStatementLoading: incomeStatementQuery.isLoading,
        isBalanceSheetLoading: balanceSheetQuery.isLoading,
        trialBalanceError: trialBalanceQuery.error,
        incomeStatementError: incomeStatementQuery.error,
        balanceSheetError: balanceSheetQuery.error,
        isLoading: financialSummaryQuery.isLoading || expenseBreakdownQuery.isLoading,
      },
      statements: {
        agedReport: agedReceivablesQuery.data,
        receiptRows,
        financialSummary: financialSummaryQuery.data,
        expenseBreakdown: expenseBreakdownQuery.data,
        dailyRows: dailyCollectionQuery.data?.rows ?? [],
        cashFlowStatement: cashFlowStatementQuery.data,
        vatReturn: vatReturnQuery.data,
        tenantStatement: tenantStatementQuery.data,
        ownerStatement: ownerStatementQuery.data,
        selectedContractId: filters.contractId,
        selectedOwnerId: filters.ownerId,
        tenantStatementError: tenantStatementQuery.error,
        ownerStatementError: ownerStatementQuery.error,
        isTenantStatementLoading: tenantStatementQuery.isLoading,
        isOwnerStatementLoading: ownerStatementQuery.isLoading,
        isLoading: agedReceivablesQuery.isLoading
          || receiptsQuery.isLoading
          || financialSummaryQuery.isLoading
          || expenseBreakdownQuery.isLoading
          || dailyCollectionQuery.isLoading
          || cashFlowStatementQuery.isLoading
          || vatReturnQuery.isLoading,
      },
    },
  } as const;
}

export type ReportsWorkspaceModel = ReturnType<typeof useReportsWorkspace>;
