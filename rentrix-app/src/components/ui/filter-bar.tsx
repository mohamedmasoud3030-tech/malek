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
  /** Routine filters. They sit inline on md+ screens; on phones they live in the sheet. */
  filters?: ReactNode;
  /** Optional set of filters that stay behind a quiet toggle even on desktop. */
  advancedFilters?: ReactNode;
  advancedFilterTitle?: string;
  advancedFilterDescription?: string;
  activeFilters?: readonly ActiveFilterItem[];
  onClearAllFilters?: () => void;
  /** Register utilities: columns, export, sort. Inline on md+, sheet on phones. */
  actions?: ReactNode;
  className?: string;
};

/**
 * Canonical MALEK search + filter system. One composition owner.
 *
 * The toolbar is a quiet edge-to-edge strip, never a card:
 * - md+ screens: search, quick filters and register utilities sit inline so
 *   routine filtering stays one step away; advanced filters sit behind a
 *   quiet toggle.
 * - phones: search plus a single icon trigger; everything shares one sheet.
 * - active filters are rendered exactly once, as removable chips under the
 *   toolbar, so the state of the list is always visible without opening
 *   anything.
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
  const [desktopAdvancedOpen, setDesktopAdvancedOpen] = useState(false);
  const showSearch = typeof onSearchChange === 'function';
  const activeFilterCount = activeFilters.length;
  const hasFilterContent = Boolean(filters || advancedFilters || actions || activeFilterCount > 0);

  return (
    <div className="min-w-0 space-y-1.5" data-search-filter-system>
      <section
        data-filter-bar
        data-register-toolbar
        aria-label="البحث والتصفية"
        className={cn(
          'flex min-w-0 items-center gap-2 border-y border-border/50 bg-muted/10 py-2',
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
        ) : (
          <div className="min-w-0 flex-1" />
        )}

        {filters ? (
          <div
            className="hidden min-w-0 max-w-full items-center gap-1.5 overflow-x-auto overscroll-x-contain no-scrollbar md:flex [&>*]:shrink-0 [&_input]:min-h-11 [&_input]:h-11 [&_select]:min-h-11 [&_select]:h-11"
            data-quick-filters-desktop
          >
            {filters}
          </div>
        ) : null}

        {actions ? (
          <div className="hidden shrink-0 items-center gap-1.5 md:flex" data-filter-actions-desktop>
            {actions}
          </div>
        ) : null}

        {advancedFilters ? (
          <Button
            type="button"
            variant={desktopAdvancedOpen ? 'secondary' : 'ghost'}
            className="hidden min-h-11 shrink-0 rounded-lg px-3 text-xs md:inline-flex"
            aria-label={activeFilterCount > 0 ? `${advancedFilterTitle}، ${activeFilterCount} نشطة` : advancedFilterTitle}
            aria-expanded={desktopAdvancedOpen}
            aria-controls="desktop-advanced-filters"
            onClick={() => setDesktopAdvancedOpen((open) => !open)}
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

        {hasFilterContent ? (
          <Button
            type="button"
            variant={activeFilterCount > 0 ? 'secondary' : 'ghost'}
            size="icon"
            className="relative size-11 shrink-0 rounded-xl shadow-none md:hidden"
            aria-label={activeFilterCount > 0 ? `${advancedFilterTitle}، ${activeFilterCount} نشطة` : advancedFilterTitle}
            aria-expanded={filtersOpen}
            aria-haspopup="dialog"
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

      {desktopAdvancedOpen && advancedFilters ? (
        <div
          id="desktop-advanced-filters"
          className="hidden min-w-0 border-t border-border/50 pt-2 md:block"
          data-advanced-filter-desktop
        >
          {advancedFilters}
        </div>
      ) : null}

      {activeFilterCount > 0 ? (
        <ActiveFilterBar
          filters={activeFilters}
          onClearAll={onClearAllFilters}
          className="border-0 rounded-none bg-transparent px-0.5 py-0.5 shadow-none"
        />
      ) : null}

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
              ) : (
                <span aria-hidden="true" />
              )}
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
