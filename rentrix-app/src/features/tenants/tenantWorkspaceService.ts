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

const tenantContractSelect = '*, properties:property_id(id,title), units:unit_id(id,unit_number)';
const tenantInvoiceSelect = 'contract_id,status,amount,paid_amount,due_date';

function escapeSearchTerm(value: string) {
  return value.replaceAll('%', String.raw`\%`).replaceAll('_', String.raw`\_`);
}

function applyTenantSearch(query: ReturnType<typeof supabase.from>, search: string) {
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
