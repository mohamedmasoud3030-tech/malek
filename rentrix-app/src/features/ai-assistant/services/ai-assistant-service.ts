import { getContractStatusVariants } from '@/lib/contractStatus';
import { getMaintenanceStatusVariants, normalizeMaintenancePriority, normalizeMaintenanceStatus } from '@/lib/maintenanceStatus';
import { deriveMaintenanceAttention } from '@/features/maintenance/maintenance-attention';
import type { Maintenance } from '@/features/maintenance/maintenance-service';
import { chunkForInFilter, fetchAllRows } from '@/lib/paginatedRead';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import type { Contract, Expense, Invoice, Payment, Property, Unit } from '@/types/domain';
import type {
  AiAssistantAction,
  AiAssistantContext,
  AiAssistantEntityContext,
  AiAssistantHistoryMessage,
  AiAssistantMaintenanceRequest,
  AiAssistantRequest,
  AiAssistantResponse,
  AiAssistantSurfaceContext,
} from '../types';
import { AiAssistantConfigurationError, looksLikeRawSqlPrompt } from './ai-assistant-guardrails';

export { AiAssistantConfigurationError, isAiAssistantConfigurationError, looksLikeRawSqlPrompt } from './ai-assistant-guardrails';

const sampleLimit = 500;
const topListLimit = 25;
/**
 * Payload row caps. The Edge Function enforces a strict serialized-context
 * budget (≤ 9,000 chars) and per-list caps (≤ 25 rows); the richer v3 context
 * (names, maintenance, vacancy, performance) must stay within it.
 */
const topInvoicePayloadLimit = 10;
const topRenewalPayloadLimit = 10;
const topMaintenancePayloadLimit = 4;
const topVacantUnitPayloadLimit = 6;
const topPropertyPerformancePayloadLimit = 3;
const maxNameLength = 60;
const renewalLookaheadDays = 90;

type InvoiceContextRow = Pick<Invoice, 'id' | 'contract_id' | 'due_date' | 'amount' | 'paid_amount' | 'status' | 'deleted_at'>;
type ContractRenewalRow = Pick<Contract, 'id' | 'property_id' | 'tenant_id' | 'unit_id' | 'end_date' | 'rent_amount' | 'status' | 'deleted_at'>;
type PropertySnapshotRow = Pick<Property, 'id' | 'status' | 'deleted_at'>;
type UnitSnapshotRow = Pick<Unit, 'id' | 'status' | 'deleted_at'> & {
  name?: string | null;
  unit_number?: string | null;
  property_id?: string | null;
  properties?: JoinedNameRecord;
};
type PaymentSnapshotRow = Pick<Payment, 'id' | 'amount' | 'payment_date' | 'status' | 'deleted_at'>;
type ExpenseSnapshotRow = Pick<Expense, 'id' | 'amount' | 'expense_date' | 'deleted_at'>;

/** Nested PostgREST joins arrive as an object (FK) or a single-entry array. */
type JoinedNameRecord =
  | { full_name?: string | null; title?: string | null; name?: string | null; unit_number?: string | null }
  | Array<{ full_name?: string | null; title?: string | null; name?: string | null; unit_number?: string | null }>
  | null
  | undefined;

type ContractNameRow = {
  id: string;
  property_id: string | null;
  tenant_id: string | null;
  people?: JoinedNameRecord;
  properties?: JoinedNameRecord;
};

type MaintenanceContextRow = {
  id: string;
  title: string | null;
  priority: string | null;
  status: string | null;
  request_date: string | null;
  scheduled_date: string | null;
  created_at: string | null;
  property_id: string | null;
  properties?: JoinedNameRecord;
};

type DepositContextRow = {
  id: string;
  remaining_amount: number | null;
  status: string | null;
};

type FunctionErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
};

type FunctionSuccessBody = {
  reply?: string;
  grounded?: boolean;
  caveats?: string[];
  meta?: {
    source?: 'deterministic' | 'model' | 'fallback';
    kind?: 'data' | 'advisory';
  };
};

function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function sum(values: number[]): number {
  return Number(values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0).toFixed(3));
}

function remainingAmount(invoice: { amount: number | null; paid_amount: number | null }): number {
  return Math.max(0, Number(invoice.amount ?? 0) - Number(invoice.paid_amount ?? 0));
}

