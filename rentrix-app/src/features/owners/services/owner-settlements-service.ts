import { supabase } from '@/lib/supabase';
import { fetchAllRows } from '@/lib/paginatedRead';

export type SettlementStatus = 'pending' | 'approved' | 'paid' | 'cancelled';
export type CommissionType = 'percentage' | 'fixed';

export type OwnerSettlementRecord = {
  id: string;
  owner_id: string;
  owner_name: string;
  property_id: string;
  property_title: string;
  period_start: string;
  period_end: string;
  gross_rent_collected: number;
  management_fee_rate: number;
  management_fee_type: CommissionType;
  management_fee_amount: number;
  maintenance_deductions: number;
  utility_deductions: number;
  net_payable_amount: number;
  status: SettlementStatus;
  approved_by?: string | null;
  approved_at?: string | null;
  paid_at?: string | null;
  payout_reference?: string | null;
  notes?: string | null;
  created_at: string;
};

export type OwnerSettlementTarget = {
  owner_id: string;
  owner_name: string;
  property_id: string;
  property_title: string;
  commission_type: CommissionType;
  commission_value: number;
};

export type OwnerSettlementTotals = {
  gross: number;
  fees: number;
  deductions: number;
  net: number;
};

/**
 * Cancelled drafts never create a payable or collection, so they must be
 * excluded from control totals — otherwise the totals look larger than the
 * ledger-backed live settlements they're meant to summarize.
 */
export function summarizeLiveOwnerSettlements(settlements: readonly OwnerSettlementRecord[]): OwnerSettlementTotals {
  return settlements
    .filter((settlement) => settlement.status !== 'cancelled')
    .reduce<OwnerSettlementTotals>(
      (summary, settlement) => ({
        gross: summary.gross + settlement.gross_rent_collected,
        fees: summary.fees + settlement.management_fee_amount,
        deductions: summary.deductions + settlement.maintenance_deductions + settlement.utility_deductions,
        net: summary.net + settlement.net_payable_amount,
      }),
      { gross: 0, fees: 0, deductions: 0, net: 0 },
    );
}

export type CreateSettlementDraftPayload = {
  owner_id: string;
  property_id: string;
  period_start: string;
  period_end: string;
  /**
   * Idempotency key, generated ONCE per creation attempt by the caller and kept
   * stable across retries/double-clicks — the server replays the cached result
   * instead of writing twice (financial_operation_idempotency).
   */
  request_id: string;
  notes?: string;
  // P1: no amount fields. gross_collected/office_fee/owner_expenses/tax_amount/
  // net_payable are DERIVED SERVER-SIDE by calculate_owner_net_payout inside
  // create_owner_settlement_draft_atomic; the client is never the source of
  // financial numbers (see docs/audits/P1_OWNER_SETTLEMENT_INTEGRITY_20260723.md).
};

/** Row shape of public.calculate_owner_net_payout (the server-side preview). */
export type OwnerSettlementPreview = {
  gross_collected: number;
  office_fee: number;
  owner_expenses: number;
  tax_amount: number;
  net_payable: number;
  breakdown: {
    source?: string;
    policy?: string;
    payments_count?: number;
    collected_gross?: number;
    rate_fees?: number;
    fixed_fees?: number;
    master_obligations?: number;
    vat?: { enabled?: boolean; rate?: number; company_scoped?: boolean };
    agreements?: unknown[];
  } | null;
};

export type PreviewSettlementPayload = {
  owner_id: string;
  property_id?: string | null;
  period_start: string;
  period_end: string;
};

export type ApproveSettlementPayload = {
  settlement_id: string;
};

export type ProcessPayoutPayload = {
  settlement_id: string;
  payout_method: 'bank_transfer' | 'check' | 'cash';
  payout_reference: string;
};

export const settlementStatusLabels: Record<SettlementStatus, string> = {
  pending: 'مسودة بانتظار الاعتماد',
  approved: 'معتمدة للصرف',
  paid: 'مدفوعة للمالك',
  cancelled: 'ملغاة',
};

type EntityLabels = {
  ownerMap: Map<string, string>;
  propertyMap: Map<string, string>;
};

function messageFromError(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return fallback;
}

function normalizeStatus(status: unknown): SettlementStatus {
  const value = String(status ?? '').toUpperCase();
  if (value === 'APPROVED') return 'approved';
  if (value === 'PAID') return 'paid';
  if (value === 'CANCELLED') return 'cancelled';
  return 'pending';
}

