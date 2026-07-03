import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import type { Database } from '@/types/database';

export type ContractDocumentRecord = Database['public']['Tables']['contract_documents']['Row'];

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function listContractDocuments(contractId: string) {
  const { data, error } = await supabase
    .from('contract_documents')
    .select('*')
    .eq('contract_id', contractId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .returns<ContractDocumentRecord[]>();

  if (error) handleSupabaseError(error, 'تعذر تحميل مستندات العقد');
  return data ?? [];
}

export async function uploadContractDocument(contractId: string, file: File) {
  if (!contractId) throw new Error('معرّف العقد مطلوب');
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('نوع الملف غير مدعوم. المسموح: صور JPG/PNG/WEBP أو PDF');
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('حجم الملف يتجاوز 10 ميغابايت');
  }

  const ext = file.name.split('.').pop() ?? 'bin';
  const uniqueId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const storagePath = `contracts/${contractId}/${Date.now()}-${uniqueId}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('attachments')
    .upload(storagePath, file, { upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrlData } = supabase.storage.from('attachments').getPublicUrl(storagePath);

  const { data, error } = await supabase
    .from('contract_documents')
    .insert({
      contract_id: contractId,
      file_name: file.name,
      file_url: publicUrlData.publicUrl,
      storage_path: storagePath,
      file_size: file.size,
      mime_type: file.type,
    })
    .select('*')
    .single()
    .returns<ContractDocumentRecord>();

  if (error) {
    // Roll back the orphaned storage object if the DB insert failed.
    await supabase.storage.from('attachments').remove([storagePath]);
    handleSupabaseError(error, 'تعذر حفظ مستند العقد');
  }
  return data;
}

export async function deleteContractDocument(documentId: string) {
  const { data, error } = await supabase
    .from('contract_documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', documentId)
    .select('*')
    .single()
    .returns<ContractDocumentRecord>();

  if (error) handleSupabaseError(error, 'تعذر حذف المستند');
  return data;
}
