/**
 * R1 — Dashboard Truth.
 *
 * The dashboard reads ONE authoritative, company-isolated read model:
 * public.rpt_dashboard_snapshot(p_from, p_to, p_as_of). Every KPI is an SQL
 * aggregate computed by the database — the browser never derives an
 * authoritative operational or financial number from row datasets
 * (rows.length / client filtering of capped reads is forbidden here).
 *
 * queues.* are bounded (max 5) presentation rows for the work-queue cards.
 * They are display context only and are never used as a KPI source.
 */
import { supabase } from '@/lib/supabase';

export type DashboardPeriod = {
  dateFrom: string;
  dateTo: string;
  asOf: string;
  month: number;
  year: number;
};

export type DashboardAgingBucketKey = 'current' | 'days_1_30' | 'days_31_60' | 'days_61_90' | 'days_90_plus';

export type DashboardAgingBucket = {
  total: number;
  count: number;
};

export type DashboardPortfolio = {
  properties: number;
  units: number;
};

export type DashboardOccupancy = {
  occupiedUnits: number;
  vacantUnits: number;
  occupancyRate: number;
};

export type DashboardContracts = {
  active: number;
  expiring30: number;
  expiring60: number;
  expiring90: number;
};

export type DashboardBilling = {
  invoicedAmount: number;
  invoicesCount: number;
  /** All-time active invoice count — onboarding progress truth, not a period KPI. */
  invoicesTotalCount: number;
};

export type DashboardCollections = {
  collectedAmount: number;
  paymentsCount: number;
  outstandingAmount: number;
  collectionRate: number;
};

export type DashboardExpenses = {
  totalAmount: number;
  count: number;
};

export type DashboardArrears = {
  totalOverdue: number;
  overdueCount: number;
  averageDaysOverdue: number;
  over90Amount: number;
  over90Count: number;
  totalOutstanding: number;
  buckets: Record<DashboardAgingBucketKey, DashboardAgingBucket>;
};

export type DashboardOwnerFunds = {
  netPayable: number;
  settlementsDraft: number;
  settlementsApproved: number;
};

export type DashboardMaintenance = {
  open: number;
  inProgress: number;
  urgentOpen: number;
};

export type DashboardExceptions = {
  unmatchedBankLines: number;
  pendingSettlements: number;
};

export type DashboardQueueContractRow = {
  id: string;
  reference: string | null;
  endDate: string;
  daysRemaining: number;
  tenantName: string | null;
  propertyTitle: string | null;
  unitNumber: string | null;
};

export type DashboardQueueInvoiceRow = {
  invoiceId: string;
  reference: string | null;
  dueDate: string;
  daysOverdue: number;
  remainingAmount: number;
  tenantName: string | null;
  propertyTitle: string | null;
  unitNumber: string | null;
};

export type DashboardQueueMaintenanceRow = {
  id: string;
  title: string | null;
  priority: string | null;
  propertyTitle: string | null;
  unitNumber: string | null;
};

export type DashboardQueues = {
  expiringContracts: DashboardQueueContractRow[];
  overdueInvoices: DashboardQueueInvoiceRow[];
  urgentMaintenance: DashboardQueueMaintenanceRow[];
};

export type DashboardSnapshot = {
  period: DashboardPeriod;
  portfolio: DashboardPortfolio;
  occupancy: DashboardOccupancy;
  contracts: DashboardContracts;
  billing: DashboardBilling;
  collections: DashboardCollections;
  expenses: DashboardExpenses;
  netCash: number;
  arrears: DashboardArrears;
  ownerFunds: DashboardOwnerFunds;
  maintenance: DashboardMaintenance;
  exceptions: DashboardExceptions;
  queues: DashboardQueues;
};

const agingBucketKeys: DashboardAgingBucketKey[] = ['current', 'days_1_30', 'days_31_60', 'days_61_90', 'days_90_plus'];

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function getTodayLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

function normalizeAgingBuckets(value: unknown): Record<DashboardAgingBucketKey, DashboardAgingBucket> {
  const raw = asRecord(value);
  return agingBucketKeys.reduce((buckets, key) => {
    const bucket = asRecord(raw[key]);
    buckets[key] = { total: toNumber(bucket.total), count: toNumber(bucket.count) };
    return buckets;
  }, {} as Record<DashboardAgingBucketKey, DashboardAgingBucket>);
}

