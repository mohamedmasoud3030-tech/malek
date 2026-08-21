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
 * Canonical MALEK register toolbar for search, filters and compact utilities.
 * It uses the same dense, quiet chrome as the shared DataTable instead of
 * presenting controls as a separate dashboard card.
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
      data-register-toolbar
      className={cn(
        'flex min-w-0 flex-col gap-2.5 rounded-xl border border-border/85 bg-background p-2 shadow-[0_1px_2px_hsl(var(--foreground)/0.025)] sm:p-2.5 lg:flex-row lg:items-center',
        className,
      )}
      aria-label="البحث والتصفية"
    >
      {showSearch ? (
        <div className="min-w-0 flex-1 lg:max-w-xl">
          <SearchInput
            value={searchValue ?? ''}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            aria-label={searchAriaLabel}
          />
        </div>
      ) : null}

      {filters ? (
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto no-scrollbar [&>*]:shrink-0 [&_input]:h-10 [&_select]:h-10">
          {filters}
        </div>
      ) : null}

      {actions ? (
        <div className="flex min-w-0 shrink-0 items-center gap-1.5 overflow-x-auto no-scrollbar [&>*]:shrink-0">
          {actions}
        </div>
      ) : null}
    </section>
  );
}
