import { ATTACHMENTS_BUCKET_ID } from '@/lib/attachments-contract';
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
  const extension = file.name.split('.').pop() ?? 'bin';
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
 * Resolve a stored attachment reference for display: absolute URLs (legacy
 * rows) pass through unchanged; storage paths get a signed URL for the
 * private bucket.
 */
export async function createSignedAttachmentUrl(
  value: string,
  expiresInSeconds = 60 * 60,
): Promise<string> {
  if (/^https?:\/\//i.test(value)) return value;
  const { data, error } = await supabase.storage
    .from(attachmentBucket)
    .createSignedUrl(value, expiresInSeconds);
  if (error) throw new Error(error.message);
  if (!data?.signedUrl) throw new Error('تعذر إنشاء رابط المعاينة المؤقت');
  return data.signedUrl;
}
