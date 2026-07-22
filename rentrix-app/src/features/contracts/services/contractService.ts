import { getContractStatusVariants } from '@/lib/contractStatus';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { Contract, Person, Property, Unit } from '@/types/domain';
import type { ContractPayload, RenewalPayload } from '../contractSchema';

export type ContractStatusFilter = Contract['status'] | 'all';
export type ContractListItem = Contract & {
  properties: Pick<Property, 'id' | 'title' | 'address'> | null;
  units: Pick<Unit, 'id' | 'unit_number' | 'floor' | 'status' | 'rent_amount'> | null;
  people: Pick<Person, 'id' | 'full_name' | 'phone' | 'email' | 'national_id'> | null;
};
export type ContractDetail = ContractListItem & {
  renewed_from: Pick<Contract, 'id' | 'start_date' | 'end_date' | 'rent_amount' | 'status'> | null;
};

export type ContractListParams = {
  status: ContractStatusFilter;
  page: number;
  pageSize: number;
};
export type PaginatedContracts = {
  rows: ContractListItem[];
  count: number;
};
export type RenewalResult = { status: 'renewed'; old_contract_id: string; new_contract_id: string };

// Shared select clauses - single source of truth for contract relations
export const CONTRACT_BASE_SELECT =
  '*, properties:property_id(id,title,address), units:unit_id(id,unit_number,floor,status,rent_amount), people:tenant_id(id,full_name,phone,email,national_id)';
export const CONTRACT_DETAIL_SELECT =
  CONTRACT_BASE_SELECT + ', renewed_from:renewed_from_id(id,start_date,end_date,rent_amount,status)';

export async function listContracts(params: ContractListParams): Promise<PaginatedContracts> {
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;
  let query = supabase
    .from('contracts')
    .select(CONTRACT_BASE_SELECT, { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to);
  // Cover every stored casing — legacy rows may hold 'ACTIVE'/'ENDED'. The
  // generated column type only lists the modern lowercase spellings, so cast:
  // the CHECK constraint (20250101000001_core_schema.sql) allows the legacy
  // spellings and the server filter must match them too.
  if (params.status !== 'all') {
    const statusVariants = getContractStatusVariants(params.status) as Contract['status'][];
    query = query.in('status', statusVariants);
  }
  const { data, count, error } = await query.returns<ContractListItem[]>();
  if (error) throw error;
  return { rows: data ?? [], count: count ?? 0 };
}

export async function getContract(contractId: string): Promise<ContractDetail> {
  const { data, error } = await supabase.from('contracts').select(CONTRACT_DETAIL_SELECT).eq('id', contractId).is('deleted_at', null).single().returns<ContractDetail>();
  if (error) throw error;
  return data;
}

export async function createContract(payload: ContractPayload): Promise<Contract> {
  const { data, error } = await supabase.rpc('create_contract_atomic', {
    p_property_id: payload.property_id,
    p_unit_id: payload.unit_id ?? null,
    p_tenant_id: payload.tenant_id,
    p_agreement_id: payload.agreement_id ?? null,
    p_start_date: payload.start_date,
    p_end_date: payload.end_date,
    p_rent_amount: payload.rent_amount,
    p_payment_cycle: payload.payment_cycle,
    p_payment_terms_id: payload.payment_terms_id ?? null,
    p_status: payload.status,
    p_cancellation_reason: payload.cancellation_reason ?? null,
    p_notes: payload.notes ?? null,
    p_attachment_url: payload.attachment_url ?? null,
  });
  if (error) throw error;
  return data as Contract;
}

export async function updateContract(contractId: string, payload: ContractPayload): Promise<Contract> {
  // Routed through update_contract_atomic (not a raw table update) so that
  // property/unit-overlap and owner-agreement-coverage invariants are
  // re-validated on edit, matching create_contract_atomic's checks. See
  // supabase/migrations/20260708044657_contract_lifecycle_atomic_rpcs.sql.
  const { data, error } = await supabase.rpc('update_contract_atomic', {
    p_contract_id: contractId,
    p_property_id: payload.property_id,
    p_unit_id: payload.unit_id ?? null,
    p_tenant_id: payload.tenant_id,
    p_agreement_id: payload.agreement_id ?? null,
    p_start_date: payload.start_date,
    p_end_date: payload.end_date,
    p_rent_amount: payload.rent_amount,
    p_payment_cycle: payload.payment_cycle,
    p_payment_terms_id: payload.payment_terms_id ?? null,
    p_status: payload.status,
    p_cancellation_reason: payload.cancellation_reason ?? null,
    p_notes: payload.notes ?? null,
    p_attachment_url: payload.attachment_url ?? null,
  });
  if (error) throw error;
  return data as Contract;
}

export type TerminateContractResult = { status: 'terminated'; contract_id: string; cancelled_invoice_ids: string[] };

export async function terminateContract(contractId: string, reason: string): Promise<TerminateContractResult> {
  const { data, error } = await supabase.rpc('terminate_contract_atomic', {
    p_contract_id: contractId,
    p_reason: reason,
  });
  if (error) throw error;
  return data as TerminateContractResult;
}

export async function softDeleteContract(contractId: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_contract_atomic', { p_contract_id: contractId });
  if (error) throw error;
}

function parseRenewalResult(data: unknown): RenewalResult {
  if (!data || typeof data !== 'object') throw new Error('Renewal RPC returned an invalid response');
  const result = data as Partial<RenewalResult>;
  if (result.status !== 'renewed' || !result.old_contract_id || !result.new_contract_id) {
    throw new Error('Renewal RPC response is missing the new contract id');
  }
  return result as RenewalResult;
}

export async function renewContract(contractId: string, payload: RenewalPayload): Promise<RenewalResult> {
  const { data, error } = await supabase.rpc('renew_contract_atomic', {
    old_contract_id: contractId,
    new_contract_data: {
      new_start: payload.new_start,
      new_end: payload.new_end,
      new_amount: payload.new_amount,
      agreement_id: payload.agreement_id ?? null,
    },
  });
  if (error) throw error;
  return parseRenewalResult(data);
}