function uniqueIds(rows: any[], key: string) {
  return Array.from(new Set(rows.map((row) => String(row[key] ?? '')).filter(Boolean)));
}

async function loadEntityLabels(
  ownerIds: string[],
  propertyIds: string[],
  options: { activeOnly?: boolean } = {},
): Promise<EntityLabels> {
  let ownersQuery = (supabase as any)
    .from('owners')
    .select('id, name, full_name, display_name')
    .in('id', ownerIds);
  let propertiesQuery = (supabase as any)
    .from('properties')
    .select('id, title')
    .in('id', propertyIds);

  if (options.activeOnly) {
    ownersQuery = ownersQuery.is('deleted_at', null).eq('is_active', true);
    propertiesQuery = propertiesQuery.is('deleted_at', null);
  }

  const [ownersResult, propertiesResult] = await Promise.all([
    ownerIds.length ? ownersQuery : Promise.resolve({ data: [], error: null }),
    propertyIds.length ? propertiesQuery : Promise.resolve({ data: [], error: null }),
  ]);

  if (ownersResult.error) {
    throw new Error(messageFromError(ownersResult.error, 'تعذر تحميل أسماء الملاك.'));
  }
  if (propertiesResult.error) {
    throw new Error(messageFromError(propertiesResult.error, 'تعذر تحميل أسماء العقارات.'));
  }

  return {
    ownerMap: new Map<string, string>(
      (ownersResult.data ?? []).map((owner: any) => [
        String(owner.id),
        String(owner.display_name ?? owner.full_name ?? owner.name ?? 'مالك غير معروف'),
      ]),
    ),
    propertyMap: new Map<string, string>(
      (propertiesResult.data ?? []).map((property: any) => [
        String(property.id),
        String(property.title ?? 'عقار غير معروف'),
      ]),
    ),
  };
}

export async function listOwnerSettlements(): Promise<OwnerSettlementRecord[]> {
  let settlements: any[];
  try {
    // Settlements feed owner statements and payout KPIs: never accept PostgREST's
    // silent 1,000-row cap as a complete financial history.
    // `.range()`-based pagination needs a fully deterministic order —
    // created_at alone can tie across rows, which could otherwise skip or
    // duplicate a row at a page boundary. `id` breaks every tie.
    ({ rows: settlements } = await fetchAllRows<any>(() => (supabase as any)
      .from('owner_settlements')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })));
  } catch (error) {
    const settlementError = error;
    throw new Error(messageFromError(settlementError, 'تعذر تحميل تسويات الملاك.'));
  }
  if (!settlements.length) return [];

  const { ownerMap, propertyMap } = await loadEntityLabels(
    uniqueIds(settlements, 'owner_id'),
    uniqueIds(settlements, 'property_id'),
  );

  return settlements.map((row: any): OwnerSettlementRecord => ({
    id: String(row.id),
    owner_id: String(row.owner_id ?? ''),
    owner_name: ownerMap.get(String(row.owner_id ?? '')) ?? 'مالك غير معروف',
    property_id: String(row.property_id ?? ''),
    property_title: propertyMap.get(String(row.property_id ?? '')) ?? 'عقار غير معروف',
    period_start: String(row.period_start ?? ''),
    period_end: String(row.period_end ?? ''),
    gross_rent_collected: Number(row.gross_collected ?? 0),
    management_fee_rate: 0,
    management_fee_type: 'fixed',
    management_fee_amount: Number(row.office_fee ?? 0),
    maintenance_deductions: Number(row.owner_expenses ?? 0),
    utility_deductions: Number(row.tax_amount ?? 0),
    net_payable_amount: Number(row.net_payable ?? 0),
    status: normalizeStatus(row.status),
    approved_by: row.approved_by ? String(row.approved_by) : null,
    approved_at: row.approved_at ? String(row.approved_at) : null,
    paid_at: row.paid_at ? String(row.paid_at) : null,
    payout_reference: row.payment_reference ? String(row.payment_reference) : null,
    notes: row.notes ? String(row.notes) : null,
    created_at: String(row.created_at ?? new Date(0).toISOString()),
  }));
}

