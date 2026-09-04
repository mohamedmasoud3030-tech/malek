import { getTodayLocalDateString } from '@/features/financials/financials-date-utils';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { Owner, PropertyOwnerWithOwner } from './services/owner-service';

export type OwnerAgreement = Database['public']['Tables']['owner_agreements']['Row'];
export type OwnerAgreementVersion = Database['public']['Tables']['owner_agreement_versions']['Row'];
export type OwnerAgreementInsert = Database['public']['Tables']['owner_agreements']['Insert'];
export type AgreementType = 'property_management' | 'master_lease';
export type CommissionType = 'FIXED_MONTHLY' | 'RATE';
export type CollectionRole = 'OWNER_IS_CREDITOR' | 'OFFICE_IS_CREDITOR';
export type DepositParty = 'OWNER' | 'OFFICE';

export type OwnerAgreementVersionTerms = Pick<OwnerAgreementVersion,
  'collection_role' | 'commission_type' | 'commission_value' | 'effective_from'
> & Partial<Pick<OwnerAgreementVersion,
  'operating_model' | 'effective_to' | 'offset_allowed' | 'reserve_amount' | 'deposit_beneficiary' | 'deposit_custodian' | 'notes'
>>;

export type OwnerAgreementFormPayload = Pick<OwnerAgreementInsert,
  'owner_id' | 'property_id' | 'agreement_type' | 'commission_type' | 'commission_value' | 'starts_on'
> & Partial<Pick<OwnerAgreementInsert, 'ends_on' | 'notes'>> & {
  collection_role?: CollectionRole;
  offset_allowed?: boolean;
  reserve_amount?: number;
  deposit_beneficiary?: DepositParty | null;
  deposit_custodian?: DepositParty | null;
};

/**
 * One explicit ownership share submitted with the property/agreement creation
 * payload. Mirrors the canonical property_owners row semantics consumed by the
 * atomic creation RPC (`create_property_with_ownership_atomic`).
 */
export type PropertyOwnershipShare = Readonly<{
  owner_id: string;
  ownership_percentage: number;
  is_primary: boolean;
}>;

export interface CreatePropertyWithAgreementPayload {
  title: string; type: string; address: string; owner_id: string; owner_name?: string | null; purchase_value?: number | null; current_value?: number | null; status?: string; notes?: string | null;
  agreement_type: AgreementType; collection_role?: CollectionRole; commission_type: CommissionType; commission_value: number; agreement_starts_on: string; agreement_ends_on?: string | null;
  /**
   * Complete ownership payload created together with the property and
   * agreement in one atomic database transaction. Exactly one share must be
   * the primary owner (matching `owner_id`), no owner may repeat, and the
   * percentages must total exactly 100. Omitted for callers that keep the
   * legacy single-owner default (primary owner at 100%).
   */
  ownership?: readonly PropertyOwnershipShare[];
}
export interface CreatePropertyWithAgreementResult { property_id: string; agreement_id: string; }

/**
 * Normalizes the client-side ownership payload into the explicit share list
 * sent to the atomic RPC, and fails closed on the same invariants the RPC
 * enforces (exactly one primary matching the property owner, no duplicate
 * owners, percentages within (0, 100] summing to exactly 100). Kept at the
 * service boundary so a hand-crafted call cannot bypass the contract.
 */
