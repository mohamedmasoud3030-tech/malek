import type { CanonicalContractStatus } from '@/lib/contractStatus';
import { getContractStatusVariants } from '@/lib/contractStatus';
import { fetchAllRows } from '@/lib/paginatedRead';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { Contract, Person, Property, Unit } from '@/types/domain';
import type { ContractPayload, RenewalPayload } from '../contractSchema';

// The database CHECK still permits the legacy spellings 'ACTIVE'/'ENDED'
// alongside the canonical lowercase set, so `Contract['status']` is wider than
// the values the UI filters on. Filters are expressed in canonical terms and
// `getContractStatusVariants` expands them to every stored spelling at query
// time — see `@/lib/contractStatus`.
export type ContractStatusFilter = CanonicalContractStatus | 'all';
export type ContractListItem = Contract & {
  reference?: string | null;
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
export type AllContractsRead = Readonly<{ rows: ContractListItem[]; truncated: boolean }>;
export type RenewalResult = { status: 'renewed'; old_contract_id: string; new_contract_id: string };

// Shared select clauses - single source of truth for contract relations
export const CONTRACT_BASE_SELECT =
  '*, properties:properties!contracts_property_id_fkey(id,title,address), units:units!contracts_unit_id_fkey(id,unit_number,floor,status,rent_amount), people:people!contracts_tenant_id_fkey(id,full_name,phone,email,national_id)';
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
    .order('id', { ascending: false })
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

/**
 * Fetch EVERY contract matching the status filter by paging forward — a
 * single listContracts call is silently capped at the server max-rows
 * (default 1000), which quietly truncated the reports workspace (rent roll,
 * renewals forecast, deferred-revenue audit, contract filter dropdown) for
 * portfolios beyond 1000 contracts. The reports workspace exposes the
 * `truncated` flag and visibly blocks complete-result assumptions, so this is
 * an intentional opt-in to the partial-read contract.
 */
export async function listContractsForProperty(propertyId: string): Promise<ContractListItem[]> {
  const { rows } = await fetchAllRows<ContractListItem>(
    () =>
      supabase
        .from('contracts')
        .select(CONTRACT_BASE_SELECT)
        .is('deleted_at', null)
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .returns<ContractListItem[]>(),
  );
  return rows;
}

export async function listAllContracts(status: ContractStatusFilter = 'all'): Promise<AllContractsRead> {
  const buildQuery = () => {
    let query = supabase
      .from('contracts')
      .select(CONTRACT_BASE_SELECT)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });
    if (status !== 'all') {
      const statusVariants = getContractStatusVariants(status) as Contract['status'][];
      query = query.in('status', statusVariants);
    }
    return query;
  };

  return fetchAllRows<ContractListItem>(
    () => buildQuery().returns<ContractListItem[]>(),
    { allowTruncated: true },
  );
}

export async function getContract(contractId: string): Promise<ContractDetail | null> {
  const { data, error } = await supabase
    .from('contracts')
    .select(CONTRACT_DETAIL_SELECT)
    .eq('id', contractId)
    .is('deleted_at', null)
    .maybeSingle()
    .returns<ContractDetail>();
  if (error) throw error;
  if (Array.isArray(data)) return data[0] ?? null;
  return data;
}

async function assertContractPropertyIsOperational(propertyId: string, contractStatus?: string): Promise<void> {
  // Only operational contracts (active/draft) require an active property.
  // Non-operational statuses (expired, terminated, ended) can reference any
  // non-archived property — matching the DB trigger's gating.
  if (contractStatus && !['active', 'draft', 'ACTIVE', 'DRAFT'].includes(contractStatus)) {
    const { data: exists, error: checkError } = await supabase
      .from('properties')
      .select('id')
      .eq('id', propertyId)
      .is('deleted_at', null)
      .maybeSingle();
    if (checkError) throw new Error('تعذر التحقق من وجود العقار قبل تعديل العقد');
    if (!exists) throw new Error('العقار غير موجود أو مؤرشف');
    return;
  }

  const { data, error } = await supabase
    .from('properties')
    .select('id,status')
    .eq('id', propertyId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error('تعذر التحقق من حالة العقار قبل حفظ العقد');
  if (!data) throw new Error('العقار غير موجود أو مؤرشف');
  if (data.status !== 'active') {
    throw new Error('لا يمكن إنشاء أو نقل عقد على عقار غير نشط. أعد تنشيط العقار أولاً.');
  }
}

async function assertNoDuplicateDraftForUnitTenant({
  unitId,
  tenantId,
  excludedContractId,
}: Readonly<{
  unitId: string | null | undefined;
  tenantId: string;
  excludedContractId?: string | null;
}>): Promise<void> {
  if (!unitId) return;

  let query = supabase
    .from('contracts')
    .select('id')
    .eq('unit_id', unitId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .in('status', getContractStatusVariants('draft') as Contract['status'][]);
  if (excludedContractId) query = query.neq('id', excludedContractId);

  const { data, error } = await query.limit(1);
  if (error) throw new Error('تعذر التحقق من مسودة العقد الحالية. أعد المحاولة قبل الحفظ.');
  if ((data ?? []).length > 0) {
    throw new Error('توجد بالفعل مسودة عقد لهذه الوحدة والمستأجر. افتح المسودة الحالية وعدّلها بدلاً من إنشاء مسودة أخرى.');
  }
}

export async function createContract(payload: ContractPayload): Promise<Contract> {
  await assertContractPropertyIsOperational(payload.property_id);
  if (payload.status === 'draft') await assertNoDuplicateDraftForUnitTenant({ unitId: payload.unit_id, tenantId: payload.tenant_id });
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
    p_billing_day: payload.billing_day,
    p_grace_days: payload.grace_days,
    p_lease_mode: payload.lease_mode ?? 'long_term',
    p_daily_reference_rate: payload.lease_mode === 'short_stay' ? payload.daily_reference_rate ?? null : null,
  });
  if (error) throw error;
  return data as Contract;
}

