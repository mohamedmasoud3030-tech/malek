import { Paperclip } from 'lucide-react';
import { useId, useRef } from 'react';
import { cn } from '@/lib/utils';

type FilePickerFieldProps = Readonly<{
  accept?: string;
  file: File | null;
  onChange: (file: File | null) => void;
  label?: string;
  hint?: string;
  required?: boolean;
  className?: string;
}>;

/** Arabic-first file picker that hides the native English browser control. */
export function FilePickerField({
  accept,
  file,
  onChange,
  label = 'الملف',
  hint,
  required,
  className,
}: FilePickerFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn('grid gap-1.5', className)} data-file-picker-field>
      <label htmlFor={inputId} className="text-sm font-bold">
        {label}
        {required ? ' *' : ''}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex min-h-11 items-center gap-2.5 rounded-xl border border-dashed border-border bg-muted/20 px-3 text-start outline-none hover:bg-muted/40 focus-visible:ring-4 focus-visible:ring-primary/20"
      >
        <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {file ? file.name : 'اختيار ملف'}
        </span>
        {file ? (
          <span className="shrink-0 text-xs font-bold text-muted-foreground">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </span>
        ) : (
          <span className="shrink-0 text-xs font-bold text-primary">استعراض</span>
        )}
      </button>
      {hint ? <p className="text-xs leading-4 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
