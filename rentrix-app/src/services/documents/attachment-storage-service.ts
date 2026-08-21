import { ATTACHMENTS_ALLOWED_MIME_TYPES, ATTACHMENTS_BUCKET_ID, ATTACHMENTS_MAX_FILE_SIZE } from '@/lib/attachments-contract';
import { supabase } from '@/lib/supabase';

const attachmentBucket = ATTACHMENTS_BUCKET_ID;

/**
 * Upload an attachment to the private bucket and return its storage path.
 * The bucket is private, so no public URL exists; callers persist the path
 * and resolve a short-lived signed URL at view time (createSignedAttachmentUrl).
 * Values already stored as absolute http(s) URLs are legacy public URLs and
 * are still rendered as-is by the field component.
 */
export async function uploadAttachment(file: File): Promise<string> {
  if (file.size <= 0) throw new Error('الملف فارغ ولا يمكن رفعه.');
  if (file.size > ATTACHMENTS_MAX_FILE_SIZE) throw new Error('حجم الملف يتجاوز 5 ميغابايت.');
  if (!ATTACHMENTS_ALLOWED_MIME_TYPES.has(file.type)) throw new Error('نوع الملف غير مدعوم.');
  const extensionByMime: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  const extension = extensionByMime[file.type];
  const uniqueId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Date.now().toString(36)}`;
  const path = `${Date.now()}-${uniqueId}.${extension}`;
  const { error } = await supabase.storage
    .from(attachmentBucket)
    .upload(path, file, { upsert: false });

  if (error) {
    throw new Error(error.message);
  }

  return path;
}

/**
 * Resolve a stored attachment reference for display. Stored objects must be
 * private-bucket paths; an absolute legacy URL is intentionally rejected so
 * this client never re-publishes a historic public attachment. Migrate those
 * records through a server-controlled workflow instead.
 */
export async function createSignedAttachmentUrl(
  value: string,
  expiresInSeconds = 60 * 60,
): Promise<string> {
  if (/^https?:\/\//i.test(value)) {
    throw new Error('المرفق القديم يحتاج ترحيلاً آمناً قبل عرضه.');
  }
  const { data, error } = await supabase.storage
    .from(attachmentBucket)
    .createSignedUrl(value, expiresInSeconds);
  if (error) throw new Error(error.message);
  if (!data?.signedUrl) throw new Error('تعذر إنشاء رابط المعاينة المؤقت');
  return data.signedUrl;
}
