import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type KpiAccent = 'primary' | 'emerald' | 'amber' | 'sky' | 'rose' | 'violet' | 'slate';

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  className?: string;
  accent?: KpiAccent;
  /** Legacy compatibility prop. Compact sizing is determined by context. */
  compact?: boolean;
  /**
   * Optional visualization slot under the value (sparkline, radial, mini
   * bars). Presentation only — the value above stays the readable truth.
   */
  visual?: ReactNode;
}

/**
 * KPI metric card with semantic accent support.
 * The accent affects the icon tile and top rule only; value text stays neutral
 * for readability and financial consistency in both light and dark themes.
 */
export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  trendValue,
  className,
  accent = 'primary',
  visual,
}: KpiCardProps) {
  return (
    <article
      data-kpi-card
      data-accent={accent}
      className={cn(
        'min-w-0 rounded-xl border border-border/65 bg-card p-3 sm:p-3.5 shadow-card',
        'transition-shadow duration-200 hover:shadow-card-hover',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="kpi-card__icon grid size-10 shrink-0 place-items-center rounded-lg">
          <Icon className="size-[1.125rem]" aria-hidden="true" />
        </div>
        {trend && trendValue ? (
          <span
            className={cn(
              'inline-flex min-h-6 items-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums',
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
        <p className="break-words text-lg font-bold tabular-nums leading-tight text-foreground [overflow-wrap:anywhere] sm:text-2xl" dir="ltr">
          {value}
        </p>
        <p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p>
        {/* Full muted token: the /70 opacity blend measured 2.27:1 (axe). */}
        {sub ? (
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{sub}</p>
        ) : null}
        {visual ? <div className="mt-2 min-w-0">{visual}</div> : null}
      </div>
    </article>
  );
}
