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
  /** Module context — selects the semantic tint for the active segment. */
  tone?: 'primary' | 'contracts' | 'maintenance' | 'finance' | 'neutral';
}

type ScrollState = Readonly<{
  canScrollStart: boolean;
  canScrollEnd: boolean;
}>;

/**
 * Canonical compact filter segments for MALEK data registers.
 * The control keeps the speed of status tabs while visually belonging to the
 * same dense toolbar language as search, sort and table utilities.
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
          '-mx-2 flex scroll-px-2 gap-1 overflow-x-auto px-2 no-scrollbar sm:mx-0 sm:px-0',
          className,
        )}
        role="group"
        aria-label={ariaLabel}
      >
        {options.map((option) => {
          const isActive = value === option.value;
          const activeClasses = {
            primary: 'border-primary/25 bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.04)]',
            contracts: 'border-[hsl(var(--tone-amber)/0.24)] bg-[hsl(var(--tone-amber-soft))] text-[hsl(var(--tone-amber))]',
            maintenance: 'border-[hsl(var(--tone-sky)/0.24)] bg-[hsl(var(--tone-sky-soft))] text-[hsl(var(--tone-sky))]',
            finance: 'border-success/25 bg-success/10 text-success',
            neutral: 'border-foreground/12 bg-foreground/[0.055] text-foreground',
          }[tone];
          const activeCountClasses = {
            primary: 'bg-primary/15 text-primary',
            contracts: 'bg-[hsl(var(--tone-amber)/0.14)] text-[hsl(var(--tone-amber))]',
            maintenance: 'bg-[hsl(var(--tone-sky)/0.13)] text-[hsl(var(--tone-sky))]',
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
                'flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-[background-color,border-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15',
                isActive
                  ? activeClasses
                  : 'border-border/75 bg-background text-muted-foreground hover:border-foreground/15 hover:bg-muted/55 hover:text-foreground',
              )}
            >
              {option.label}
              {option.count !== undefined ? (
                <span
                  className={cn(
                    'rounded-md px-1.5 py-0.5 text-[9px] font-bold tabular-nums',
                    isActive ? activeCountClasses : 'bg-muted text-foreground/75',
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
