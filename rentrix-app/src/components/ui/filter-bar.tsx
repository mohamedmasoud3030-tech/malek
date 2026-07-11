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
 * Unified list toolbar: search + filter controls + trailing actions.
 * Keeps list pages visually consistent across the product.
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
    <div
      className={cn(
        'flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/80 p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4',
        className,
      )}
    >
      {showSearch ? (
        <div className="min-w-0 flex-1">
          <SearchInput
            value={searchValue ?? ''}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            aria-label={searchAriaLabel}
          />
        </div>
      ) : null}

      {filters ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0">{filters}</div>
      ) : null}

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:ms-auto">{actions}</div>
      ) : null}
    </div>
  );
}
