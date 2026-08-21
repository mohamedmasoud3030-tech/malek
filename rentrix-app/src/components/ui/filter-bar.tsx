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
 * Mobile keeps search on one line and packs filters/utilities into a second
 * compact rail instead of stacking several card-height rows.
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
        'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-1.5 rounded-xl border border-border/85 bg-background p-1.5 shadow-[0_1px_2px_hsl(var(--foreground)/0.025)] sm:p-2 lg:flex lg:items-center lg:gap-2',
        className,
      )}
      aria-label="البحث والتصفية"
    >
      {showSearch ? (
        <div className="col-span-2 min-w-0 flex-1 lg:max-w-xl">
          <SearchInput
            value={searchValue ?? ''}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            aria-label={searchAriaLabel}
          />
        </div>
      ) : null}

      {filters ? (
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto no-scrollbar [&>*]:shrink-0 [&_input]:min-h-11 [&_input]:h-11 [&_select]:min-h-11 [&_select]:h-11">
          {filters}
        </div>
      ) : null}

      {actions ? (
        <div className={cn(
          'flex min-w-0 shrink-0 items-center justify-end gap-1.5 overflow-x-auto no-scrollbar [&>*]:shrink-0',
          !filters && 'col-span-2',
        )}>
          {actions}
        </div>
      ) : null}
    </section>
  );
}