export function normalizePropertyOwnershipPayload(
  ownerId: string,
  ownership?: readonly PropertyOwnershipShare[],
): PropertyOwnershipShare[] {
  // Omitted payload keeps the legacy single-owner default (primary at 100%).
  // An EXPLICITLY empty array is not a default request: it is an invalid
  // ownership payload and fails closed exactly like the RPC's
  // OWNERSHIP_PRIMARY_REQUIRED.
  if (ownership === undefined) {
    return [{ owner_id: ownerId, ownership_percentage: 100, is_primary: true }];
  }
  if (ownership.length === 0) {
    throw new Error('يجب تحديد مالك أساسي واحد فقط في نسب الملكية.');
  }

  const primaryShares = ownership.filter((share) => share.is_primary);
  if (primaryShares.length !== 1) {
    throw new Error('يجب تحديد مالك أساسي واحد فقط في نسب الملكية.');
  }
  if (primaryShares[0]?.owner_id !== ownerId) {
    throw new Error('المالك الأساسي في بيانات الملكية يختلف عن المالك المحدد للعقار.');
  }

  const seenOwnerIds = new Set<string>();
  let total = 0;
  for (const share of ownership) {
    if (!share.owner_id) throw new Error('كل سجل ملكية يجب أن يحدد المالك.');
    if (seenOwnerIds.has(share.owner_id)) {
      throw new Error('لا يمكن تكرار المالك نفسه في نسب الملكية.');
    }
    seenOwnerIds.add(share.owner_id);
    const percentage = Number(share.ownership_percentage);
    if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
      throw new Error('نسبة الملكية يجب أن تكون أكبر من صفر وألا تتجاوز 100%.');
    }
    total += percentage;
  }
  if (total !== 100) {
    throw new Error('مجموع نسب الملكية يجب أن يساوي 100% بالضبط.');
  }
  return [...ownership];
}

