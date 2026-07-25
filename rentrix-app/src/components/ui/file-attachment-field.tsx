import { Paperclip, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAttachmentUpload } from '@/hooks/use-attachment-upload';
import { ATTACHMENTS_ACCEPT, ATTACHMENTS_ALLOWED_MIME_TYPES, ATTACHMENTS_MAX_FILE_SIZE } from '@/lib/attachments-contract';
import { createSignedAttachmentUrl } from '@/services/documents/attachment-storage-service';
import { cn } from '@/lib/utils';

const ALLOWED_TYPES = ATTACHMENTS_ALLOWED_MIME_TYPES;
const MAX_SIZE_BYTES = ATTACHMENTS_MAX_FILE_SIZE;

type FileAttachmentFieldProps = {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  disabled?: boolean;
  accept?: string;
};

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url);
}

/**
 * Resolve the stored reference for display. Absolute http(s) values are legacy
 * rows and render as-is; storage paths (new uploads, private bucket) are
 * exchanged for a short-lived signed URL at render time. Resolution failures
 * fall back to the raw value so forms stay usable offline/in fixtures.
 */
function useResolvedAttachmentUrl(value: string | null) {
  const [resolved, setResolved] = useState<string | null>(value);

  useEffect(() => {
    let cancelled = false;
    setResolved(value);
    if (!value || /^https?:\/\//i.test(value)) return undefined;

    createSignedAttachmentUrl(value)
      .then((url) => {
        if (!cancelled) setResolved(url);
      })
      .catch(() => {
        if (!cancelled) setResolved(value);
      });

    return () => {
      cancelled = true;
    };
  }, [value]);

  return resolved;
}

export function FileAttachmentField({
  value,
  onChange,
  label = 'مرفق',
  disabled = false,
  accept = ATTACHMENTS_ACCEPT,
}: FileAttachmentFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploadAttachment = useAttachmentUpload();
  const resolvedUrl = useResolvedAttachmentUrl(value);

  const handleFile = async (file: File) => {
    setError(null);

    if (!ALLOWED_TYPES.has(file.type)) {
      setError('نوع الملف غير مدعوم. المسموح: صور JPG/PNG/WEBP أو PDF');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError('حجم الملف يتجاوز 5 ميغابايت');
      return;
    }

    setUploading(true);
    try {
      onChange(await uploadAttachment(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل رفع الملف');
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const handleRemove = () => {
    onChange(null);
    setError(null);
  };

  return (
    <div className="grid gap-2">
      <p className="text-sm font-bold">{label}</p>

      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
          {isImageUrl(value) && resolvedUrl ? (
            <img src={resolvedUrl} alt="مرفق" className="size-16 rounded-lg object-cover border border-border" />
          ) : (
            <div className="grid size-16 place-items-center rounded-lg border border-border bg-background">
              <Paperclip className="size-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            {resolvedUrl ? (
              <a
                href={resolvedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-sm font-bold text-primary hover:underline"
              >
                عرض المرفق
              </a>
            ) : (
              <span className="block truncate text-sm font-bold">مرفق محفوظ</span>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              {isImageUrl(value) ? 'صورة' : 'ملف PDF'}
            </p>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleRemove}
              className="grid size-8 place-items-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label="إزالة المرفق"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-6 text-center transition-colors',
            !disabled && 'cursor-pointer hover:border-primary/50 hover:bg-primary/5',
            disabled && 'opacity-50',
          )}
          onClick={() => !disabled && !uploading && inputRef.current?.click()}
          role={disabled ? undefined : 'button'}
          tabIndex={disabled ? undefined : 0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); !disabled && !uploading && inputRef.current?.click(); } }}
        >
          {uploading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Upload className="size-4" />
              جار الرفع...
            </div>
          ) : (
            <>
              <Paperclip className="size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                اسحب ملفاً هنا أو <span className="font-bold text-primary">اختر ملفاً</span>
              </p>
              <p className="text-xs text-muted-foreground">JPG، PNG، WEBP، PDF — بحد أقصى 5 ميغابايت</p>
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs font-bold text-destructive">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={handleInputChange}
        disabled={disabled || uploading}
        aria-label={label}
      />
    </div>
  );
}
