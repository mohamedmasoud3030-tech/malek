import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import { fetchAllRows } from '@/lib/paginatedRead';

export type DepositStatus = 'held' | 'partially_refunded' | 'refunded' | 'forfeited_damage' | 'forfeited_arrears' | 'partially_deducted';

export type DepositRecord = {
  id: string;
  contract_id: string;
  tenant_id?: string | null;
  tenant_name?: string | null;
  property_id?: string | null;
  property_title?: string | null;
  unit_id?: string | null;
  unit_number?: string | null;
  deposit_amount: number;
  deducted_amount: number;
  refunded_amount: number;
  remaining_amount: number;
  status: DepositStatus;
  received_date: string;
  settled_date?: string | null;
  notes?: string | null;
  created_at: string;
  request_id?: string | null;
};

export type DepositCreatePayload = {
  contract_id: string;
  tenant_id?: string | null;
  property_id?: string | null;
  unit_id?: string | null;
  amount: number;
  received_date?: string | null;
  notes?: string | null;
  request_id?: string;
};

export type DepositDeductionPayload = {
  deposit_id: string;
  deduction_amount: number;
  reason: 'maintenance_damage' | 'unpaid_arrears' | 'cleaning_fee' | 'other';
  description: string;
  charged_date: string;
  property_id?: string | null;
  request_id?: string;
};

export type DepositRefundPayload = {
  deposit_id: string;
  refund_amount: number;
  payment_method: 'cash' | 'bank_transfer' | 'check';
  refund_date: string;
  notes?: string | null;
  request_id?: string;
};

export const depositStatusLabels: Record<DepositStatus, string> = {
  held: 'محتجز في الأمانات',
  partially_refunded: 'مسترد جزئياً',
  refunded: 'مسترد بالكامل',
  forfeited_damage: 'مخصوم لصالح أضرار الشقة',
  forfeited_arrears: 'مصادر لسداد المتأخرات',
  partially_deducted: 'مخصوم جزئياً لأضرار',
};

export const deductionReasonLabels: Record<DepositDeductionPayload['reason'], string> = {
  maintenance_damage: 'أضرار وصيانة العين المؤجرة',
  unpaid_arrears: 'سداد فواتير ومتأخرات إيجارية',
  cleaning_fee: 'رسوم تنظيف وإعادة تسليم',
  other: 'خصومات أخرى معتمدة',
};

type DepositRow = {
  id: string;
  contract_id: string;
  tenant_id?: string | null;
  property_id?: string | null;
  unit_id?: string | null;
  deposit_amount: number;
  deducted_amount: number;
  refunded_amount: number;
  remaining_amount: number;
  status: DepositStatus;
  received_date: string;
  settled_date?: string | null;
  notes?: string | null;
  created_at: string;
  request_id?: string | null;
};

function mapRow(row: any): DepositRecord {
  return {
    id: row.id,
    contract_id: row.contract_id,
    tenant_id: row.tenant_id ?? null,
    tenant_name: row.people?.full_name ?? row.tenant_id ?? null,
    property_id: row.property_id ?? null,
    property_title: row.properties?.title ?? row.property_id ?? null,
    unit_id: row.unit_id ?? null,
    unit_number: row.units?.unit_number ?? row.unit_id ?? null,
    deposit_amount: Number(row.deposit_amount ?? 0),
    deducted_amount: Number(row.deducted_amount ?? 0),
    refunded_amount: Number(row.refunded_amount ?? 0),
    remaining_amount: Number(row.remaining_amount ?? 0),
    status: row.status as DepositStatus,
    received_date: row.received_date,
    settled_date: row.settled_date ?? null,
    notes: row.notes ?? null,
    created_at: row.created_at,
    request_id: row.request_id ?? null,
  };
}

