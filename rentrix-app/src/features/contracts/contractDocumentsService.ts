import { ATTACHMENTS_ALLOWED_MIME_TYPES, ATTACHMENTS_MAX_FILE_SIZE } from '@/lib/attachments-contract';
import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import type { Database } from '@/types/database';

export type ContractDocumentRecord = Database['public']['Tables']['contract_documents']['Row'];

const ALLOWED_TYPES = ATTACHMENTS_ALLOWED_MIME_TYPES;
const MAX_SIZE_BYTES = ATTACHMENTS_MAX_FILE_SIZE;
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60;

function createDocumentStorageId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

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
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error('نوع الملف غير مدعوم. المسموح: صور JPG/PNG/WEBP أو PDF');
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('حجم الملف يتجاوز 5 ميغابايت');
  }

  const ext = file.name.split('.').pop() ?? 'bin';
  const uniqueId = createDocumentStorageId();
  const storagePath = `contracts/${contractId}/${Date.now()}-${uniqueId}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('attachments')
    .upload(storagePath, file, { upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  // The bucket is private: file_url stores the storage path (not a public URL);
  // viewing/downloading always goes through getContractDocumentSignedUrl below.
  const { data, error } = await supabase
    .from('contract_documents')
    .insert({
      contract_id: contractId,
      file_name: file.name,
      file_url: storagePath,
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

/**
 * Resolve a view/download URL for a stored contract document.
 * Legacy rows may still hold an absolute public URL in file_url; newer rows
 * hold the storage path there. Private-bucket reads always use a signed URL.
 */
export async function getContractDocumentSignedUrl(
  document: Pick<ContractDocumentRecord, 'file_url' | 'storage_path'>,
  expiresInSeconds = SIGNED_URL_EXPIRY_SECONDS,
): Promise<string> {
  if (/^https?:\/\//i.test(document.file_url)) return document.file_url;
  const storagePath = document.storage_path || document.file_url;
  if (!storagePath) throw new Error('مسار الملف مطلوب');
  const { data, error } = await supabase.storage
    .from('attachments')
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) handleSupabaseError(error, 'تعذر إنشاء رابط المعاينة المؤقت');
  if (!data?.signedUrl) throw new Error('تعذر إنشاء رابط المعاينة المؤقت');
  return data.signedUrl;
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
