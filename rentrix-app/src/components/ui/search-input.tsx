import { Search, X } from 'lucide-react';
import { useRef } from 'react';
import { cn } from '@/lib/utils';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Consistent search input used across all list pages.
 * Includes a clear button when there is text.
 * Uses a 16px mobile font size to avoid iOS input zoom, then compacts on larger screens.
 * The clear button keeps a 44px touch target while preserving the visual icon size.
 *
 * @example
 * <SearchInput value={query} onChange={setQuery} placeholder="ابحث عن عقد..." />
 */
export function SearchInput({ value, onChange, placeholder = 'بحث...', className }: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'h-11 w-full rounded-xl border border-input bg-background pe-9 ps-3 text-base sm:text-sm',
          'outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10',
          'placeholder:text-muted-foreground',
          value && 'pe-16',
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => { onChange(''); inputRef.current?.focus(); }}
          className="absolute end-5 top-1/2 grid min-h-11 min-w-11 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition hover:text-foreground focus:outline-none focus:ring-4 focus:ring-primary/10"
          aria-label="مسح البحث"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