function normalizeQueues(value: unknown): DashboardQueues {
  const raw = asRecord(value);

  return {
    expiringContracts: asArray(raw.expiring_contracts).map((row) => {
      const record = asRecord(row);
      return {
        id: toText(record.id),
        reference: toNullableText(record.reference),
        endDate: toText(record.end_date),
        daysRemaining: toNumber(record.days_remaining),
        tenantName: toNullableText(record.tenant_name),
        propertyTitle: toNullableText(record.property_title),
        unitNumber: toNullableText(record.unit_number),
      };
    }),
    overdueInvoices: asArray(raw.overdue_invoices).map((row) => {
      const record = asRecord(row);
      return {
        invoiceId: toText(record.invoice_id),
        reference: toNullableText(record.reference),
        dueDate: toText(record.due_date),
        daysOverdue: toNumber(record.days_overdue),
        remainingAmount: toNumber(record.remaining_amount),
        tenantName: toNullableText(record.tenant_name),
        propertyTitle: toNullableText(record.property_title),
        unitNumber: toNullableText(record.unit_number),
      };
    }),
    urgentMaintenance: asArray(raw.urgent_maintenance).map((row) => {
      const record = asRecord(row);
      return {
        id: toText(record.id),
        title: toNullableText(record.title),
        priority: toNullableText(record.priority),
        propertyTitle: toNullableText(record.property_title),
        unitNumber: toNullableText(record.unit_number),
      };
    }),
  };
}

export function normalizeDashboardSnapshot(data: unknown, period: DashboardPeriod): DashboardSnapshot {
  const raw = asRecord(data);
  const portfolio = asRecord(raw.portfolio);
  const occupancy = asRecord(raw.occupancy);
  const contracts = asRecord(raw.contracts);
  const billing = asRecord(raw.billing);
  const collections = asRecord(raw.collections);
  const expenses = asRecord(raw.expenses);
  const arrears = asRecord(raw.arrears);
  const ownerFunds = asRecord(raw.owner_funds);
  const maintenance = asRecord(raw.maintenance);
  const exceptions = asRecord(raw.exceptions);

  return {
    period,
    portfolio: {
      properties: toNumber(portfolio.properties),
      units: toNumber(portfolio.units),
    },
    occupancy: {
      occupiedUnits: toNumber(occupancy.occupied_units),
      vacantUnits: toNumber(occupancy.vacant_units),
      occupancyRate: toNumber(occupancy.occupancy_rate),
    },
    contracts: {
      active: toNumber(contracts.active),
      expiring30: toNumber(contracts.expiring_30),
      expiring60: toNumber(contracts.expiring_60),
      expiring90: toNumber(contracts.expiring_90),
    },
    billing: {
      invoicedAmount: toNumber(billing.invoiced_amount),
      invoicesCount: toNumber(billing.invoices_count),
      invoicesTotalCount: toNumber(billing.invoices_total_count),
    },
    collections: {
      collectedAmount: toNumber(collections.collected_amount),
      paymentsCount: toNumber(collections.payments_count),
      outstandingAmount: toNumber(collections.outstanding_amount),
      collectionRate: toNumber(collections.collection_rate),
    },
    expenses: {
      totalAmount: toNumber(expenses.total_amount),
      count: toNumber(expenses.count),
    },
    netCash: toNumber(raw.net_cash),
    arrears: {
      totalOverdue: toNumber(arrears.total_overdue),
      overdueCount: toNumber(arrears.overdue_count),
      averageDaysOverdue: toNumber(arrears.average_days_overdue),
      over90Amount: toNumber(arrears.over_90_amount),
      over90Count: toNumber(arrears.over_90_count),
      totalOutstanding: toNumber(arrears.total_outstanding),
      buckets: normalizeAgingBuckets(arrears.buckets),
    },
    ownerFunds: {
      netPayable: toNumber(ownerFunds.net_payable),
      settlementsDraft: toNumber(ownerFunds.settlements_draft),
      settlementsApproved: toNumber(ownerFunds.settlements_approved),
    },
    maintenance: {
      open: toNumber(maintenance.open),
      inProgress: toNumber(maintenance.in_progress),
      urgentOpen: toNumber(maintenance.urgent_open),
    },
    exceptions: {
      unmatchedBankLines: toNumber(exceptions.unmatched_bank_lines),
      pendingSettlements: toNumber(exceptions.pending_settlements),
    },
    queues: normalizeQueues(raw.queues),
  };
}

export async function getDashboardSnapshot(date = new Date()): Promise<DashboardSnapshot> {
  const period = createDashboardPeriod(date);
  const { data, error } = await supabase.rpc('rpt_dashboard_snapshot', {
    p_from: period.dateFrom,
    p_to: period.dateTo,
    p_as_of: period.asOf,
  });
  if (error) throw error;
  return normalizeDashboardSnapshot(data, period);
}
