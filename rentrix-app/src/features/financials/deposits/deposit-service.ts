import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import { depositPayloadSchema } from './deposit-schema';

/** Narrow a Json RPC response to a plain object (never `as any`). */
function asJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}


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

export type DepositRefundPayload = {
  deposit_id: string;
  refund_amount: number;
  payment_method: 'cash' | 'bank_transfer' | 'check';
  refund_date: string;
  notes?: string | null;
  request_id?: string;
};

/** GAP-009 governed deposit claim (evidence-backed, maker-checker approved). */
export type DepositClaimKind = 'INVOICE_ARREARS' | 'DAMAGE';
export type DepositClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'APPLIED' | 'REVERSED';

export type DepositClaimRecord = {
  id: string;
  deposit_id: string;
  contract_id: string;
  claim_kind: DepositClaimKind;
  invoice_id?: string | null;
  allocation_amount: number;
  evidence_uri: string;
  claim_note?: string | null;
  inspection_id?: string | null;
  target_type?: string | null;
  target_account_no?: string | null;
  status: DepositClaimStatus;
  created_by: string;
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
  application_request_id?: string | null;
  application_effective_date?: string | null;
  application_journal_batch_id?: string | null;
  applied_at?: string | null;
  reversal_request_id?: string | null;
  reversal_reason?: string | null;
  reversed_at?: string | null;
  created_at: string;
};

export type DepositClaimCreatePayload = {
  deposit_id: string;
  claim_kind: DepositClaimKind;
  invoice_id?: string | null;
  allocation_amount: number;
  evidence_uri: string;
  claim_note?: string | null;
  inspection_id?: string | null;
  request_id?: string;
};

export type DepositRefundEventRecord = {
  id: string;
  deposit_id: string;
  amount: number;
  cash_account_no: string;
  effective_date: string;
  request_id: string;
  journal_batch_id: string;
  status: 'POSTED' | 'REVERSED';
  posted_at: string;
  reversal_request_id?: string | null;
  reversal_reason?: string | null;
  reversed_at?: string | null;
  created_at: string;
};

export const depositStatusLabels: Record<DepositStatus, string> = {
  held: 'محتجز في الأمانات',
  partially_refunded: 'مسترد جزئياً',
  refunded: 'مسترد بالكامل',
  forfeited_damage: 'مصادرة للتعويض عن الأضرار',
  forfeited_arrears: 'مصادرة لتسوية المتأخرات',
  partially_deducted: 'مخصوم جزئياً',
};

export const depositClaimStatusLabels: Record<DepositClaimStatus, string> = {
  PENDING: 'بانتظار الاعتماد',
  APPROVED: 'معتمد',
  REJECTED: 'مرفوض',
  APPLIED: 'تم التطبيق',
  REVERSED: 'تم الإلغاء (تعويضي)',
};

export const depositClaimKindLabels: Record<DepositClaimKind, string> = {
  INVOICE_ARREARS: 'تسوية متأخرات فاتورة',
  DAMAGE: 'تعويض عن أضرار',
};

/** Legacy reason vocabulary retained for display compatibility. */
export const deductionReasonLabels: Record<string, string> = {
  maintenance_damage: 'أضرار',
  unpaid_arrears: 'متأخرات إيجار',
  cleaning_fee: 'رسوم تنظيف',
  other: 'أخرى',
};

