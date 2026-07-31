import { supabase } from '@/lib/supabase';
import type { Invoice } from '@/types/domain';
import { getInvoiceStatusVariants, normalizeInvoiceStatus } from '../components/invoice-status-labels';
import { sumFinancialValues, toFinancialNumber } from '../financialMath';
import {
  type ContractContext,
  type InvoiceReportRow,
  type PersonContext,
  type PropertyContext,
  type UnitContext,
  getInvoiceReportGrossAmount,
  getInvoiceReportRemainingAmount,
  loadPeopleById,
  loadPropertiesById,
  loadUnitsById,
  mapFromSettledContext,
  matchesInvoiceContext,
  uniqueStrings,
} from './financial-report-rows';
import { fetchCompleteReportRows } from './report-paginated-read';

export type ArrearsReportFilters = {
  asOf: string;
  propertyId?: string;
  tenantId?: string;
  contractId?: string;
};

export type AgingBucketKey = 'current' | 'days_1_30' | 'days_31_60' | 'days_61_90' | 'days_90_plus';

export type AgedReceivablesBucket = {
  key: AgingBucketKey;
  label: string;
  total: number;
  invoiceCount: number;
};

export type OverdueInvoiceReportRow = {
  invoiceId: string;
  shortInvoiceId: string;
  contractId: string;
  tenantId: string | null;
  tenantName: string | null;
  propertyId: string | null;
  propertyTitle: string | null;
  unitId: string | null;
  unitNumber: string | null;
  dueDate: string;
  daysOverdue: number;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  status: Invoice['status'];
};

export type AgedReceivablesGroupRow = {
  contractId: string;
  tenantId: string | null;
  tenantName: string | null;
  propertyId: string | null;
  propertyTitle: string | null;
  unitId: string | null;
  unitNumber: string | null;
  buckets: Record<AgingBucketKey, AgedReceivablesBucket>;
  totalOutstanding: number;
  totalOverdue: number;
  invoiceCount: number;
};

export type AgedReceivablesReport = {
  asOf: string;
  buckets: Record<AgingBucketKey, AgedReceivablesBucket>;
  totalOutstanding: number;
  totalOverdue: number;
  rows: AgedReceivablesGroupRow[];
};

export type OverdueInvoicesReport = {
  asOf: string;
  totalOverdue: number;
  invoiceCount: number;
  rows: OverdueInvoiceReportRow[];
};

export type ArrearsSummaryReport = {
  asOf: string;
  totalOverdue: number;
  overdueInvoiceCount: number;
  over90Amount: number;
  over90InvoiceCount: number;
  averageDaysOverdue: number;
};

export type DashboardArrearsReports = {
  overdueInvoices: OverdueInvoicesReport;
  arrearsSummary: ArrearsSummaryReport;
  agedReceivables: AgedReceivablesReport;
};

const agingBucketLabels: Record<AgingBucketKey, string> = {
  current: 'غير متأخر',
  days_1_30: '1–30 يوم',
  days_31_60: '31–60 يوم',
  days_61_90: '61–90 يوم',
  days_90_plus: 'أكثر من 90 يوم',
};

const agingBucketOrder: AgingBucketKey[] = ['current', 'days_1_30', 'days_31_60', 'days_61_90', 'days_90_plus'];
/**
 * Receivable statuses in EVERY casing found in live data. The previous
 * lowercase-only list silently hid every modern UPPERCASE-status invoice
 * (schema default 'UNPAID', RPC writers) from the whole arrears workspace.
 */
const receivableInvoiceStatuses: Invoice['status'][] = [
  ...getInvoiceStatusVariants('unpaid'),
  ...getInvoiceStatusVariants('partial'),
  ...getInvoiceStatusVariants('overdue'),
];
const millisecondsPerDay = 24 * 60 * 60 * 1000;

const invoiceReportSelect = 'id, contract_id, issue_date, due_date, amount, paid_amount, status, deleted_at, contracts:contract_id(id, property_id, tenant_id, unit_id)';

