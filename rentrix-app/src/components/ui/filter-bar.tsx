import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { SearchInput } from './search-input';

type FilterBarProps = {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  filters?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/**
 * Unified list toolbar: search, compact filters and trailing actions.
 *
 * Controls stack into a full-width mobile grid instead of shrinking desktop
 * controls into an unusable row. At desktop widths the same content returns to
 * a compact toolbar.
 */
export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'بحث...',
  searchAriaLabel = 'بحث',
  filters,
  actions,
  className,
}: FilterBarProps) {
  const showSearch = typeof onSearchChange === 'function';

  return (
    <section
      data-filter-bar
      className={cn(
        'grid min-w-0 gap-3 rounded-xl border border-border/70 bg-card p-3 shadow-card sm:p-4 lg:grid-cols-[minmax(15rem,1fr)_auto_auto] lg:items-center',
        !showSearch && 'lg:grid-cols-[minmax(0,1fr)_auto]',
        className,
      )}
      aria-label="البحث والتصفية"
    >
      {showSearch ? (
        <div className="min-w-0">
          <SearchInput
            value={searchValue ?? ''}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            aria-label={searchAriaLabel}
          />
        </div>
      ) : null}

      {filters ? (
        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:justify-end [&>*]:min-w-0 [&_input]:w-full [&_select]:w-full lg:[&_input]:w-auto lg:[&_select]:w-auto">
          {filters}
        </div>
      ) : null}

      {actions ? (
        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:shrink-0 lg:flex-wrap lg:items-center lg:justify-end [&>*]:w-full lg:[&>*]:w-auto">
          {actions}
        </div>
      ) : null}
    </section>
  );
}
