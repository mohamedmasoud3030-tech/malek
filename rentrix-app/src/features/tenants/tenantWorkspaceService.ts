import { isContractStatus } from '@/lib/contractStatus';
import { fetchAllRowsInBatches } from '@/lib/paginatedRead';
import { supabase } from '@/lib/supabase';
import { getTodayLocalDateString } from '@/features/financials/financials-date-utils';
import { normalizeInvoiceStatus } from '@/features/financials/components/invoice-status-labels';
import type { Contract, Invoice, Person, Property, Unit } from '@/types/domain';

export type TenantWorkspaceParams = {
  search: string;
  page: number;
  pageSize: number;
};

export type TenantWorkspaceRow = {
  person: Pick<Person, 'id' | 'full_name' | 'phone' | 'email' | 'national_id'>;
  activeContractCount: number;
  propertyTitle: string | null;
  unitNumber: string | null;
  primaryContractId: string | null;
  hasInvoices: boolean;
  hasArrears: boolean;
};

export type TenantWorkspaceResult = {
  rows: TenantWorkspaceRow[];
  count: number;
};

type TenantContract = Contract & {
  properties: Pick<Property, 'id' | 'title'> | null;
  units: Pick<Unit, 'id' | 'unit_number'> | null;
};

export type TenantInvoice = Pick<Invoice, 'contract_id' | 'status' | 'amount' | 'paid_amount' | 'due_date'>;

type TenantPerson = TenantWorkspaceRow['person'];

type TenantInvoiceSummary = {
  hasInvoices: boolean;
  hasArrears: boolean;
};

const tenantContractSelect = '*, properties:properties!contracts_property_id_fkey(id,title), units:units!contracts_unit_id_fkey(id,unit_number)';
const tenantInvoiceSelect = 'contract_id,status,amount,paid_amount,due_date';

function escapeSearchTerm(value: string) {
  return value.replaceAll('%', String.raw`\%`).replaceAll('_', String.raw`\_`);
}

// `supabase.from(...)` is a query builder; `.or()` only exists on the filter
// builder returned by `.select()`. Constrain to what the helper actually uses
// so the call site keeps its fully-typed builder.
function applyTenantSearch<Q extends { or(filters: string): Q }>(query: Q, search: string): Q {
  const trimmedSearch = search.trim();
  if (trimmedSearch.length === 0) {
    return query;
  }
  const term = `"%${escapeSearchTerm(trimmedSearch)}%"`;
  return query.or(`full_name.ilike.${term},phone.ilike.${term},email.ilike.${term},national_id.ilike.${term}`);
}

function groupBy<TItem, TKey extends string>(items: TItem[], getKey: (item: TItem) => TKey) {
  return items.reduce<Record<TKey, TItem[]>>((grouped, item) => {
    const key = getKey(item);
    grouped[key] = [...(grouped[key] ?? []), item];
    return grouped;
  }, {} as Record<TKey, TItem[]>);
}

function getPrimaryContract(contracts: TenantContract[]) {
  return contracts.find((contract) => isContractStatus(contract.status, 'active')) ?? contracts[0] ?? null;
}

export function isInvoiceInArrears(invoice: TenantInvoice, today: string) {
  const remainingAmount = invoice.amount - invoice.paid_amount;
  if (remainingAmount <= 0) return false;

  const status = normalizeInvoiceStatus(invoice.status);
  if (status !== 'unpaid' && status !== 'partial' && status !== 'overdue') return false;

  return status === 'overdue' || invoice.due_date < today;
}

function summarizeTenantInvoices(invoices: TenantInvoice[], today: string): TenantInvoiceSummary {
  return {
    hasInvoices: invoices.length > 0,
    hasArrears: invoices.some((invoice) => isInvoiceInArrears(invoice, today)),
  };
}

function buildTenantRow(person: TenantPerson, contracts: TenantContract[], invoices: TenantInvoice[], today: string): TenantWorkspaceRow {
  const primaryContract = getPrimaryContract(contracts);
  const invoiceSummary = summarizeTenantInvoices(invoices, today);
  return {
    person,
    activeContractCount: contracts.filter((contract) => isContractStatus(contract.status, 'active')).length,
    propertyTitle: primaryContract?.properties?.title ?? null,
    unitNumber: primaryContract?.units?.unit_number ?? null,
    primaryContractId: primaryContract?.id ?? null,
    ...invoiceSummary,
  };
}

