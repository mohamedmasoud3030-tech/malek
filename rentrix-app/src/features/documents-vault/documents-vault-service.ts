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
  fileUrl: string;
  storagePath: string;
  fileSize?: number | null;
  mimeType?: string | null;
  uploadedAt: string;
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

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/jpg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export async function listVaultDocuments(params: VaultListParams = {}): Promise<VaultDocumentItem[]> {
  let query = (supabase as any).from('vault_documents').select('*').is('deleted_at', null).order('created_at', { ascending: false }).limit(100);

  if (params.category && params.category !== 'all') {
    query = query.eq('category', params.category);
  }
  if (params.relatedEntityType) {
    query = query.eq('related_entity_type', params.relatedEntityType);
  }
  if (params.relatedEntityId) {
    query = query.eq('related_entity_id', params.relatedEntityId);
  }
  if (params.search?.trim()) {
    const term = `%${params.search.trim()}%`;
    query = query.or(`title.ilike.${term},file_name.ilike.${term}`);
  }

  const { data, error } = await (query as any);
  if (error) handleSupabaseError(error, 'تعذر تحميل المستندات');

  const rows = (data ?? []) as any[];

  // Try to enrich related entity title via simple mapping (contract -> fetch title)
  // For now return as-is with file_url from storage public URL if needed
  return rows.map((r: any) => ({
    id: r.id,
    title: r.title,
    category: r.category as VaultCategory,
    relatedEntityType: r.related_entity_type ?? null,
    relatedEntityId: r.related_entity_id ?? null,
    relatedEntityTitle: r.related_entity_id ? `${r.related_entity_type ?? ''} ${r.related_entity_id.slice(0, 8)}` : null,
    fileName: r.file_name,
    fileUrl: r.file_url,
    storagePath: r.storage_path,
    fileSize: r.file_size ?? null,
    mimeType: r.mime_type ?? null,
    uploadedAt: r.created_at,
  }));
}

export type UploadVaultDocumentParams = {
  file: File;
  title: string;
  category: VaultCategory;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
};

function validateFile(file: File) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`حجم الملف يتجاوز الحد المسموح (10MB). حجم الملف الحالي: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
  }
  if (file.type && !ALLOWED_MIME.has(file.type) && !file.type.startsWith('image/')) {
    // Allow images broadly
    if (!file.type.startsWith('image/')) {
      throw new Error(`نوع الملف غير مدعوم: ${file.type}. الأنواع المدعومة: PDF، صور، Word، Excel`);
    }
  }
}

export async function uploadVaultDocument(params: UploadVaultDocumentParams): Promise<VaultDocumentItem> {
  validateFile(params.file);

  if (!params.title.trim()) throw new Error('عنوان المستند مطلوب');

  const fileExt = params.file.name.split('.').pop() || 'bin';
  const storagePath = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
  const fullPath = `vault/${storagePath}`;

  // 1. Upload to storage bucket attachments
  const { error: uploadError } = await supabase.storage.from('attachments').upload(fullPath, params.file, {
    cacheControl: '3600',
    upsert: false,
    contentType: params.file.type || undefined,
  });

  if (uploadError) {
    // Try to handle bucket not existing etc
    handleSupabaseError(uploadError as any, 'فشل رفع الملف إلى التخزين');
  }

  // Get public or signed URL
  const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(fullPath);
  const fileUrl = urlData?.publicUrl || '';

  // 2. Insert metadata - if this fails, attempt to remove uploaded file (rollback)
  try {
    const { data, error } = await (supabase
      .from('vault_documents')
      .insert({
        title: params.title.trim(),
        category: params.category,
        related_entity_type: params.relatedEntityType || null,
        related_entity_id: params.relatedEntityId || null,
        file_name: params.file.name,
        file_url: fileUrl,
        storage_path: fullPath,
        file_size: params.file.size,
        mime_type: params.file.type || null,
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
    };
  } catch (err) {
    // Rollback: try to delete uploaded file
    try {
      await supabase.storage.from('attachments').remove([fullPath]);
    } catch {
      // ignore rollback failure
    }
    if (err instanceof Error) throw err;
    handleSupabaseError(err as any, 'تعذر حفظ بيانات المستند بعد الرفع');
    throw err;
  }
}

export async function softDeleteVaultDocument(id: string): Promise<void> {
  const { data: existing, error: fetchError } = await ((supabase as any).from('vault_documents').select('storage_path').eq('id', id).is('deleted_at', null).single() as any);
  if (fetchError) handleSupabaseError(fetchError, 'المستند غير موجود');

  const { error } = await ((supabase as any).from('vault_documents').update({ deleted_at: new Date().toISOString() } as any).eq('id', id) as any);
  if (error) handleSupabaseError(error, 'تعذر حذف المستند');

  // Optional: we keep storage file for audit, not deleting physically on soft delete
  void existing;
}

export async function getVaultDocumentDownloadUrl(storagePath: string): Promise<string> {
  // Try public URL first
  const { data } = supabase.storage.from('attachments').getPublicUrl(storagePath);
  if (data?.publicUrl) return data.publicUrl;

  // Fallback to signed URL
  const { data: signed, error } = await supabase.storage.from('attachments').createSignedUrl(storagePath, 60 * 60);
  if (error) handleSupabaseError(error, 'تعذر إنشاء رابط التنزيل');
  return signed?.signedUrl || '';
}
