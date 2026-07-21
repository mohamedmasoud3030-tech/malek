import { ATTACHMENTS_ALLOWED_MIME_TYPES, ATTACHMENTS_MAX_FILE_SIZE } from '@/lib/attachments-contract';
import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';

export type VaultCategory = 'all' | 'contracts' | 'identity' | 'receipts' | 'maintenance' | 'expenses' | 'utilities' | 'other';

export type VaultDocumentItem = {
  id: string;
  title: string;
  category: VaultCategory;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  relatedEntityTitle?: string | null;
  fileName: string;
  // fileUrl is deprecated for private bucket - holds storage_path for backward compat, use signed URL via getVaultDocumentSignedUrl
  fileUrl: string;
  storagePath: string;
  fileSize?: number | null;
  mimeType?: string | null;
  uploadedAt: string;
  signedUrl?: string | null; // populated on demand via signed URL
};

export const vaultCategoryLabels: Record<VaultCategory, string> = {
  all: 'كل المرفقات والمستندات',
  contracts: 'عقود وإتفاقيات',
  identity: 'هويات وإثباتات',
  receipts: 'إيصالات وسدادات',
  maintenance: 'صيانة وبلاغات',
  expenses: 'مصروفات وفواتير',
  utilities: 'عدادات ومرافق',
  other: 'أخرى',
};

export type VaultListParams = {
  category?: VaultCategory;
  search?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
};

export const VAULT_MAX_FILE_SIZE = ATTACHMENTS_MAX_FILE_SIZE;
export const VAULT_ALLOWED_MIME_TYPES = ATTACHMENTS_ALLOWED_MIME_TYPES;

const SIGNED_URL_EXPIRY_SECONDS = 60 * 60;

export async function listVaultDocuments(params: VaultListParams = {}): Promise<VaultDocumentItem[]> {
  let query = (supabase as any).from('vault_documents').select('*').is('deleted_at', null).order('created_at', { ascending: false }).limit(100);

  if (params.category && params.category !== 'all') query = query.eq('category', params.category);
  if (params.relatedEntityType) query = query.eq('related_entity_type', params.relatedEntityType);
  if (params.relatedEntityId) query = query.eq('related_entity_id', params.relatedEntityId);
  if (params.search?.trim()) {
    const term = `%${params.search.trim()}%`;
    query = query.or(`title.ilike.${term},file_name.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) handleSupabaseError(error, 'تعذر تحميل المستندات');

  return ((data ?? []) as any[]).map((row: any) => ({
    id: row.id,
    title: row.title,
    category: row.category as VaultCategory,
    relatedEntityType: row.related_entity_type ?? null,
    relatedEntityId: row.related_entity_id ?? null,
    relatedEntityTitle: row.related_entity_id ? `${row.related_entity_type ?? ''} ${row.related_entity_id.slice(0, 8)}` : null,
    fileName: row.file_name,
    fileUrl: row.file_url,
    storagePath: row.storage_path,
    fileSize: row.file_size ?? null,
    mimeType: row.mime_type ?? null,
    uploadedAt: row.created_at,
    signedUrl: null,
  }));
}

export type UploadVaultDocumentParams = {
  file: File;
  title: string;
  category: VaultCategory;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
};

export function validateVaultFile(file: Pick<File, 'size' | 'type'>) {
  if (file.size <= 0) {
    throw new Error('الملف فارغ ولا يمكن رفعه.');
  }
  if (file.size > VAULT_MAX_FILE_SIZE) {
    throw new Error(`حجم الملف يتجاوز الحد المسموح (5MB). حجم الملف الحالي: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
  }
  if (!VAULT_ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error(`نوع الملف غير مدعوم: ${file.type || 'غير معروف'}. الأنواع المدعومة: PDF، JPEG، PNG، WebP`);
  }
}

export async function uploadVaultDocument(params: UploadVaultDocumentParams): Promise<VaultDocumentItem> {
  validateVaultFile(params.file);
  if (!params.title.trim()) throw new Error('عنوان المستند مطلوب');

  const fileExt = params.file.name.split('.').pop() || 'bin';
  const storagePath = `${crypto.randomUUID()}.${fileExt}`;
  const fullPath = `vault/${storagePath}`;

  const { error: uploadError } = await supabase.storage.from('attachments').upload(fullPath, params.file, {
    cacheControl: '3600',
    upsert: false,
    contentType: params.file.type,
  });

  if (uploadError) handleSupabaseError(uploadError as any, 'فشل رفع الملف إلى التخزين');

  try {
    const { data, error } = await ((supabase as any)
      .from('vault_documents')
      .insert({
        title: params.title.trim(),
        category: params.category,
        related_entity_type: params.relatedEntityType || null,
        related_entity_id: params.relatedEntityId || null,
        file_name: params.file.name,
        file_url: fullPath,
        storage_path: fullPath,
        file_size: params.file.size,
        mime_type: params.file.type,
      } as any)
      .select('*')
      .single() as any);

    if (error) throw error;
    if (!data) throw new Error('لم يتم حفظ بيانات المستند');

    return {
      id: data.id,
      title: data.title,
      category: data.category as VaultCategory,
      relatedEntityType: data.related_entity_type ?? null,
      relatedEntityId: data.related_entity_id ?? null,
      relatedEntityTitle: data.related_entity_id,
      fileName: data.file_name,
      fileUrl: data.file_url,
      storagePath: data.storage_path,
      fileSize: data.file_size,
      mimeType: data.mime_type,
      uploadedAt: data.created_at,
      signedUrl: null,
    };
  } catch (error) {
    try {
      await supabase.storage.from('attachments').remove([fullPath]);
    } catch {
      // Preserve the original metadata error; cleanup failure is best-effort.
    }
    if (error instanceof Error) throw error;
    handleSupabaseError(error as any, 'تعذر حفظ بيانات المستند بعد الرفع');
    throw error;
  }
}

export async function softDeleteVaultDocument(id: string): Promise<void> {
  const { error } = await ((supabase as any)
    .from('vault_documents')
    .update({ deleted_at: new Date().toISOString() } as any)
    .eq('id', id)
    .is('deleted_at', null) as any);
  if (error) handleSupabaseError(error, 'تعذر حذف المستند');
}

export async function getVaultDocumentSignedUrl(
  storagePath: string,
  expiresInSeconds = SIGNED_URL_EXPIRY_SECONDS,
): Promise<string> {
  if (!storagePath) throw new Error('مسار الملف مطلوب');
  const { data, error } = await supabase.storage.from('attachments').createSignedUrl(storagePath, expiresInSeconds);
  if (error) handleSupabaseError(error, 'تعذر إنشاء رابط التنزيل المؤقت');
  if (!data?.signedUrl) throw new Error('لم يتم إنشاء رابط التنزيل');
  return data.signedUrl;
}

export async function getVaultDocumentDownloadUrl(storagePath: string): Promise<string> {
  return getVaultDocumentSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);
}

export async function getVaultDocumentsWithSignedUrls(
  documents: VaultDocumentItem[],
  expiresInSeconds = SIGNED_URL_EXPIRY_SECONDS,
): Promise<VaultDocumentItem[]> {
  return Promise.all(
    documents.map(async (document) => {
      try {
        const signedUrl = await getVaultDocumentSignedUrl(document.storagePath, expiresInSeconds);
        return { ...document, signedUrl };
      } catch {
        return { ...document, signedUrl: null };
      }
    }),
  );
}
