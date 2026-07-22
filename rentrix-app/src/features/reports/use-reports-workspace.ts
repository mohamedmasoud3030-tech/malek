import { useMemo } from 'react';
import { useAllContracts } from '@/features/contracts/useContracts';
import { useOwners } from '@/features/owners/useOwners';
import { useReceipts } from '@/features/financials/receipts/useReceipts';
import {
  useAgedReceivablesReport,
  useArrearsSummaryReport,
  useBalanceSheetReport,
  useCashFlowStatementReport,
  useCollectionSummaryReport,
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
import { summarizeMaintenanceRequests } from '@/features/maintenance/maintenance-helpers';
import { useMaintenance } from '@/features/maintenance/use-maintenance';
import { useCostCenters } from '@/features/settings/useCostCenters';
import { useAllUnits } from '@/features/units/use-units';
import { buildDeferredRevenueAudit } from './reports-insights';
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

function firstErrorOf(...errors: ReadonlyArray<unknown>): unknown {
  for (const error of errors) {
    if (error != null) return error;
  }
  return undefined;
}

function isLoadingAny(...flags: ReadonlyArray<boolean | undefined>): boolean {
  return flags.some(Boolean);
}

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
  const collectionSummaryQuery = useCollectionSummaryReport(financialFilters);
  const financialCashflowQuery = useFinancialCashflowReport(financialFilters);
  const cashFlowStatementQuery = useCashFlowStatementReport(financialFilters);
  const vatReturnQuery = useVatReturnReport(financialFilters);
  const dailyCollectionQuery = useDailyCollectionReport(financialFilters);
  const expenseBreakdownQuery = useExpenseBreakdownReport(financialFilters);
  const overdueInvoicesQuery = useOverdueInvoicesReport(arrearsFilters);
  const agedReceivablesQuery = useAgedReceivablesReport(arrearsFilters);
  const arrearsSummaryQuery = useArrearsSummaryReport(arrearsFilters);
  // Full paged read — the 1000-row single-shot cap used to truncate the rent roll,
  // renewals forecast, deferred-revenue audit, and the contract filter dropdown.
  const contractsQuery = useAllContracts('all');
  const ownersQuery = useOwners();
  const tenantStatementQuery = useTenantStatementReport(filters.contractId || undefined);
  const ownerStatementQuery = useOwnerStatementReport(filters.ownerId || undefined, financialFilters);
  const unitsQuery = useAllUnits();
  const maintenanceQuery = useMaintenance('all', '');
  const trialBalanceQuery = useTrialBalanceReport(filters.asOf);
  const incomeStatementQuery = useIncomeStatementReport(financialFilters);
  const balanceSheetQuery = useBalanceSheetReport(filters.asOf);
  const receiptsQuery = useReceipts({ limit: latestReceiptLimit });
  const costCentersQuery = useCostCenters();
  const propertyTitlesQuery = usePropertyTitles();

  const contracts = contractsQuery.data?.rows ?? [];
  const allReceipts = receiptsQuery.data ?? [];
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
  const maintenanceSummary = useMemo(
    () => summarizeMaintenanceRequests(maintenanceQuery.data ?? []),
    [maintenanceQuery.data],
  );
  const receiptRows = useMemo(
    () => allReceipts
      .filter((receipt) => isWithinDateRange(receipt.payment_date, filters))
      .map((receipt) => ({
        id: receipt.id,
        receipt_number: receipt.receipt_number,
        payment_date: receipt.payment_date,
        amount: receipt.amount,
        tenant_name: receipt.tenant_name,
        property_title: receipt.property_title,
        unit_number: receipt.unit_number,
        contract_id: receipt.contract_id,
        payment_method: receipt.payment_method,
        status: receipt.status,
      })),
    [allReceipts, filters],
  );
  const deferredRevenueAudit = useMemo(
    () => buildDeferredRevenueAudit(contracts, allReceipts, filters.asOf),
    [allReceipts, contracts, filters.asOf],
  );

  const firstError = firstErrorOf(
    financialSummaryQuery.error,
    collectionSummaryQuery.error,
    financialCashflowQuery.error,
    cashFlowStatementQuery.error,
    vatReturnQuery.error,
    dailyCollectionQuery.error,
    expenseBreakdownQuery.error,
    overdueInvoicesQuery.error,
    agedReceivablesQuery.error,
    arrearsSummaryQuery.error,
    trialBalanceQuery.error,
    incomeStatementQuery.error,
    balanceSheetQuery.error,
    contractsQuery.error,
    ownersQuery.error,
    tenantStatementQuery.error,
    ownerStatementQuery.error,
    unitsQuery.error,
    maintenanceQuery.error,
    receiptsQuery.error,
    costCentersQuery.error,
    propertyTitlesQuery.error,
  );

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
        collectionSummary: collectionSummaryQuery.data,
        cashflowRows: financialCashflowQuery.data?.rows ?? [],
        isLoading: isLoadingAny(
          financialSummaryQuery.isLoading,
          collectionSummaryQuery.isLoading,
          financialCashflowQuery.isLoading,
        ),
      },
      collections: {
        summary: collectionSummaryQuery.data,
        rows: dailyCollectionQuery.data?.rows ?? [],
        receiptRows,
        rentRollRows,
        isLoading: isLoadingAny(
          collectionSummaryQuery.isLoading,
          dailyCollectionQuery.isLoading,
          receiptsQuery.isLoading,
          contractsQuery.isLoading,
        ),
      },
      overdue: {
        rows: overdueInvoicesQuery.data?.rows ?? [],
        agedReport: agedReceivablesQuery.data,
        summary: arrearsSummaryQuery.data,
        isLoading: isLoadingAny(
          overdueInvoicesQuery.isLoading,
          agedReceivablesQuery.isLoading,
          arrearsSummaryQuery.isLoading,
        ),
      },
      expenses: {
        report: expenseBreakdownQuery.data,
        isLoading: expenseBreakdownQuery.isLoading,
      },
      occupancy: {
        occupancyRows,
        expiringRows,
        isLoading: isLoadingAny(unitsQuery.isLoading, contractsQuery.isLoading),
      },
      maintenance: {
        rows: maintenanceQuery.data ?? [],
        summary: maintenanceSummary,
        isLoading: maintenanceQuery.isLoading,
      },
      deferredRevenue: {
        audit: deferredRevenueAudit,
        asOf: filters.asOf,
        isLoading: isLoadingAny(receiptsQuery.isLoading, contractsQuery.isLoading),
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
        isLoading: isLoadingAny(trialBalanceQuery.isLoading, incomeStatementQuery.isLoading, balanceSheetQuery.isLoading),
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
        isLoading: isLoadingAny(
          agedReceivablesQuery.isLoading,
          receiptsQuery.isLoading,
          financialSummaryQuery.isLoading,
          expenseBreakdownQuery.isLoading,
          dailyCollectionQuery.isLoading,
          cashFlowStatementQuery.isLoading,
          vatReturnQuery.isLoading,
        ),
      },
    },
  } as const;
}

export type ReportsWorkspaceModel = ReturnType<typeof useReportsWorkspace>;