async function listTenantContracts(tenantIds: string[]) {
  if (tenantIds.length === 0) {
    return [];
  }

  const { rows } = await fetchAllRowsInBatches<TenantContract, string>(tenantIds, (tenantIdBatch) => supabase
    .from('contracts')
    .select(tenantContractSelect)
    .in('tenant_id', [...tenantIdBatch])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .returns<TenantContract[]>());

  return rows;
}

async function listTenantInvoices(contractIds: string[]) {
  if (contractIds.length === 0) {
    return [];
  }

  const { rows } = await fetchAllRowsInBatches<TenantInvoice, string>(contractIds, (contractIdBatch) => supabase
    .from('invoices')
    .select(tenantInvoiceSelect)
    .in('contract_id', [...contractIdBatch])
    .is('deleted_at', null)
    .order('contract_id', { ascending: true })
    .order('due_date', { ascending: true })
    .order('id', { ascending: true })
    .returns<TenantInvoice[]>());

  return rows;
}

export type TenantDossier = Readonly<{
  person: TenantPerson;
  contracts: Array<TenantContract & { reference?: string | null }>;
  invoices: Array<TenantInvoice & { id: string; reference?: string | null }>;
  latestActivity: Array<{ id: string; subject: string | null; body: string; status: string | null; created_at: string }>;
}>;

/** One-tenant dossier query; no full people/property/unit register fetches. */
export async function getTenantDossier(tenantId: string, options: { includeFinancial: boolean; includeActivity: boolean }): Promise<TenantDossier> {
  const { data: person, error: personError } = await supabase
    .from('people')
    .select('id,full_name,phone,email,national_id')
    .eq('id', tenantId)
    .eq('type', 'tenant')
    .is('deleted_at', null)
    .single()
    .returns<TenantPerson>();
  if (personError) throw personError;
  if (!person) throw new Error('المستأجر غير موجود أو غير متاح لصلاحياتك.');

  const { data: contractsData, error: contractsError } = await (supabase as any)
    .from('contracts')
    .select('*, properties:properties!contracts_property_id_fkey(id,title), units:units!contracts_unit_id_fkey(id,unit_number)')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (contractsError) throw contractsError;
  const contracts = (contractsData ?? []) as TenantDossier['contracts'];
  const contractIds = contracts.map((contract) => contract.id);

  const [invoiceResult, activityResult] = await Promise.all([
    options.includeFinancial && contractIds.length > 0
      ? (supabase as any).from('invoices').select('id,reference,contract_id,status,amount,paid_amount,due_date').in('contract_id', contractIds).is('deleted_at', null).order('due_date', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    options.includeActivity
      ? (supabase as any).from('communication_records').select('id,subject,body,status,created_at').in('related_entity_type', ['tenant', 'person']).eq('related_entity_id', tenantId).is('deleted_at', null).order('created_at', { ascending: false }).limit(10)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (invoiceResult.error) throw invoiceResult.error;
  if (activityResult.error) throw activityResult.error;
  return { person, contracts, invoices: invoiceResult.data ?? [], latestActivity: activityResult.data ?? [] } as TenantDossier;
}

function getInvoicesByTenant(contractsByTenant: Record<string, TenantContract[]>, invoicesByContract: Record<string, TenantInvoice[]>) {
  return Object.fromEntries(
    Object.entries(contractsByTenant).map(([tenantId, contracts]) => [
      tenantId,
      contracts.flatMap((contract) => invoicesByContract[contract.id] ?? []),
    ]),
  );
}

export async function listTenantWorkspace(params: TenantWorkspaceParams): Promise<TenantWorkspaceResult> {
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;
  let query = supabase
    .from('people')
    .select('id,full_name,phone,email,national_id', { count: 'exact' })
    .eq('type', 'tenant')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);

  query = applyTenantSearch(query, params.search);

  const { data: people, count, error } = await query.returns<TenantPerson[]>();
  if (error) {
    throw error;
  }

  const tenantPeople = people ?? [];
  const contracts = await listTenantContracts(tenantPeople.map((person) => person.id));
  const invoices = await listTenantInvoices(contracts.map((contract) => contract.id));
  const contractsByTenant = groupBy(contracts, (contract) => contract.tenant_id);
  const invoicesByContract = groupBy(invoices, (invoice) => invoice.contract_id);
  const invoicesByTenant = getInvoicesByTenant(contractsByTenant, invoicesByContract);
  const today = getTodayLocalDateString();

  return {
    rows: tenantPeople.map((person) => buildTenantRow(person, contractsByTenant[person.id] ?? [], invoicesByTenant[person.id] ?? [], today)),
    count: count ?? 0,
  };
}
