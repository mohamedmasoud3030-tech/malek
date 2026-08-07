/**
 * EnterpriseSearch — Enterprise UX Foundation (Wave 4A)
 *
 * Debounced, accessible search input for toolbars. Owns only the debounce
 * + clear mechanics; filtering itself stays in the module (client or server).
 *
 * @example
 * const [search, setSearch] = useState('');
 * const table = useTableState();
 * <EnterpriseSearch value={table.search} onChange={table.setSearch} />
 */

import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EnterpriseSearchProps {
  value: string;
  /** Called with the debounced value (`debounceMs` after the last keystroke). */
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  /** Fires immediately (no debounce) when the user presses Enter. */
  onSubmit?: (value: string) => void;
  /** Show a small spinner-style busy hint in the leading icon slot. */
  isLoading?: boolean;
  /** Optional result count shown next to the input (announced politely). */
  resultCount?: number;
  autoFocus?: boolean;
  className?: string;
  /** Screen-reader label. Defaults to the placeholder. */
  'aria-label'?: string;
}

export function EnterpriseSearch({
  value,
  onChange,
  placeholder = 'بحث...',
  debounceMs = 250,
  onSubmit,
  isLoading = false,
  resultCount,
  autoFocus = false,
  className,
  'aria-label': ariaLabel,
}: EnterpriseSearchProps) {
  const [draft, setDraft] = useState(value);
  const committedRef = useRef(value);

  // Keep the draft in sync when the parent resets the value externally.
  useEffect(() => {
    if (value !== committedRef.current) {
      committedRef.current = value;
      setDraft(value);
    }
  }, [value]);

  // Debounced commit of the local draft.
  useEffect(() => {
    if (draft === committedRef.current) return undefined;
    const timer = window.setTimeout(() => {
      committedRef.current = draft;
      onChange(draft);
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [draft, debounceMs, onChange]);

  const clear = () => {
    committedRef.current = '';
    setDraft('');
    onChange('');
  };

  return (
    <div data-enterprise-search className={cn('relative flex items-center gap-2', className)}>
      <div className="relative min-w-0 flex-1">
        <span
          className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-muted-foreground"
          aria-hidden="true"
        >
          <Search className={cn('size-4', isLoading && 'animate-pulse')} />
        </span>
        <input
          type="search"
          role="searchbox"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              committedRef.current = draft;
              onChange(draft);
              onSubmit?.(draft);
            }
            if (event.key === 'Escape' && draft !== '') {
              event.stopPropagation();
              clear();
            }
          }}
          placeholder={placeholder}
          aria-label={ariaLabel ?? placeholder}
          autoFocus={autoFocus}
          className={cn(
            'h-10 w-full rounded-xl border border-border bg-card ps-9 pe-9 text-sm text-foreground',
            'placeholder:text-muted-foreground/70',
            'transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:border-primary/40',
            '[&::-webkit-search-cancel-button]:hidden',
          )}
        />
        {draft !== '' ? (
          <button
            type="button"
            onClick={clear}
            aria-label="مسح البحث"
            className="absolute inset-y-0 end-2 my-auto grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {typeof resultCount === 'number' ? (
        <span
          data-enterprise-search-count
          aria-live="polite"
          className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground"
        >
          {resultCount} نتيجة
        </span>
      ) : null}
    </div>
  );
}
