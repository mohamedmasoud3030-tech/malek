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

function mapChargedToToResponsible(chargedTo: string | null | undefined): ResponsibleParty {
  switch ((chargedTo || '').toUpperCase()) {
    case 'TENANT':
      return 'tenant';
    case 'OWNER':
      return 'landlord';
    case 'COMPANY':
      return 'company';
    default:
      return 'tenant';
  }
}

function mapResponsibleToChargedTo(party: ResponsibleParty): 'TENANT' | 'OWNER' | 'COMPANY' {
  switch (party) {
    case 'tenant':
      return 'TENANT';
    case 'landlord':
      return 'OWNER';
    case 'company':
      return 'COMPANY';
    default:
      return 'TENANT';
  }
}

function mapStatusToBillStatus(dbStatus: string | null, paidAmount: number, amount: number): UtilityBillStatus {
  const s = (dbStatus || '').toUpperCase();
  if (s === 'PAID') return 'paid';
  if (paidAmount > 0 && paidAmount < amount) return 'partially_paid';
  if (paidAmount >= amount && amount > 0) return 'paid';
  return 'unpaid';
}

function mapBillStatusToDb(status: UtilityBillStatus): 'UNPAID' | 'PAID' | 'OVERDUE' {
  switch (status) {
    case 'paid':
      return 'PAID';
    case 'partially_paid':
      return 'UNPAID';
    case 'unpaid':
    default:
      return 'UNPAID';
  }
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// ---------- Meters ----------
export async function listUtilityMeters(propertyId?: string): Promise<UtilityMeter[]> {
  let query: any = supabase.from('utility_meters' as any).select('*').is('deleted_at', null).order('created_at', { ascending: false });
  if (propertyId) query = query.eq('property_id', propertyId);

  const { data, error } = await query;
  if (error) handleSupabaseError(error, 'تعذر تحميل عدادات المرافق');

  return (data ?? []).map((m: any) => ({
    id: m.id,
    property_id: m.property_id,
    unit_id: m.unit_id ?? null,
    utility_type: m.utility_type as UtilityType,
    meter_number: m.meter_number,
    account_number: m.account_number,
    provider_name: m.provider_name ?? null,
    responsible_party: (m.responsible_party as ResponsibleParty) ?? 'tenant',
    is_active: m.is_active ?? true,
    notes: m.notes ?? null,
    created_at: m.created_at,
  }));
}

export async function createUtilityMeter(values: UtilityMeterFormValues): Promise<UtilityMeter> {
  if (!values.property_id) throw new Error('العقار مطلوب');
  if (!values.meter_number.trim()) throw new Error('رقم العداد مطلوب');
  if (!values.account_number.trim()) throw new Error('رقم الحساب مطلوب');

  const payload = {
    property_id: values.property_id,
    unit_id: values.unit_id || null,
    utility_type: values.utility_type,
    meter_number: values.meter_number.trim(),
    account_number: values.account_number.trim(),
    provider_name: values.provider_name?.trim() || null,
    responsible_party: values.responsible_party,
    is_active: values.is_active ?? true,
    notes: values.notes?.trim() || null,
  };

  const { data, error } = await ((supabase as any).from('utility_meters').insert(payload as any).select('*').single() as any);
  if (error) handleSupabaseError(error, 'تعذر إنشاء عداد المرافق');
  if (!data) throw new Error('لم يتم إنشاء العداد');

  return {
    id: data.id,
    property_id: data.property_id,
    unit_id: data.unit_id ?? null,
    utility_type: data.utility_type as UtilityType,
    meter_number: data.meter_number,
    account_number: data.account_number,
    provider_name: data.provider_name ?? null,
    responsible_party: data.responsible_party as ResponsibleParty,
    is_active: data.is_active ?? true,
    notes: data.notes ?? null,
    created_at: data.created_at,
  };
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

  const { data, error } = await ((supabase as any).from('utility_meters').update(payload as any).eq('id', id).is('deleted_at', null).select('*').single() as any);
  if (error) handleSupabaseError(error, 'تعذر تحديث عداد المرافق');
  if (!data) throw new Error('العداد غير موجود');

  return {
    id: data.id,
    property_id: data.property_id,
    unit_id: data.unit_id ?? null,
    utility_type: data.utility_type as UtilityType,
    meter_number: data.meter_number,
    account_number: data.account_number,
    provider_name: data.provider_name ?? null,
    responsible_party: data.responsible_party as ResponsibleParty,
    is_active: data.is_active ?? true,
    notes: data.notes ?? null,
    created_at: data.created_at,
  };
}

export async function softDeleteUtilityMeter(id: string): Promise<void> {
  const { error } = await ((supabase as any).from('utility_meters').update({ deleted_at: new Date().toISOString() } as any).eq('id', id) as any);
  if (error) handleSupabaseError(error, 'تعذر حذف العداد');
}

// ---------- Bills ----------
export async function listUtilityBills(filter?: { propertyId?: string; status?: UtilityBillStatus; meterId?: string }): Promise<UtilityBill[]> {
  let query = (supabase as any).from('utility_bills').select('*').is('deleted_at', null).order('due_date', { ascending: false }).limit(200);

  if (filter?.propertyId) query = query.eq('property_id', filter.propertyId);
  if (filter?.meterId) query = query.eq('meter_id', filter.meterId);

  const { data, error } = await (query as any);
  if (error) handleSupabaseError(error, 'تعذر تحميل فواتير المرافق');

  const rows = (data ?? []) as any[];

  // Client-side status filter mapping
  const mapped = rows.map((r: any) => {
    const paid = Number(r.paid_amount ?? 0);
    const amount = Number(r.amount ?? 0);
    return {
      id: r.id,
      meter_id: r.meter_id ?? null,
      property_id: r.property_id,
      unit_id: r.unit_id ?? null,
      bill_number: r.reference_no ?? r.id?.slice(0, 8) ?? null,
      billing_period_start: r.billing_period_start ?? null,
      billing_period_end: r.billing_period_end ?? null,
      previous_reading: toNumberOrNull(r.previous_reading),
      current_reading: toNumberOrNull(r.current_reading),
      consumption_units: toNumberOrNull(r.consumption_units),
      amount,
      paid_amount: paid,
      due_date: r.due_date,
      status: mapStatusToBillStatus(r.status, paid, amount),
      responsible_party: mapChargedToToResponsible(r.charged_to),
      attachment_url: r.attachment_url ?? null,
      notes: r.notes ?? null,
      created_at: r.created_at,
    } as UtilityBill;
  });

  if (filter?.status && filter.status !== undefined) {
    return mapped.filter((b) => b.status === filter.status);
  }

  return mapped;
}

export async function createUtilityBill(values: UtilityBillFormValues): Promise<UtilityBill> {
  if (!values.property_id) throw new Error('العقار مطلوب');
  if (!values.due_date) throw new Error('تاريخ الاستحقاق مطلوب');
  if (!Number.isFinite(values.amount) || values.amount <= 0) throw new Error('المبلغ يجب أن يكون أكبر من صفر');

  // Calculate consumption if readings provided
  let consumption = values.consumption_units;
  if (consumption == null && values.previous_reading != null && values.current_reading != null) {
    consumption = Number(values.current_reading) - Number(values.previous_reading);
  }

  const payload = {
    property_id: values.property_id,
    contract_id: null,
    type: values.meter_id ? 'meter_bill' : 'general_utility',
    amount: values.amount,
    billing_period_start: values.billing_period_start || null,
    billing_period_end: values.billing_period_end || null,
    due_date: values.due_date,
    charged_to: mapResponsibleToChargedTo(values.responsible_party),
    status: mapBillStatusToDb(values.paid_amount && values.paid_amount > 0 && values.paid_amount < values.amount ? 'partially_paid' : values.paid_amount && values.paid_amount >= values.amount ? 'paid' : 'unpaid'),
    reference_no: values.bill_number?.trim() || null,
    notes: values.notes?.trim() || null,
    meter_id: values.meter_id || null,
    unit_id: values.unit_id || null,
    previous_reading: values.previous_reading ?? null,
    current_reading: values.current_reading ?? null,
    consumption_units: consumption ?? null,
    paid_amount: values.paid_amount ?? 0,
    attachment_url: values.attachment_url || null,
  };

  const { data, error } = await ((supabase as any).from('utility_bills').insert(payload as any).select('*').single() as any);
  if (error) handleSupabaseError(error, 'تعذر إنشاء فاتورة المرافق');
  if (!data) throw new Error('لم يتم إنشاء الفاتورة');

  return {
    id: data.id,
    meter_id: data.meter_id ?? null,
    property_id: data.property_id,
    unit_id: data.unit_id ?? null,
    bill_number: data.reference_no ?? data.id,
    billing_period_start: data.billing_period_start ?? null,
    billing_period_end: data.billing_period_end ?? null,
    previous_reading: toNumberOrNull(data.previous_reading),
    current_reading: toNumberOrNull(data.current_reading),
    consumption_units: toNumberOrNull(data.consumption_units),
    amount: Number(data.amount),
    paid_amount: Number(data.paid_amount ?? 0),
    due_date: data.due_date,
    status: mapStatusToBillStatus(data.status, Number(data.paid_amount ?? 0), Number(data.amount)),
    responsible_party: mapChargedToToResponsible(data.charged_to),
    attachment_url: data.attachment_url ?? null,
    notes: data.notes ?? null,
    created_at: data.created_at,
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

  // Auto-calc status from paid_amount
  if (values.paid_amount !== undefined || values.amount !== undefined) {
    const amount = values.amount as number | undefined;
    const paid = values.paid_amount as number | undefined;
    // We'll let DB trigger or manual status; for now set UNPAID/PAID based on amounts if provided, otherwise keep existing
    if (paid != null && amount != null) {
      payload.status = paid >= amount ? 'PAID' : paid > 0 ? 'UNPAID' : 'UNPAID';
    } else if (paid != null) {
      // Need existing amount - we will update status after fetch, but for now approximate
      payload.status = paid > 0 ? 'UNPAID' : 'UNPAID';
    }
  }

  const { data, error } = await ((supabase as any).from('utility_bills').update(payload as any).eq('id', id).is('deleted_at', null).select('*').single() as any);
  if (error) handleSupabaseError(error, 'تعذر تحديث فاتورة المرافق');
  if (!data) throw new Error('الفاتورة غير موجودة');

  return {
    id: data.id,
    meter_id: data.meter_id ?? null,
    property_id: data.property_id,
    unit_id: data.unit_id ?? null,
    bill_number: data.reference_no ?? data.id,
    billing_period_start: data.billing_period_start ?? null,
    billing_period_end: data.billing_period_end ?? null,
    previous_reading: toNumberOrNull(data.previous_reading),
    current_reading: toNumberOrNull(data.current_reading),
    consumption_units: toNumberOrNull(data.consumption_units),
    amount: Number(data.amount),
    paid_amount: Number(data.paid_amount ?? 0),
    due_date: data.due_date,
    status: mapStatusToBillStatus(data.status, Number(data.paid_amount ?? 0), Number(data.amount)),
    responsible_party: mapChargedToToResponsible(data.charged_to),
    attachment_url: data.attachment_url ?? null,
    notes: data.notes ?? null,
    created_at: data.created_at,
  };
}

export async function softDeleteUtilityBill(id: string): Promise<void> {
  const { error } = await ((supabase as any).from('utility_bills').update({ deleted_at: new Date().toISOString() } as any).eq('id', id) as any);
  if (error) handleSupabaseError(error, 'تعذر حذف فاتورة المرافق');
}