function createEmptyAgingBuckets(): Record<AgingBucketKey, AgedReceivablesBucket> {
  return agingBucketOrder.reduce((buckets, key) => {
    buckets[key] = { key, label: agingBucketLabels[key], total: 0, invoiceCount: 0 };
    return buckets;
  }, {} as Record<AgingBucketKey, AgedReceivablesBucket>);
}

function parseDateOnly(value: string): number {
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
}

export function calculateDaysOverdue(dueDate: string | null | undefined, asOf: string): number {
  if (!dueDate) return 0;
  const dueTimestamp = parseDateOnly(dueDate);
  const asOfTimestamp = parseDateOnly(asOf);
  if (!Number.isFinite(dueTimestamp) || !Number.isFinite(asOfTimestamp)) return 0;
  return Math.max(0, Math.floor((asOfTimestamp - dueTimestamp) / millisecondsPerDay));
}

export function getAgingBucketKey(dueDate: string | null | undefined, asOf: string): AgingBucketKey {
  if (!dueDate || dueDate > asOf) return 'current';
  const daysOverdue = calculateDaysOverdue(dueDate, asOf);
  if (daysOverdue <= 30) return 'days_1_30';
  if (daysOverdue <= 60) return 'days_31_60';
  if (daysOverdue <= 90) return 'days_61_90';
  return 'days_90_plus';
}

function isReceivableInvoiceStatus(status: Invoice['status']) {
  const canonical = normalizeInvoiceStatus(status);
  return canonical === 'unpaid' || canonical === 'partial' || canonical === 'overdue';
}

export function filterInvoicesForArrearsReport(invoices: InvoiceReportRow[], filters: ArrearsReportFilters) {
  return invoices.filter((invoice) => {
    if (invoice.deleted_at) return false;
    if (!isReceivableInvoiceStatus(invoice.status)) return false;
    if (getInvoiceReportRemainingAmount(invoice) <= 0) return false;
    return matchesInvoiceContext(invoice, filters);
  });
}

type ArrearsContextMaps = {
  tenantsById?: Map<string, PersonContext>;
  propertiesById?: Map<string, PropertyContext>;
  unitsById?: Map<string, UnitContext>;
};

type ArrearsInvoiceRow = InvoiceReportRow & { contracts?: ContractContext | null };
type ArrearsEntityContextFields = Pick<
  OverdueInvoiceReportRow,
  'contractId' | 'tenantId' | 'tenantName' | 'propertyId' | 'propertyTitle' | 'unitId' | 'unitNumber'
>;

function getArrearsEntityContextFields(invoice: ArrearsInvoiceRow, contexts: ArrearsContextMaps = {}): ArrearsEntityContextFields {
  const contract = invoice.contracts ?? null;
  const tenant = contract?.tenant_id ? contexts.tenantsById?.get(contract.tenant_id) : undefined;
  const property = contract?.property_id ? contexts.propertiesById?.get(contract.property_id) : undefined;
  const unit = contract?.unit_id ? contexts.unitsById?.get(contract.unit_id) : undefined;

  return {
    contractId: invoice.contract_id,
    tenantId: contract?.tenant_id ?? null,
    tenantName: tenant?.full_name ?? null,
    propertyId: contract?.property_id ?? null,
    propertyTitle: property?.title ?? null,
    unitId: contract?.unit_id ?? null,
    unitNumber: unit?.unit_number ?? null,
  };
}

function buildOverdueInvoiceRow(invoice: ArrearsInvoiceRow, asOf: string, contexts: ArrearsContextMaps = {}): OverdueInvoiceReportRow {
  return {
    invoiceId: invoice.id,
    shortInvoiceId: invoice.id.slice(0, 8),
    ...getArrearsEntityContextFields(invoice, contexts),
    dueDate: invoice.due_date,
    daysOverdue: calculateDaysOverdue(invoice.due_date, asOf),
    amount: getInvoiceReportGrossAmount(invoice),
    paidAmount: toFinancialNumber(invoice.paid_amount),
    remainingAmount: getInvoiceReportRemainingAmount(invoice),
    status: invoice.status,
  };
}

