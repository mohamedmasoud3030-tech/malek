import { supabase } from '@/lib/supabase';

const attachmentBucket = 'attachments';

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

  return supabase.storage.from(attachmentBucket).getPublicUrl(path).data.publicUrl;
}
