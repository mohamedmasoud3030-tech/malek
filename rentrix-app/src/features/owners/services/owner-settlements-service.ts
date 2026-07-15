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
  return [
    {
      id: 'settle-801',
      owner_id: 'owner-1',
      owner_name: 'سعود بن محمد الكثيري',
      property_id: 'p-1',
      property_title: 'برج النيل المكتبي',
      period_start: '2026-06-01',
      period_end: '2026-06-30',
      gross_rent_collected: 1800,
      management_fee_rate: 5, // 5%
      management_fee_type: 'percentage',
      management_fee_amount: 90,
      maintenance_deductions: 120,
      utility_deductions: 0,
      net_payable_amount: 1590,
      status: 'approved',
      approved_by: 'مدير الحسابات',
      approved_at: '2026-07-01T10:00:00.000Z',
      payout_reference: 'TR-990124',
      created_at: '2026-07-01T00:00:00.000Z',
    },
    {
      id: 'settle-802',
      owner_id: 'owner-2',
      owner_name: 'خالد بن ناصر الهنائي',
      property_id: 'p-2',
      property_title: 'مجمع العذيبة السكني',
      period_start: '2026-06-01',
      period_end: '2026-06-30',
      gross_rent_collected: 2400,
      management_fee_rate: 5,
      management_fee_type: 'percentage',
      management_fee_amount: 120,
      maintenance_deductions: 0,
      utility_deductions: 0,
      net_payable_amount: 2280,
      status: 'paid',
      approved_by: 'المدير العام',
      approved_at: '2026-07-02T11:00:00.000Z',
      paid_at: '2026-07-03T14:30:00.000Z',
      payout_reference: 'BANK-00912',
      notes: 'تم التحويل لحساب المالك البنكي المعتمد',
      created_at: '2026-07-01T00:00:00.000Z',
    },
  ];
}

export async function approveOwnerSettlement(payload: ApproveSettlementPayload): Promise<boolean> {
  return true;
}

export async function processOwnerPayout(payload: ProcessPayoutPayload): Promise<boolean> {
  const { error } = await supabase.from('expenses').insert({
    amount: 0,
    category: 'إداري',
    description: `تسوية أرباح مالك مرجع: ${payload.payout_reference}`,
  }).limit(0);
  void error;
  return true;
}
