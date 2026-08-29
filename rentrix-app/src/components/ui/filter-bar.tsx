import { useState, type ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ActiveFilterBar, type ActiveFilterItem } from './active-filter-bar';
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
 * Pages provide only values, filter controls and actions. This component owns
 * the shared responsive composition: one search control, one compact quick-
 * filter rail, desktop advanced filters, a mobile BottomSheet for the same
 * advanced controls, active-filter chips, counts and clear-all behavior.
 */
export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'بحث...',
  searchAriaLabel = 'بحث',
  filters,
  advancedFilters,
  advancedFilterTitle = 'فلاتر إضافية',
  advancedFilterDescription = 'استخدم الفلاتر الإضافية لتضييق النتائج عند الحاجة.',
  activeFilters = [],
  onClearAllFilters,
  actions,
  className,
}: FilterBarProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const showSearch = typeof onSearchChange === 'function';
  const activeFilterCount = activeFilters.length;
  const showUtilities = Boolean(advancedFilters || actions);

  return (
    <div className="min-w-0 space-y-1.5" data-search-filter-system>
      <section
        data-filter-bar
        data-register-toolbar
        className={cn(
          'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 rounded-xl border border-border/70 bg-card p-1.5 shadow-card sm:p-2 lg:grid-cols-[minmax(18rem,1.1fr)_minmax(0,2fr)_auto] lg:gap-2',
          className,
        )}
        aria-label="البحث والتصفية"
      >
        {showSearch ? (
          <div className="col-span-2 min-w-0 lg:col-span-1">
            <SearchInput
              value={searchValue ?? ''}
              onChange={onSearchChange}
              placeholder={searchPlaceholder}
              aria-label={searchAriaLabel}
            />
          </div>
        ) : null}

        {filters ? (
          <div
            className={cn(
              'flex min-w-0 items-center gap-1.5 overflow-x-auto no-scrollbar [&>*]:shrink-0 [&_input]:min-h-11 [&_input]:h-11 [&_select]:min-h-11 [&_select]:h-11',
              !showSearch && 'col-span-1 lg:col-span-2',
            )}
          >
            {filters}
          </div>
        ) : null}

        {showUtilities ? (
          <div
            className={cn(
              'flex min-w-0 shrink-0 items-center justify-end gap-1.5 overflow-x-auto no-scrollbar [&>*]:shrink-0',
              !filters && !showSearch && 'col-span-2 lg:col-span-3',
              !filters && showSearch && 'col-span-2 lg:col-span-2',
            )}
          >
            {advancedFilters ? (
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 rounded-lg px-3 text-xs md:hidden"
                aria-label={activeFilterCount > 0 ? `${advancedFilterTitle}، ${activeFilterCount} نشطة` : advancedFilterTitle}
                onClick={() => setAdvancedOpen(true)}
              >
                <SlidersHorizontal className="me-1.5 size-3.5" aria-hidden="true" />
                <span>{advancedFilterTitle}</span>
                {activeFilterCount > 0 ? (
                  <span className="rounded-md bg-primary/12 px-1.5 py-0.5 text-[11px] font-black text-primary tabular-nums">
                    {activeFilterCount}
                  </span>
                ) : null}
              </Button>
            ) : null}
            {actions}
          </div>
        ) : null}

        {advancedFilters ? (
          <div
            className="col-span-2 hidden min-w-0 border-t border-border/60 pt-2 md:block lg:col-span-3"
            data-advanced-filter-desktop
          >
            {advancedFilters}
          </div>
        ) : null}
      </section>

      {activeFilterCount > 0 ? (
        <ActiveFilterBar
          filters={activeFilters}
          onClearAll={onClearAllFilters}
          className="shadow-none"
        />
      ) : null}

      {advancedFilters ? (
        <BottomSheet open={advancedOpen} onClose={() => setAdvancedOpen(false)} title={advancedFilterTitle}>
          <div className="space-y-3" data-advanced-filter-mobile>
            <p className="text-xs font-medium leading-5 text-muted-foreground">{advancedFilterDescription}</p>
            {advancedFilters}
            <div className="flex items-center gap-2 pt-1">
              {activeFilterCount > 0 && onClearAllFilters ? (
                <Button type="button" variant="ghost" className="min-h-11 flex-1 rounded-lg" onClick={onClearAllFilters}>
                  مسح الكل
                </Button>
              ) : null}
              <Button type="button" className="min-h-11 flex-1 rounded-lg" onClick={() => setAdvancedOpen(false)}>
                عرض النتائج
              </Button>
            </div>
          </div>
        </BottomSheet>
      ) : null}
    </div>
  );
}
