import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import { fetchAllRows } from '@/lib/paginatedRead';
import type { Database } from '@/types/database';
import type { LandFilters, LandFormValues, LandRecord } from '../types';

type LandInsert = Database['public']['Tables']['lands']['Insert'];
type LandUpdate = Database['public']['Tables']['lands']['Update'];

function toOptionalNumber(value: string) {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
}

function toPayload(values: LandFormValues): LandInsert {
  return {
    id: crypto.randomUUID(),
    plot_no: values.plot_no.trim() || null,
    name: values.name.trim() || null,
    location: values.location.trim() || null,
    area: toOptionalNumber(values.area),
    owner_id: values.owner_id.trim() || null,
    purchase_price: toOptionalNumber(values.purchase_price),
    owner_price: toOptionalNumber(values.owner_price),
    commission: toOptionalNumber(values.commission),
    category: values.category,
    status: values.status,
    notes: values.notes.trim() || null,
  };
}

export async function listLands(filters: LandFilters) {
  let query = supabase.from('lands').select('*').order('created_at', { ascending: false });
  if (filters.status !== 'all') query = query.eq('status', filters.status);
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

export async function createLand(values: LandFormValues) {
  if (!values.name.trim() && !values.plot_no.trim()) throw new Error('أدخل اسم الأرض أو رقم القطعة على الأقل.');
  const { data, error } = await supabase.from('lands').insert(toPayload(values)).select('*').single().returns<LandRecord>();
  if (error) handleSupabaseError(error, 'تعذر حفظ الأرض');
  return data;
}

export async function updateLand(id: string, values: LandFormValues) {
  if (!values.name.trim() && !values.plot_no.trim()) throw new Error('أدخل اسم الأرض أو رقم القطعة على الأقل.');
  const { id: _newId, ...basePayload } = toPayload(values);
  const payload: LandUpdate = { ...basePayload, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from('lands').update(payload).eq('id', id).select('*').single().returns<LandRecord>();
  if (error) handleSupabaseError(error, 'تعذر تحديث الأرض');
  return data;
}

export async function archiveLand(id: string) {
  const { data, error } = await supabase.from('lands').update({ status: 'archived', updated_at: new Date().toISOString() }).eq('id', id).select('*').single().returns<LandRecord>();
  if (error) handleSupabaseError(error, 'تعذر أرشفة الأرض');
  return data;
}