function getLocalDateString(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

type DepositRow = Record<string, unknown> & {
  contracts?: { people?: { full_name?: string } | null } | null;
  properties?: { title?: string } | null;
  units?: { unit_number?: string } | null;
  people?: { full_name?: string } | null;
};

function mapRow(row: DepositRow): DepositRecord {
  return {
    id: String(row.id),
    contract_id: String(row.contract_id ?? ''),
    tenant_id: row.tenant_id ? String(row.tenant_id) : null,
    tenant_name: row.contracts?.people?.full_name ?? row.people?.full_name ?? null,
    property_id: row.property_id ? String(row.property_id) : null,
    property_title: row.properties?.title ?? null,
    unit_id: row.unit_id ? String(row.unit_id) : null,
    unit_number: row.units?.unit_number ?? null,
    deposit_amount: Number(row.deposit_amount ?? 0),
    deducted_amount: Number(row.deducted_amount ?? 0),
    refunded_amount: Number(row.refunded_amount ?? 0),
    remaining_amount: Number(row.remaining_amount ?? 0),
    status: row.status as DepositStatus,
    received_date: String(row.received_date ?? ''),
    settled_date: row.settled_date ? String(row.settled_date) : null,
    notes: row.notes ? String(row.notes) : null,
    created_at: String(row.created_at ?? ''),
    request_id: row.request_id ? String(row.request_id) : null,
  };
}

function mapClaimRow(row: Record<string, unknown>): DepositClaimRecord {
  return {
    id: String(row.id),
    deposit_id: String(row.deposit_id),
    contract_id: String(row.contract_id),
    claim_kind: row.claim_kind as DepositClaimKind,
    invoice_id: row.invoice_id ? String(row.invoice_id) : null,
    allocation_amount: Number(row.allocation_amount ?? 0),
    evidence_uri: String(row.evidence_uri ?? ''),
    claim_note: row.claim_note ? String(row.claim_note) : null,
    inspection_id: row.inspection_id ? String(row.inspection_id) : null,
    target_type: row.target_type ? String(row.target_type) : null,
    target_account_no: row.target_account_no ? String(row.target_account_no) : null,
    status: row.status as DepositClaimStatus,
    created_by: String(row.created_by ?? ''),
    approved_by: row.approved_by ? String(row.approved_by) : null,
    approved_at: row.approved_at ? String(row.approved_at) : null,
    rejected_by: row.rejected_by ? String(row.rejected_by) : null,
    rejected_at: row.rejected_at ? String(row.rejected_at) : null,
    rejection_reason: row.rejection_reason ? String(row.rejection_reason) : null,
    application_request_id: row.application_request_id ? String(row.application_request_id) : null,
    application_effective_date: row.application_effective_date ? String(row.application_effective_date) : null,
    application_journal_batch_id: row.application_journal_batch_id ? String(row.application_journal_batch_id) : null,
    applied_at: row.applied_at ? String(row.applied_at) : null,
    reversal_request_id: row.reversal_request_id ? String(row.reversal_request_id) : null,
    reversal_reason: row.reversal_reason ? String(row.reversal_reason) : null,
    reversed_at: row.reversed_at ? String(row.reversed_at) : null,
    created_at: String(row.created_at ?? ''),
  };
}

export async function listTenantDeposits(): Promise<DepositRecord[]> {
  const { data, error } = await supabase
    .from('tenant_deposits')
    .select(`
      *,
      contracts:contract_id(people:tenant_id(id,full_name)),
      properties:property_id(id,title),
      units:unit_id(id,unit_number)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200)
    .returns<Record<string, unknown>[]>();
  if (error) handleSupabaseError(error, 'تعذر تحميل الودائع');
  return (data ?? []).map((row) => mapRow(row as DepositRow));
}

export async function createTenantDeposit(payload: DepositCreatePayload): Promise<DepositRecord> {
  // Re-parse at the service boundary. UI validation is not a trust boundary.
  const validated = depositPayloadSchema.parse(payload);
  const requestId = validated.request_id || crypto.randomUUID();

  const rpcPayload = {
    contract_id: validated.contract_id,
    tenant_id: validated.tenant_id || null,
    property_id: validated.property_id || null,
    unit_id: validated.unit_id || null,
    amount: validated.amount,
    received_date: validated.received_date || getLocalDateString(),
    notes: validated.notes || null,
    request_id: requestId,
  };

  const { data, error } = await supabase.rpc('create_deposit_atomic', { p_payload: rpcPayload });
  if (error) handleSupabaseError(error, 'فشل إنشاء وديعة التأمين');

  const depositId = asJsonObject(data).deposit_id as string | undefined;
  if (!depositId) throw new Error('لم يتم إرجاع معرف الوديعة من الخادم');

  const { data: row, error: fetchError } = await supabase
    .from('tenant_deposits')
    .select(`
      *,
      contracts:contract_id(people:tenant_id(id,full_name)),
      properties:property_id(id,title),
      units:unit_id(id,unit_number)
    `)
    .eq('id', depositId)
    .single();

  if (fetchError) handleSupabaseError(fetchError, 'تم إنشاء الوديعة لكن تعذر تحميلها');
  return mapRow(row as DepositRow);
}

// ─────────────────────────────────────────────────────────────────────────────
// GAP-009 governed deposit claim lifecycle (evidence-backed, maker-checker)
// ─────────────────────────────────────────────────────────────────────────────

export async function createDepositClaim(payload: DepositClaimCreatePayload): Promise<DepositClaimRecord> {
  if (!payload.deposit_id) throw new Error('معرف الوديعة مطلوب');
  if (!Number.isFinite(payload.allocation_amount) || payload.allocation_amount <= 0) {
    throw new Error('مبلغ التخصيص يجب أن يكون أكبر من صفر');
  }
  if (!payload.evidence_uri || payload.evidence_uri.trim().length < 3) {
    throw new Error('دليل الإثبات مطلوب (رابط أو مرجع مستند)');
  }
  if (payload.claim_kind === 'INVOICE_ARREARS' && !payload.invoice_id) {
    throw new Error('فاتورة المتأخرات مطلوبة');
  }
  if (payload.claim_kind === 'DAMAGE' && !payload.inspection_id) {
    throw new Error('فحص إخلاء مراجع مطلوب لطلب خصم الأضرار');
  }

  const rpcPayload = {
    request_id: payload.request_id || crypto.randomUUID(),
    deposit_id: payload.deposit_id,
    claim_kind: payload.claim_kind,
    invoice_id: payload.invoice_id || null,
    allocation_amount: payload.allocation_amount,
    evidence_uri: payload.evidence_uri.trim(),
    claim_note: payload.claim_note || null,
    inspection_id: payload.inspection_id || null,
  };

  const { data, error } = await supabase.rpc('create_deposit_application_claim_with_inspection_atomic', { p_payload: rpcPayload });
  if (error) handleSupabaseError(error, 'فشل إنشاء طلب تخصيص الوديعة');
  const claimId = asJsonObject(data).claim_id as string | undefined;
  if (!claimId) throw new Error('لم يتم إرجاع معرف الطلب من الخادم');
  return (await getDepositClaim(claimId))!;
}

export async function getDepositClaim(claimId: string): Promise<DepositClaimRecord | null> {
  const { data, error } = await supabase
    .from('deposit_application_claims')
    .select('*')
    .eq('id', claimId)
    .maybeSingle();
  if (error) handleSupabaseError(error, 'تعذر تحميل الطلب');
  return data ? mapClaimRow(data as Record<string, unknown>) : null;
}

export async function listDepositClaims(depositId?: string): Promise<DepositClaimRecord[]> {
  let query = supabase.from('deposit_application_claims').select('*').order('created_at', { ascending: false }).limit(200);
  if (depositId) query = query.eq('deposit_id', depositId);
  const { data, error } = await query;
  if (error) handleSupabaseError(error, 'تعذر تحميل طلبات التخصيص');
  return (data ?? []).map(mapClaimRow);
}

export async function approveDepositClaim(claimId: string): Promise<void> {
  const { error } = await supabase.rpc('approve_deposit_application_claim_atomic', { p_payload: { claim_id: claimId } });
  if (error) handleSupabaseError(error, 'فشل اعتماد الطلب - لا يمكن اعتماد طلب أنشأته بنفسك');
}

export async function rejectDepositClaim(claimId: string, reason: string): Promise<void> {
  if (!reason || reason.trim().length < 3) throw new Error('سبب الرفض مطلوب');
  const { error } = await supabase.rpc('reject_deposit_application_claim_atomic', {
    p_payload: { claim_id: claimId, reason: reason.trim() },
  });
  if (error) handleSupabaseError(error, 'فشل رفض الطلب');
}

export async function applyDepositClaim(claimId: string, effectiveDate?: string): Promise<{ batch_id: string }> {
  const { data, error } = await supabase.rpc('apply_deposit_claim_atomic', {
    p_payload: {
      claim_id: claimId,
      request_id: crypto.randomUUID(),
      effective_date: effectiveDate || getLocalDateString(),
    },
  });
  if (error) handleSupabaseError(error, 'فشل تطبيق التخصيص - تحقق من الرصيد وحالة الفاتورة');
  return { batch_id: String(asJsonObject(data).batch_id ?? '') };
}

export async function reverseDepositClaim(claimId: string, reason: string): Promise<void> {
  if (!reason || reason.trim().length < 3) throw new Error('سبب الإلغاء مطلوب');
  const { error } = await supabase.rpc('reverse_deposit_claim_atomic', {
    p_payload: { claim_id: claimId, request_id: crypto.randomUUID(), reason: reason.trim() },
  });
  if (error) handleSupabaseError(error, 'فشل إلغاء التخصيص');
}

// ─────────────────────────────────────────────────────────────────────────────
// GAP-009 governed deposit refunds (server-derived cash account, reversible)
// ─────────────────────────────────────────────────────────────────────────────

export async function refundDepositGoverned(payload: DepositRefundPayload): Promise<{ refund_event_id: string; remaining: number; refunded: number }> {
  if (!payload.deposit_id) throw new Error('معرف الوديعة مطلوب');
  if (!Number.isFinite(payload.refund_amount) || payload.refund_amount <= 0) throw new Error('مبلغ الاسترداد يجب أن يكون أكبر من صفر');
  if (!payload.refund_date) throw new Error('تاريخ الاسترداد مطلوب');

  const rpcPayload = {
    deposit_id: payload.deposit_id,
    amount: payload.refund_amount,
    refund_date: payload.refund_date,
    payment_method: payload.payment_method,
    notes: payload.notes || null,
    request_id: payload.request_id || crypto.randomUUID(),
  };

  const { data, error } = await supabase.rpc('refund_deposit_governed_atomic', { p_payload: rpcPayload });
  if (error) handleSupabaseError(error, 'فشل رد مبلغ التأمين - تحقق من الرصيد المتبقي');
  return {
    refund_event_id: String(asJsonObject(data).refund_event_id ?? ''),
    remaining: Number(asJsonObject(data).remaining ?? 0),
    refunded: Number(asJsonObject(data).refunded ?? 0),
  };
}

export async function listDepositRefundEvents(depositId?: string): Promise<DepositRefundEventRecord[]> {
  let query = supabase.from('deposit_refund_events').select('*').order('effective_date', { ascending: false }).limit(200);
  if (depositId) query = query.eq('deposit_id', depositId);
  const { data, error } = await query;
  if (error) handleSupabaseError(error, 'تعذر تحميل أحداث الاسترداد');
  return (data ?? []).map((row) => ({
    id: String(row.id),
    deposit_id: String(row.deposit_id),
    amount: Number(row.amount ?? 0),
    cash_account_no: String(row.cash_account_no ?? ''),
    effective_date: String(row.effective_date ?? ''),
    request_id: String(row.request_id ?? ''),
    journal_batch_id: String(row.journal_batch_id ?? ''),
    status: row.status as 'POSTED' | 'REVERSED',
    posted_at: String(row.posted_at ?? ''),
    reversal_request_id: row.reversal_request_id ? String(row.reversal_request_id) : null,
    reversal_reason: row.reversal_reason ? String(row.reversal_reason) : null,
    reversed_at: row.reversed_at ? String(row.reversed_at) : null,
    created_at: String(row.created_at ?? ''),
  }));
}

export async function reverseDepositRefund(refundEventId: string, reason: string): Promise<void> {
  if (!reason || reason.trim().length < 3) throw new Error('سبب إلغاء الاسترداد مطلوب');
  const { error } = await supabase.rpc('reverse_deposit_refund_atomic', {
    p_payload: { refund_event_id: refundEventId, request_id: crypto.randomUUID(), reason: reason.trim() },
  });
  if (error) handleSupabaseError(error, 'فشل إلغاء الاسترداد');
}

/** Legacy deduction/refund helpers are intentionally absent: deduction/refund
 * writes are governed (evidence-backed claims + maker-checker) and RPC-only. */
