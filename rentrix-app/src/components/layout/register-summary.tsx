import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type RegisterMetricItem = Readonly<{
  id: string;
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: LucideIcon;
  tone?: 'default' | 'warning' | 'success' | 'danger';
  /** Hide the metric when its numeric value is zero / empty. */
  hideWhenEmpty?: boolean;
}>;

function isEmptyMetricValue(value: ReactNode): boolean {
  if (value == null || value === false) return true;
  if (typeof value === 'number') return value === 0;
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (normalized === '' || normalized === '—' || normalized === '0' || normalized === '0%') return true;
    const numeric = normalized.replace(/[^\d.,-]/g, '');
    return /^0([.,]0+)?$/.test(numeric);
  }
  return false;
}

const toneClass: Record<NonNullable<RegisterMetricItem['tone']>, string> = {
  default: 'text-foreground',
  warning: 'text-warning',
  success: 'text-success',
  danger: 'text-destructive',
};

/**
 * One compact facts strip for register pages.
 * Metrics share a single surface instead of competing as independent KPI cards;
 * the strip wraps naturally on narrow screens without turning into a dashboard.
 */
export function RegisterMetricStrip({
  items,
  'aria-label': ariaLabel,
  className,
}: Readonly<{
  items: readonly RegisterMetricItem[];
  'aria-label': string;
  className?: string;
}>) {
  const visible = items.filter((item) => !(item.hideWhenEmpty && isEmptyMetricValue(item.value)));
  if (visible.length === 0) return null;
  const hasOddMobileTail = visible.length % 2 === 1;

  return (
    <section
      data-register-metric-strip
      aria-label={ariaLabel}
      className={cn(
        'grid min-w-0 grid-cols-2 gap-px overflow-hidden rounded-lg border border-border/70 bg-border/60 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]',
        className,
      )}
    >
      {visible.map((item, index) => {
        const Icon = item.icon;
        const isLast = index === visible.length - 1;
        return (
          <div
            key={item.id}
            data-register-metric=""
            className={cn(
              'flex min-w-0 items-start gap-2 bg-card px-2.5 py-2 sm:px-3 sm:py-2.5',
              hasOddMobileTail && isLast && 'col-span-2 sm:col-span-1',
            )}
          >
            {Icon ? (
              <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 break-words text-[0.6875rem] font-bold leading-4 text-muted-foreground">{item.label}</p>
              <p
                className={cn(
                  'mt-0.5 break-words text-sm font-black tabular-nums leading-5 [overflow-wrap:anywhere]',
                  toneClass[item.tone ?? 'default'],
                )}
              >
                {item.value}
              </p>
              {item.hint ? (
                <p className="mt-0.5 line-clamp-2 break-words text-[0.6875rem] leading-4 text-muted-foreground">{item.hint}</p>
              ) : null}
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function RegisterAttention({
  count,
  label,
  description,
}: Readonly<{
  count: number;
  label: string;
  description?: string;
}>) {
  if (count <= 0) return null;

  return (
    <div
      data-register-attention
      role="status"
      className="flex items-start gap-2 rounded-xl border border-warning/25 bg-warning-bg px-3 py-2 text-warning"
    >
      <span className="mt-0.5 text-sm font-black tabular-nums">{count}</span>
      <div className="min-w-0">
        <p className="text-xs font-black">{label}</p>
        {description ? <p className="mt-0.5 text-xs font-medium leading-5 text-warning">{description}</p> : null}
      </div>
    </div>
  );
}
