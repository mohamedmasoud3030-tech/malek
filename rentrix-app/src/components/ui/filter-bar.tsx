import { useState, type ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ActiveFilterItem } from './active-filter-bar';
import { BottomSheet } from './bottom-sheet';
import { Button } from './button';
import { SearchInput } from './search-input';

type FilterBarProps = {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  filters?: ReactNode;
  advancedFilters?: ReactNode;
  advancedFilterTitle?: string;
  advancedFilterDescription?: string;
  activeFilters?: readonly ActiveFilterItem[];
  onClearAllFilters?: () => void;
  actions?: ReactNode;
  className?: string;
};

/**
 * Canonical MALEK search + filter system.
 *
 * Every register exposes one calm control only: search plus an icon-only filter
 * trigger. Quick filters, advanced filters and view utilities live inside the
 * same sheet so pages do not accumulate duplicated filter rows and chips.
 */
export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'بحث...',
  searchAriaLabel = 'بحث',
  filters,
  advancedFilters,
  advancedFilterTitle = 'الفلاتر',
  advancedFilterDescription = 'اختر فقط ما تحتاجه لتضييق النتائج.',
  activeFilters = [],
  onClearAllFilters,
  actions,
  className,
}: FilterBarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const showSearch = typeof onSearchChange === 'function';
  const activeFilterCount = activeFilters.length;
  const hasFilterContent = Boolean(filters || advancedFilters || actions || activeFilterCount > 0);

  return (
    <div className="min-w-0" data-search-filter-system>
      <section
        data-filter-bar
        data-register-toolbar
        className={cn(
          'flex min-w-0 items-center gap-2 border-y border-border/50 bg-muted/10 py-2',
          className,
        )}
        aria-label="البحث والتصفية"
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
        ) : <div className="min-w-0 flex-1" />}

        {hasFilterContent ? (
          <Button
            type="button"
            variant={activeFilterCount > 0 ? 'secondary' : 'ghost'}
            size="icon"
            className="relative size-11 shrink-0 rounded-xl border border-border/60 bg-card/80 text-foreground shadow-none"
            aria-label={activeFilterCount > 0 ? `${advancedFilterTitle}، ${activeFilterCount} نشطة` : advancedFilterTitle}
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen(true)}
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            {activeFilterCount > 0 ? (
              <span
                className="absolute -end-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-black leading-none text-primary-foreground tabular-nums"
                aria-hidden="true"
              >
                {activeFilterCount}
              </span>
            ) : null}
          </Button>
        ) : null}
      </section>

      {hasFilterContent ? (
        <BottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title={advancedFilterTitle}>
          <div className="space-y-4" data-unified-filter-sheet>
            <p className="text-xs font-medium leading-5 text-muted-foreground">{advancedFilterDescription}</p>

            {filters ? (
              <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2" data-filter-sheet-quick>
                {filters}
              </div>
            ) : null}

            {advancedFilters ? (
              <div className="border-t border-border/50 pt-3" data-filter-sheet-advanced>
                {advancedFilters}
              </div>
            ) : null}

            {actions ? (
              <div className="flex min-w-0 flex-wrap items-center gap-2 border-t border-border/50 pt-3" data-filter-sheet-actions>
                {actions}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2 border-t border-border/50 pt-3">
              {activeFilterCount > 0 && onClearAllFilters ? (
                <Button type="button" variant="ghost" className="min-h-11 rounded-xl" onClick={onClearAllFilters}>
                  مسح الفلاتر
                </Button>
              ) : <span aria-hidden="true" />}
              <Button type="button" className="min-h-11 rounded-xl" onClick={() => setFiltersOpen(false)}>
                عرض النتائج
              </Button>
            </div>
          </div>
        </BottomSheet>
      ) : null}
    </div>
  );
}
