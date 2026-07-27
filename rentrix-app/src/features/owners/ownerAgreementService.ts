import { getTodayLocalDateString } from '@/features/financials/financials-date-utils';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { Owner, PropertyOwnerWithOwner } from './services/owner-service';

export type OwnerAgreement = Database['public']['Tables']['owner_agreements']['Row'];
export type OwnerAgreementInsert = Database['public']['Tables']['owner_agreements']['Insert'];
export type AgreementType = 'property_management' | 'master_lease';
export type CommissionType = 'FIXED_MONTHLY' | 'RATE';

export type OwnerAgreementFormPayload = Pick<OwnerAgreementInsert,
  'owner_id' | 'property_id' | 'agreement_type' | 'commission_type' | 'commission_value' | 'starts_on'
> & Partial<Pick<OwnerAgreementInsert, 'ends_on' | 'notes'>>;

export interface CreatePropertyWithAgreementPayload {
  title: string; type: string; address: string; owner_id: string; owner_name?: string | null; purchase_value?: number | null; current_value?: number | null; status?: string; notes?: string | null;
  agreement_type: AgreementType; commission_type: CommissionType; commission_value: number; agreement_starts_on: string; agreement_ends_on?: string | null;
}
export interface CreatePropertyWithAgreementResult { property_id: string; agreement_id: string; }

function normalizeAgreementPayload(payload: OwnerAgreementFormPayload): OwnerAgreementFormPayload {
  if (!payload.owner_id) throw new Error('اختر المالك للاتفاقية.');
  if (!payload.property_id) throw new Error('العقار مطلوب للاتفاقية.');
  if (!payload.starts_on) throw new Error('تاريخ بداية الاتفاقية مطلوب.');
  if (payload.ends_on && payload.ends_on < payload.starts_on) throw new Error('تاريخ نهاية الاتفاقية يجب ألا يسبق البداية.');
  if (payload.commission_type === 'RATE' && (payload.commission_value < 0 || payload.commission_value > 100)) {
    throw new Error('نسبة العمولة يجب أن تكون بين 0 و100.');
  }
  if (payload.commission_type === 'FIXED_MONTHLY' && payload.commission_value < 0) {
    throw new Error('قيمة العمولة الثابتة يجب ألا تكون سالبة.');
  }
  return { ...payload, ends_on: payload.ends_on || null, notes: payload.notes?.trim() || null };
}

export function propertyOwnershipCoversAgreementRange(
  ownership: Pick<PropertyOwnerWithOwner, 'starts_on' | 'ends_on'>,
  startsOn: string,
  endsOn?: string | null,
): boolean {
  if (!startsOn) return false;
  if (ownership.starts_on && ownership.starts_on > startsOn) return false;
  if (!ownership.ends_on) return true;
  return Boolean(endsOn && ownership.ends_on >= endsOn);
}

export function getEligibleAgreementOwners(
  ownershipLinks: readonly PropertyOwnerWithOwner[],
  startsOn: string,
  endsOn?: string | null,
): Owner[] {
  const ownersById = new Map<string, Owner>();

  for (const link of ownershipLinks) {
    if (!link.owner?.is_active || !propertyOwnershipCoversAgreementRange(link, startsOn, endsOn)) continue;
    ownersById.set(link.owner_id, link.owner);
  }

  return [...ownersById.values()];
}

export function assertAgreementOwnerHasOwnership(
  ownershipLinks: readonly PropertyOwnerWithOwner[],
  payload: Pick<OwnerAgreementFormPayload, 'owner_id' | 'starts_on' | 'ends_on'>,
): void {
  const hasCoveringOwnership = ownershipLinks.some((link) => (
    link.owner_id === payload.owner_id
    && link.owner?.is_active === true
    && propertyOwnershipCoversAgreementRange(link, payload.starts_on, payload.ends_on)
  ));

  if (!hasCoveringOwnership) {
    throw new Error('المالك المحدد غير نشط أو لا يملك العقار طوال فترة الاتفاقية. فعّل المالك وراجع تواريخ الملكية أو اختر مالكاً آخر.');
  }
}

