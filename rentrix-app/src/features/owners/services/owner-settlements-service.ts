import { supabase } from '@/lib/supabase';

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

export type CreateSettlementDraftPayload = {
  owner_id: string;
  property_id: string;
  period_start: string;
  period_end: string;
  gross_collected: number;
  office_fee: number;
  owner_expenses: number;
  tax_amount: number;
  notes?: string;
};

export type ApproveSettlementPayload = {
  settlement_id: string;
};

export type ProcessPayoutPayload = {
  settlement_id: string;
  payout_method: 'bank_transfer' | 'check' | 'cash';
  payout_reference: string;
  payout_date?: string;
};

export const settlementStatusLabels: Record<SettlementStatus, string> = {
  pending: 'مسودة بانتظار الاعتماد',
  approved: 'معتمدة للصرف',
  paid: 'مدفوعة للمالك',
  cancelled: 'ملغاة',
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

export async function listOwnerSettlements(): Promise<OwnerSettlementRecord[]> {
  const { data: settlements, error: settlementError } = await (supabase as any)
    .from('owner_settlements')
    .select('*')
    .order('created_at', { ascending: false });

  if (settlementError) {
    throw new Error(messageFromError(settlementError, 'تعذر تحميل تسويات الملاك.'));
  }

  if (!settlements?.length) return [];

  const ownerIds = Array.from(new Set(settlements.map((row: any) => String(row.owner_id ?? '')).filter(Boolean)));
  const propertyIds = Array.from(new Set(settlements.map((row: any) => String(row.property_id ?? '')).filter(Boolean)));

  const [ownersResult, propertiesResult] = await Promise.all([
    ownerIds.length
      ? (supabase as any).from('owners').select('id, name, full_name, display_name').in('id', ownerIds)
      : Promise.resolve({ data: [], error: null }),
    propertyIds.length
      ? (supabase as any).from('properties').select('id, title').in('id', propertyIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (ownersResult.error) {
    throw new Error(messageFromError(ownersResult.error, 'تعذر تحميل أسماء الملاك.'));
  }
  if (propertiesResult.error) {
    throw new Error(messageFromError(propertiesResult.error, 'تعذر تحميل أسماء العقارات.'));
  }

  const ownerMap = new Map<string, string>(
    (ownersResult.data ?? []).map((owner: any) => [
      String(owner.id),
      String(owner.display_name ?? owner.full_name ?? owner.name ?? 'مالك غير معروف'),
    ]),
  );
  const propertyMap = new Map<string, string>(
    (propertiesResult.data ?? []).map((property: any) => [String(property.id), String(property.title ?? 'عقار غير معروف')]),
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

  const ownerIds = Array.from(new Set(agreements.map((row: any) => String(row.owner_id ?? '')).filter(Boolean)));
  const propertyIds = Array.from(new Set(agreements.map((row: any) => String(row.property_id ?? '')).filter(Boolean)));

  const [ownersResult, propertiesResult] = await Promise.all([
    (supabase as any)
      .from('owners')
      .select('id, name, full_name, display_name')
      .in('id', ownerIds)
      .is('deleted_at', null)
      .eq('is_active', true),
    (supabase as any).from('properties').select('id, title').in('id', propertyIds).is('deleted_at', null),
  ]);

  if (ownersResult.error) {
    throw new Error(messageFromError(ownersResult.error, 'تعذر تحميل الملاك المتاحين للتسوية.'));
  }
  if (propertiesResult.error) {
    throw new Error(messageFromError(propertiesResult.error, 'تعذر تحميل العقارات المتاحة للتسوية.'));
  }

  const ownerMap = new Map<string, string>(
    (ownersResult.data ?? []).map((owner: any) => [
      String(owner.id),
      String(owner.display_name ?? owner.full_name ?? owner.name ?? 'مالك غير معروف'),
    ]),
  );
  const propertyMap = new Map<string, string>(
    (propertiesResult.data ?? []).map((property: any) => [String(property.id), String(property.title ?? 'عقار غير معروف')]),
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

export async function createOwnerSettlementDraft(payload: CreateSettlementDraftPayload): Promise<string> {
  const { data, error } = await (supabase as any).rpc('create_owner_settlement_draft_atomic', {
    p_payload: {
      ...payload,
      request_id: crypto.randomUUID(),
    },
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
    p_payload: {
      settlement_id: payload.settlement_id,
      request_id: crypto.randomUUID(),
    },
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