export function summarizeOverdueInvoicesReport(
  invoices: ArrearsInvoiceRow[],
  filters: ArrearsReportFilters,
  contexts: ArrearsContextMaps = {},
): OverdueInvoicesReport {
  const rows = filterInvoicesForArrearsReport(invoices, filters)
    .filter((invoice) => invoice.due_date <= filters.asOf)
    .map((invoice) => buildOverdueInvoiceRow(invoice, filters.asOf, contexts))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || b.remainingAmount - a.remainingAmount || a.invoiceId.localeCompare(b.invoiceId));

  return {
    asOf: filters.asOf,
    totalOverdue: sumFinancialValues(rows.map((row) => row.remainingAmount)),
    invoiceCount: rows.length,
    rows,
  };
}

function addToAgingBucket(buckets: Record<AgingBucketKey, AgedReceivablesBucket>, key: AgingBucketKey, amount: number) {
  buckets[key] = {
    ...buckets[key],
    total: toFinancialNumber(buckets[key].total) + toFinancialNumber(amount),
    invoiceCount: buckets[key].invoiceCount + 1,
  };
}

function createAgedReceivablesGroup(invoice: ArrearsInvoiceRow, contexts: ArrearsContextMaps = {}): AgedReceivablesGroupRow {
  return {
    ...getArrearsEntityContextFields(invoice, contexts),
    buckets: createEmptyAgingBuckets(),
    totalOutstanding: 0,
    totalOverdue: 0,
    invoiceCount: 0,
  };
}

export function summarizeAgedReceivablesReport(
  invoices: ArrearsInvoiceRow[],
  filters: ArrearsReportFilters,
  contexts: ArrearsContextMaps = {},
): AgedReceivablesReport {
  const buckets = createEmptyAgingBuckets();
  const groupsByContract = new Map<string, AgedReceivablesGroupRow>();
  const receivableInvoices = filterInvoicesForArrearsReport(invoices, filters);

  for (const invoice of receivableInvoices) {
    const remainingAmount = getInvoiceReportRemainingAmount(invoice);
    const bucketKey = getAgingBucketKey(invoice.due_date, filters.asOf);
    addToAgingBucket(buckets, bucketKey, remainingAmount);

    const group = groupsByContract.get(invoice.contract_id) ?? createAgedReceivablesGroup(invoice, contexts);
    addToAgingBucket(group.buckets, bucketKey, remainingAmount);
    group.totalOutstanding = toFinancialNumber(group.totalOutstanding) + remainingAmount;
    if (bucketKey !== 'current') group.totalOverdue = toFinancialNumber(group.totalOverdue) + remainingAmount;
    group.invoiceCount += 1;
    groupsByContract.set(invoice.contract_id, group);
  }

  const rows = Array.from(groupsByContract.values()).sort((a, b) => {
    const aLabel = a.tenantName ?? a.propertyTitle ?? a.contractId;
    const bLabel = b.tenantName ?? b.propertyTitle ?? b.contractId;
    return aLabel.localeCompare(bLabel, 'ar');
  });

  return {
    asOf: filters.asOf,
    buckets,
    totalOutstanding: sumFinancialValues(agingBucketOrder.map((key) => buckets[key].total)),
    totalOverdue: sumFinancialValues(agingBucketOrder.filter((key) => key !== 'current').map((key) => buckets[key].total)),
    rows,
  };
}

