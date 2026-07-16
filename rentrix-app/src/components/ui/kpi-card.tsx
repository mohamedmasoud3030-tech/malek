import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  className?: string;
  /** Legacy compatibility prop. KPI cards intentionally render one brand accent. */
  accent?: string;
  /** Legacy compatibility prop. Compact sizing is determined by context. */
  compact?: boolean;
}

/**
 * KPI metric card — single accent (primary only).
 * Trend indicators communicate direction rather than category color.
 */
export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  trendValue,
  className,
}: KpiCardProps) {
  return (
    <article
      data-kpi-card
      className={cn(
        'min-w-0 rounded-xl border border-border/70 bg-card p-3.5 sm:p-4 shadow-card',
        'transition-shadow duration-200 hover:shadow-card-hover',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Icon className="size-[1.125rem]" aria-hidden="true" />
        </div>
        {trend && trendValue ? (
          <span
            className={cn(
              'inline-flex min-h-6 items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums',
              trend === 'up' && 'text-success bg-success/10',
              trend === 'down' && 'text-danger bg-danger/10',
              trend === 'neutral' && 'text-muted-foreground bg-muted',
            )}
          >
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '–'} {trendValue}
          </span>
        ) : null}
      </div>

      <div className="mt-3 min-w-0">
        <p className="break-words text-lg sm:text-2xl font-bold tabular-nums leading-tight text-foreground" dir="ltr">
          {value}
        </p>
        <p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p>
        {sub ? (
          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground/70">{sub}</p>
        ) : null}
      </div>
    </article>
  );
}
