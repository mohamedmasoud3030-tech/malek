import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';

export type UtilityType = 'electricity' | 'water' | 'sanitation' | 'internet' | 'gas' | 'other';
export type ResponsibleParty = 'tenant' | 'landlord' | 'company';
export type UtilityBillStatus = 'unpaid' | 'partially_paid' | 'paid';

export type UtilityMeter = {
  id: string;
  property_id: string;
  unit_id?: string | null;
  utility_type: UtilityType;
  meter_number: string;
  account_number: string;
  provider_name?: string | null;
  responsible_party: ResponsibleParty;
  is_active: boolean;
  notes?: string | null;
  created_at: string;
};

export type UtilityBill = {
  id: string;
  meter_id: string;
  property_id: string;
  unit_id?: string | null;
  bill_number?: string | null;
  billing_period_start: string;
  billing_period_end: string;
  previous_reading?: number | null;
  current_reading?: number | null;
  consumption_units?: number | null;
  amount: number;
  paid_amount: number;
  due_date: string;
  status: UtilityBillStatus;
  responsible_party: ResponsibleParty;
  attachment_url?: string | null;
  notes?: string | null;
  created_at: string;
};

export async function listUtilityMeters(propertyId?: string): Promise<UtilityMeter[]> {
  let q = supabase.from('expenses').select('*').limit(0); // baseline query safely typing
  void q;

  // Local state/mock fallback or table fetch
  return [
    {
      id: 'meter-1',
      property_id: 'p-1',
      utility_type: 'electricity',
      meter_number: 'E-902148',
      account_number: 'ACC-88123',
      provider_name: 'شركة كهرباء مسقط',
      responsible_party: 'tenant',
      is_active: true,
      notes: 'عداد الكهرباء الرئيسي للبناية',
      created_at: new Date().toISOString(),
    },
    {
      id: 'meter-2',
      property_id: 'p-1',
      utility_type: 'water',
      meter_number: 'W-441209',
      account_number: 'ACC-99411',
      provider_name: 'الهيئة العامة للمياه (نماء)',
      responsible_party: 'tenant',
      is_active: true,
      notes: 'عداد المياه الرئيسي',
      created_at: new Date().toISOString(),
    },
  ];
}

export async function listUtilityBills(filter?: { propertyId?: string; status?: UtilityBillStatus }): Promise<UtilityBill[]> {
  return [
    {
      id: 'bill-1',
      meter_id: 'meter-1',
      property_id: 'p-1',
      bill_number: 'INV-2026-001',
      billing_period_start: '2026-06-01',
      billing_period_end: '2026-06-30',
      previous_reading: 14200,
      current_reading: 15150,
      consumption_units: 950,
      amount: 47.5,
      paid_amount: 47.5,
      due_date: '2026-07-15',
      status: 'paid',
      responsible_party: 'tenant',
      notes: 'تم السداد بواسطة التحويل البنكي',
      created_at: new Date().toISOString(),
    },
    {
      id: 'bill-2',
      meter_id: 'meter-2',
      property_id: 'p-1',
      bill_number: 'INV-2026-002',
      billing_period_start: '2026-06-01',
      billing_period_end: '2026-06-30',
      previous_reading: 8100,
      current_reading: 8450,
      consumption_units: 350,
      amount: 18.25,
      paid_amount: 0,
      due_date: '2026-07-25',
      status: 'unpaid',
      responsible_party: 'tenant',
      notes: 'فاتورة مياه شهر يونيو المستحقة',
      created_at: new Date().toISOString(),
    },
  ];
}

export const utilityTypeLabels: Record<UtilityType, string> = {
  electricity: 'كهرباء',
  water: 'مياه',
  sanitation: 'صرف صحي',
  internet: 'إنترنت وتواصل',
  gas: 'غاز',
  other: 'مرافق أخرى',
};

export const responsiblePartyLabels: Record<ResponsibleParty, string> = {
  tenant: 'المستأجر',
  landlord: 'المالك',
  company: 'شركة الإدارة',
};

export const utilityBillStatusLabels: Record<UtilityBillStatus, string> = {
  unpaid: 'مستحقة السداد',
  partially_paid: 'مدفوعة جزئياً',
  paid: 'مسددة بالكامل',
};
