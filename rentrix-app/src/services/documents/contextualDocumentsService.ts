import { supabase } from '@/lib/supabase';
import { ATTACHMENTS_ALLOWED_MIME_TYPES, ATTACHMENTS_MAX_FILE_SIZE } from '@/lib/attachments-contract';
import { fetchAllRows } from '@/lib/paginatedRead';
import { handleSupabaseError } from '@/lib/supabase-error';

export const documentEntityTypes = [
  'property', 'unit', 'land', 'person', 'tenant', 'owner', 'contract',
  'invoice', 'payment', 'receipt', 'expense', 'maintenance', 'utility_bill',
  'service_provider',
] as const;
export type DocumentEntityType = (typeof documentEntityTypes)[number];
export type DocumentCategory = 'contracts' | 'identity' | 'receipts' | 'maintenance' | 'expenses' | 'utilities' | 'other';
export type DocumentTypedMetadata = Readonly<{
  originalFileName?: string;
  contentType?: string;
  sizeBytes?: number;
  replacedAt?: string;
  businessReference?: string;
  reference?: string;
  parties?: string | readonly string[];
  issueDate?: string;
  importantDate?: string;
  expiryDate?: string;
  expiresAt?: string;
  amount?: number | string;
  status?: string;
}>;

export const documentCategoryLabels: Readonly<Record<DocumentCategory, string>> = {
  contracts: 'عقد أو اتفاقية',
  identity: 'هوية أو إثبات',
  receipts: 'إيصال أو سند',
  maintenance: 'مستند صيانة',
  expenses: 'فاتورة مصروف',
  utilities: 'مستند مرافق',
  other: 'مستند عام',
};

export function defaultDocumentCategory(entityType: DocumentEntityType): DocumentCategory {
  if (entityType === 'contract') return 'contracts';
  if (entityType === 'person' || entityType === 'tenant' || entityType === 'owner') return 'identity';
  if (entityType === 'receipt' || entityType === 'payment') return 'receipts';
  if (entityType === 'maintenance') return 'maintenance';
  if (entityType === 'expense' || entityType === 'invoice') return 'expenses';
  if (entityType === 'utility_bill') return 'utilities';
  return 'other';
}

export type ContextualDocumentRow = Readonly<{
  id: string;
  title: string;
  category: DocumentCategory;
  document_type: string | null;
  metadata: DocumentTypedMetadata | null;
  related_entity_type: DocumentEntityType | null;
  related_entity_id: string | null;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}>;

