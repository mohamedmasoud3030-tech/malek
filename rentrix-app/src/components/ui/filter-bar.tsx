import { SlidersHorizontal } from 'lucide-react';
import { useCallback, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { BottomSheet } from './bottom-sheet';
import { Button } from './button';
import { SearchInput } from './search-input';

type FilterBarProps = {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  filters?: ReactNode;
  actions?: ReactNode;
  mobileFilterCount?: number;
  mobileFilterTitle?: string;
  className?: string;
};

/**
 * Canonical MALEK entity toolbar.
 *
 * Phone: search stays directly beside one filter trigger; filter controls move
 * into a labelled bottom sheet and desktop-only table utilities disappear.
 * Desktop/tablet: search, filters and utilities share one quiet toolbar row.
 */
export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'بحث...',
  searchAriaLabel = 'بحث',
  filters,
  actions,
  mobileFilterCount = 0,
  mobileFilterTitle = 'تصفية النتائج',
  className,
}: FilterBarProps) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const closeMobileFilters = useCallback(() => setMobileFiltersOpen(false), []);
  const showSearch = typeof onSearchChange === 'function';

  return (
    <>
      <section
        data-filter-bar
        data-register-toolbar
        className={cn(
          'flex min-w-0 items-center gap-1.5 border-y border-border/70 bg-transparent py-1.5 md:rounded-xl md:border md:border-border/85 md:bg-background md:p-2 md:shadow-[0_1px_2px_hsl(var(--foreground)/0.025)] lg:gap-2',
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
          <Button
            type="button"
            variant={mobileFilterCount > 0 ? 'soft' : 'secondary'}
            className="min-h-11 shrink-0 px-2.5 md:hidden"
            aria-label={mobileFilterCount > 0 ? `فتح الفلاتر، ${mobileFilterCount} مفعلة` : 'فتح الفلاتر'}
            aria-haspopup="dialog"
            aria-expanded={mobileFiltersOpen}
            onClick={() => setMobileFiltersOpen(true)}
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            <span className="hidden text-xs font-bold min-[360px]:inline">فلترة</span>
            {mobileFilterCount > 0 ? (
              <span className="grid size-5 place-items-center rounded-full bg-primary text-[10px] font-black text-primary-foreground" aria-hidden="true">
                {mobileFilterCount}
              </span>
            ) : null}
          </Button>
        ) : null}

        {filters ? (
          <div className="hidden min-w-0 flex-1 items-center gap-1.5 overflow-x-auto no-scrollbar md:flex [&>*]:shrink-0 [&_input]:h-11 [&_input]:min-h-11 [&_select]:h-11 [&_select]:min-h-11">
            {filters}
          </div>
        ) : null}

        {actions ? (
          <div className="hidden min-w-0 shrink-0 items-center justify-end gap-1.5 md:flex [&>*]:shrink-0">
            {actions}
          </div>
        ) : null}
      </section>

      {filters ? (
        <BottomSheet open={mobileFiltersOpen} onClose={closeMobileFilters} title={mobileFilterTitle} className="md:hidden">
          <div data-mobile-filter-sheet className="space-y-5">
            <div className="grid min-w-0 gap-4 [&_[data-filter-tabs-scroll]]:mx-0 [&_[data-filter-tabs-scroll]]:px-0 [&_label]:min-w-0 [&_select]:h-12 [&_select]:w-full">
              {filters}
            </div>
            <Button type="button" className="w-full" onClick={closeMobileFilters}>
              عرض النتائج
            </Button>
          </div>
        </BottomSheet>
      ) : null}
    </>
  );
}
