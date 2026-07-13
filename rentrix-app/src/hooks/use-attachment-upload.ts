import { useCallback } from 'react';
import { uploadAttachment } from '@/services/documents/attachment-storage-service';

export function useAttachmentUpload() {
  return useCallback((file: File) => uploadAttachment(file), []);
}
