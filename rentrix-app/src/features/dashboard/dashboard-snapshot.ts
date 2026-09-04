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
import { toDateOnlyISO } from '@/lib/formatters';
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
};

export type DashboardBilling = {
  invoicedAmount: number;
  /** All-time active invoice count — onboarding progress truth, not a period KPI. */
  invoicesTotalCount: number;
};

export type DashboardCollections = {
  collectedAmount: number;
  outstandingAmount: number;
  collectionRate: number;
};

export type DashboardExpenses = {
  totalAmount: number;
};

export type DashboardArrears = {
  totalOverdue: number;
  overdueCount: number;
  averageDaysOverdue: number;
  over90Count: number;
  buckets: Record<DashboardAgingBucketKey, DashboardAgingBucket>;
};

export type DashboardOwnerFunds = {
  settlementsDraft: number;
  settlementsApproved: number;
};

export type DashboardMaintenance = {
  urgentOpen: number;
};

export type DashboardExceptions = {
  unmatchedBankLines: number;
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

export type DashboardQueues = {
  expiringContracts: DashboardQueueContractRow[];
  overdueInvoices: DashboardQueueInvoiceRow[];
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
  return toDateOnlyISO(date);
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
    },
    billing: {
      invoicedAmount: toNumber(billing.invoiced_amount),
      invoicesTotalCount: toNumber(billing.invoices_total_count),
    },
    collections: {
      collectedAmount: toNumber(collections.collected_amount),
      outstandingAmount: toNumber(collections.outstanding_amount),
      collectionRate: toNumber(collections.collection_rate),
    },
    expenses: {
      totalAmount: toNumber(expenses.total_amount),
    },
    netCash: toNumber(raw.net_cash),
    arrears: {
      totalOverdue: toNumber(arrears.total_overdue),
      overdueCount: toNumber(arrears.overdue_count),
      averageDaysOverdue: toNumber(arrears.average_days_overdue),
      over90Count: toNumber(arrears.over_90_count),
      buckets: normalizeAgingBuckets(arrears.buckets),
    },
    ownerFunds: {
      settlementsDraft: toNumber(ownerFunds.settlements_draft),
      settlementsApproved: toNumber(ownerFunds.settlements_approved),
    },
    maintenance: {
      urgentOpen: toNumber(maintenance.urgent_open),
    },
    exceptions: {
      unmatchedBankLines: toNumber(exceptions.unmatched_bank_lines),
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
