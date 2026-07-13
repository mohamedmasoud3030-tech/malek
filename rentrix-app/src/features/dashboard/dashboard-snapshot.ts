import { getTodayLocalDateString } from '@/features/financials/financials-date-utils';
import {
  getAgedReceivablesReport,
  getArrearsSummaryReport,
  getFinancialPeriodSummaryReport,
  getOverdueInvoicesReport,
  type AgedReceivablesReport,
  type ArrearsSummaryReport,
  type FinancialPeriodSummaryReport,
  type OverdueInvoicesReport,
} from '@/features/financials/reports/financialReportsService';
import { listContracts, type ContractListItem } from '@/features/contracts/services/contractService';
import { listMaintenance, type Maintenance } from '@/features/maintenance/maintenance-service';
import { getDashboardOverview, type DashboardOverview } from './dashboard-service';

export type DashboardPeriod = {
  dateFrom: string;
  dateTo: string;
  asOf: string;
  month: number;
  year: number;
};

export type DashboardFinancialMetrics = {
  rentDue: number;
  collectedRent: number;
  outstandingRent: number;
  expenses: number;
  netPosition: number;
  invoicesCount: number;
  paymentsCount: number;
  expensesCount: number;
};

export type DashboardOperationalMetrics = {
  properties: number;
  units: number;
  activeContracts: number;
  expiringContracts30Days: number;
  vacantUnits: number;
  occupiedUnits: number;
  occupancyRate: number;
};

export type DashboardArrearsMetrics = {
  totalOverdue: number;
  overdueInvoiceCount: number;
  averageDaysOverdue: number;
  over90Amount: number;
  over90InvoiceCount: number;
  overdueInvoices: OverdueInvoicesReport['rows'];
  agedReceivables: AgedReceivablesReport;
};

export type DashboardDeferredMetric = {
  key: 'recentPayments' | 'tenantStatement' | 'ledgerProfitLoss';
  reason: string;
};

export type DashboardSnapshot = {
  period: DashboardPeriod;
  overview: DashboardOverview;
  financial: DashboardFinancialMetrics;
  operational: DashboardOperationalMetrics;
  arrears: DashboardArrearsMetrics;
  activeContracts: ContractListItem[];
  maintenance: {
    urgentRequests: Maintenance[];
    totalOpen: number;
    totalInProgress: number;
  };
  deferred: DashboardDeferredMetric[];
};

export function createDashboardPeriod(date = new Date()): DashboardPeriod {
  const dateFrom = getTodayLocalDateString(new Date(date.getFullYear(), date.getMonth(), 1));
  const dateTo = getTodayLocalDateString(date);

  return {
    dateFrom,
    dateTo,
    asOf: dateTo,
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
}

export function calculateOccupancyRate(units: number, vacantUnits: number): number {
  if (units <= 0) return 0;
  const occupiedUnits = Math.max(0, units - Math.max(0, vacantUnits));
  return Math.round((occupiedUnits / units) * 100);
}

export function summarizeDashboardFinancialMetrics(periodSummary: FinancialPeriodSummaryReport): DashboardFinancialMetrics {
  return {
    rentDue: periodSummary.invoiced,
    collectedRent: periodSummary.paid,
    outstandingRent: periodSummary.outstanding,
    expenses: periodSummary.expenses,
    netPosition: periodSummary.netCash,
    invoicesCount: periodSummary.invoicesCount,
    paymentsCount: periodSummary.paymentsCount,
    expensesCount: periodSummary.expensesCount,
  };
}

export function summarizeDashboardOperationalMetrics(
  overview: DashboardOverview,
  activeContracts: ContractListItem[],
): DashboardOperationalMetrics {
  const units = overview.operational.units;
  const vacantUnits = overview.operational.vacantUnits;

  return {
    properties: overview.operational.properties,
    units,
    activeContracts: activeContracts.length || overview.operational.activeContracts,
    expiringContracts30Days: overview.operational.expiringContracts30Days,
    vacantUnits,
    occupiedUnits: Math.max(0, units - Math.max(0, vacantUnits)),
    occupancyRate: calculateOccupancyRate(units, vacantUnits),
  };
}

export function summarizeDashboardArrearsMetrics(params: {
  overdueInvoices: OverdueInvoicesReport;
  arrearsSummary: ArrearsSummaryReport;
  agedReceivables: AgedReceivablesReport;
}): DashboardArrearsMetrics {
  return {
    totalOverdue: params.overdueInvoices.totalOverdue,
    overdueInvoiceCount: params.overdueInvoices.invoiceCount,
    averageDaysOverdue: params.arrearsSummary.averageDaysOverdue,
    over90Amount: params.arrearsSummary.over90Amount,
    over90InvoiceCount: params.arrearsSummary.over90InvoiceCount,
    overdueInvoices: params.overdueInvoices.rows,
    agedReceivables: params.agedReceivables,
  };
}

const dashboardDeferredMetrics: DashboardDeferredMetric[] = [
  {
    key: 'recentPayments',
    reason: 'Recent payment rows need a safe row-level payment context before dashboard display; no receipt/payment actions are added in Phase 5.2.',
  },
  {
    key: 'tenantStatement',
    reason: 'Tenant statement behavior belongs to later Tenant/Reports phases and must not be inferred from dashboard rows.',
  },
  {
    key: 'ledgerProfitLoss',
    reason: 'Accounting-grade profit/loss belongs to the later Accounting/Ledger phase; dashboard uses net cash/position from existing reports only.',
  },
];

export async function getDashboardSnapshot(date = new Date()): Promise<DashboardSnapshot> {
  const period = createDashboardPeriod(date);
  const periodFilters = { dateFrom: period.dateFrom, dateTo: period.dateTo };
  const arrearsFilters = { asOf: period.asOf };

  const [
    overview,
    periodSummary,
    overdueInvoices,
    arrearsSummary,
    agedReceivables,
    activeContractsResult,
    maintenanceRows,
  ] = await Promise.all([
    getDashboardOverview(date),
    getFinancialPeriodSummaryReport(periodFilters),
    getOverdueInvoicesReport(arrearsFilters),
    getArrearsSummaryReport(arrearsFilters),
    getAgedReceivablesReport(arrearsFilters),
    listContracts({ status: 'active', page: 1, pageSize: 500 }),
    listMaintenance('all', ''),
  ]);

  const activeContracts = activeContractsResult.rows;
  const urgentRequests = maintenanceRows.filter(
    (request) => request.priority === 'urgent' && (request.status === 'open' || request.status === 'in_progress'),
  );
  const totalOpen = maintenanceRows.filter((request) => request.status === 'open').length;
  const totalInProgress = maintenanceRows.filter((request) => request.status === 'in_progress').length;

  return {
    period,
    overview,
    financial: summarizeDashboardFinancialMetrics(periodSummary),
    operational: summarizeDashboardOperationalMetrics(overview, activeContracts),
    arrears: summarizeDashboardArrearsMetrics({ overdueInvoices, arrearsSummary, agedReceivables }),
    activeContracts,
    maintenance: {
      urgentRequests,
      totalOpen,
      totalInProgress,
    },
    deferred: dashboardDeferredMetrics,
  };
}
