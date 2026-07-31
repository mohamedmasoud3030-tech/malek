import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import { fetchAllRows } from '@/lib/paginatedRead';
import type { Database } from '@/types/database';
import type { LeadFilters, LeadFormValues, LeadRecord } from '../types';
import { assertLeadStatusTransition, leadPayloadSchema, leadStatusSchema } from '../lead-schema';

type LeadInsert = Database['public']['Tables']['leads']['Insert'];
type LeadUpdate = Database['public']['Tables']['leads']['Update'];

export function leadPayload(values: LeadFormValues): LeadInsert {
  // This is deliberately parsed again here, rather than trusting a form hook.
  const value = leadPayloadSchema.parse(values);
  return { id: crypto.randomUUID(), ...value } as LeadInsert;
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

  // Status is a state machine, not an arbitrary editable string. Read the
  // authoritative current state immediately before the write; the database/RLS
  // policy remains the final company-isolation boundary.
  const { data: current, error: currentError } = await supabase
    .from('leads')
    .select('status')
    .eq('id', id)
    .single();
  if (currentError) handleSupabaseError(currentError, 'تعذر التحقق من حالة العميل المحتمل');
  assertLeadStatusTransition(
    leadStatusSchema.parse((current as Pick<LeadRecord, 'status'> | null)?.status),
    leadStatusSchema.parse(basePayload.status),
  );

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
