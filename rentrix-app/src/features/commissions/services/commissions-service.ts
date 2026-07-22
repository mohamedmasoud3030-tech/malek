import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import { fetchAllRows } from '@/lib/paginatedRead';
import type { Database } from '@/types/database';
import type { CommissionFilters, CommissionFormValues, CommissionRecord } from '../types';

type CommissionInsert = Database['public']['Tables']['commissions']['Insert'];
type CommissionUpdate = Database['public']['Tables']['commissions']['Update'];

const commissionTypeValues = new Set(['contract', 'payment', 'owner', 'lead', 'land']);
const commissionStatusValues = new Set(['pending', 'approved', 'paid', 'cancelled']);

function numberOrNull(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} يجب أن يكون رقماً موجباً أو صفراً.`);
  return parsed;
}

function percentageOrNull(value: string) {
  const percentage = numberOrNull(value, 'نسبة العمولة');
  if (percentage !== null && percentage > 100) throw new Error('نسبة العمولة يجب ألا تتجاوز 100%.');
  return percentage;
}

function deriveAmount(values: CommissionFormValues) {
  const amount = numberOrNull(values.amount, 'مبلغ العمولة');
  if (amount !== null) return amount;
  const dealValue = numberOrNull(values.deal_value, 'قيمة الصفقة');
  const percentage = percentageOrNull(values.percentage);
  if (dealValue !== null && percentage !== null) return Number((dealValue * (percentage / 100)).toFixed(2));
  return null;
}

export function commissionPayload(values: CommissionFormValues): CommissionInsert {
  return {
    id: crypto.randomUUID(),
    staff_name: values.staff_name.trim(),
    type: values.type,
    status: values.status,
    source_id: values.source_id.trim() || null,
    deal_value: numberOrNull(values.deal_value, 'قيمة الصفقة'),
    percentage: percentageOrNull(values.percentage),
    amount: deriveAmount(values),
    paid_at: values.status === 'paid' ? Date.now() : null,
  };
}

export async function listCommissions(filters: CommissionFilters) {
  let query = supabase.from('commissions').select('*').order('created_at', { ascending: false });
  if (filters.status !== 'all') query = query.eq('status', filters.status);
  if (filters.type !== 'all') query = query.eq('type', filters.type);
  if (filters.query.trim()) {
    const term = `%${filters.query.trim()}%`;
    query = query.or(`staff_name.ilike.${term},source_id.ilike.${term},type.ilike.${term}`);
  }

  try {
    const { rows } = await fetchAllRows<CommissionRecord>(() => query as any);
    return rows;
  } catch (error) {
    handleSupabaseError(error, 'تعذر تحميل العمولات');
    throw error;
  }
}

function validateCommission(values: CommissionFormValues) {
  if (!values.staff_name.trim()) throw new Error('اسم الموظف أو الوسيط مطلوب.');
  if (!commissionTypeValues.has(values.type)) throw new Error('نوع مصدر العمولة غير صحيح.');
  if (!commissionStatusValues.has(values.status)) throw new Error('حالة العمولة غير صحيحة.');
  const amount = deriveAmount(values);
  if (amount === null || amount <= 0) throw new Error('أدخل قيمة عمولة أكبر من صفر أو قيمة الصفقة والنسبة.');
}

export async function createCommission(values: CommissionFormValues) {
  validateCommission(values);
  const { data, error } = await supabase.from('commissions').insert(commissionPayload(values)).select('*').single().returns<CommissionRecord>();
  if (error) handleSupabaseError(error, 'تعذر حفظ العمولة');
  return data;
}

export async function updateCommission(id: string, values: CommissionFormValues) {
  validateCommission(values);
  const { id: _newId, ...basePayload } = commissionPayload(values);
  const payload: CommissionUpdate = { ...basePayload, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from('commissions').update(payload).eq('id', id).select('*').single().returns<CommissionRecord>();
  if (error) handleSupabaseError(error, 'تعذر تحديث العمولة');
  return data;
}

export async function archiveCommission(id: string) {
  const { data, error } = await supabase.from('commissions').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', id).select('*').single().returns<CommissionRecord>();
  if (error) handleSupabaseError(error, 'تعذر إلغاء العمولة');
  return data;
}
