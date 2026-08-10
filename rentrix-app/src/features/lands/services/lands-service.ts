import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import { fetchAllRows } from '@/lib/paginatedRead';
import {
  coerceFormToPayload,
  landFormSchema,
  landPayloadSchema,
  type LandFormInput,
  type LandPayload,
  LAND_STATUS_VALUES,
} from '../land-schema';
import type { LandFilters, LandRecord } from '../types';

type LandInsert = LandPayload;
type LandUpdate = Partial<LandPayload>;

/**
 * Coerces the raw form values to a clean service-layer payload.
 * The form schema enforces all business rules; the payload schema
 * re-validates after coercion so a hand-crafted call (future import
 * scripts, tests, etc.) cannot bypass the same checks.
 */
export function toPayload(values: LandFormInput): LandPayload {
  // 1. Form-level validation (rejects invalid combos before coercion).
  const parsed = landFormSchema.parse(values);
  // 2. Coerce numeric fields and run cross-field checks.
  const coerced = coerceFormToPayload(parsed);
  // 3. Payload-level validation (locks the typed shape and cross-field rules).
  return landPayloadSchema.parse(coerced);
}

export async function listLands(filters: LandFilters) {
  let query = supabase.from('lands').select('*').order('created_at', { ascending: false });
  if (filters.status !== 'all' && LAND_STATUS_VALUES.includes(filters.status as typeof LAND_STATUS_VALUES[number])) {
    query = query.eq('status', filters.status);
  }
  if (filters.query.trim()) {
    const term = `%${filters.query.trim()}%`;
    query = query.or(`plot_no.ilike.${term},name.ilike.${term},location.ilike.${term},category.ilike.${term}`);
  }

  try {
    const { rows } = await fetchAllRows<LandRecord>(() => query as any);
    return rows;
  } catch (error) {
    handleSupabaseError(error, 'تعذر تحميل الأراضي');
    throw error;
  }
}

export type LandDossier = Readonly<{
  land: LandRecord;
  owner: { id: string; full_name: string | null; display_name: string | null; phone: string | null; email: string | null } | null;
  commissions: Array<{ id: string; amount: number; status: string; staff_name: string | null }>;
  latestActivity: Array<{ id: string; subject: string | null; body: string; created_at: string }>;
}>;

export async function getLandDossier(landId: string, options: { includeCommissions: boolean; includeActivity: boolean }): Promise<LandDossier> {
  const { data: land, error: landError } = await supabase.from('lands').select('*').eq('id', landId).single().returns<LandRecord>();
  if (landError) handleSupabaseError(landError, 'تعذر تحميل ملف الأرض');
  if (!land) throw new Error('الأرض غير موجودة أو غير متاحة لصلاحياتك.');
  const [ownerResult, commissionResult, activityResult] = await Promise.all([
    land.owner_id
      ? (supabase as any).from('owners').select('id,full_name,display_name,phone,email').eq('id', land.owner_id).is('deleted_at', null).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    options.includeCommissions
      ? (supabase as any).from('commissions').select('id,amount,status,staff_name').eq('type', 'land').eq('source_id', landId).order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    options.includeActivity
      ? (supabase as any).from('communication_records').select('id,subject,body,created_at').eq('related_entity_type', 'land').eq('related_entity_id', landId).is('deleted_at', null).order('created_at', { ascending: false }).limit(10)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (ownerResult.error) throw ownerResult.error;
  if (commissionResult.error) throw commissionResult.error;
  if (activityResult.error) throw activityResult.error;
  return { land, owner: ownerResult.data, commissions: commissionResult.data ?? [], latestActivity: activityResult.data ?? [] } as LandDossier;
}

export async function createLand(values: LandFormInput) {
  const payload = toPayload(values);
  const insertPayload: LandInsert & { id: string } = { id: crypto.randomUUID(), ...payload };
  const { data, error } = await supabase.from('lands').insert(insertPayload).select('*').single().returns<LandRecord>();
  if (error) handleSupabaseError(error, 'تعذر حفظ الأرض');
  return data;
}

export async function updateLand(id: string, values: LandFormInput) {
  const payload = toPayload(values);
  const updatePayload: LandUpdate = { ...payload };
  const { data, error } = await supabase.from('lands').update(updatePayload).eq('id', id).select('*').single().returns<LandRecord>();
  if (error) handleSupabaseError(error, 'تعذر تحديث الأرض');
  return data;
}

export async function archiveLand(id: string) {
  if (!id) throw new Error('معرف الأرض مطلوب');
  const { data, error } = await supabase.from('lands').update({ status: 'archived' }).eq('id', id).select('*').single().returns<LandRecord>();
  if (error) handleSupabaseError(error, 'تعذر أرشفة الأرض');
  return data;
}
