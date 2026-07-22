import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import { fetchAllRows } from '@/lib/paginatedRead';
import type { Database } from '@/types/database';
import type { LeadFilters, LeadFormValues, LeadRecord } from '../types';

type LeadInsert = Database['public']['Tables']['leads']['Insert'];
type LeadUpdate = Database['public']['Tables']['leads']['Update'];

function toOptionalNumber(value: string) {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
}

function leadPayload(values: LeadFormValues): LeadInsert {
  return {
    id: crypto.randomUUID(),
    name: values.name.trim(),
    phone: values.phone.trim() || null,
    email: values.email.trim() || null,
    source: values.source,
    status: values.status,
    desired_unit_type: values.desired_unit_type.trim() || null,
    min_budget: toOptionalNumber(values.min_budget),
    max_budget: toOptionalNumber(values.max_budget),
    notes: values.notes.trim() || null,
  };
}

export async function listLeads(filters: LeadFilters) {
  let query = supabase.from('leads').select('*').order('created_at', { ascending: false });
  if (filters.status !== 'all') query = query.eq('status', filters.status);
  if (filters.source !== 'all') query = query.eq('source', filters.source);
  if (filters.query.trim()) {
    const term = `%${filters.query.trim()}%`;
    query = query.or(`name.ilike.${term},phone.ilike.${term},email.ilike.${term},desired_unit_type.ilike.${term}`);
  }

  try {
    const { rows } = await fetchAllRows<LeadRecord>(() => query as any);
    return rows;
  } catch (error) {
    handleSupabaseError(error, 'تعذر تحميل العملاء المحتملين');
    throw error;
  }
}

export async function createLead(values: LeadFormValues) {
  if (!values.name.trim()) throw new Error('اسم العميل المحتمل مطلوب.');
  const { data, error } = await supabase.from('leads').insert(leadPayload(values)).select('*').single().returns<LeadRecord>();
  if (error) handleSupabaseError(error, 'تعذر حفظ العميل المحتمل');
  return data;
}

export async function updateLead(id: string, values: LeadFormValues) {
  if (!values.name.trim()) throw new Error('اسم العميل المحتمل مطلوب.');
  const { id: _newId, ...basePayload } = leadPayload(values);
  const payload: LeadUpdate = { ...basePayload, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from('leads').update(payload).eq('id', id).select('*').single().returns<LeadRecord>();
  if (error) handleSupabaseError(error, 'تعذر تحديث العميل المحتمل');
  return data;
}

export async function archiveLead(id: string) {
  const { data, error } = await supabase.from('leads').update({ status: 'archived', updated_at: new Date().toISOString() }).eq('id', id).select('*').single().returns<LeadRecord>();
  if (error) handleSupabaseError(error, 'تعذر أرشفة العميل المحتمل');
  return data;
}
