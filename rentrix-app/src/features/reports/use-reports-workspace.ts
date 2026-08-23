import { useMemo } from 'react';
import { useAllContracts } from '@/features/contracts/useContracts';
import { useOwners } from '@/features/owners/useOwners';
import { useReceipts } from '@/features/financials/receipts/useReceipts';
import {
  useAgedReceivablesReport,
  useArrearsSummaryReport,
  useBalanceSheetReport,
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
import { useAuthoritativeReportsCollectionRate } from './reports-collection-efficiency';
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
} from './reports-page.helpers';
import type { ReportsFilterState } from './reports-workspace-filters';
import type { ReportLocation, ReportViewId } from './reports-section-model';

function firstErrorOf(...errors: ReadonlyArray<unknown>): unknown {
  for (const error of errors) {
    if (error != null) return error;
  }
  return undefined;
}

function isLoadingAny(...flags: ReadonlyArray<boolean | undefined>): boolean {
  return flags.some(Boolean);
}

/** R6 — active report bodies remain lazy; compact directories stay cached for filters. */
function viewNeeds(view: ReportViewId, location: ReportLocation) {
  const active = (views: ReportViewId[]) => views.includes(view) && views.includes(location.view);
  return active;
}

export function useReportsWorkspace(filters: ReportsFilterState, location: ReportLocation) {
  const financialFilters = useMemo(
    () => ({
      dateFrom: filters.from,
      dateTo: filters.to,
      propertyId: filters.propertyId || undefined,
      unitId: filters.unitId || undefined,
      tenantId: filters.tenantId || undefined,
      contractId: filters.contractId || undefined,
      costCenterId: filters.costCenterId || undefined,
      status: filters.status ?? 'all',
    }),
    [filters.contractId, filters.costCenterId, filters.from, filters.propertyId, filters.status, filters.tenantId, filters.to, filters.unitId],
  );
  const expenseFilters = useMemo(
    () => ({
      dateFrom: filters.from,
      dateTo: filters.to,
      propertyId: filters.propertyId || undefined,
      costCenterId: filters.costCenterId || undefined,
    }),
    [filters.costCenterId, filters.from, filters.propertyId, filters.to],
  );
  const arrearsFilters = useMemo(() => ({
    asOf: filters.asOf,
    propertyId: filters.propertyId || undefined,
    unitId: filters.unitId || undefined,
    tenantId: filters.tenantId || undefined,
    contractId: filters.contractId || undefined,
  }), [filters.asOf, filters.contractId, filters.propertyId, filters.tenantId, filters.unitId]);

  const view = location.view;
  const isAccounting = location.section === 'accounting';
  const isAnalytics = location.section === 'analytics';
  const isStatements = location.section === 'statements';

  const needsOverview = isAnalytics && view === 'overview';
  const needsCollections = isAnalytics && view === 'collections';
  const needsOverdue = isAnalytics && view === 'overdue';
  const needsExpenses = isAnalytics && view === 'expenses';
  const needsOccupancy = isAnalytics && (view === 'occupancy' || view === 'property_analytics');
  const needsMaintenance = isAnalytics && view === 'maintenance_analytics';
  const needsAccountingReports = isAccounting && view === 'accounting_reports';
  const needsDeferredRevenue = isAccounting && view === 'deferred_revenue';
  const needsStatements = isStatements || needsAccountingReports;

  const financialSummaryQuery = useFinancialPeriodSummaryReport(financialFilters);
  const collectionRateQuery = useAuthoritativeReportsCollectionRate({ from: filters.from, to: filters.to });

  const collectionSummaryQuery = useCollectionSummaryReport(financialFilters, { enabled: needsOverview || needsCollections });
  const financialCashflowQuery = useFinancialCashflowReport(financialFilters, { enabled: needsOverview });
  const vatReturnQuery = useVatReturnReport(financialFilters, { enabled: needsStatements });
  const dailyCollectionQuery = useDailyCollectionReport(financialFilters, { enabled: needsCollections || needsStatements });
  const expenseBreakdownQuery = useExpenseBreakdownReport(expenseFilters, { enabled: needsExpenses || needsStatements });
  const overdueInvoicesQuery = useOverdueInvoicesReport(arrearsFilters, { enabled: needsOverdue });
  const agedReceivablesQuery = useAgedReceivablesReport(arrearsFilters, { enabled: needsOverdue || needsStatements });
  const arrearsSummaryQuery = useArrearsSummaryReport(arrearsFilters, { enabled: needsOverdue });
  const contractsQuery = useAllContracts('all', { enabled: true });
  const ownersQuery = useOwners({ enabled: true });
  const tenantStatementQuery = useTenantStatementReport(filters.contractId || undefined, { enabled: needsStatements });
  const ownerStatementQuery = useOwnerStatementReport(filters.ownerId || undefined, financialFilters, { enabled: needsStatements });
  const unitsQuery = useAllUnits({ enabled: needsOccupancy });
  const maintenanceQuery = useMaintenance('all', '', { enabled: needsMaintenance });
  const trialBalanceQuery = useTrialBalanceReport(filters.asOf, { enabled: needsAccountingReports });
  const incomeStatementQuery = useIncomeStatementReport(financialFilters, { enabled: needsAccountingReports });
  const balanceSheetQuery = useBalanceSheetReport(filters.asOf, { enabled: needsAccountingReports });
  const receiptsQuery = useReceipts({ limit: latestReceiptLimit }, { enabled: needsCollections || needsDeferredRevenue || needsStatements });
  const costCentersQuery = useCostCenters();
  const propertyTitlesQuery = usePropertyTitles({ enabled: needsOccupancy });

  const contracts = contractsQuery.data?.rows ?? [];
  const scopedContracts = useMemo(
    () => contracts.filter((contract) => {
      if (filters.propertyId && contract.property_id !== filters.propertyId) return false;
      if (filters.unitId && contract.unit_id !== filters.unitId) return false;
      if (filters.tenantId && contract.tenant_id !== filters.tenantId) return false;
      if (filters.contractId && contract.id !== filters.contractId) return false;
      return true;
    }),
    [contracts, filters.contractId, filters.propertyId, filters.tenantId, filters.unitId],
  );
  const contractById = useMemo(() => new Map(contracts.map((contract) => [contract.id, contract] as const)), [contracts]);
  const allReceipts = receiptsQuery.data ?? [];
  const propertyTitlesById = useMemo(
    () => new Map((propertyTitlesQuery.data ?? []).map((row) => [row.id, row.title] as const)),
    [propertyTitlesQuery.data],
  );
  const rentRollRows = useMemo(() => buildRentRollRows(scopedContracts, contractStatusLabels), [scopedContracts]);
  const occupancyRows = useMemo(
    () => buildOccupancyRows(
      (unitsQuery.data ?? []).filter((unit) => {
        if (filters.propertyId && unit.property_id !== filters.propertyId) return false;
        if (filters.unitId && unit.id !== filters.unitId) return false;
        return true;
      }),
      propertyTitlesById,
    ),
    [filters.propertyId, filters.unitId, propertyTitlesById, unitsQuery.data],
  );
  const expiringRows = useMemo(() => buildExpiringContractsRows(scopedContracts, new Date()), [scopedContracts]);
  const maintenanceSummary = useMemo(() => summarizeMaintenanceRequests(maintenanceQuery.data ?? []), [maintenanceQuery.data]);
  const receiptRows = useMemo(
    () => allReceipts
      .filter((receipt) => isWithinDateRange(receipt.payment_date, filters))
      .filter((receipt) => {
        const contract = receipt.contract_id ? contractById.get(receipt.contract_id) : undefined;
        if (filters.contractId && receipt.contract_id !== filters.contractId) return false;
        if (filters.propertyId && contract?.property_id !== filters.propertyId) return false;
        if (filters.unitId && contract?.unit_id !== filters.unitId) return false;
        if (filters.tenantId && contract?.tenant_id !== filters.tenantId) return false;
        return true;
      })
      .map((receipt) => ({
        id: receipt.id,
        receipt_number: receipt.receipt_number,
        payment_date: receipt.payment_date,
        amount: receipt.amount,
        tenant_name: receipt.tenant_name,
        property_title: receipt.property_title,
        unit_number: receipt.unit_number,
        contract_id: receipt.contract_id,
        invoice_id: receipt.invoice_id,
        invoice_reference: receipt.invoice_reference,
        invoice_status: receipt.invoice_status,
        payment_method: receipt.payment_method,
        reference_number: receipt.reference_number,
        status: receipt.status,
      })),
    [allReceipts, contractById, filters],
  );
  const deferredRevenueAudit = useMemo(
    () => buildDeferredRevenueAudit(scopedContracts, receiptRows, filters.asOf),
    [filters.asOf, receiptRows, scopedContracts],
  );

  const firstError = firstErrorOf(
    financialSummaryQuery.error,
    collectionRateQuery.error,
    collectionSummaryQuery.error,
    financialCashflowQuery.error,
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
      collectionRate: collectionRateQuery.data ?? 0,
      isLoading: isLoadingAny(financialSummaryQuery.isLoading, collectionRateQuery.isLoading),
    },
    sections: {
      overview: {
        summary: financialSummaryQuery.data,
        collectionSummary: collectionSummaryQuery.data,
        collectionRate: collectionRateQuery.data ?? 0,
        cashflowRows: financialCashflowQuery.data?.rows ?? [],
        isLoading: isLoadingAny(financialSummaryQuery.isLoading, collectionRateQuery.isLoading, collectionSummaryQuery.isLoading, financialCashflowQuery.isLoading),
      },
      collections: {
        from: filters.from,
        to: filters.to,
        summary: collectionSummaryQuery.data,
        rows: dailyCollectionQuery.data?.rows ?? [],
        receiptRows,
        rentRollRows,
        isLoading: isLoadingAny(collectionSummaryQuery.isLoading, dailyCollectionQuery.isLoading, receiptsQuery.isLoading, contractsQuery.isLoading),
      },
      overdue: {
        rows: overdueInvoicesQuery.data?.rows ?? [],
        agedReport: agedReceivablesQuery.data,
        summary: arrearsSummaryQuery.data,
        isLoading: isLoadingAny(overdueInvoicesQuery.isLoading, agedReceivablesQuery.isLoading, arrearsSummaryQuery.isLoading),
      },
      expenses: { report: expenseBreakdownQuery.data, isLoading: expenseBreakdownQuery.isLoading },
      occupancy: { occupancyRows, expiringRows, isLoading: isLoadingAny(unitsQuery.isLoading, contractsQuery.isLoading) },
      maintenance: { rows: maintenanceQuery.data ?? [], summary: maintenanceSummary, isLoading: maintenanceQuery.isLoading },
      deferredRevenue: { audit: deferredRevenueAudit, asOf: filters.asOf, isLoading: isLoadingAny(receiptsQuery.isLoading, contractsQuery.isLoading) },
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
        vatReturn: vatReturnQuery.data,
        tenantStatement: tenantStatementQuery.data,
        ownerStatement: ownerStatementQuery.data,
        selectedContractId: filters.contractId,
        selectedOwnerId: filters.ownerId,
        tenantStatementError: tenantStatementQuery.error,
        ownerStatementError: ownerStatementQuery.error,
        isTenantStatementLoading: tenantStatementQuery.isLoading,
        isOwnerStatementLoading: ownerStatementQuery.isLoading,
        isLoading: isLoadingAny(agedReceivablesQuery.isLoading, receiptsQuery.isLoading, financialSummaryQuery.isLoading, expenseBreakdownQuery.isLoading, dailyCollectionQuery.isLoading, vatReturnQuery.isLoading),
      },
    },
  } as const;
}

export type ReportsWorkspaceModel = ReturnType<typeof useReportsWorkspace>;
export { viewNeeds };