export async function listTenantDeposits(): Promise<DepositRecord[]> {
  try {
    // A `.limit(200)` here used to silently hide older held deposits. Deposits
    // remain a liability until settled, so every row must participate in this view.
    const { rows } = await fetchAllRows<DepositRow>(() => supabase
      .from('tenant_deposits')
      .select(`
        *,
        properties:property_id(id,title),
        units:unit_id(id,unit_number)
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .returns<DepositRow>() as any);
    return rows.map(mapRow);
  } catch (error) {
    if ((error as any)?.code === '42P01') return [];
    handleSupabaseError(error, 'تعذر تحميل ودائع التأمين');
    throw error;
  }
}

export async function createTenantDeposit(payload: DepositCreatePayload): Promise<DepositRecord> {
  if (!payload.contract_id) throw new Error('العقد مطلوب لتسجيل الوديعة');
  if (!Number.isFinite(payload.amount) || payload.amount <= 0) throw new Error('مبلغ الوديعة يجب أن يكون أكبر من صفر');

  const requestId = payload.request_id || crypto.randomUUID();

  function getLocalDateString(date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const rpcPayload = {
    contract_id: payload.contract_id,
    tenant_id: payload.tenant_id || null,
    property_id: payload.property_id || null,
    unit_id: payload.unit_id || null,
    amount: payload.amount,
    received_date: payload.received_date || getLocalDateString(),
    notes: payload.notes || null,
    request_id: requestId,
  };

  const { data, error } = await supabase.rpc('create_deposit_atomic' as any, { p_payload: rpcPayload });
  if (error) handleSupabaseError(error, 'فشل إنشاء وديعة التأمين');

  const depositId = (data as any)?.deposit_id as string | undefined;
  if (!depositId) throw new Error('لم يتم إرجاع معرف الوديعة من الخادم');

  const { data: row, error: fetchError } = await supabase
    .from('tenant_deposits')
    .select(`
      *,
      properties:property_id(id,title),
      units:unit_id(id,unit_number)
    `)
    .eq('id', depositId)
    .single();

  if (fetchError) handleSupabaseError(fetchError, 'تم إنشاء الوديعة لكن تعذر تحميلها');
  return mapRow(row);
}

export async function recordDepositDeduction(payload: DepositDeductionPayload): Promise<DepositRecord> {
  if (!payload.deposit_id) throw new Error('معرف الوديعة مطلوب');
  if (!Number.isFinite(payload.deduction_amount) || payload.deduction_amount <= 0) throw new Error('مبلغ الخصم يجب أن يكون أكبر من صفر');
  if (!payload.description?.trim()) throw new Error('وصف الخصم مطلوب');
  if (!payload.charged_date) throw new Error('تاريخ الخصم مطلوب');

  const requestId = payload.request_id || crypto.randomUUID();
  const rpcPayload = {
    deposit_id: payload.deposit_id,
    amount: payload.deduction_amount,
    reason: payload.reason,
    description: payload.description.trim(),
    charged_date: payload.charged_date,
    property_id: payload.property_id || null,
    request_id: requestId,
  };

  const { error } = await supabase.rpc('deduct_deposit_atomic' as any, { p_payload: rpcPayload });
  if (error) handleSupabaseError(error, 'فشل خصم مبلغ التأمين - تحقق من الرصيد المتبقي');

  const { data: row, error: fetchError } = await supabase
    .from('tenant_deposits')
    .select(`
      *,
      properties:property_id(id,title),
      units:unit_id(id,unit_number)
    `)
    .eq('id', payload.deposit_id)
    .single();

  if (fetchError) handleSupabaseError(fetchError, 'تم الخصم لكن تعذر تحديث السجل');
  return mapRow(row);
}

export async function recordDepositRefund(payload: DepositRefundPayload): Promise<DepositRecord> {
  if (!payload.deposit_id) throw new Error('معرف الوديعة مطلوب');
  if (!Number.isFinite(payload.refund_amount) || payload.refund_amount <= 0) throw new Error('مبلغ الاسترداد يجب أن يكون أكبر من صفر');
  if (!payload.refund_date) throw new Error('تاريخ الاسترداد مطلوب');

  const requestId = payload.request_id || crypto.randomUUID();
  const rpcPayload = {
    deposit_id: payload.deposit_id,
    amount: payload.refund_amount,
    payment_method: payload.payment_method,
    refund_date: payload.refund_date,
    notes: payload.notes || null,
    request_id: requestId,
  };

  const { error } = await supabase.rpc('refund_deposit_atomic' as any, { p_payload: rpcPayload });
  if (error) handleSupabaseError(error, 'فشل رد مبلغ التأمين - تحقق من الرصيد المتبقي');

  const { data: row, error: fetchError } = await supabase
    .from('tenant_deposits')
    .select(`
      *,
      properties:property_id(id,title),
      units:unit_id(id,unit_number)
    `)
    .eq('id', payload.deposit_id)
    .single();

  if (fetchError) handleSupabaseError(fetchError, 'تم الاسترداد لكن تعذر تحديث السجل');
  return mapRow(row);
}

export async function listDepositTransactions(depositId: string) {
  try {
    const { rows } = await fetchAllRows<any>(() => supabase
      .from('deposit_transactions')
      .select('*')
      .eq('deposit_id', depositId)
      .order('created_at', { ascending: true }) as any);
    return rows;
  } catch (error) {
    handleSupabaseError(error, 'تعذر تحميل سجل حركات الوديعة');
    throw error;
  }
}
