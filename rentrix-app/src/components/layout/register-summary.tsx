import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
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
 * Compact operational summary for register pages.
 * Mobile follows the global Wave 4 two-column rhythm; desktop may widen to
 * three columns while every metric remains compact and overflow-safe.
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
    <section data-register-metric-strip aria-label={ariaLabel} className={className}>
      <ResponsiveCardGrid desktopColumns={visible.length === 4 ? 4 : 3} gap="sm">
        {visible.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              data-register-metric
              className="flex min-w-0 items-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2 shadow-card"
            >
              {Icon ? (
                <span className="hidden size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground sm:grid">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 break-words text-xs font-bold leading-5 text-muted-foreground">{item.label}</p>
                <p className={cn('break-words text-sm font-black tabular-nums leading-5 [overflow-wrap:anywhere]', toneClass[item.tone ?? 'default'])}>
                  {item.value}
                </p>
                {item.hint ? <p className="line-clamp-2 break-words text-xs leading-5 text-muted-foreground">{item.hint}</p> : null}
              </div>
            </div>
          );
        })}
      </ResponsiveCardGrid>
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
        {meta ? <p className="truncate text-xs font-medium leading-5 text-muted-foreground">{meta}</p> : null}
      </div>
      {extra}
    </header>
  );
}