function isOpenInvoiceStatus(status: string | null | undefined): boolean {
  const normalized = status?.toLowerCase() ?? '';
  return !['paid', 'void', 'draft', 'cancelled', 'canceled'].includes(normalized);
}

function isActivePayment(payment: PaymentSnapshotRow): boolean {
  return !payment.deleted_at && payment.status?.toUpperCase() !== 'VOID';
}

function boundedName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > maxNameLength ? `${trimmed.slice(0, maxNameLength - 1)}…` : trimmed;
}

function joinedName(record: JoinedNameRecord, ...fields: Array<'full_name' | 'title' | 'name' | 'unit_number'>): string | null {
  const entry = Array.isArray(record) ? record[0] : record;
  if (!entry) return null;
  for (const field of fields) {
    const name = boundedName(entry[field]);
    if (name) return name;
  }
  return null;
}

function daysBetweenDates(isoFrom: string, isoTo: string): number {
  const from = Date.parse(`${isoFrom}T00:00:00Z`);
  const to = Date.parse(`${isoTo}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

const closedInvoiceStatuses = [
  'paid',
  'PAID',
  'void',
  'VOID',
  'draft',
  'DRAFT',
  'cancelled',
  'CANCELLED',
  'canceled',
  'CANCELED',
];
const closedInvoiceStatusFilter = `(${closedInvoiceStatuses.join(',')})`;

async function fetchOpenInvoiceContextRows(asOf: string) {
  let data: InvoiceContextRow[];
  try {
    ({ rows: data } = await fetchAllRows<InvoiceContextRow>(() => supabase
      .from('invoices')
      .select('id, contract_id, due_date, amount, paid_amount, status, deleted_at')
      .is('deleted_at', null)
      .lte('due_date', asOf)
      .not('status', 'in', closedInvoiceStatusFilter)
      .order('due_date', { ascending: true }) as any));
  } catch (error) {
    handleSupabaseError(error, 'تعذر تجهيز ملخص الفواتير المتأخرة');
    throw error;
  }
  return data.filter((invoice) => isOpenInvoiceStatus(invoice.status));
}

async function fetchContractRenewals(asOf: string, until: string) {
  const { data, error } = await supabase
    .from('contracts')
    .select('id, property_id, tenant_id, unit_id, end_date, rent_amount, status, deleted_at')
    .is('deleted_at', null)
    .in('status', getContractStatusVariants('active') as Contract['status'][])
    .gte('end_date', asOf)
    .lte('end_date', until)
    .order('end_date', { ascending: true })
    .limit(topListLimit)
    .returns<ContractRenewalRow[]>();

  if (error) handleSupabaseError(error, 'تعذر تجهيز ملخص العقود القريبة من التجديد');
  return data ?? [];
}

async function fetchSnapshotRows(asOf: string, thirtyDaysAgo: string, ninetyDaysAgo: string) {
  const results = await Promise.all([
    fetchAllRows<PropertySnapshotRow>(() => supabase.from('properties').select('id, status, deleted_at').is('deleted_at', null) as any),
    fetchAllRows<UnitSnapshotRow>(() => supabase.from('units').select('id, status, deleted_at, name, unit_number, property_id, properties:property_id(title, name)').is('deleted_at', null) as any),
    fetchAllRows<PaymentSnapshotRow>(() => supabase.from('payments').select('id, amount, payment_date, status, deleted_at').is('deleted_at', null).gte('payment_date', thirtyDaysAgo).lte('payment_date', asOf) as any),
    fetchAllRows<ExpenseSnapshotRow>(() => supabase.from('expenses').select('id, amount, expense_date, deleted_at').is('deleted_at', null).gte('expense_date', ninetyDaysAgo).lte('expense_date', asOf) as any),
  ]);

  return {
    properties: results[0].rows,
    units: results[1].rows,
    payments: results[2].rows,
    expenses90: results[3].rows,
  };
}

/**
 * Loads tenant/property display names for the contracts behind the overdue
 * invoices. Bounded: unique contract ids only, capped at `sampleLimit`, read
 * in `.in()` chunks. Failures degrade to a name-less (but still correct)
 * context instead of failing the assistant.
 */
async function fetchContractNameMap(contractIds: readonly string[]): Promise<Map<string, ContractNameRow>> {
  const map = new Map<string, ContractNameRow>();
  const uniqueIds = [...new Set(contractIds)].slice(0, sampleLimit);
  if (uniqueIds.length === 0) return map;
  try {
    for (const chunk of chunkForInFilter(uniqueIds)) {
      const { data, error } = await supabase
        .from('contracts')
        .select('id, property_id, tenant_id, people:people!contracts_tenant_id_fkey(full_name), properties:properties!contracts_property_id_fkey(title, name)')
        .in('id', chunk)
        .returns<ContractNameRow[]>();
      if (error || !Array.isArray(data)) return map;
      for (const row of data) {
        if (row && typeof row.id === 'string') map.set(row.id, row);
      }
    }
  } catch {
    return map;
  }
  return map;
}

async function fetchMaintenanceContextRows(): Promise<MaintenanceContextRow[] | null> {
  // Reuse the canonical lifecycle vocabulary: only unfinished work
  // (open / in progress) and finished-but-unclosed work (resolved) matter to
  // the operational snapshot.
  const statuses = [
    ...getMaintenanceStatusVariants('open'),
    ...getMaintenanceStatusVariants('in_progress'),
    ...getMaintenanceStatusVariants('resolved'),
  ];
  try {
    const { data, error } = await supabase
      .from('maintenance_records')
      .select('id, title, priority, status, request_date, scheduled_date, created_at, property_id, properties:property_id(title, name)')
      .is('deleted_at', null)
      .in('status', statuses)
      .order('request_date', { ascending: true })
      .limit(sampleLimit)
      .returns<MaintenanceContextRow[]>();
    // Failure means "unknown", never "zero": the section is omitted so the
    // deterministic layer answers "data unavailable" instead of asserting an
    // empty queue.
    if (error || !Array.isArray(data)) return null;
    return data;
  } catch {
    return null;
  }
}

async function fetchDepositContextRows(): Promise<DepositContextRow[] | null> {
  try {
    const { data, error } = await supabase
      .from('tenant_deposits')
      .select('id, remaining_amount, status')
      .is('deleted_at', null)
      .limit(sampleLimit)
      .returns<DepositContextRow[]>();
    if (error || !Array.isArray(data)) return null;
    return data;
  } catch {
    return null;
  }
}

function buildMaintenanceSnapshot(rows: MaintenanceContextRow[], asOf: string): AiAssistantContext['maintenanceSnapshot'] {
  let openCount = 0;
  let inProgressCount = 0;
  let urgentOpenCount = 0;
  let stalledCount = 0;
  let awaitingClosureCount = 0;
  let oldestOpenAgeDays = 0;

  const ranked: Array<{ row: MaintenanceContextRow; urgent: boolean; ageDays: number; status: string }> = [];
  for (const row of rows) {
    const status = normalizeMaintenanceStatus(row.status);
    const priority = normalizeMaintenancePriority(row.priority);
    const attention = deriveMaintenanceAttention(row as unknown as Maintenance, asOf);
    if (status === 'open') openCount += 1;
    if (status === 'in_progress') inProgressCount += 1;
    if (priority === 'urgent' && (status === 'open' || status === 'in_progress')) urgentOpenCount += 1;
    if (attention.isStalled) stalledCount += 1;
    if (attention.isAwaitingClosure) awaitingClosureCount += 1;
    if ((status === 'open' || status === 'in_progress') && attention.ageDays !== null) {
      oldestOpenAgeDays = Math.max(oldestOpenAgeDays, attention.ageDays);
    }
    if (status === 'open' || status === 'in_progress') {
      ranked.push({ row, urgent: priority === 'urgent', ageDays: attention.ageDays ?? 0, status });
    }
  }

  ranked.sort((left, right) => {
    if (left.urgent !== right.urgent) return left.urgent ? -1 : 1;
    return right.ageDays - left.ageDays;
  });

  const topRequests: AiAssistantMaintenanceRequest[] = ranked.slice(0, topMaintenancePayloadLimit).map((entry) => ({
    requestId: entry.row.id,
    propertyName: joinedName(entry.row.properties, 'title', 'name'),
    issue: boundedName(entry.row.title),
    priority: normalizeMaintenancePriority(entry.row.priority),
    status: entry.status,
    openedDate: entry.row.request_date ?? entry.row.created_at?.slice(0, 10) ?? null,
    ageDays: entry.ageDays,
  }));

  return {
    openCount,
    inProgressCount,
    urgentOpenCount,
    stalledCount,
    awaitingClosureCount,
    oldestOpenAgeDays,
    topRequests,
  };
}

/**
 * Contextual copilot — scoped, authoritative entity snapshot.
 *
 * The route-derived id is never trusted on its own: the entity context only
 * exists when the referenced row loads through the same permission-filtered
 * client every workspace uses. Any failure (missing row, RLS denial, query
 * error) degrades to the general assistant instead of guessing.
 */
async function loadEntityContext(
  surface: AiAssistantSurfaceContext,
  asOf: string,
  openInvoices: InvoiceContextRow[],
): Promise<AiAssistantEntityContext | undefined> {
  const { entityType, entityId } = surface;
  if (!entityType || !entityId) return undefined;

  const outstandingFor = (contractIds: ReadonlySet<string>) => {
    const scoped = openInvoices.filter((invoice) => contractIds.has(invoice.contract_id) && remainingAmount(invoice) > 0);
    return {
      outstandingAmount: sum(scoped.map(remainingAmount)),
      oldestOverdueDate: scoped.length ? scoped.reduce((oldest, invoice) => (invoice.due_date < oldest ? invoice.due_date : oldest), scoped[0].due_date) : null,
    };
  };

  try {
    if (entityType === 'property') {
      const { data, error } = await supabase
        .from('properties')
        .select('id, title, name, status')
        .eq('id', entityId)
        .is('deleted_at', null)
        .limit(1)
        .returns<Array<{ id: string; title: string | null; name: string | null; status: string | null }>>();
      const property = !error && Array.isArray(data) ? data[0] : undefined;
      if (!property) return undefined;

      const [unitsResult, contractsResult] = await Promise.all([
        supabase.from('units').select('id, status').eq('property_id', entityId).is('deleted_at', null).limit(1000)
          .returns<Array<{ id: string; status: string | null }>>(),
        supabase.from('contracts').select('id, rent_amount, status').eq('property_id', entityId).is('deleted_at', null).limit(1000)
          .returns<Array<{ id: string; rent_amount: number | null; status: string | null }>>(),
      ]);
      const units = !unitsResult.error && Array.isArray(unitsResult.data) ? unitsResult.data : [];
      const contracts = !contractsResult.error && Array.isArray(contractsResult.data) ? contractsResult.data : [];
      const activeStatuses = new Set(getContractStatusVariants('active').map((status) => status.toLowerCase()));
      const activeContracts = contracts.filter((contract) => activeStatuses.has(String(contract.status ?? '').toLowerCase()));
      const { outstandingAmount, oldestOverdueDate } = outstandingFor(new Set(contracts.map((contract) => contract.id)));

      return {
        type: 'property',
        id: property.id,
        name: boundedName(property.title) ?? boundedName(property.name),
        status: boundedName(property.status),
        unitCount: units.length,
        occupiedUnitCount: units.filter((unit) => ['occupied', 'rented'].includes(String(unit.status ?? '').trim().toLowerCase())).length,
        activeContractCount: activeContracts.length,
        monthlyRentAmount: sum(activeContracts.map((contract) => Number(contract.rent_amount ?? 0))),
        outstandingAmount,
        oldestOverdueDate,
      };
    }

    if (entityType === 'unit') {
      const { data, error } = await supabase
        .from('units')
        .select('id, name, unit_number, status, rent_amount, property_id, properties:property_id(title, name)')
        .eq('id', entityId)
        .is('deleted_at', null)
        .limit(1)
        .returns<Array<UnitSnapshotRow & { rent_amount: number | null }>>();
      const unit = !error && Array.isArray(data) ? data[0] : undefined;
      if (!unit) return undefined;

      const contractsResult = await supabase
        .from('contracts')
        .select('id, rent_amount, tenant_id, people:tenant_id(full_name)')
        .eq('unit_id', entityId)
        .is('deleted_at', null)
        .in('status', getContractStatusVariants('active') as Contract['status'][])
        .limit(5)
        .returns<Array<{ id: string; rent_amount: number | null; tenant_id: string | null; people?: JoinedNameRecord }>>();
      const contracts = !contractsResult.error && Array.isArray(contractsResult.data) ? contractsResult.data : [];
      const { outstandingAmount, oldestOverdueDate } = outstandingFor(new Set(contracts.map((contract) => contract.id)));

      return {
        type: 'unit',
        id: unit.id,
        name: boundedName(unit.name) ?? boundedName(unit.unit_number),
        status: boundedName(unit.status),
        propertyName: joinedName(unit.properties, 'title', 'name'),
        tenantName: contracts.length ? joinedName(contracts[0].people, 'full_name') : null,
        rentAmount: contracts.length ? Number(contracts[0].rent_amount ?? 0) : Number(unit.rent_amount ?? 0),
        outstandingAmount,
        oldestOverdueDate,
      };
    }

    if (entityType === 'contract') {
      const { data, error } = await supabase
        .from('contracts')
        .select('id, status, rent_amount, start_date, end_date, tenant_id, property_id, unit_id, people:people!contracts_tenant_id_fkey(full_name), properties:properties!contracts_property_id_fkey(title, name), units:units!contracts_unit_id_fkey(name, unit_number)')
        .eq('id', entityId)
        .is('deleted_at', null)
        .limit(1)
        .returns<Array<{
          id: string;
          status: string | null;
          rent_amount: number | null;
          start_date: string | null;
          end_date: string | null;
          people?: JoinedNameRecord;
          properties?: JoinedNameRecord;
          units?: JoinedNameRecord;
        }>>();
      const contract = !error && Array.isArray(data) ? data[0] : undefined;
      if (!contract) return undefined;

      const { outstandingAmount, oldestOverdueDate } = outstandingFor(new Set([contract.id]));

      let nextDueDate: string | null = null;
      const upcomingResult = await supabase
        .from('invoices')
        .select('id, due_date, amount, paid_amount, status')
        .eq('contract_id', entityId)
        .is('deleted_at', null)
        .gte('due_date', asOf)
        .not('status', 'in', closedInvoiceStatusFilter)
        .order('due_date', { ascending: true })
        .limit(5)
        .returns<Array<{ id: string; due_date: string; amount: number | null; paid_amount: number | null; status: string | null }>>();
      const upcoming = !upcomingResult.error && Array.isArray(upcomingResult.data) ? upcomingResult.data : [];
      nextDueDate = upcoming.find((invoice) => isOpenInvoiceStatus(invoice.status) && remainingAmount(invoice) > 0)?.due_date ?? null;

      return {
        type: 'contract',
        id: contract.id,
        name: joinedName(contract.people, 'full_name'),
        status: boundedName(contract.status),
        tenantName: joinedName(contract.people, 'full_name'),
        propertyName: joinedName(contract.properties, 'title', 'name'),
        unitName: joinedName(contract.units, 'name', 'unit_number'),
        rentAmount: Number(contract.rent_amount ?? 0),
        startDate: contract.start_date,
        endDate: contract.end_date,
        outstandingAmount,
        oldestOverdueDate,
        nextDueDate,
      };
    }

    if (entityType === 'tenant' || entityType === 'person') {
      const { data, error } = await supabase
        .from('people')
        .select('id, full_name')
        .eq('id', entityId)
        .is('deleted_at', null)
        .limit(1)
        .returns<Array<{ id: string; full_name: string | null }>>();
      const person = !error && Array.isArray(data) ? data[0] : undefined;
      if (!person) return undefined;

      const contractsResult = await supabase
        .from('contracts')
        .select('id, status')
        .eq('tenant_id', entityId)
        .is('deleted_at', null)
        .limit(1000)
        .returns<Array<{ id: string; status: string | null }>>();
      const contracts = !contractsResult.error && Array.isArray(contractsResult.data) ? contractsResult.data : [];
      const activeStatuses = new Set(getContractStatusVariants('active').map((status) => status.toLowerCase()));
      const { outstandingAmount, oldestOverdueDate } = outstandingFor(new Set(contracts.map((contract) => contract.id)));

      return {
        type: entityType,
        id: person.id,
        name: boundedName(person.full_name),
        activeContractCount: contracts.filter((contract) => activeStatuses.has(String(contract.status ?? '').toLowerCase())).length,
        outstandingAmount,
        oldestOverdueDate,
      };
    }

    if (entityType === 'owner') {
      const { data, error } = await supabase
        .from('owners')
        .select('id, full_name, display_name, name')
        .eq('id', entityId)
        .is('deleted_at', null)
        .limit(1)
        .returns<Array<{ id: string; full_name: string | null; display_name: string | null; name: string | null }>>();
      const owner = !error && Array.isArray(data) ? data[0] : undefined;
      if (!owner) return undefined;

      const ownershipResult = await supabase
        .from('property_owners')
        .select('property_id')
        .eq('owner_id', entityId)
        .limit(1000)
        .returns<Array<{ property_id: string | null }>>();
      const propertyIds = [...new Set(
        (!ownershipResult.error && Array.isArray(ownershipResult.data) ? ownershipResult.data : [])
          .map((row) => row.property_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      )];

      let contracts: Array<{ id: string; status: string | null }> = [];
      if (propertyIds.length > 0) {
        const contractsResult = await supabase
          .from('contracts')
          .select('id, status')
          .in('property_id', propertyIds.slice(0, 250))
          .is('deleted_at', null)
          .limit(1000)
          .returns<Array<{ id: string; status: string | null }>>();
        contracts = !contractsResult.error && Array.isArray(contractsResult.data) ? contractsResult.data : [];
      }
      const activeStatuses = new Set(getContractStatusVariants('active').map((status) => status.toLowerCase()));
      const { outstandingAmount, oldestOverdueDate } = outstandingFor(new Set(contracts.map((contract) => contract.id)));

      return {
        type: 'owner',
        id: owner.id,
        name: boundedName(owner.display_name) ?? boundedName(owner.full_name) ?? boundedName(owner.name),
        propertyCount: propertyIds.length,
        activeContractCount: contracts.filter((contract) => activeStatuses.has(String(contract.status ?? '').toLowerCase())).length,
        outstandingAmount,
        oldestOverdueDate,
      };
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export async function buildAiAssistantContext(surface?: AiAssistantSurfaceContext): Promise<AiAssistantContext> {
  const now = new Date();
  const asOf = toDateOnly(now);
  const renewalUntil = toDateOnly(addDays(now, renewalLookaheadDays));
  const thirtyDaysAgo = toDateOnly(addDays(now, -30));
  const ninetyDaysAgo = toDateOnly(addDays(now, -90));

  const [openInvoices, contractRenewals, snapshot, maintenanceRows, depositRows] = await Promise.all([
    fetchOpenInvoiceContextRows(asOf),
    fetchContractRenewals(asOf, renewalUntil),
    fetchSnapshotRows(asOf, thirtyDaysAgo, ninetyDaysAgo),
    fetchMaintenanceContextRows(),
    fetchDepositContextRows(),
  ]);

  const overdueInvoices = openInvoices
    .filter((invoice) => remainingAmount(invoice) > 0)
    .sort((left, right) => left.due_date.localeCompare(right.due_date));
  const dueTodayInvoices = overdueInvoices.filter((invoice) => invoice.due_date === asOf);
  const contractNames = await fetchContractNameMap(overdueInvoices.map((invoice) => invoice.contract_id));
  const activePayments = snapshot.payments.filter(isActivePayment);
  const invoiceAmountLast30Days = openInvoices
    .filter((invoice) => invoice.due_date >= thirtyDaysAgo)
    .map((invoice) => Number(invoice.amount ?? 0));
  const expenses30 = snapshot.expenses90.filter((expense) => expense.expense_date >= thirtyDaysAgo);
  const occupiedUnitCount = snapshot.units.filter((unit) => ['occupied', 'rented'].includes(String(unit.status ?? '').trim().toLowerCase())).length;
  const vacantUnits = snapshot.units.filter((unit) => String(unit.status ?? '').trim().toLowerCase() === 'available');
  const unitCount = snapshot.units.length;

  // Outstanding grouped by property for "which property is behind" answers.
  const outstandingByProperty = new Map<string, { propertyName: string | null; outstandingAmount: number; openInvoiceCount: number }>();
  for (const invoice of overdueInvoices) {
    const contract = contractNames.get(invoice.contract_id);
    if (!contract?.property_id) continue;
    const entry = outstandingByProperty.get(contract.property_id) ?? {
      propertyName: joinedName(contract.properties, 'title', 'name'),
      outstandingAmount: 0,
      openInvoiceCount: 0,
    };
    entry.outstandingAmount = Number((entry.outstandingAmount + remainingAmount(invoice)).toFixed(3));
    entry.openInvoiceCount += 1;
    outstandingByProperty.set(contract.property_id, entry);
  }
  const topOutstanding = [...outstandingByProperty.entries()]
    .map(([propertyId, entry]) => ({ propertyId, ...entry }))
    .sort((left, right) => right.outstandingAmount - left.outstandingAmount)
    .slice(0, topPropertyPerformancePayloadLimit);

  const heldDeposits = (depositRows ?? []).filter((deposit) => Number(deposit.remaining_amount ?? 0) > 0);

  const context: AiAssistantContext = {
    asOf,
    sampleLimit,
    overdueInvoices: {
      invoiceCount: overdueInvoices.length,
      totalOutstanding: sum(overdueInvoices.map(remainingAmount)),
      oldestDueDate: overdueInvoices[0]?.due_date ?? null,
      topInvoices: overdueInvoices.slice(0, topInvoicePayloadLimit).map((invoice) => {
        const contract = contractNames.get(invoice.contract_id);
        return {
          invoiceId: invoice.id,
          contractId: invoice.contract_id,
          dueDate: invoice.due_date,
          remainingAmount: remainingAmount(invoice),
          status: invoice.status,
          tenantName: contract ? joinedName(contract.people, 'full_name') : null,
          propertyName: contract ? joinedName(contract.properties, 'title', 'name') : null,
          daysOverdue: daysBetweenDates(invoice.due_date, asOf),
        };
      }),
      dueTodayCount: dueTodayInvoices.length,
      dueTodayAmount: sum(dueTodayInvoices.map(remainingAmount)),
    },
    contractRenewals: {
      lookaheadDays: renewalLookaheadDays,
      contractCount: contractRenewals.length,
      totalRentAmount: sum(contractRenewals.map((contract) => Number(contract.rent_amount ?? 0))),
      upcomingContracts: contractRenewals.slice(0, topRenewalPayloadLimit).map((contract) => ({
        contractId: contract.id,
        propertyId: contract.property_id,
        tenantId: contract.tenant_id,
        unitId: contract.unit_id,
        endDate: contract.end_date,
        rentAmount: Number(contract.rent_amount ?? 0),
      })),
    },
    propertyFinancialSnapshot: {
      propertyCount: snapshot.properties.length,
      activePropertyCount: snapshot.properties.filter((property) => String(property.status ?? '').trim().toLowerCase() === 'active').length,
      unitCount,
      occupiedUnitCount,
      vacantUnitCount: vacantUnits.length,
      occupancyRate: unitCount > 0 ? Number(((occupiedUnitCount / unitCount) * 100).toFixed(2)) : 0,
      outstandingInvoiceAmount: sum(overdueInvoices.map(remainingAmount)),
      expensesLast90Days: sum(snapshot.expenses90.map((expense) => Number(expense.amount ?? 0))),
    },
    reportSummary: {
      invoicesLast30Days: invoiceAmountLast30Days.length,
      invoiceAmountLast30Days: sum(invoiceAmountLast30Days),
      paymentsLast30Days: activePayments.length,
      paymentAmountLast30Days: sum(activePayments.map((payment) => Number(payment.amount ?? 0))),
      expensesLast30Days: expenses30.length,
      expenseAmountLast30Days: sum(expenses30.map((expense) => Number(expense.amount ?? 0))),
    },
    maintenanceSnapshot: maintenanceRows === null ? undefined : buildMaintenanceSnapshot(maintenanceRows, asOf),
    vacancyDetail: {
      topVacantUnits: vacantUnits.slice(0, topVacantUnitPayloadLimit).map((unit) => ({
        unitId: unit.id,
        propertyName: joinedName(unit.properties, 'title', 'name'),
        unitName: boundedName(unit.name) ?? boundedName(unit.unit_number),
      })),
    },
    propertyPerformance: { topOutstanding },
    depositHeld: depositRows === null
      ? undefined
      : {
          totalHeld: sum(heldDeposits.map((deposit) => Number(deposit.remaining_amount ?? 0))),
          heldCount: heldDeposits.length,
        },
  };

  if (surface) {
    const entity = await loadEntityContext(surface, asOf, openInvoices);
    context.surface = {
      route: surface.route.slice(0, 200),
      entityType: entity ? surface.entityType : null,
      entityId: entity ? surface.entityId : null,
      entityLabel: entity?.name ?? null,
      section: surface.section,
    };
    if (entity) context.entity = entity;
  }

  return context;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readErrorBody(value: unknown): FunctionErrorBody {
  if (!isRecord(value) || !isRecord(value.error)) return {};
  return {
    error: {
      code: typeof value.error.code === 'string' ? value.error.code : undefined,
      message: typeof value.error.message === 'string' ? value.error.message : undefined,
    },
  };
}

function readSuccessBody(value: unknown): FunctionSuccessBody {
  if (!isRecord(value)) return {};
  const meta = isRecord(value.meta) && ['deterministic', 'model', 'fallback'].includes(String(value.meta.source))
    ? {
        source: value.meta.source as 'deterministic' | 'model' | 'fallback',
        kind: value.meta.kind === 'advisory' || value.meta.kind === 'data'
          ? (value.meta.kind as 'data' | 'advisory')
          : undefined,
      }
    : undefined;
  const caveats = Array.isArray(value.caveats) && value.caveats.length <= 5
    && value.caveats.every((entry) => typeof entry === 'string' && entry.length <= 500)
    ? value.caveats as string[]
    : undefined;
  return {
    reply: typeof value.reply === 'string' && value.reply.length <= 6_000 ? value.reply : undefined,
    grounded: typeof value.grounded === 'boolean' ? value.grounded : undefined,
    caveats,
    meta,
  };
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) handleSupabaseError(error, 'تعذر قراءة جلسة المستخدم');
  const token = data.session?.access_token;
  if (!token) throw new Error('يجب تسجيل الدخول لاستخدام مساعد الذكاء الاصطناعي.');
  return token;
}

async function invokeAiAssistant(prompt: string, action: AiAssistantAction | undefined, history: AiAssistantHistoryMessage[], context: AiAssistantContext) {
  if (!env.isConfigured) throw new AiAssistantConfigurationError();

  const accessToken = await getAccessToken();
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 30_000);
  let response: Response;
  try {
    response = await fetch(`${env.supabaseUrl}/functions/v1/ai-assistant`, {
      method: 'POST',
      headers: {
        apikey: env.supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requestId: globalThis.crypto.randomUUID(), prompt, action, history: history.slice(-6), context }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('استغرق المساعد وقتاً أطول من المتوقع. حاول مرة أخرى.');
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
  }

  const body = await readJson(response);
  if (!response.ok) {
    const errorBody = readErrorBody(body);
    const code = errorBody.error?.code;
    const message = errorBody.error?.message ?? 'تعذر تشغيل مساعد الذكاء الاصطناعي.';
    if (code === 'AI_CONFIG_MISSING') throw new AiAssistantConfigurationError(message);
    throw new Error(message);
  }

  const successBody = readSuccessBody(body);
  if (
    !successBody.reply?.trim()
    || successBody.grounded === undefined
    || !successBody.caveats
    || !successBody.meta?.source
  ) throw new Error('عاد مساعد الذكاء الاصطناعي برد غير صالح.');
  return {
    reply: successBody.reply.trim(),
    grounded: successBody.grounded,
    caveats: successBody.caveats,
    source: successBody.meta.source,
    kind: successBody.meta.kind,
  };
}

export async function requestAiAssistantResponse(request: AiAssistantRequest): Promise<AiAssistantResponse> {
  const prompt = request.prompt.trim();
  if (!prompt) throw new Error('اكتب سؤالاً أو اختر إجراءً جاهزاً.');
  if (looksLikeRawSqlPrompt(prompt)) throw new Error('لا يقبل المساعد أوامر SQL ولا ينفذ استعلامات مباشرة. استخدم سؤالاً تشغيلياً بصيغة عادية.');

  const context = await buildAiAssistantContext(request.surface);
  const response = await invokeAiAssistant(prompt, request.action, request.history, context);
  return { ...response, context };
}