export async function updateContract(contractId: string, payload: ContractPayload): Promise<Contract> {
  // Routed through update_contract_atomic (not a raw table update) so that
  // property/unit-overlap and owner-agreement-coverage invariants are
  // re-validated on edit, matching create_contract_atomic's checks. See
  // supabase/migrations/20260901000000_canonical_baseline.sql.
  await assertContractPropertyIsOperational(payload.property_id, payload.status);
  if (payload.status === 'draft') await assertNoDuplicateDraftForUnitTenant({ unitId: payload.unit_id, tenantId: payload.tenant_id, excludedContractId: contractId });
  // R4: billing policy is DRAFT-only editable and lives behind its own
  // server command; run it BEFORE the general update so a rejected policy
  // change fails the whole edit atomically from the user's perspective.
  {
    const { error: policyError } = await supabase.rpc('update_contract_billing_policy_atomic', {
      p_contract_id: contractId,
      p_billing_day: payload.billing_day,
      p_grace_days: payload.grace_days,
    });
    if (policyError) throw policyError;
  }
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
    p_lease_mode: payload.lease_mode ?? 'long_term',
    p_daily_reference_rate: payload.lease_mode === 'short_stay' ? payload.daily_reference_rate ?? null : null,
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

// ─────────────────────────────────────────────────────────────────────────────
// Canonical contract approval/activation chain (S04-T03 / DOM-005).
// The browser never flips `status` to 'active' itself: activation is the only
// path that freezes the owner-agreement snapshot (collection role, operating
// model, version) onto the contract and it fails closed unless the DB has a
// complete maker→checker approval with signature evidence.
// ─────────────────────────────────────────────────────────────────────────────

function toApprovalResult(data: unknown): Contract {
  if (!data || typeof data !== 'object') throw new Error('استجابة غير صالحة من خادم الاعتماد');
  const result = data as Contract;
  if (typeof result.status !== 'string' || typeof result.approval_status !== 'string') {
    throw new Error('استجابة الاعتماد ناقصة الحقول المطلوبة');
  }
  return result;
}

/** Maker submits a draft contract for approval, recording their signature. */
export async function submitContractForApproval(contractId: string, makerSignature: string): Promise<Contract> {
  const { data, error } = await supabase.rpc('submit_contract_for_approval_atomic', {
    p_contract_id: contractId,
    p_maker_signature: makerSignature,
  });
  if (error) throw error;
  return toApprovalResult(data);
}

/** Checker (a different user than the maker) approves the pending contract. */
export async function approveContract(contractId: string, checkerSignature: string): Promise<Contract> {
  const { data, error } = await supabase.rpc('approve_contract_atomic', {
    p_contract_id: contractId,
    p_checker_signature: checkerSignature,
  });
  if (error) throw error;
  return toApprovalResult(data);
}

/** Checker rejects the pending contract with a mandatory reason. */
export async function rejectContract(contractId: string, checkerSignature: string, reason: string): Promise<Contract> {
  const { data, error } = await supabase.rpc('reject_contract_atomic', {
    p_contract_id: contractId,
    p_checker_signature: checkerSignature,
    p_reason: reason,
  });
  if (error) throw error;
  return toApprovalResult(data);
}

/** Activate an approved contract, freezing the authoritative agreement snapshot. */
export async function activateContract(contractId: string): Promise<Contract> {
  const { data, error } = await supabase.rpc('activate_contract_with_agreement_snapshot_atomic', {
    p_contract_id: contractId,
  });
  if (error) throw error;
  return toApprovalResult(data);
}