function safeExtension(fileName: string) {
  return (fileName.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
}

function documentTypeFromMime(mime: string) {
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  return 'attachment';
}

function buildStoragePath(entityType: DocumentEntityType, entityId: string, file: Pick<File, 'name'>) {
  return `vault/contextual/${entityType}/${entityId}/${crypto.randomUUID()}.${safeExtension(file.name)}`;
}

function typedMetadata(file: Pick<File, 'name' | 'size' | 'type'>, replacedAt?: string, existing: DocumentTypedMetadata | null = null): DocumentTypedMetadata {
  // File replacement must not erase real business metadata attached to the
  // document. File-system facts are refreshed; typed contextual facts survive.
  return { ...existing, originalFileName: file.name, contentType: file.type, sizeBytes: file.size, ...(replacedAt ? { replacedAt } : {}) };
}

export async function listContextualDocuments(relatedEntityType: DocumentEntityType, relatedEntityId: string) {
  const query = (supabase as any).from('vault_documents').select('*').is('deleted_at', null).eq('related_entity_type', relatedEntityType).eq('related_entity_id', relatedEntityId).order('created_at', { ascending: false });
  const { rows } = await fetchAllRows<ContextualDocumentRow>(() => query);
  return rows;
}

export function validateContextualDocumentFile(file: Pick<File, 'size' | 'type'>) {
  if (file.size <= 0 || file.size > ATTACHMENTS_MAX_FILE_SIZE) throw new Error('حجم الملف غير صالح (الحد الأقصى 5 ميغابايت).');
  if (!ATTACHMENTS_ALLOWED_MIME_TYPES.has(file.type)) throw new Error('نوع الملف غير مدعوم. المسموح: PDF، JPG، PNG، WEBP.');
}

export async function uploadContextualDocument(params: {
  file: File;
  title: string;
  category: DocumentCategory;
  relatedEntityType: DocumentEntityType;
  relatedEntityId: string;
}) {
  validateContextualDocumentFile(params.file);
  const storagePath = buildStoragePath(params.relatedEntityType, params.relatedEntityId, params.file);
  const { error: uploadError } = await supabase.storage.from('attachments').upload(storagePath, params.file, { upsert: false, contentType: params.file.type });
  if (uploadError) { handleSupabaseError(uploadError, 'فشل رفع المستند'); throw uploadError; }
  try {
    const { data, error } = await (supabase as any).from('vault_documents').insert({
      title: params.title.trim() || params.file.name,
      category: params.category,
      document_type: documentTypeFromMime(params.file.type),
      metadata: typedMetadata(params.file),
      related_entity_type: params.relatedEntityType,
      related_entity_id: params.relatedEntityId,
      file_name: params.file.name,
      file_url: storagePath,
      storage_path: storagePath,
      file_size: params.file.size,
      mime_type: params.file.type,
    }).select('*').single();
    if (error) throw error;
    return data as ContextualDocumentRow;
  } catch (error) {
    await supabase.storage.from('attachments').remove([storagePath]);
    throw error;
  }
}

export async function replaceContextualDocument(documentId: string, file: File) {
  validateContextualDocumentFile(file);
  const { data: existing, error: readError } = await (supabase as any).from('vault_documents').select('id,related_entity_type,related_entity_id,storage_path,metadata').eq('id', documentId).is('deleted_at', null).single();
  if (readError || !existing) throw readError ?? new Error('المستند غير موجود.');
  const entityType = existing.related_entity_type as DocumentEntityType;
  const newStoragePath = buildStoragePath(entityType, existing.related_entity_id, file);
  const { error: uploadError } = await supabase.storage.from('attachments').upload(newStoragePath, file, { upsert: false, contentType: file.type });
  if (uploadError) throw uploadError;
  const replacedAt = new Date().toISOString();
  const { data, error } = await (supabase as any).from('vault_documents').update({
    file_name: file.name,
    file_url: newStoragePath,
    storage_path: newStoragePath,
    file_size: file.size,
    mime_type: file.type,
    document_type: documentTypeFromMime(file.type),
    metadata: typedMetadata(file, replacedAt, (existing.metadata ?? null) as DocumentTypedMetadata | null),
    updated_at: replacedAt,
  }).eq('id', documentId).is('deleted_at', null).select('*').single();
  if (error) {
    await supabase.storage.from('attachments').remove([newStoragePath]);
    throw error;
  }
  if (existing.storage_path && existing.storage_path !== newStoragePath) {
    await supabase.storage.from('attachments').remove([existing.storage_path]).catch(() => undefined);
  }
  return data as ContextualDocumentRow;
}

export async function archiveContextualDocument(id: string) {
  const { error } = await (supabase as any).from('vault_documents').update({ deleted_at: new Date().toISOString() }).eq('id', id).is('deleted_at', null);
  if (error) { handleSupabaseError(error, 'تعذر أرشفة المستند'); throw error; }
}

export async function getContextualDocumentSignedUrl(storagePath: string) {
  const { data, error } = await supabase.storage.from('attachments').createSignedUrl(storagePath, 3600);
  if (error) { handleSupabaseError(error, 'تعذر إنشاء رابط المستند'); throw error; }
  if (!data?.signedUrl) throw new Error('تعذر إنشاء رابط المستند');
  return data.signedUrl;
}
