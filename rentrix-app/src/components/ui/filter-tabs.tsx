import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface FilterOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface FilterTabsProps<T extends string> {
  options: FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  ariaLabel?: string;
  /** Module context — selects the semantic tint for the active pill. */
  tone?: 'primary' | 'contracts' | 'maintenance' | 'finance' | 'neutral';
}

type ScrollState = Readonly<{
  canScrollStart: boolean;
  canScrollEnd: boolean;
}>;

/**
 * Horizontal pill-style filter tabs — used on list pages for status filtering.
 * The edge fades respond to the actual scroll position, including RTL layouts,
 * so the control hints at hidden options without obscuring the first or last tab.
 *
 * @example
 * <FilterTabs
 *   options={[
 *     { value: 'all', label: 'الكل' },
 *     { value: 'active', label: 'نشط', count: 12 },
 *     { value: 'expired', label: 'منتهي' },
 *   ]}
 *   value={filter}
 *   onChange={setFilter}
 * />
 */
export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
  className,
  ariaLabel = 'خيارات التصفية',
  tone = 'primary',
}: FilterTabsProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState<ScrollState>({
    canScrollStart: false,
    canScrollEnd: false,
  });

  const updateScrollState = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const logicalOffset = Math.min(maxScroll, Math.abs(scroller.scrollLeft));
    const nextState = {
      canScrollStart: maxScroll > 2 && logicalOffset > 2,
      canScrollEnd: maxScroll > 2 && logicalOffset < maxScroll - 2,
    };

    setScrollState((current) =>
      current.canScrollStart === nextState.canScrollStart && current.canScrollEnd === nextState.canScrollEnd
        ? current
        : nextState,
    );
  }, []);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    const frame = window.requestAnimationFrame(updateScrollState);
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateScrollState);

    resizeObserver?.observe(scroller);
    scroller.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      scroller.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [options.length, updateScrollState]);

  return (
    <div
      data-filter-tabs-wrapper
      data-can-scroll-start={scrollState.canScrollStart}
      data-can-scroll-end={scrollState.canScrollEnd}
      className="min-w-0"
    >
      <div
        ref={scrollRef}
        data-filter-tabs-scroll
        className={cn(
          '-mx-3 flex scroll-px-3 gap-1.5 overflow-x-auto px-3 pb-0.5 no-scrollbar sm:mx-0 sm:px-0',
          className,
        )}
        role="group"
        aria-label={ariaLabel}
      >
        {options.map((option) => {
          const isActive = value === option.value;
          const activeClasses = {
            primary: 'border-primary/25 bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.05)]',
            contracts: 'border-[hsl(24_90%_42%/0.22)] bg-[hsl(32_95%_62%/0.14)] text-[hsl(24_90%_35%)]',
            maintenance: 'border-[hsl(211_85%_40%/0.25)] bg-[hsl(211_90%_50%/0.1)] text-[hsl(211_85%_36%)]',
            finance: 'border-success/25 bg-success/10 text-success',
            neutral: 'border-foreground/10 bg-foreground/[0.06] text-foreground',
          }[tone];
          const activeCountClasses = {
            primary: 'bg-primary/15 text-primary',
            contracts: 'bg-[hsl(32_95%_62%/0.2)] text-[hsl(24_90%_35%)]',
            maintenance: 'bg-[hsl(211_90%_50%/0.18)] text-[hsl(211_85%_36%)]',
            finance: 'bg-success/15 text-success',
            neutral: 'bg-foreground/10 text-foreground',
          }[tone];

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(option.value)}
              className={cn(
                'flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 active:scale-[0.98]',
                isActive
                  ? activeClasses
                  : 'border-border/70 bg-background text-muted-foreground hover:border-primary/15 hover:bg-muted/70 hover:text-foreground',
              )}
            >
              {option.label}
              {option.count !== undefined ? (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                    isActive ? activeCountClasses : 'bg-muted text-foreground/80',
                  )}
                >
                  {option.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
