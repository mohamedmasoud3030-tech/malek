import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import { fetchAllRows } from '@/lib/paginatedRead';
import type { Database } from '@/types/database';
import type { CommunicationFilters, CommunicationFormValues, CommunicationRecord } from '../types';

type CommunicationInsert = Database['public']['Tables']['communication_records']['Insert'];
type CommunicationUpdate = Database['public']['Tables']['communication_records']['Update'];

function communicationPayload(values: CommunicationFormValues): CommunicationInsert {
  return {
    contact_name: values.contact_name.trim(),
    contact_phone: values.contact_phone.trim() || null,
    contact_email: values.contact_email.trim() || null,
    channel: values.channel,
    direction: values.direction,
    status: values.status,
    subject: values.subject.trim() || null,
    body: values.body.trim(),
    related_entity_type: values.related_entity_type.trim() || null,
    related_entity_id: values.related_entity_id.trim() || null,
  };
}

export async function listCommunicationRecords(filters: CommunicationFilters) {
  let query = supabase.from('communication_records').select('*').is('deleted_at', null).order('created_at', { ascending: false });
  if (filters.channel !== 'all') query = query.eq('channel', filters.channel);
  if (filters.status !== 'all') query = query.eq('status', filters.status);
  if (filters.query.trim()) {
    const term = `%${filters.query.trim()}%`;
    query = query.or(`contact_name.ilike.${term},contact_phone.ilike.${term},contact_email.ilike.${term},subject.ilike.${term},body.ilike.${term}`);
  }

  try {
    const { rows } = await fetchAllRows<CommunicationRecord>(() => query as any);
    return rows;
  } catch (error) {
    handleSupabaseError(error, 'تعذر تحميل سجل التواصل');
    throw error;
  }
}

export async function createCommunicationRecord(values: CommunicationFormValues) {
  if (!values.contact_name.trim()) throw new Error('اسم جهة التواصل مطلوب.');
  if (!values.body.trim()) throw new Error('محتوى التواصل مطلوب.');
  const { data, error } = await supabase.from('communication_records').insert(communicationPayload(values)).select('*').single().returns<CommunicationRecord>();
  if (error) handleSupabaseError(error, 'تعذر حفظ سجل التواصل');
  return data;
}

export async function updateCommunicationRecord(id: string, values: CommunicationFormValues) {
  if (!values.contact_name.trim()) throw new Error('اسم جهة التواصل مطلوب.');
  if (!values.body.trim()) throw new Error('محتوى التواصل مطلوب.');
  const payload: CommunicationUpdate = { ...communicationPayload(values), updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from('communication_records').update(payload).eq('id', id).is('deleted_at', null).select('*').single().returns<CommunicationRecord>();
  if (error) handleSupabaseError(error, 'تعذر تحديث سجل التواصل');
  return data;
}

export async function archiveCommunicationRecord(id: string) {
  const { data, error } = await supabase.from('communication_records').update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id).select('*').single().returns<CommunicationRecord>();
  if (error) handleSupabaseError(error, 'تعذر أرشفة سجل التواصل');
  return data;
}
