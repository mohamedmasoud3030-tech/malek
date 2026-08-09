import { supabase } from '@/lib/supabase';
import { ATTACHMENTS_ALLOWED_MIME_TYPES, ATTACHMENTS_MAX_FILE_SIZE } from '@/lib/attachments-contract';
import { fetchAllRows } from '@/lib/paginatedRead';
import { handleSupabaseError } from '@/lib/supabase-error';

export type ContextualDocumentRow = Readonly<{
  id: string;
  title: string;
  category: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}>;

export async function listContextualDocuments(relatedEntityType: string, relatedEntityId: string) {
  const query = (supabase as any).from('vault_documents').select('*').is('deleted_at', null).eq('related_entity_type', relatedEntityType).eq('related_entity_id', relatedEntityId).order('created_at', { ascending: false });
  const { rows } = await fetchAllRows<ContextualDocumentRow>(() => query);
  return rows;
}

export function validateContextualDocumentFile(file: Pick<File, 'size' | 'type'>) {
  if (file.size <= 0 || file.size > ATTACHMENTS_MAX_FILE_SIZE) throw new Error('حجم الملف غير صالح (الحد الأقصى 5 ميغابايت).');
  if (!ATTACHMENTS_ALLOWED_MIME_TYPES.has(file.type)) throw new Error('نوع الملف غير مدعوم. المسموح: PDF، JPG، PNG، WEBP.');
}

export async function uploadContextualDocument(params: { file: File; title: string; category: string; relatedEntityType: string; relatedEntityId: string }) {
  validateContextualDocumentFile(params.file);
  const extension = params.file.name.split('.').pop() || 'bin';
  const storagePath = `vault/contextual/${params.relatedEntityType}/${params.relatedEntityId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from('attachments').upload(storagePath, params.file, { upsert: false, contentType: params.file.type });
  if (uploadError) { handleSupabaseError(uploadError, 'فشل رفع المستند'); throw uploadError; }
  try {
    const { data, error } = await (supabase as any).from('vault_documents').insert({ title: params.title.trim(), category: params.category, related_entity_type: params.relatedEntityType, related_entity_id: params.relatedEntityId, file_name: params.file.name, file_url: storagePath, storage_path: storagePath, file_size: params.file.size, mime_type: params.file.type }).select('*').single();
    if (error) throw error;
    return data as ContextualDocumentRow;
  } catch (error) {
    await supabase.storage.from('attachments').remove([storagePath]);
    throw error;
  }
}

export async function archiveContextualDocument(id: string) {
  const { error } = await (supabase as any).from('vault_documents').update({ deleted_at: new Date().toISOString() }).eq('id', id).is('deleted_at', null);
  if (error) { handleSupabaseError(error, 'تعذر أرشفة المستند'); throw error; }
}

export async function getContextualDocumentSignedUrl(storagePath: string) {
  const { data, error } = await supabase.storage.from('attachments').createSignedUrl(storagePath, 3600);
  if (error) { handleSupabaseError(error, 'تعذر إنشاء رابط المعاينة'); throw error; }
  if (!data?.signedUrl) throw new Error('تعذر إنشاء رابط المعاينة');
  return data.signedUrl;
}