function normalizeAgreementPayload(payload: OwnerAgreementFormPayload): OwnerAgreementFormPayload {
  if (!payload.owner_id) throw new Error('اختر المالك للاتفاقية.');
  if (!payload.property_id) throw new Error('العقار مطلوب للاتفاقية.');
  if (payload.agreement_type !== 'property_management') throw new Error('الاستئجار الرئيسي غير متاح في الإصدار الحالي.');
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
  if (payload.agreement_type !== 'property_management') throw new Error('الاستئجار الرئيسي غير متاح في الإصدار الحالي.');
  // TD-01 / R-01: the complete ownership payload travels with the creation
  // call so the property, agreement, and ownership split commit in ONE
  // database transaction (create_property_with_ownership_atomic). There is no
  // separate client-side ownership-write round trip after creation anymore.
  const ownership = normalizePropertyOwnershipPayload(payload.owner_id, payload.ownership);
  const { data, error } = await supabase.rpc('create_property_with_ownership_atomic', {
    p_title: payload.title, p_type: payload.type, p_address: payload.address, p_owner_id: payload.owner_id,
    p_agreement_type: payload.agreement_type, p_collection_role: payload.collection_role ?? 'OWNER_IS_CREDITOR', p_commission_type: payload.commission_type, p_commission_value: payload.commission_value,
    p_agreement_starts_on: payload.agreement_starts_on, p_agreement_ends_on: payload.agreement_ends_on ?? null,
    p_owner_name: payload.owner_name ?? null, p_purchase_value: payload.purchase_value ?? null, p_current_value: payload.current_value ?? null,
    p_status: payload.status ?? 'active', p_notes: payload.notes ?? null,
    p_ownership: ownership,
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

export function groupAgreementsByTemporalStatus<T extends Pick<OwnerAgreement, 'starts_on' | 'ends_on'>>(
  agreements: readonly T[],
  asOf = getTodayLocalDateString(),
) {
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

export type OwnerAgreementWithProperty = OwnerAgreement & Readonly<{
  property: { id: string; title: string | null } | null;
}>;

/**
 * Agreements for one owner across their properties (read context for the
 * owner dossier). The property workspace remains the single management
 * authority for agreements and versions.
 */
export async function listOwnerAgreementsForOwner(ownerId: string): Promise<OwnerAgreementWithProperty[]> {
  const { data, error } = await supabase
    .from('owner_agreements')
    .select('*, property:properties(id, title)')
    .eq('owner_id', ownerId)
    .order('starts_on', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getAgreementCoveringRange(propertyId: string, contractStart: string, contractEnd: string): Promise<OwnerAgreement | null> {
  const { data, error } = await supabase.from('owner_agreements').select('*').eq('property_id', propertyId).lte('starts_on', contractStart).or(`ends_on.is.null,ends_on.gte.${contractEnd}`).order('starts_on', { ascending: false }).limit(1);
  if (error) throw error;
  return (data ?? [])[0] ?? null;
}

export async function listOwnerAgreementVersions(agreementIds: readonly string[]): Promise<OwnerAgreementVersion[]> {
  if (agreementIds.length === 0) return [];
  const { data, error } = await supabase
    .from('owner_agreement_versions')
    .select('*')
    .in('owner_agreement_id', [...agreementIds])
    .order('version_no', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createOwnerAgreement(payload: OwnerAgreementFormPayload): Promise<OwnerAgreement> {
  const { data, error } = await supabase.rpc('create_owner_agreement_with_version_atomic', { payload: normalizeAgreementPayload(payload) });
  if (error) throw new Error(formatAgreementError(error.message));
  return data as OwnerAgreement;
}

export async function createOwnerAgreementVersion(
  agreementId: string,
  terms: OwnerAgreementVersionTerms,
): Promise<OwnerAgreementVersion> {
  if (!terms.effective_from) throw new Error('تاريخ سريان التعديل مطلوب.');
  if (terms.effective_from <= getTodayLocalDateString()) throw new Error('لا يمكن تطبيق تعديل بأثر رجعي. اختر تاريخ سريان مستقبلي.');
  if (terms.effective_to && terms.effective_to < terms.effective_from) throw new Error('تاريخ نهاية التعديل يجب ألا يسبق بداية سريانه.');
  if (!Number.isFinite(terms.commission_value) || terms.commission_value < 0) throw new Error('قيمة العمولة غير صحيحة.');
  if (terms.commission_type === 'RATE' && terms.commission_value > 100) throw new Error('نسبة العمولة يجب أن تكون بين 0 و100.');
  if (!Number.isFinite(terms.reserve_amount ?? 0) || (terms.reserve_amount ?? 0) < 0) throw new Error('قيمة الاحتياطي لا يمكن أن تكون سالبة.');

  const { data, error } = await supabase.rpc('create_future_owner_agreement_version_atomic', {
    p_owner_agreement_id: agreementId,
    p_terms: {
      ...terms,
      operating_model: terms.operating_model ?? 'OWNER_AGENCY',
      effective_to: terms.effective_to || null,
      notes: terms.notes?.trim() || null,
    },
  });
  if (error) throw new Error(formatAgreementError(error.message));
  return data as OwnerAgreementVersion;
}

export function formatAgreementError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('غير مصرح') || lower.includes('not authorized') || lower.includes('permission denied')) return 'غير مصرح: يحتاج هذا الإجراء صلاحية مدير أو مشرف.';
  if (lower.includes('master_lease_excluded_from_rc1')) return 'الاستئجار الرئيسي غير متاح في الإصدار الحالي.';
  if (lower.includes('retroactive_change_forbidden') || lower.includes('version_must_be_future')) return 'لا يمكن تطبيق تعديل بأثر رجعي. اختر تاريخ سريان مستقبلي.';
  if (lower.includes('version_terms_invalid')) return 'شروط التعديل غير صحيحة. راجع تاريخ السريان والعمولة والاحتياطي.';
  if (lower.includes('owner_agreements_no_overlap') || lower.includes('exclusion constraint')) return 'يوجد اتفاقية مالك لهذا العقار في نفس الفترة الزمنية. عدّل التواريخ أو أنهِ الاتفاقية الحالية أولاً.';
  if (lower.includes('لا يملك العقار طوال فترة الاتفاقية') || lower.includes('requires ownership')) return 'المالك المحدد لا يملك العقار طوال فترة الاتفاقية. راجع تواريخ الملكية أو اختر مالكاً آخر.';
  if (lower.includes('outside') || lower.includes('خارج الفترة') || lower.includes('linked')) return 'لا يمكن تعديل الاتفاقية لأن هناك عقداً محفوظاً سيصبح خارج فترة الاتفاقية.';
  if (lower.includes('نسبة العمولة') || lower.includes('rate')) return 'نسبة العمولة يجب أن تكون بين 0 و100 عند اختيار نوع RATE.';
  return message || 'تعذر حفظ اتفاقية المالك. حاول مرة أخرى.';
}
