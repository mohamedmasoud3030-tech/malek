import { getTodayLocalDateString } from '@/features/financials/financials-date-utils';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type OwnerAgreement = Database['public']['Tables']['owner_agreements']['Row'];
export type OwnerAgreementInsert = Database['public']['Tables']['owner_agreements']['Insert'];

export type AgreementType = 'property_management' | 'master_lease';
export type CommissionType = 'FIXED_MONTHLY' | 'RATE';

export interface CreatePropertyWithAgreementPayload {
  // Property fields
  title: string;
  type: string;
  address: string;
  owner_id: string;
  owner_name?: string | null;
  purchase_value?: number | null;
  current_value?: number | null;
  status?: string;
  notes?: string | null;
  // Agreement fields
  agreement_type: AgreementType;
  commission_type: CommissionType;
  commission_value: number;
  agreement_starts_on: string;
  agreement_ends_on?: string | null;
}

export interface CreatePropertyWithAgreementResult {
  property_id: string;
  agreement_id: string;
}

/**
 * Atomic RPC: creates property + owner_agreement + property_owners (compat) in one transaction.
 * properties.owner_id is kept as a compatibility projection only.
 */
export async function createPropertyWithAgreement(
  payload: CreatePropertyWithAgreementPayload,
): Promise<CreatePropertyWithAgreementResult> {
  const { data, error } = await supabase.rpc('create_property_with_agreement', {
    p_title: payload.title,
    p_type: payload.type,
    p_address: payload.address,
    p_owner_id: payload.owner_id,
    p_agreement_type: payload.agreement_type,
    p_commission_type: payload.commission_type,
    p_commission_value: payload.commission_value,
    p_agreement_starts_on: payload.agreement_starts_on,
    p_agreement_ends_on: payload.agreement_ends_on ?? null,
    p_owner_name: payload.owner_name ?? null,
    p_purchase_value: payload.purchase_value ?? null,
    p_current_value: payload.current_value ?? null,
    p_status: payload.status ?? 'active',
    p_notes: payload.notes ?? null,
  });

  if (error) throw new Error(formatAgreementError(error.message));
  if (!isCreatePropertyWithAgreementResult(data)) {
    throw new Error('تعذر التحقق من استجابة إنشاء العقار والاتفاقية.');
  }
  return data;
}

function isCreatePropertyWithAgreementResult(value: unknown): value is CreatePropertyWithAgreementResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'property_id' in value &&
    'agreement_id' in value &&
    typeof value.property_id === 'string' &&
    typeof value.agreement_id === 'string'
  );
}

/** Returns the agreement in force on a specific date, not merely the latest scheduled agreement. */
export function getAgreementActiveOn(
  agreements: readonly OwnerAgreement[],
  asOf = getTodayLocalDateString(),
): OwnerAgreement | null {
  return agreements.find((agreement) =>
    agreement.starts_on <= asOf && (!agreement.ends_on || agreement.ends_on >= asOf),
  ) ?? null;
}

export async function listOwnerAgreementsForProperty(propertyId: string): Promise<OwnerAgreement[]> {
  const { data, error } = await supabase
    .from('owner_agreements')
    .select('*')
    .eq('property_id', propertyId)
    .order('starts_on', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Returns the active agreement that covers the given date range for a property.
 * Used by contract creation to validate agreement coverage.
 */
export async function getAgreementCoveringRange(
  propertyId: string,
  contractStart: string,
  contractEnd: string,
): Promise<OwnerAgreement | null> {
  const { data, error } = await supabase
    .from('owner_agreements')
    .select('*')
    .eq('property_id', propertyId)
    .lte('starts_on', contractStart)
    .or(`ends_on.is.null,ends_on.gte.${contractEnd}`)
    .order('starts_on', { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data ?? [])[0] ?? null;
}

function formatAgreementError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('غير مصرح') || lower.includes('not authorized') || lower.includes('permission denied')) {
    return 'غير مصرح: يحتاج هذا الإجراء صلاحية مدير أو مشرف.';
  }
  if (lower.includes('owner_agreements_no_overlap') || lower.includes('exclusion constraint')) {
    return 'يوجد اتفاقية مالك نشطة لهذا العقار في نفس الفترة الزمنية. عدّل التواريخ أو أنهِ الاتفاقية الحالية أولاً.';
  }
  if (lower.includes('نسبة العمولة') || lower.includes('rate')) {
    return 'نسبة العمولة يجب أن تكون بين 0 و100 عند اختيار نوع RATE.';
  }
  return message || 'تعذر حفظ العقار مع الاتفاقية. حاول مرة أخرى.';
}
