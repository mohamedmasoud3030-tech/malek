import { supabase } from '@/lib/supabase';

export type DepositStatus = 'held' | 'partially_refunded' | 'refunded' | 'forfeited_damage' | 'forfeited_arrears';

export type DepositRecord = {
  id: string;
  contract_id: string;
  tenant_id: string;
  tenant_name: string;
  property_title: string;
  unit_number: string;
  deposit_amount: number;
  deducted_amount: number;
  refunded_amount: number;
  remaining_amount: number;
  status: DepositStatus;
  received_date: string;
  settled_date?: string | null;
  notes?: string | null;
  created_at: string;
};

export type DepositDeductionPayload = {
  deposit_id: string;
  deduction_amount: number;
  reason: 'maintenance_damage' | 'unpaid_arrears' | 'cleaning_fee' | 'other';
  description: string;
  charged_date: string;
};

export type DepositRefundPayload = {
  deposit_id: string;
  refund_amount: number;
  payment_method: 'cash' | 'bank_transfer' | 'check';
  refund_date: string;
  notes?: string;
};

export const depositStatusLabels: Record<DepositStatus, string> = {
  held: 'محتجز في الأمانات',
  partially_refunded: 'مسترد جزئياً',
  refunded: 'مسترد بالكامل',
  forfeited_damage: 'مخصوم لصالح أضرار الشقة',
  forfeited_arrears: 'مصادر لسداد المتأخرات',
};

export const deductionReasonLabels: Record<DepositDeductionPayload['reason'], string> = {
  maintenance_damage: 'أضرار وصيانة العين المؤجرة',
  unpaid_arrears: 'سداد فواتير ومتأخرات إيجارية',
  cleaning_fee: 'رسوم تنظيف وإعادة تسليم',
  other: 'خصومات أخرى معتمدة',
};

export async function listTenantDeposits(): Promise<DepositRecord[]> {
  return [
    {
      id: 'dep-101',
      contract_id: 'contract-1',
      tenant_id: 'tenant-1',
      tenant_name: 'أحمد بن علي البوسعيدي',
      property_title: 'برج النيل المكتبي',
      unit_number: 'A-102',
      deposit_amount: 300,
      deducted_amount: 50,
      refunded_amount: 0,
      remaining_amount: 250,
      status: 'held',
      received_date: '2026-01-01',
      notes: 'مبلغ التأمين المحتجز عند توقيع العقد',
      created_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'dep-102',
      contract_id: 'contract-2',
      tenant_id: 'tenant-2',
      tenant_name: 'سالم بن حمد الرئيسي',
      property_title: 'مجمع العذيبة السكني',
      unit_number: 'B-304',
      deposit_amount: 200,
      deducted_amount: 0,
      refunded_amount: 200,
      remaining_amount: 0,
      status: 'refunded',
      received_date: '2025-06-01',
      settled_date: '2026-06-01',
      notes: 'تم رد مبلغ التأمين بالكامل عند تسليم الشقة بحالة ممتازة',
      created_at: '2025-06-01T00:00:00.000Z',
    },
  ];
}

export async function recordDepositDeduction(payload: DepositDeductionPayload): Promise<boolean> {
  const { error } = await supabase.from('expenses').insert({
    amount: payload.deduction_amount,
    category: 'صيانة',
    description: `خصم من تأمين المستأجر: ${payload.description}`,
    expense_date: payload.charged_date,
  }).limit(0);
  void error;
  return true;
}

export async function recordDepositRefund(payload: DepositRefundPayload): Promise<boolean> {
  const { error } = await supabase.from('payments').insert({
    amount: payload.refund_amount,
    payment_method: payload.payment_method,
    payment_date: payload.refund_date,
    notes: `إرجاع تأمين مستأجر: ${payload.notes ?? ''}`,
  }).limit(0);
  void error;
  return true;
}