export function summarizeArrearsSummaryReport(invoices: ArrearsInvoiceRow[], filters: ArrearsReportFilters): ArrearsSummaryReport {
  const overdueInvoices = filterInvoicesForArrearsReport(invoices, filters).filter((invoice) => invoice.due_date <= filters.asOf);
  const daysOverdueValues = overdueInvoices.map((invoice) => calculateDaysOverdue(invoice.due_date, filters.asOf));
  const over90Invoices = overdueInvoices.filter((invoice) => calculateDaysOverdue(invoice.due_date, filters.asOf) > 90);

  return {
    asOf: filters.asOf,
    totalOverdue: sumFinancialValues(overdueInvoices.map((invoice) => getInvoiceReportRemainingAmount(invoice))),
    overdueInvoiceCount: overdueInvoices.length,
    over90Amount: sumFinancialValues(over90Invoices.map((invoice) => getInvoiceReportRemainingAmount(invoice))),
    over90InvoiceCount: over90Invoices.length,
    averageDaysOverdue: daysOverdueValues.length > 0
      ? toFinancialNumber(sumFinancialValues(daysOverdueValues) / daysOverdueValues.length)
      : 0,
  };
}

async function loadArrearsInvoices(filters: ArrearsReportFilters): Promise<InvoiceReportRow[]> {
  const buildQuery = () => {
    let query = supabase
      .from('invoices')
      .select(invoiceReportSelect)
      .is('deleted_at', null)
      .in('status', receivableInvoiceStatuses)
      .order('id', { ascending: true });

    if (filters.contractId) query = query.eq('contract_id', filters.contractId);
    return query;
  };

  const rows = await fetchCompleteReportRows<InvoiceReportRow>(
    () => buildQuery().returns<InvoiceReportRow[]>(),
    'المتأخرات',
  );
  return filterInvoicesForArrearsReport(rows, filters);
}

async function loadArrearsContextMaps(invoices: ArrearsInvoiceRow[]): Promise<ArrearsContextMaps> {
  const contracts = invoices.map((invoice) => invoice.contracts).filter((contract): contract is ContractContext => Boolean(contract));
  const [tenantsResult, propertiesResult, unitsResult] = await Promise.allSettled([
    loadPeopleById(supabase, uniqueStrings(contracts.map((contract) => contract.tenant_id))),
    loadPropertiesById(supabase, uniqueStrings(contracts.map((contract) => contract.property_id))),
    loadUnitsById(supabase, uniqueStrings(contracts.map((contract) => contract.unit_id))),
  ]);

  return {
    tenantsById: mapFromSettledContext(tenantsResult),
    propertiesById: mapFromSettledContext(propertiesResult),
    unitsById: mapFromSettledContext(unitsResult),
  };
}

export async function getOverdueInvoicesReport(filters: ArrearsReportFilters): Promise<OverdueInvoicesReport> {
  const invoices = await loadArrearsInvoices(filters);
  const overdueInvoices = invoices.filter((invoice) => invoice.due_date <= filters.asOf);
  const contexts = await loadArrearsContextMaps(overdueInvoices);
  return summarizeOverdueInvoicesReport(overdueInvoices, filters, contexts);
}

export async function getAgedReceivablesReport(filters: ArrearsReportFilters): Promise<AgedReceivablesReport> {
  const invoices = await loadArrearsInvoices(filters);
  const contexts = await loadArrearsContextMaps(invoices);
  return summarizeAgedReceivablesReport(invoices, filters, contexts);
}

export async function getArrearsSummaryReport(filters: ArrearsReportFilters): Promise<ArrearsSummaryReport> {
  const invoices = await loadArrearsInvoices(filters);
  return summarizeArrearsSummaryReport(invoices, filters);
}

export async function getDashboardArrearsReports(filters: ArrearsReportFilters): Promise<DashboardArrearsReports> {
  const invoices = await loadArrearsInvoices(filters);
  const contexts = await loadArrearsContextMaps(invoices);

  return {
    overdueInvoices: summarizeOverdueInvoicesReport(invoices, filters, contexts),
    arrearsSummary: summarizeArrearsSummaryReport(invoices, filters),
    agedReceivables: summarizeAgedReceivablesReport(invoices, filters, contexts),
  };
}
