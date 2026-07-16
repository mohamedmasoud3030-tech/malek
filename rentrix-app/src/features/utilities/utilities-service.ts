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
  meter_id: string | null;
  property_id: string;
  unit_id?: string | null;
  bill_number?: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
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

export type UtilityMeterFormValues = {
  property_id: string;
  unit_id?: string | null;
  utility_type: UtilityType;
  meter_number: string;
  account_number: string;
  provider_name?: string | null;
  responsible_party: ResponsibleParty;
  is_active?: boolean;
  notes?: string | null;
};

export type UtilityBillFormValues = {
  meter_id?: string | null;
  property_id: string;
  unit_id?: string | null;
  bill_number?: string | null;
  billing_period_start?: string | null;
  billing_period_end?: string | null;
  previous_reading?: number | null;
  current_reading?: number | null;
  consumption_units?: number | null;
  amount: number;
  paid_amount?: number | null;
  due_date: string;
  responsible_party: ResponsibleParty;
  attachment_url?: string | null;
  notes?: string | null;
};

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

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function mapChargedToToResponsible(chargedTo: string | null | undefined): ResponsibleParty {
  const value = (chargedTo || '').toUpperCase();
  if (value === 'OWNER') return 'landlord';
  if (value === 'COMPANY') return 'company';
  return 'tenant';
}

function mapResponsibleToChargedTo(party: ResponsibleParty): 'TENANT' | 'OWNER' | 'COMPANY' {
  if (party === 'landlord') return 'OWNER';
  if (party === 'company') return 'COMPANY';
  return 'TENANT';
}

function deriveBillStatus(paidAmount: number, amount: number): UtilityBillStatus {
  if (amount > 0 && paidAmount >= amount) return 'paid';
  if (paidAmount > 0) return 'partially_paid';
  return 'unpaid';
}

function mapStatusToBillStatus(dbStatus: string | null, paidAmount: number, amount: number): UtilityBillStatus {
  if ((dbStatus || '').toUpperCase() === 'PAID') return 'paid';
  return deriveBillStatus(paidAmount, amount);
}

function mapBillStatusToDb(status: UtilityBillStatus): 'UNPAID' | 'PAID' {
  return status === 'paid' ? 'PAID' : 'UNPAID';
}

function mapMeter(row: any): UtilityMeter {
  return {
    id: row.id,
    property_id: row.property_id,
    unit_id: row.unit_id ?? null,
    utility_type: row.utility_type as UtilityType,
    meter_number: row.meter_number,
    account_number: row.account_number,
    provider_name: row.provider_name ?? null,
    responsible_party: (row.responsible_party as ResponsibleParty) ?? 'tenant',
    is_active: row.is_active ?? true,
    notes: row.notes ?? null,
    created_at: row.created_at,
  };
}

function mapBill(row: any): UtilityBill {
  const amount = Number(row.amount ?? 0);
  const paidAmount = Number(row.paid_amount ?? 0);
  return {
    id: row.id,
    meter_id: row.meter_id ?? null,
    property_id: row.property_id,
    unit_id: row.unit_id ?? null,
    bill_number: row.reference_no ?? row.id?.slice(0, 8) ?? null,
    billing_period_start: row.billing_period_start ?? null,
    billing_period_end: row.billing_period_end ?? null,
    previous_reading: toNumberOrNull(row.previous_reading),
    current_reading: toNumberOrNull(row.current_reading),
    consumption_units: toNumberOrNull(row.consumption_units),
    amount,
    paid_amount: paidAmount,
    due_date: row.due_date,
    status: mapStatusToBillStatus(row.status, paidAmount, amount),
    responsible_party: mapChargedToToResponsible(row.charged_to),
    attachment_url: row.attachment_url ?? null,
    notes: row.notes ?? null,
    created_at: row.created_at,
  };
}

function calculateConsumption(values: Partial<UtilityBillFormValues>): number | null {
  if (values.consumption_units != null) return Number(values.consumption_units);
  if (values.previous_reading == null || values.current_reading == null) return null;
  return Number(values.current_reading) - Number(values.previous_reading);
}

