import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type EntitySummaryItem = Readonly<{
  label: string;
  value: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger';
  hidden?: boolean;
}>;

type EntitySummaryStripProps = Readonly<{
  items: readonly EntitySummaryItem[];
  ariaLabel: string;
  className?: string;
}>;

const valueTone = {
  default: 'text-foreground',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
} as const;

/**
 * Compact operational context for entity registers.
 *
 * Counts remain available without turning every number into a dashboard card.
 * The strip is intentionally part of the register flow: label + value pairs,
 * quiet separators, no icon tiles, elevation, progress art, or dead space.
 */
export function EntitySummaryStrip({ items, ariaLabel, className }: EntitySummaryStripProps) {
  const visibleItems = items.filter((item) => !item.hidden);
  if (visibleItems.length === 0) return null;

  return (
    <dl
      data-entity-summary-strip
      aria-label={ariaLabel}
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-0 gap-y-1 border-y border-border/65 py-1.5 text-[11px] sm:py-2 sm:text-xs',
        className,
      )}
    >
      {visibleItems.map((item, index) => (
        <div
          key={item.label}
          className={cn(
            'flex min-h-7 min-w-0 items-center gap-1.5 px-2 first:ps-0 sm:px-3',
            index > 0 && 'border-s border-border/70',
          )}
        >
          <dt className="whitespace-nowrap font-semibold text-muted-foreground">{item.label}</dt>
          <dd className={cn('min-w-0 font-black tabular-nums', valueTone[item.tone ?? 'default'])}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
