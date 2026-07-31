import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import { fetchAllRows } from '@/lib/paginatedRead';
import type { Database } from '@/types/database';
import {
  coerceCommunicationFormToPayload,
  communicationFormSchema,
  communicationPayloadSchema,
} from '../communication-schema';
import type { CommunicationFilters, CommunicationRecord } from '../types';

type CommunicationInsert = Database['public']['Tables']['communication_records']['Insert'];
type CommunicationUpdate = Database['public']['Tables']['communication_records']['Update'];

/**
 * Parse a form submission through the form schema (rejects missing
 * required fields and bad phone/email/UUID shapes) and then through
 * the payload schema (locks the typed shape). The service is the
 * only path that touches Supabase, so the schema is run here even
 * if the form skipped it.
 */
function buildInsertPayload(values: Parameters<typeof coerceCommunicationFormToPayload>[0]) {
  const form = communicationFormSchema.parse(values);
  const coerced = coerceCommunicationFormToPayload(form);
  return communicationPayloadSchema.parse(coerced) as unknown as CommunicationInsert;
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

export async function createCommunicationRecord(values: Parameters<typeof buildInsertPayload>[0]) {
  const insertPayload = buildInsertPayload(values);
  const { data, error } = await supabase.from('communication_records').insert(insertPayload).select('*').single().returns<CommunicationRecord>();
  if (error) handleSupabaseError(error, 'تعذر حفظ سجل التواصل');
  return data;
}

export async function updateCommunicationRecord(id: string, values: Parameters<typeof buildInsertPayload>[0]) {
  if (!id) throw new Error('معرف سجل التواصل مطلوب');
  const insertPayload = buildInsertPayload(values);
  const payload: CommunicationUpdate = { ...insertPayload, updated_at: new Date().toISOString() } as unknown as CommunicationUpdate;
  const { data, error } = await supabase.from('communication_records').update(payload).eq('id', id).is('deleted_at', null).select('*').single().returns<CommunicationRecord>();
  if (error) handleSupabaseError(error, 'تعذر تحديث سجل التواصل');
  return data;
}

export async function archiveCommunicationRecord(id: string) {
  if (!id) throw new Error('معرف سجل التواصل مطلوب');
  const { data, error } = await supabase.from('communication_records').update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id).select('*').single().returns<CommunicationRecord>();
  if (error) handleSupabaseError(error, 'تعذر أرشفة سجل التواصل');
  return data;
}