export async function listUtilityMeters(propertyId?: string): Promise<UtilityMeter[]> {
  let query: any = supabase.from('utility_meters' as any).select('*').is('deleted_at', null).order('created_at', { ascending: false });
  if (propertyId) query = query.eq('property_id', propertyId);

  const { data, error } = await query;
  if (error) handleSupabaseError(error, 'تعذر تحميل عدادات المرافق');
  return (data ?? []).map(mapMeter);
}

export async function createUtilityMeter(values: UtilityMeterFormValues): Promise<UtilityMeter> {
  if (!values.property_id) throw new Error('العقار مطلوب');
  if (!values.meter_number.trim()) throw new Error('رقم العداد مطلوب');
  if (!values.account_number.trim()) throw new Error('رقم الحساب مطلوب');

  const { data, error } = await ((supabase as any)
    .from('utility_meters')
    .insert({
      property_id: values.property_id,
      unit_id: values.unit_id || null,
      utility_type: values.utility_type,
      meter_number: values.meter_number.trim(),
      account_number: values.account_number.trim(),
      provider_name: values.provider_name?.trim() || null,
      responsible_party: values.responsible_party,
      is_active: values.is_active ?? true,
      notes: values.notes?.trim() || null,
    })
    .select('*')
    .single() as any);

  if (error) handleSupabaseError(error, 'تعذر إنشاء عداد المرافق');
  if (!data) throw new Error('لم يتم إنشاء العداد');
  return mapMeter(data);
}

export async function updateUtilityMeter(id: string, values: Partial<UtilityMeterFormValues>): Promise<UtilityMeter> {
  if (!id) throw new Error('معرف العداد مطلوب');

  const payload: Record<string, unknown> = {};
  if (values.property_id !== undefined) payload.property_id = values.property_id;
  if (values.unit_id !== undefined) payload.unit_id = values.unit_id || null;
  if (values.utility_type !== undefined) payload.utility_type = values.utility_type;
  if (values.meter_number !== undefined) payload.meter_number = values.meter_number.trim();
  if (values.account_number !== undefined) payload.account_number = values.account_number.trim();
  if (values.provider_name !== undefined) payload.provider_name = values.provider_name?.trim() || null;
  if (values.responsible_party !== undefined) payload.responsible_party = values.responsible_party;
  if (values.is_active !== undefined) payload.is_active = values.is_active;
  if (values.notes !== undefined) payload.notes = values.notes?.trim() || null;

  const { data, error } = await ((supabase as any)
    .from('utility_meters')
    .update(payload)
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .single() as any);

  if (error) handleSupabaseError(error, 'تعذر تحديث عداد المرافق');
  if (!data) throw new Error('العداد غير موجود');
  return mapMeter(data);
}

export async function softDeleteUtilityMeter(id: string): Promise<void> {
  const { error } = await ((supabase as any)
    .from('utility_meters')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id) as any);
  if (error) handleSupabaseError(error, 'تعذر حذف العداد');
}

export async function listUtilityBills(filter?: { propertyId?: string; status?: UtilityBillStatus; meterId?: string }): Promise<UtilityBill[]> {
  let query = (supabase as any).from('utility_bills').select('*').is('deleted_at', null).order('due_date', { ascending: false }).limit(200);
  if (filter?.propertyId) query = query.eq('property_id', filter.propertyId);
  if (filter?.meterId) query = query.eq('meter_id', filter.meterId);

  const { data, error } = await query;
  if (error) handleSupabaseError(error, 'تعذر تحميل فواتير المرافق');

  const bills = (data ?? []).map(mapBill);
  return filter?.status ? bills.filter((bill: UtilityBill) => bill.status === filter.status) : bills;
}

