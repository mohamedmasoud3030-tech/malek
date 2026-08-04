import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import { fetchAllRows } from '@/lib/paginatedRead';
import type { CommissionFilters, CommissionFormValues, CommissionRecord } from '../types';

const commissionTypeValues = new Set(['contract', 'payment', 'owner', 'lead', 'land']);
const commissionEditableStatusValues = new Set(['pending', 'approved']);

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

export function commissionPayload(values: CommissionFormValues) {
  return {
    staff_name: values.staff_name.trim(),
    type: values.type,
    source_id: values.source_id.trim() || null,
    deal_value: numberOrNull(values.deal_value, 'قيمة الصفقة'),
    percentage: percentageOrNull(values.percentage),
    amount: deriveAmount(values),
  };
}

export async function listCommissions(filters: CommissionFilters) {
  let query = supabase.from('commissions').select('*').order('created_at', { ascending: false }).order('id', { ascending: false });
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

function validateCommission(values: CommissionFormValues, mode: 'create' | 'update') {
  if (!values.staff_name.trim()) throw new Error('اسم الموظف أو الوسيط مطلوب.');
  if (!commissionTypeValues.has(values.type)) throw new Error('نوع مصدر العمولة غير صحيح.');
  if (mode === 'create' && values.status !== 'pending') {
    throw new Error('تُنشأ العمولة بحالة قيد المراجعة، ثم يمكن اعتمادها من الإجراء المخصص.');
  }
  if (mode === 'update' && !commissionEditableStatusValues.has(values.status)) {
    throw new Error('استخدم إجراء الإلغاء أو الصرف لتغيير العمولة إلى حالة نهائية.');
  }
  const amount = deriveAmount(values);
  if (amount === null || amount <= 0) throw new Error('أدخل قيمة عمولة أكبر من صفر أو قيمة الصفقة والنسبة.');
}

function commissionFromRpc(data: unknown): CommissionRecord {
  const commission = (data as { commission?: CommissionRecord } | null)?.commission;
  if (!commission) throw new Error('تعذر قراءة سجل العمولة بعد تنفيذ العملية.');
  return commission;
}

export async function createCommission(values: CommissionFormValues) {
  validateCommission(values, 'create');
  const payload = { ...commissionPayload(values), request_id: crypto.randomUUID() };
  const { data, error } = await (supabase.rpc as any)('create_commission_atomic', { p_payload: payload });
  if (error) handleSupabaseError(error, 'تعذر حفظ العمولة');
  return commissionFromRpc(data);
}

export async function updateCommission(id: string, values: CommissionFormValues) {
  validateCommission(values, 'update');
  const payload = {
    ...commissionPayload(values),
    commission_id: id,
    requested_status: values.status,
    request_id: crypto.randomUUID(),
  };
  const { data, error } = await (supabase.rpc as any)('update_commission_atomic', { p_payload: payload });
  if (error) handleSupabaseError(error, 'تعذر تحديث العمولة');
  return commissionFromRpc(data);
}

export async function archiveCommission(id: string) {
  const payload = { commission_id: id, request_id: crypto.randomUUID() };
  const { data, error } = await (supabase.rpc as any)('cancel_commission_atomic', { p_payload: payload });
  if (error) handleSupabaseError(error, 'تعذر إلغاء العمولة');
  return commissionFromRpc(data);
}

export async function payCommissionAtomic(
  commissionId: string,
  options?: {
    paymentDate?: string;
    accountId?: string;
    expenseAccountId?: string;
    requestId?: string;
  },
) {
  const payload = {
    commission_id: commissionId,
    payment_date: options?.paymentDate,
    account_id: options?.accountId,
    expense_account_id: options?.expenseAccountId,
    request_id: options?.requestId ?? crypto.randomUUID(),
  };
  const { data, error } = await (supabase.rpc as any)('pay_commission_atomic', { p_payload: payload });
  if (error) handleSupabaseError(error, 'تعذر صرف العمولة مالياً');
  return data;
}

export async function reverseCommissionAtomic(
  commissionId: string,
  reason: string,
  requestId?: string,
) {
  const payload = {
    commission_id: commissionId,
    reason,
    request_id: requestId ?? crypto.randomUUID(),
  };
  const { data, error } = await (supabase.rpc as any)('reverse_commission_atomic', { p_payload: payload });
  if (error) handleSupabaseError(error, 'تعذر عكس العمولة مالياً');
  return data;
}
