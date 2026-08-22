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
 * Compact operational strip for register pages.
 * Replaces stacked KPI cards when the page only needs a scannable summary.
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

  return (
    <section
      data-register-metric-strip
      aria-label={ariaLabel}
      className={cn(
        'flex min-w-0 flex-wrap items-stretch divide-x-0 overflow-hidden rounded-xl border border-border/70 bg-card shadow-card',
        className,
      )}
    >
      {visible.map((item, index) => {
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            data-register-metric
            className={cn(
              'flex min-w-[6.75rem] flex-1 items-center gap-2 px-3 py-1.5 sm:px-3.5',
              index > 0 && 'border-s border-border/70',
            )}
          >
            {Icon ? (
              <span className="hidden size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground sm:grid">
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
            ) : null}
            <div className="min-w-0">
              <p className="truncate text-[10px] font-bold text-muted-foreground">{item.label}</p>
              <p className={cn('truncate text-sm font-black tabular-nums leading-5', toneClass[item.tone ?? 'default'])}>
                {item.value}
              </p>
              {item.hint ? <p className="truncate text-[10px] text-muted-foreground">{item.hint}</p> : null}
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
        {description ? <p className="mt-0.5 text-[11px] font-medium leading-4 text-warning/80">{description}</p> : null}
      </div>
    </div>
  );
}

export function RegisterHeading({
  title,
  meta,
  extra,
}: Readonly<{
  title: string;
  meta?: string;
  extra?: ReactNode;
}>) {
  return (
    <header data-register-heading className="flex min-h-9 items-center justify-between gap-3 px-0.5">
      <div className="min-w-0">
        <h2 className="truncate text-sm font-black">{title}</h2>
        {meta ? <p className="truncate text-[11px] font-medium text-muted-foreground">{meta}</p> : null}
      </div>
      {extra}
    </header>
  );
}