export async function listOwnerSettlementTargets(): Promise<OwnerSettlementTarget[]> {
  const { data: agreements, error: agreementError } = await (supabase as any)
    .from('owner_agreements')
    .select('owner_id, property_id, commission_type, commission_value, starts_on, ends_on')
    .order('starts_on', { ascending: false });

  if (agreementError) {
    throw new Error(messageFromError(agreementError, 'تعذر تحميل اتفاقيات الملاك.'));
  }
  if (!agreements?.length) return [];

  const { ownerMap, propertyMap } = await loadEntityLabels(
    uniqueIds(agreements, 'owner_id'),
    uniqueIds(agreements, 'property_id'),
    { activeOnly: true },
  );

  const uniqueTargets = new Map<string, OwnerSettlementTarget>();
  for (const agreement of agreements) {
    const ownerId = String(agreement.owner_id ?? '');
    const propertyId = String(agreement.property_id ?? '');
    const ownerName = ownerMap.get(ownerId);
    const propertyTitle = propertyMap.get(propertyId);
    if (!ownerName || !propertyTitle) continue;

    const key = `${ownerId}:${propertyId}`;
    if (uniqueTargets.has(key)) continue;
    const isRate = String(agreement.commission_type ?? '').toUpperCase() === 'RATE';
    uniqueTargets.set(key, {
      owner_id: ownerId,
      owner_name: ownerName,
      property_id: propertyId,
      property_title: propertyTitle,
      commission_type: isRate ? 'percentage' : 'fixed',
      commission_value: Number(agreement.commission_value ?? 0),
    });
  }

  return Array.from(uniqueTargets.values()).sort((a, b) =>
    `${a.owner_name}-${a.property_title}`.localeCompare(`${b.owner_name}-${b.property_title}`, 'ar'),
  );
}

/**
 * Server-derived preview of a settlement before the draft exists. Calls the
 * same derivation RPC the write path uses, so the visible numbers are EXACTLY
 * what gets stored — never a client-side re-computation.
 */
export async function previewOwnerSettlement(payload: PreviewSettlementPayload): Promise<OwnerSettlementPreview> {
  const { data, error } = await (supabase as any).rpc('calculate_owner_net_payout', {
    p_owner_id: payload.owner_id,
    p_period_start: payload.period_start,
    p_period_end: payload.period_end,
    p_property_id: payload.property_id ?? null,
  });

  if (error) {
    throw new Error(messageFromError(error, 'تعذر حساب معاينة التسوية من الخادم.'));
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('لم تُرجع قاعدة البيانات معاينة التسوية.');
  return {
    gross_collected: Number(row.gross_collected ?? 0),
    office_fee: Number(row.office_fee ?? 0),
    owner_expenses: Number(row.owner_expenses ?? 0),
    tax_amount: Number(row.tax_amount ?? 0),
    net_payable: Number(row.net_payable ?? 0),
    breakdown: (row.breakdown ?? null) as OwnerSettlementPreview['breakdown'],
  };
}

export async function createOwnerSettlementDraft(payload: CreateSettlementDraftPayload): Promise<string> {
  const { data, error } = await (supabase as any).rpc('create_owner_settlement_draft_atomic', {
    // Spread only; request_id stays exactly the attempt key the caller holds —
    // retrying with the same key replays the cached server response instead of
    // creating a second draft.
    p_payload: { ...payload, request_id: payload.request_id },
  });

  if (error) {
    throw new Error(messageFromError(error, 'تعذر إنشاء مسودة تسوية المالك.'));
  }
  const settlementId = data?.settlement_id;
  if (!settlementId) throw new Error('لم تُرجع قاعدة البيانات رقم التسوية الجديدة.');
  return String(settlementId);
}

export async function approveOwnerSettlement(payload: ApproveSettlementPayload): Promise<void> {
  const { error } = await (supabase as any).rpc('approve_owner_settlement_atomic', {
    p_payload: { settlement_id: payload.settlement_id, request_id: crypto.randomUUID() },
  });

  if (error) {
    throw new Error(messageFromError(error, 'تعذر اعتماد تسوية المالك.'));
  }
}

export async function processOwnerPayout(payload: ProcessPayoutPayload): Promise<void> {
  const { error } = await (supabase as any).rpc('pay_owner_settlement_atomic', {
    p_payload: {
      settlement_id: payload.settlement_id,
      request_id: crypto.randomUUID(),
      method: payload.payout_method,
      payment_reference: payload.payout_reference,
    },
  });

  if (error) {
    throw new Error(messageFromError(error, 'تعذر تسجيل صرف تسوية المالك.'));
  }
}
