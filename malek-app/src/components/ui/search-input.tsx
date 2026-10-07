import { Search, X } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
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
          'min-h-11 h-11 w-full rounded-lg border border-input/80 bg-background ps-9 pe-3 text-base font-medium text-foreground sm:text-sm',
          'outline-none transition-[border-color,box-shadow,background-color] hover:border-foreground/15 focus:border-primary/35 focus:bg-background focus:ring-4 focus:ring-primary/8',
          'placeholder:font-normal placeholder:text-muted-foreground/70',
          value && 'pe-11',
        )}
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => { onChange(''); inputRef.current?.focus(); }}
          className="absolute end-0 top-0 rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:ring-primary/10"
          aria-label="مسح البحث"
        >
          <X className="size-3.5" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
