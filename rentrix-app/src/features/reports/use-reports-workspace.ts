import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import {
  useAccountingBalanceSheetReport,
  useAccountingIncomeStatementReport,
  useAccountingTrialBalanceReport,
} from '@/features/accounting/reports/accountingReportsHooks';
import { useAllContracts } from '@/features/contracts/useContracts';
import { useOwners } from '@/features/owners/useOwners';
import { useReceipts } from '@/features/financials/receipts/useReceipts';
import {
  useAgedReceivablesReport,
  useArrearsSummaryReport,
  useCollectionSummaryReport,
  useDailyCollectionReport,
  useExpenseBreakdownReport,
  useFinancialCashflowReport,
  useFinancialPeriodSummaryReport,
  useOverdueInvoicesReport,
  useOwnerStatementReport,
  usePropertyCollectionBreakdownReport,
  useTenantStatementReport,
  useVatReturnReport,
  financialReportKeys,
} from '@/features/financials/reports/useFinancialReports';
import { summarizeMaintenanceRequests } from '@/features/maintenance/maintenance-helpers';
import { useMaintenance } from '@/features/maintenance/use-maintenance';
import { useCostCenters } from '@/features/settings/useCostCenters';
import { useAllUnits } from '@/features/units/use-units';
import { buildVacancyAnalytics } from '@/features/units/vacancy-analytics';
import { previousPeriodRange } from './documents/report-period';
import { loadPremiumOwnerReportPayload } from './documents/premium-owner-report';
import {
  buildPropertyAnalyticsComparison,
  buildPropertyAnalyticsExecutive,
  buildPropertyAnalyticsInsights,
  buildPropertyAnalyticsBenchmark,
  rateOf,
  type PropertyAnalyticsInput,
} from './property-analytics-model';
import { useAuthoritativeReportsCollectionRate } from './reports-collection-efficiency';
import { buildDeferredRevenueAudit } from './reports-insights';
import {
  buildExpiringContractsRows,
  buildOccupancyRows,
  buildPropertyPerformanceRows,
  buildRentRollRows,
  contractStatusLabels,
  getTodayLocalDateString,
  isWithinDateRange,
  latestReceiptLimit,
  usePropertyTitles,
} from './reports-page.helpers';
import type { ReportsFilterState } from './reports-workspace-filters';
import type { StatementProductFocus } from './report-products';
import type { ReportLocation } from './report-route';

function firstErrorOf(...errors: ReadonlyArray<unknown>): unknown {
  for (const error of errors) {
    if (error != null) return error;
  }
  return undefined;
}

function isLoadingAny(...flags: ReadonlyArray<boolean | undefined>): boolean {
  return flags.some(Boolean);
}

type ReportsWorkspaceOptions = Readonly<{
  statementFocus?: StatementProductFocus;
}>;

