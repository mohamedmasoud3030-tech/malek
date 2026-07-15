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

export type ApproveSettlementPayload = {
  settlement_id: string;
  approved_by: string;
  notes?: string;
};

export type ProcessPayoutPayload = {
  settlement_id: string;
  payout_method: 'bank_transfer' | 'check' | 'cash';
  payout_reference: string;
  payout_date: string;
};

export const settlementStatusLabels: Record<SettlementStatus, string> = {
  pending: 'معلقة (تحت المراجعة)',
  approved: 'معتمدة للاعتماد المالي',
  paid: 'مسددة بحساب المالك',
  cancelled: 'ملغاة',
};

export async function listOwnerSettlements(): Promise<OwnerSettlementRecord[]> {
  const { data: settlements, error: settleError } = await supabase
    .from('owner_settlements')
    .select('*')
    .order('created_at', { ascending: false });

  if (settleError) {
    console.error('Error fetching owner settlements:', settleError);
    return [];
  }

  if (!settlements || settlements.length === 0) {
    return [];
  }

  const ownerIds = Array.from(new Set(settlements.map((s) => s.owner_id).filter(Boolean)));
  const propertyIds = Array.from(new Set(settlements.map((s) => s.property_id).filter(Boolean)));

  const [ownersRes, propertiesRes] = await Promise.all([
    ownerIds.length > 0
      ? supabase.from('owners').select('id, name').in('id', ownerIds)
      : { data: [] },
    propertyIds.length > 0
      ? supabase.from('properties').select('id, title').in('id', propertyIds)
      : { data: [] }
  ]);

  const ownerMap = new Map((ownersRes.data ?? []).map((o) => [o.id.toString(), o.name]));
  const propertyMap = new Map((propertiesRes.data ?? []).map((p) => [p.id.toString(), p.title]));

  return settlements.map((s) => {
    // Map DRAFT status from DB to 'pending' status for UI backwards compatibility
    const uiStatus: SettlementStatus =
      s.status === 'DRAFT'
        ? 'pending'
        : (s.status?.toLowerCase() as SettlementStatus) || 'pending';

    return {
      id: s.id,
      owner_id: s.owner_id || '',
      owner_name: ownerMap.get(s.owner_id || '') || 'مالك غير معروف',
      property_id: s.property_id || '',
      property_title: propertyMap.get(s.property_id || '') || 'عقار غير معروف',
      period_start: s.period_start || '',
      period_end: s.period_end || '',
      gross_rent_collected: Number(s.gross_collected ?? 0),
      management_fee_rate: 5, // Default percentage
      management_fee_type: 'percentage',
      management_fee_amount: Number(s.office_fee ?? 0),
      maintenance_deductions: Number(s.owner_expenses ?? 0),
      utility_deductions: Number(s.tax_amount ?? 0),
      net_payable_amount: Number(s.net_payable ?? 0),
      status: uiStatus,
      approved_by: s.approved_by,
      approved_at: s.approved_at,
      paid_at: s.paid_at,
      payout_reference: s.payment_reference,
      notes: s.notes,
      created_at: s.created_at || new Date().toISOString(),
    };
  });
}

export async function approveOwnerSettlement(payload: ApproveSettlementPayload): Promise<boolean> {
  const { error } = await supabase.rpc('approve_owner_settlement_atomic', {
    p_payload: {
      settlement_id: payload.settlement_id,
      request_id: crypto.randomUUID()
    }
  });

  if (error) {
    console.error('Error approving owner settlement:', error);
    throw new Error(error.message);
  }
  return true;
}

export async function processOwnerPayout(payload: ProcessPayoutPayload): Promise<boolean> {
  const { error } = await supabase.rpc('pay_owner_settlement_atomic', {
    p_payload: {
      settlement_id: payload.settlement_id,
      request_id: crypto.randomUUID(),
      method: payload.payout_method,
      payment_reference: payload.payout_reference
    }
  });

  if (error) {
    console.error('Error paying owner settlement:', error);
    throw new Error(error.message);
  }
  return true;
}