export async function createPropertyWithAgreement(payload: CreatePropertyWithAgreementPayload): Promise<CreatePropertyWithAgreementResult> {
  const { data, error } = await supabase.rpc('create_property_with_agreement', {
    p_title: payload.title, p_type: payload.type, p_address: payload.address, p_owner_id: payload.owner_id,
    p_agreement_type: payload.agreement_type, p_commission_type: payload.commission_type, p_commission_value: payload.commission_value,
    p_agreement_starts_on: payload.agreement_starts_on, p_agreement_ends_on: payload.agreement_ends_on ?? null,
    p_owner_name: payload.owner_name ?? null, p_purchase_value: payload.purchase_value ?? null, p_current_value: payload.current_value ?? null,
    p_status: payload.status ?? 'active', p_notes: payload.notes ?? null,
  });
  if (error) throw new Error(formatAgreementError(error.message));
  if (!isCreatePropertyWithAgreementResult(data)) throw new Error('تعذر التحقق من استجابة إنشاء العقار والاتفاقية.');
  return data;
}

function isCreatePropertyWithAgreementResult(value: unknown): value is CreatePropertyWithAgreementResult {
  return typeof value === 'object' && value !== null && 'property_id' in value && 'agreement_id' in value && typeof value.property_id === 'string' && typeof value.agreement_id === 'string';
}

export function getAgreementActiveOn(agreements: readonly OwnerAgreement[], asOf = getTodayLocalDateString()): OwnerAgreement | null {
  return agreements.find((agreement) => agreement.starts_on <= asOf && (!agreement.ends_on || agreement.ends_on >= asOf)) ?? null;
}

export function groupAgreementsByTemporalStatus(agreements: readonly OwnerAgreement[], asOf = getTodayLocalDateString()) {
  return {
    current: agreements.filter((agreement) => agreement.starts_on <= asOf && (!agreement.ends_on || agreement.ends_on >= asOf)),
    scheduled: agreements.filter((agreement) => agreement.starts_on > asOf),
    ended: agreements.filter((agreement) => Boolean(agreement.ends_on && agreement.ends_on < asOf)),
  };
}

export async function listOwnerAgreementsForProperty(propertyId: string): Promise<OwnerAgreement[]> {
  const { data, error } = await supabase.from('owner_agreements').select('*').eq('property_id', propertyId).order('starts_on', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getAgreementCoveringRange(propertyId: string, contractStart: string, contractEnd: string): Promise<OwnerAgreement | null> {
  const { data, error } = await supabase.from('owner_agreements').select('*').eq('property_id', propertyId).lte('starts_on', contractStart).or(`ends_on.is.null,ends_on.gte.${contractEnd}`).order('starts_on', { ascending: false }).limit(1);
  if (error) throw error;
  return (data ?? [])[0] ?? null;
}

export async function createOwnerAgreement(payload: OwnerAgreementFormPayload): Promise<OwnerAgreement> {
  const { data, error } = await supabase.rpc('create_owner_agreement_atomic', { payload: normalizeAgreementPayload(payload) });
  if (error) throw new Error(formatAgreementError(error.message));
  return data as OwnerAgreement;
}

export async function updateOwnerAgreement(agreementId: string, payload: OwnerAgreementFormPayload): Promise<OwnerAgreement> {
  const { data, error } = await supabase.rpc('update_owner_agreement_atomic', { p_agreement_id: agreementId, payload: normalizeAgreementPayload(payload) });
  if (error) throw new Error(formatAgreementError(error.message));
  return data as OwnerAgreement;
}

export function formatAgreementError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('غير مصرح') || lower.includes('not authorized') || lower.includes('permission denied')) return 'غير مصرح: يحتاج هذا الإجراء صلاحية مدير أو مشرف.';
  if (lower.includes('owner_agreements_no_overlap') || lower.includes('exclusion constraint')) return 'يوجد اتفاقية مالك لهذا العقار في نفس الفترة الزمنية. عدّل التواريخ أو أنهِ الاتفاقية الحالية أولاً.';
  if (lower.includes('لا يملك العقار طوال فترة الاتفاقية') || lower.includes('requires ownership')) return 'المالك المحدد لا يملك العقار طوال فترة الاتفاقية. راجع تواريخ الملكية أو اختر مالكاً آخر.';
  if (lower.includes('outside') || lower.includes('خارج الفترة') || lower.includes('linked')) return 'لا يمكن تعديل الاتفاقية لأن هناك عقداً محفوظاً سيصبح خارج فترة الاتفاقية.';
  if (lower.includes('نسبة العمولة') || lower.includes('rate')) return 'نسبة العمولة يجب أن تكون بين 0 و100 عند اختيار نوع RATE.';
  return message || 'تعذر حفظ اتفاقية المالك. حاول مرة أخرى.';
}
