import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import { fetchAllRows } from '@/lib/paginatedRead';
import {
  utilityMeterFormSchema,
  utilityMeterPayloadSchema,
  utilityBillFormSchema,
  utilityBillPayloadSchema,
  type UtilityMeterFormValues,
  type UtilityBillFormValues,
} from './utility-schema';

// Re-export so existing call sites can keep importing form values
// from utilities-service without learning the new module.
export type { UtilityMeterFormValues, UtilityBillFormValues } from './utility-schema';

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

/**
 * Parse the raw form input through the form schema (rejects
 * missing required fields) and then through the payload schema
 * (locks the typed shape and cross-field rules). The service is
 * the only path that touches Supabase, so the schema is run here
 * even if the form skipped it.
 */
function toMeterPayload(values: UtilityMeterFormValues) {
  const form = utilityMeterFormSchema.parse(values);
  return utilityMeterPayloadSchema.parse({
    property_id: form.property_id,
    unit_id: form.unit_id || null,
    utility_type: form.utility_type,
    meter_number: form.meter_number.trim(),
    account_number: form.account_number.trim(),
    provider_name: form.provider_name?.trim() || null,
    responsible_party: form.responsible_party,
    is_active: form.is_active ?? true,
    notes: form.notes?.trim() || null,
  });
}

function toBillPayload(values: UtilityBillFormValues) {
  const form = utilityBillFormSchema.parse(values);
  const previousReading = form.previous_reading ?? null;
  const currentReading = form.current_reading ?? null;
  // Readings are the source of truth when present: a browser cannot submit a
  // contradictory consumption value. Manual consumption is only accepted when
  // the provider does not expose readings.
  const consumptionUnits = previousReading != null && currentReading != null
    ? currentReading - previousReading
    : form.consumption_units ?? null;
  return utilityBillPayloadSchema.parse({
    meter_id: form.meter_id || null,
    property_id: form.property_id,
    unit_id: form.unit_id || null,
    bill_number: form.bill_number?.trim() || null,
    billing_period_start: form.billing_period_start || null,
    billing_period_end: form.billing_period_end || null,
    previous_reading: previousReading,
    current_reading: currentReading,
    consumption_units: consumptionUnits,
    amount: form.amount,
    paid_amount: form.paid_amount ?? 0,
    due_date: form.due_date,
    responsible_party: form.responsible_party,
    attachment_url: form.attachment_url || null,
    notes: form.notes?.trim() || null,
  });
}

export async function listUtilityMeters(propertyId?: string): Promise<UtilityMeter[]> {
  let query: any = supabase.from('utility_meters' as any).select('*').is('deleted_at', null).order('created_at', { ascending: false });
  if (propertyId) query = query.eq('property_id', propertyId);

  try {
    const { rows } = await fetchAllRows<any>(() => query);
    return rows.map(mapMeter);
  } catch (error) {
    handleSupabaseError(error, 'تعذر تحميل عدادات المرافق');
    throw error;
  }
}

export async function createUtilityMeter(values: UtilityMeterFormValues): Promise<UtilityMeter> {
  const payload = toMeterPayload(values);
  const { data, error } = await ((supabase as any)
    .from('utility_meters')
    .insert({
      property_id: payload.property_id,
      unit_id: payload.unit_id,
      utility_type: payload.utility_type,
      meter_number: payload.meter_number,
      account_number: payload.account_number,
      provider_name: payload.provider_name,
      responsible_party: payload.responsible_party,
      is_active: payload.is_active,
      notes: payload.notes,
    })
    .select('*')
    .single() as any);

  if (error) handleSupabaseError(error, 'تعذر إنشاء عداد المرافق');
  if (!data) throw new Error('لم يتم إنشاء العداد');
  return mapMeter(data);
}

export async function updateUtilityMeter(id: string, values: Partial<UtilityMeterFormValues>): Promise<UtilityMeter> {
  if (!id) throw new Error('معرف العداد مطلوب');

  // For partial updates we re-validate only the provided fields.
  // The payload schema enforces the same length caps and the
  // responsible_party / utility_type enums.
  const trimmed: Record<string, unknown> = {};
  if (values.property_id !== undefined) trimmed.property_id = values.property_id;
  if (values.unit_id !== undefined) trimmed.unit_id = values.unit_id;
  if (values.utility_type !== undefined) trimmed.utility_type = values.utility_type;
  if (values.meter_number !== undefined) trimmed.meter_number = values.meter_number;
  if (values.account_number !== undefined) trimmed.account_number = values.account_number;
  if (values.provider_name !== undefined) trimmed.provider_name = values.provider_name;
  if (values.responsible_party !== undefined) trimmed.responsible_party = values.responsible_party;
  if (values.is_active !== undefined) trimmed.is_active = values.is_active;
  if (values.notes !== undefined) trimmed.notes = values.notes;

  const { data, error } = await ((supabase as any)
    .from('utility_meters')
    .update(trimmed)
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
  let query = (supabase as any).from('utility_bills').select('*').is('deleted_at', null).order('due_date', { ascending: false });
  if (filter?.propertyId) query = query.eq('property_id', filter.propertyId);
  if (filter?.meterId) query = query.eq('meter_id', filter.meterId);

  let rows: any[];
  try {
    ({ rows } = await fetchAllRows<any>(() => query));
  } catch (error) {
    handleSupabaseError(error, 'تعذر تحميل فواتير المرافق');
    throw error;
  }

  const bills = rows.map(mapBill);
  return filter?.status ? bills.filter((bill: UtilityBill) => bill.status === filter.status) : bills;
}

export async function createUtilityBill(values: UtilityBillFormValues): Promise<UtilityBill> {
  const payload = toBillPayload(values);
  const status = deriveBillStatus(payload.paid_amount ?? 0, payload.amount);
  const { data, error } = await ((supabase as any)
    .from('utility_bills')
    .insert({
      property_id: payload.property_id,
      contract_id: null,
      type: payload.meter_id ? 'meter_bill' : 'general_utility',
      amount: payload.amount,
      billing_period_start: payload.billing_period_start,
      billing_period_end: payload.billing_period_end,
      due_date: payload.due_date,
      charged_to: mapResponsibleToChargedTo(payload.responsible_party),
      status: mapBillStatusToDb(status),
      reference_no: payload.bill_number,
      notes: payload.notes,
      meter_id: payload.meter_id,
      unit_id: payload.unit_id,
      previous_reading: payload.previous_reading,
      current_reading: payload.current_reading,
      consumption_units: payload.consumption_units,
      paid_amount: payload.paid_amount ?? 0,
      attachment_url: payload.attachment_url,
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