export async function createUtilityBill(values: UtilityBillFormValues): Promise<UtilityBill> {
  if (!values.property_id) throw new Error('العقار مطلوب');
  if (!values.due_date) throw new Error('تاريخ الاستحقاق مطلوب');
  if (!Number.isFinite(values.amount) || values.amount <= 0) throw new Error('المبلغ يجب أن يكون أكبر من صفر');

  const paidAmount = values.paid_amount ?? 0;
  const status = deriveBillStatus(paidAmount, values.amount);
  const { data, error } = await ((supabase as any)
    .from('utility_bills')
    .insert({
      property_id: values.property_id,
      contract_id: null,
      type: values.meter_id ? 'meter_bill' : 'general_utility',
      amount: values.amount,
      billing_period_start: values.billing_period_start || null,
      billing_period_end: values.billing_period_end || null,
      due_date: values.due_date,
      charged_to: mapResponsibleToChargedTo(values.responsible_party),
      status: mapBillStatusToDb(status),
      reference_no: values.bill_number?.trim() || null,
      notes: values.notes?.trim() || null,
      meter_id: values.meter_id || null,
      unit_id: values.unit_id || null,
      previous_reading: values.previous_reading ?? null,
      current_reading: values.current_reading ?? null,
      consumption_units: calculateConsumption(values),
      paid_amount: paidAmount,
      attachment_url: values.attachment_url || null,
    })
    .select('*')
    .single() as any);

  if (error) handleSupabaseError(error, 'تعذر إنشاء فاتورة المرافق');
  if (!data) throw new Error('لم يتم إنشاء الفاتورة');
  return mapBill(data);
}

async function resolveBillAmounts(id: string, values: Partial<UtilityBillFormValues>) {
  if (values.amount !== undefined && values.paid_amount !== undefined) {
    return { amount: values.amount, paidAmount: values.paid_amount ?? 0 };
  }

  const { data, error } = await ((supabase as any)
    .from('utility_bills')
    .select('amount,paid_amount')
    .eq('id', id)
    .is('deleted_at', null)
    .single() as any);
  if (error) handleSupabaseError(error, 'تعذر تحميل رصيد فاتورة المرافق');

  return {
    amount: values.amount ?? Number(data?.amount ?? 0),
    paidAmount: values.paid_amount ?? Number(data?.paid_amount ?? 0),
  };
}

export async function updateUtilityBill(id: string, values: Partial<UtilityBillFormValues>): Promise<UtilityBill> {
  if (!id) throw new Error('معرف الفاتورة مطلوب');

  const payload: Record<string, unknown> = {};
  if (values.meter_id !== undefined) payload.meter_id = values.meter_id || null;
  if (values.property_id !== undefined) payload.property_id = values.property_id;
  if (values.unit_id !== undefined) payload.unit_id = values.unit_id || null;
  if (values.bill_number !== undefined) payload.reference_no = values.bill_number?.trim() || null;
  if (values.billing_period_start !== undefined) payload.billing_period_start = values.billing_period_start || null;
  if (values.billing_period_end !== undefined) payload.billing_period_end = values.billing_period_end || null;
  if (values.previous_reading !== undefined) payload.previous_reading = values.previous_reading;
  if (values.current_reading !== undefined) payload.current_reading = values.current_reading;
  if (values.consumption_units !== undefined) payload.consumption_units = values.consumption_units;
  if (values.amount !== undefined) payload.amount = values.amount;
  if (values.paid_amount !== undefined) payload.paid_amount = values.paid_amount;
  if (values.due_date !== undefined) payload.due_date = values.due_date;
  if (values.responsible_party !== undefined) payload.charged_to = mapResponsibleToChargedTo(values.responsible_party);
  if (values.attachment_url !== undefined) payload.attachment_url = values.attachment_url || null;
  if (values.notes !== undefined) payload.notes = values.notes?.trim() || null;

  if (values.amount !== undefined || values.paid_amount !== undefined) {
    const { amount, paidAmount } = await resolveBillAmounts(id, values);
    payload.status = mapBillStatusToDb(deriveBillStatus(paidAmount, amount));
  }

  const { data, error } = await ((supabase as any)
    .from('utility_bills')
    .update(payload)
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .single() as any);

  if (error) handleSupabaseError(error, 'تعذر تحديث فاتورة المرافق');
  if (!data) throw new Error('الفاتورة غير موجودة');
  return mapBill(data);
}

export async function softDeleteUtilityBill(id: string): Promise<void> {
  const { error } = await ((supabase as any)
    .from('utility_bills')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id) as any);
  if (error) handleSupabaseError(error, 'تعذر حذف فاتورة المرافق');
}
