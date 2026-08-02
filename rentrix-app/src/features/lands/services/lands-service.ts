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