export function useReportsWorkspace(
  filters: ReportsFilterState,
  location: ReportLocation,
  options: ReportsWorkspaceOptions = {},
) {
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
    [
      filters.contractId,
      filters.costCenterId,
      filters.from,
      filters.propertyId,
      filters.status,
      filters.tenantId,
      filters.to,
      filters.unitId,
    ],
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
  const portfolioExpenseFilters = useMemo(
    () => ({
      dateFrom: filters.from,
      dateTo: filters.to,
      costCenterId: filters.costCenterId || undefined,
    }),
    [filters.costCenterId, filters.from, filters.to],
  );
  const arrearsFilters = useMemo(
    () => ({
      asOf: filters.asOf,
      propertyId: filters.propertyId || undefined,
      unitId: filters.unitId || undefined,
      tenantId: filters.tenantId || undefined,
      contractId: filters.contractId || undefined,
    }),
    [
      filters.asOf,
      filters.contractId,
      filters.propertyId,
      filters.tenantId,
      filters.unitId,
    ],
  );

  const view = location.view;
  const isAccounting = location.section === 'accounting';
  const isAnalytics = location.section === 'analytics';
  const isStatements = location.section === 'statements';

  const needsOverview = isAnalytics && view === 'overview';
  const needsPropertyPerformance = isAnalytics && view === 'property_analytics';
  const needsCollections =
    isAnalytics &&
    (view === 'collections' ||
      view === 'collection_movement' ||
      needsOverview ||
      needsPropertyPerformance);
  const needsOverdue =
    isAnalytics &&
    (view === 'overdue' ||
      view === 'follow_up' ||
      needsOverview ||
      needsPropertyPerformance);
  const needsExpenses =
    isAnalytics &&
    (view === 'expenses' ||
      view === 'operations_overview' ||
      needsOverview ||
      needsPropertyPerformance ||
      view === 'maintenance_analytics');
  const needsOccupancy =
    isAnalytics &&
    (view === 'occupancy' ||
      view === 'expiring' ||
      needsOverview ||
      needsPropertyPerformance);
  const needsMaintenance =
    isAnalytics &&
    (view === 'maintenance_analytics' ||
      view === 'operations_overview' ||
      needsOverview ||
      needsPropertyPerformance);
  const needsAccountingReports = isAccounting && view === 'accounting_reports';
  const needsDeferredRevenue = isAccounting && view === 'deferred_revenue';
  const statementFocus = options.statementFocus ?? 'all';
  const needsTenantStatement =
    isStatements && (statementFocus === 'all' || statementFocus === 'tenant');
  const needsOwnerStatement =
    isStatements && (statementFocus === 'all' || statementFocus === 'owner');
  const needsFinancialStatements =
    isStatements &&
    (statementFocus === 'all' || statementFocus === 'financial');
  const needsFinancialSummary =
    needsOverview ||
    needsCollections ||
    needsOverdue ||
    needsPropertyPerformance ||
    needsFinancialStatements;
  const needsCollectionRate = needsOverview || needsCollections || needsOverdue;

  /**
   * Previous comparable period for the Property Analytics workspace. Same
   * deterministic window arithmetic the professional property report uses, so
   * in-app comparison and the printed document can never disagree about what
   * "previous period" means. Loaded only for that workspace.
   */
  const previousRange = useMemo(
    () => previousPeriodRange(filters.from, filters.to),
    [filters.from, filters.to],
  );
  const previousFinancialFilters = useMemo(
    () => ({
      dateFrom: previousRange?.from ?? filters.from,
      dateTo: previousRange?.to ?? filters.to,
      propertyId: filters.propertyId || undefined,
      unitId: filters.unitId || undefined,
      tenantId: filters.tenantId || undefined,
      contractId: filters.contractId || undefined,
      costCenterId: filters.costCenterId || undefined,
      status: filters.status ?? 'all',
    }),
    [
      filters.contractId,
      filters.costCenterId,
      filters.from,
      filters.propertyId,
      filters.status,
      filters.tenantId,
      filters.to,
      filters.unitId,
      previousRange,
    ],
  );
  const previousExpenseFilters = useMemo(
    () => ({
      dateFrom: previousRange?.from ?? filters.from,
      dateTo: previousRange?.to ?? filters.to,
      propertyId: filters.propertyId || undefined,
      costCenterId: filters.costCenterId || undefined,
    }),
    [
      filters.costCenterId,
      filters.from,
      filters.propertyId,
      filters.to,
      previousRange,
    ],
  );
  const previousArrearsFilters = useMemo(
    () => ({
      asOf: previousRange?.to ?? filters.asOf,
      propertyId: filters.propertyId || undefined,
      unitId: filters.unitId || undefined,
      tenantId: filters.tenantId || undefined,
      contractId: filters.contractId || undefined,
    }),
    [
      filters.asOf,
      filters.contractId,
      filters.propertyId,
      filters.tenantId,
      filters.unitId,
      previousRange,
    ],
  );

  const financialSummaryQuery = useFinancialPeriodSummaryReport(
    financialFilters,
    { enabled: needsFinancialSummary },
  );
  const collectionRateQuery = useAuthoritativeReportsCollectionRate(
    { from: filters.from, to: filters.to },
    needsCollectionRate,
  );

  const collectionSummaryQuery = useCollectionSummaryReport(financialFilters, {
    enabled: needsOverview || needsCollections,
  });
  const propertyCollectionBreakdownQuery = usePropertyCollectionBreakdownReport(
    financialFilters,
    { enabled: needsPropertyPerformance },
  );
  const financialCashflowQuery = useFinancialCashflowReport(financialFilters, {
    enabled: needsOverview,
  });
  const vatReturnQuery = useVatReturnReport(financialFilters, {
    enabled: needsFinancialStatements,
  });
  const dailyCollectionQuery = useDailyCollectionReport(financialFilters, {
    enabled: needsCollections,
  });
  const expenseBreakdownQuery = useExpenseBreakdownReport(expenseFilters, {
    enabled: needsExpenses,
  });
  const portfolioExpenseQuery = useExpenseBreakdownReport(
    portfolioExpenseFilters,
    { enabled: needsPropertyPerformance && Boolean(filters.propertyId) },
  );
  const overdueInvoicesQuery = useOverdueInvoicesReport(arrearsFilters, {
    enabled: needsOverdue,
  });
  const agedReceivablesQuery = useAgedReceivablesReport(arrearsFilters, {
    enabled: needsOverdue,
  });
  const arrearsSummaryQuery = useArrearsSummaryReport(arrearsFilters, {
    enabled: needsOverdue,
  });
  const contractsQuery = useAllContracts('all', { enabled: true });
  const ownersQuery = useOwners({ enabled: true });
  const tenantStatementQuery = useTenantStatementReport(
    filters.contractId || undefined,
    { enabled: needsTenantStatement },
  );
  const ownerStatementQuery = useOwnerStatementReport(
    filters.ownerId || undefined,
    financialFilters,
    { enabled: needsOwnerStatement },
  );
  const ownerReportPayloadQuery = useQuery({
    queryKey: [
      ...financialReportKeys.ownerStatement(filters.ownerId || '', {
        dateFrom: filters.from,
        dateTo: filters.to,
      }),
      'premium',
      filters.propertyId || '',
    ],
    queryFn: () =>
      loadPremiumOwnerReportPayload({
        ownerId: filters.ownerId,
        from: filters.from,
        to: filters.to,
        propertyId: filters.propertyId || null,
        statement: ownerStatementQuery.data!,
      }),
    enabled:
      needsOwnerStatement &&
      Boolean(
        filters.ownerId &&
        filters.from &&
        filters.to &&
        ownerStatementQuery.data &&
        !ownerStatementQuery.data.error,
      ),
  });
  const unitsQuery = useAllUnits({ enabled: needsOccupancy });
  const maintenanceQuery = useMaintenance('all', '', {
    enabled: needsMaintenance,
  });
  const trialBalanceQuery = useAccountingTrialBalanceReport(filters.asOf, {
    enabled: needsAccountingReports,
  });
  const incomeStatementQuery = useAccountingIncomeStatementReport(
    financialFilters,
    { enabled: needsAccountingReports },
  );
  const balanceSheetQuery = useAccountingBalanceSheetReport(filters.asOf, {
    enabled: needsAccountingReports,
  });
  const receiptsQuery = useReceipts(
    { limit: latestReceiptLimit },
    { enabled: needsCollections || needsDeferredRevenue },
  );
  const costCentersQuery = useCostCenters();
  const propertyTitlesQuery = usePropertyTitles({ enabled: needsOccupancy });
  const needsPreviousPeriod = needsPropertyPerformance && previousRange != null;
  const previousSummaryQuery = useFinancialPeriodSummaryReport(
    previousFinancialFilters,
    { enabled: needsPreviousPeriod },
  );
  const previousExpenseQuery = useExpenseBreakdownReport(
    previousExpenseFilters,
    { enabled: needsPreviousPeriod },
  );
  const previousOverdueQuery = useOverdueInvoicesReport(
    previousArrearsFilters,
    { enabled: needsPreviousPeriod },
  );

  const contracts = contractsQuery.data?.rows ?? [];
  const scopedContracts = useMemo(
    () =>
      contracts.filter((contract) => {
        if (filters.propertyId && contract.property_id !== filters.propertyId)
          return false;
        if (filters.unitId && contract.unit_id !== filters.unitId) return false;
        if (filters.tenantId && contract.tenant_id !== filters.tenantId)
          return false;
        if (filters.contractId && contract.id !== filters.contractId)
          return false;
        return true;
      }),
    [
      contracts,
      filters.contractId,
      filters.propertyId,
      filters.tenantId,
      filters.unitId,
    ],
  );
  const contractById = useMemo(
    () =>
      new Map(contracts.map((contract) => [contract.id, contract] as const)),
    [contracts],
  );
  const allReceipts = receiptsQuery.data ?? [];
  const propertyTitlesById = useMemo(
    () =>
      new Map(
        (propertyTitlesQuery.data ?? []).map(
          (row) => [row.id, row.title] as const,
        ),
      ),
    [propertyTitlesQuery.data],
  );
  const rentRollRows = useMemo(
    () => buildRentRollRows(scopedContracts, contractStatusLabels),
    [scopedContracts],
  );
  const occupancyUnits = useMemo(
    () =>
      (unitsQuery.data ?? []).filter((unit) => {
        if (filters.propertyId && unit.property_id !== filters.propertyId)
          return false;
        if (filters.unitId && unit.id !== filters.unitId) return false;
        return true;
      }),
    [filters.propertyId, filters.unitId, unitsQuery.data],
  );
  const occupancyRows = useMemo(
    () => buildOccupancyRows(occupancyUnits, propertyTitlesById),
    [occupancyUnits, propertyTitlesById],
  );
  const portfolioOccupancyRows = useMemo(
    () => buildOccupancyRows(unitsQuery.data ?? [], propertyTitlesById),
    [propertyTitlesById, unitsQuery.data],
  );
  const occupancyUnitIds = useMemo(
    () => new Set(occupancyUnits.map((unit) => unit.id)),
    [occupancyUnits],
  );
  const occupancyContracts = useMemo(
    () =>
      contracts.filter(
        (contract) =>
          Boolean(contract.unit_id) && occupancyUnitIds.has(contract.unit_id!),
      ),
    [contracts, occupancyUnitIds],
  );
  const vacancyAnalytics = useMemo(
    () =>
      buildVacancyAnalytics(
        occupancyUnits,
        occupancyContracts,
        propertyTitlesById,
        filters.asOf,
      ),
    [filters.asOf, occupancyContracts, occupancyUnits, propertyTitlesById],
  );
  const expiringRows = useMemo(
    () => buildExpiringContractsRows(scopedContracts, new Date()),
    [scopedContracts],
  );
  const maintenanceRows = useMemo(
    () =>
      (maintenanceQuery.data ?? []).filter((request) => {
        if (filters.propertyId && request.property_id !== filters.propertyId)
          return false;
        if (filters.unitId && request.unit_id !== filters.unitId) return false;
        return true;
      }),
    [filters.propertyId, filters.unitId, maintenanceQuery.data],
  );
  const maintenanceSummary = useMemo(
    () => summarizeMaintenanceRequests(maintenanceRows),
    [maintenanceRows],
  );
  const receiptRows = useMemo(
    () =>
      allReceipts
        .filter((receipt) => isWithinDateRange(receipt.payment_date, filters))
        .filter((receipt) => {
          const contract = receipt.contract_id
            ? contractById.get(receipt.contract_id)
            : undefined;
          if (filters.contractId && receipt.contract_id !== filters.contractId)
            return false;
          if (
            filters.propertyId &&
            contract?.property_id !== filters.propertyId
          )
            return false;
          if (filters.unitId && contract?.unit_id !== filters.unitId)
            return false;
          if (filters.tenantId && contract?.tenant_id !== filters.tenantId)
            return false;
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
  const propertyPerformanceRows = useMemo(
    () =>
      buildPropertyPerformanceRows({
        occupancyRows,
        contracts: scopedContracts,
        collectionRows: propertyCollectionBreakdownQuery.data?.rows ?? [],
        period: { from: filters.from, to: filters.to, asOf: filters.asOf },
        overdueRows: overdueInvoicesQuery.data?.rows ?? [],
        expenseRows: expenseBreakdownQuery.data?.byProperty ?? [],
        maintenanceRows,
        vacancyRows: vacancyAnalytics.vacantRows,
      }),
    [
      expenseBreakdownQuery.data?.byProperty,
      filters.asOf,
      filters.from,
      filters.to,
      maintenanceRows,
      occupancyRows,
      overdueInvoicesQuery.data?.rows,
      propertyCollectionBreakdownQuery.data?.rows,
      scopedContracts,
      vacancyAnalytics.vacantRows,
    ],
  );
  /**
   * Property Analytics decision model. Built from the SAME authoritative read
   * models the rest of Reports uses — this hook never recomputes a financial
   * figure, it only assembles already-authoritative values into the
   * deterministic comparison/insight shape. Unavailable sources stay `null`
   * (never a fake zero) all the way through to the presentation layer.
   */
  const propertyAnalyticsInput = useMemo<PropertyAnalyticsInput>(() => {
    const previousSummary = previousSummaryQuery.data;
    const previousUnits = unitsQuery.data ?? [];
    const previousScopedUnits = previousUnits.filter(
      (unit) =>
        (!filters.propertyId || unit.property_id === filters.propertyId) &&
        (!filters.unitId || unit.id === filters.unitId),
    );
    const previousScopedUnitIds = new Set(
      previousScopedUnits.map((unit) => unit.id),
    );
    const previousScopedContracts = contracts.filter(
      (contract) =>
        Boolean(contract.unit_id) &&
        previousScopedUnitIds.has(contract.unit_id!),
    );
    const previousVacancy = previousRange
      ? buildVacancyAnalytics(
          previousScopedUnits,
          previousScopedContracts,
          propertyTitlesById,
          previousRange.to,
        )
      : null;
    return {
      occupancyRows,
      expenseRows: expenseBreakdownQuery.data?.byProperty ?? [],
      performanceRows: propertyPerformanceRows,
      benchmarkOccupancyRows: filters.propertyId
        ? portfolioOccupancyRows
        : undefined,
      benchmarkExpenseRows: filters.propertyId
        ? portfolioExpenseQuery.data?.byProperty
        : undefined,
      periodSummary: financialSummaryQuery.data ?? null,
      overdueTotal: overdueInvoicesQuery.data
        ? overdueInvoicesQuery.data.rows.reduce(
            (sum, row) => sum + row.remainingAmount,
            0,
          )
        : null,
      expenseTotal: expenseBreakdownQuery.data?.totalExpenses ?? null,
      openMaintenanceCount: maintenanceQuery.data
        ? propertyPerformanceRows.reduce(
            (sum, row) => sum + row.openMaintenanceCount,
            0,
          )
        : null,
      expiringContractsCount: contractsQuery.data ? expiringRows.length : null,
      longestVacancyDays:
        vacancyAnalytics.vacantRows.length > 0
          ? vacancyAnalytics.vacantRows.reduce(
              (max, row) => Math.max(max, row.daysVacant),
              0,
            )
          : null,
      // Reference value of vacant stock — a letting-decision reference, never
      // income and never a receivable.
      vacancyReferenceRent:
        vacancyAnalytics.vacantRows.length > 0
          ? vacancyAnalytics.referenceVacantRent
          : null,
      previous:
        previousRange &&
        (previousSummary ||
          previousVacancy ||
          previousOverdueQuery.data ||
          previousExpenseQuery.data)
          ? {
              from: previousRange.from,
              to: previousRange.to,
              occupancyRate:
                previousVacancy && previousVacancy.totalUnits > 0
                  ? rateOf(
                      previousVacancy.occupiedUnits,
                      previousVacancy.totalUnits,
                    )
                  : null,
              due: previousSummary?.invoiced ?? null,
              collected: previousSummary?.paid ?? null,
              overdue: previousOverdueQuery.data?.totalOverdue ?? null,
              expenses: previousExpenseQuery.data?.totalExpenses ?? null,
            }
          : null,
      selectedPropertyId: filters.propertyId || null,
    };
  }, [
    contracts,
    contractsQuery.data,
    expenseBreakdownQuery.data,
    expiringRows.length,
    filters.propertyId,
    filters.unitId,
    financialSummaryQuery.data,
    maintenanceQuery.data,
    occupancyRows,
    overdueInvoicesQuery.data,
    portfolioExpenseQuery.data?.byProperty,
    portfolioOccupancyRows,
    previousExpenseQuery.data,
    previousOverdueQuery.data,
    previousRange,
    previousSummaryQuery.data,
    propertyPerformanceRows,
    propertyTitlesById,
    unitsQuery.data,
    vacancyAnalytics,
  ]);

  const deferredRevenueAudit = useMemo(
    () => buildDeferredRevenueAudit(scopedContracts, receiptRows, filters.asOf),
    [filters.asOf, receiptRows, scopedContracts],
  );

  const retryFailedSources = useCallback(async () => {
    const queries = [
      financialSummaryQuery,
      collectionRateQuery,
      collectionSummaryQuery,
      propertyCollectionBreakdownQuery,
      financialCashflowQuery,
      vatReturnQuery,
      dailyCollectionQuery,
      expenseBreakdownQuery,
      portfolioExpenseQuery,
      overdueInvoicesQuery,
      agedReceivablesQuery,
      arrearsSummaryQuery,
      trialBalanceQuery,
      incomeStatementQuery,
      balanceSheetQuery,
      contractsQuery,
      ownersQuery,
      tenantStatementQuery,
      ownerStatementQuery,
      ownerReportPayloadQuery,
      unitsQuery,
      maintenanceQuery,
      receiptsQuery,
      costCentersQuery,
      propertyTitlesQuery,
      // Comparison sources: a failure here only removes the comparison, it
      // never marks the workspace incomplete — but the user can still retry.
      previousSummaryQuery,
      previousExpenseQuery,
      previousOverdueQuery,
    ];
    await Promise.all(
      queries.filter((query) => query.isError).map((query) => query.refetch()),
    );
  }, [
    financialSummaryQuery,
    collectionRateQuery,
    collectionSummaryQuery,
    propertyCollectionBreakdownQuery,
    financialCashflowQuery,
    vatReturnQuery,
    dailyCollectionQuery,
    expenseBreakdownQuery,
    portfolioExpenseQuery,
    overdueInvoicesQuery,
    agedReceivablesQuery,
    arrearsSummaryQuery,
    trialBalanceQuery,
    incomeStatementQuery,
    balanceSheetQuery,
    contractsQuery,
    ownersQuery,
    tenantStatementQuery,
    ownerStatementQuery,
    ownerReportPayloadQuery,
    unitsQuery,
    maintenanceQuery,
    receiptsQuery,
    costCentersQuery,
    propertyTitlesQuery,
    previousSummaryQuery,
    previousExpenseQuery,
    previousOverdueQuery,
  ]);

  const firstError = firstErrorOf(
    financialSummaryQuery.error,
    collectionRateQuery.error,
    collectionSummaryQuery.error,
    propertyCollectionBreakdownQuery.error,
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
    ownerReportPayloadQuery.error,
    unitsQuery.error,
    maintenanceQuery.error,
    receiptsQuery.error,
    costCentersQuery.error,
    propertyTitlesQuery.error,
  );

  return {
    today: getTodayLocalDateString(),
    firstError,
    isIncomplete: firstError != null,
    retryFailedSources,
    filters: {
      costCenterRows: costCentersQuery.data ?? [],
      ownerRows: ownersQuery.data ?? [],
      contractRows: contracts,
    },
    hero: {
      summary: financialSummaryQuery.data,
      collectionRate: collectionRateQuery.data ?? 0,
      isLoading: isLoadingAny(
        financialSummaryQuery.isLoading,
        collectionRateQuery.isLoading,
      ),
    },
    sections: {
      overview: {
        summary: financialSummaryQuery.data,
        collectionSummary: collectionSummaryQuery.data,
        collectionRate: collectionRateQuery.data ?? 0,
        cashflowRows: financialCashflowQuery.data?.rows ?? [],
        isLoading: isLoadingAny(
          financialSummaryQuery.isLoading,
          collectionRateQuery.isLoading,
          collectionSummaryQuery.isLoading,
          financialCashflowQuery.isLoading,
        ),
      },
      collections: {
        from: filters.from,
        to: filters.to,
        summary: collectionSummaryQuery.data,
        ...(collectionRateQuery.data === undefined
          ? {}
          : { collectionRate: collectionRateQuery.data }),
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
        vacancyAnalytics,
        historyComplete:
          !contractsQuery.isError && !contractsQuery.data?.truncated,
        isLoading: isLoadingAny(
          unitsQuery.isLoading,
          contractsQuery.isLoading,
          propertyTitlesQuery.isLoading,
        ),
      },
      propertyPerformance: {
        rows: propertyPerformanceRows,
        executive: buildPropertyAnalyticsExecutive(propertyAnalyticsInput),
        comparison: buildPropertyAnalyticsComparison(propertyAnalyticsInput),
        benchmark: buildPropertyAnalyticsBenchmark(propertyAnalyticsInput),
        insights: buildPropertyAnalyticsInsights(propertyAnalyticsInput),
        previousPeriod: propertyAnalyticsInput.previous ?? null,
        isLoading: isLoadingAny(
          unitsQuery.isLoading,
          contractsQuery.isLoading,
          propertyCollectionBreakdownQuery.isLoading,
          overdueInvoicesQuery.isLoading,
          expenseBreakdownQuery.isLoading,
          portfolioExpenseQuery.isLoading,
          maintenanceQuery.isLoading,
          propertyTitlesQuery.isLoading,
        ),
      },
      maintenance: {
        rows: maintenanceRows,
        summary: maintenanceSummary,
        isLoading: maintenanceQuery.isLoading,
      },
      deferredRevenue: {
        audit: deferredRevenueAudit,
        asOf: filters.asOf,
        isLoading: isLoadingAny(
          receiptsQuery.isLoading,
          contractsQuery.isLoading,
        ),
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
        isLoading: isLoadingAny(
          trialBalanceQuery.isLoading,
          incomeStatementQuery.isLoading,
          balanceSheetQuery.isLoading,
        ),
      },
      statements: {
        financialSummary: financialSummaryQuery.data,
        vatReturn: vatReturnQuery.data,
        tenantStatement: tenantStatementQuery.data,
        ownerStatement: ownerStatementQuery.data,
        ownerReportPayload: ownerReportPayloadQuery.data,
        selectedContractId: filters.contractId,
        selectedOwnerId: filters.ownerId,
        tenantStatementError: tenantStatementQuery.error,
        ownerStatementError: ownerStatementQuery.error,
        ownerReportPayloadError: ownerReportPayloadQuery.error,
        isTenantStatementLoading: tenantStatementQuery.isLoading,
        isOwnerStatementLoading: ownerStatementQuery.isLoading,
        isOwnerReportPayloadLoading: ownerReportPayloadQuery.isLoading,
        isLoading: isLoadingAny(
          financialSummaryQuery.isLoading,
          vatReturnQuery.isLoading,
        ),
      },
    },
  } as const;
}

export type ReportsWorkspaceModel = ReturnType<typeof useReportsWorkspace>;
