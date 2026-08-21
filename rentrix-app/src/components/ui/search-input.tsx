import { Search, X } from 'lucide-react';
import { useRef } from 'react';
import { cn } from '@/lib/utils';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}

/** Canonical MALEK dense-register search control used across entity lists. */
export function SearchInput({
  value,
  onChange,
  placeholder = 'بحث...',
  className,
  'aria-label': ariaLabel = 'بحث',
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn('relative min-w-0', className)} data-register-search>
      <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground/85" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn(
          'h-10 w-full rounded-lg border border-input/90 bg-background ps-9 pe-3 text-base font-semibold text-foreground shadow-[inset_0_1px_0_hsl(var(--background))] sm:text-sm',
          'outline-none transition-[border-color,box-shadow,background-color] hover:border-foreground/15 focus:border-primary/35 focus:bg-background focus:ring-4 focus:ring-primary/8',
          'placeholder:font-normal placeholder:text-muted-foreground/70',
          value && 'pe-11',
        )}
      />
      {value ? (
        <button
          type="button"
          onClick={() => { onChange(''); inputRef.current?.focus(); }}
          className="absolute inset-y-0 end-0 grid w-10 place-items-center rounded-lg text-muted-foreground outline-none transition hover:bg-muted/60 hover:text-foreground focus-visible:ring-4 focus-visible:ring-primary/10"
          aria-label="مسح البحث"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
