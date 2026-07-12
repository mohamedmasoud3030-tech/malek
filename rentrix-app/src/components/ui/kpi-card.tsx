import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  accent?: 'primary' | 'emerald' | 'amber' | 'rose' | 'violet' | 'sky';
  compact?: boolean;
  className?: string;
}

const accentMap = {
  primary: {
    surface: 'bg-primary/[0.055]',
    icon: 'bg-primary text-primary-foreground',
    trend_up: 'text-emerald-600 dark:text-emerald-400',
    trend_down: 'text-rose-600 dark:text-rose-400',
  },
  emerald: {
    surface: 'bg-emerald-50/75 dark:bg-emerald-950/25',
    icon: 'bg-emerald-500 text-white',
    trend_up: 'text-emerald-600 dark:text-emerald-400',
    trend_down: 'text-rose-600 dark:text-rose-400',
  },
  amber: {
    surface: 'bg-amber-50/75 dark:bg-amber-950/25',
    icon: 'bg-amber-500 text-white',
    trend_up: 'text-emerald-600 dark:text-emerald-400',
    trend_down: 'text-rose-600 dark:text-rose-400',
  },
  rose: {
    surface: 'bg-rose-50/75 dark:bg-rose-950/25',
    icon: 'bg-rose-500 text-white',
    trend_up: 'text-emerald-600 dark:text-emerald-400',
    trend_down: 'text-rose-600 dark:text-rose-400',
  },
  violet: {
    surface: 'bg-violet-50/75 dark:bg-violet-950/25',
    icon: 'bg-violet-500 text-white',
    trend_up: 'text-emerald-600 dark:text-emerald-400',
    trend_down: 'text-rose-600 dark:text-rose-400',
  },
  sky: {
    surface: 'bg-sky-50/75 dark:bg-sky-950/25',
    icon: 'bg-sky-500 text-white',
    trend_up: 'text-emerald-600 dark:text-emerald-400',
    trend_down: 'text-rose-600 dark:text-rose-400',
  },
};

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  trendValue,
  accent = 'primary',
  compact = false,
  className,
}: KpiCardProps) {
  const colors = accentMap[accent];

  return (
    <article
      data-kpi-card
      className={cn(
        'relative min-w-0 overflow-hidden rounded-[1.35rem] border border-border/65 bg-card p-4 shadow-[0_8px_24px_hsl(var(--foreground)/0.045)] transition-[transform,border-color,box-shadow] sm:rounded-2xl',
        'hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_14px_32px_hsl(var(--foreground)/0.07)]',
        colors.surface,
        compact ? 'p-3' : 'p-4',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={cn('grid size-10 shrink-0 place-items-center rounded-2xl shadow-sm', compact && 'size-9 rounded-xl', colors.icon)}>
          <Icon className={cn('size-4.5', compact && 'size-4')} aria-hidden="true" />
        </div>
        {trend && trendValue ? (
          <span
            className={cn(
              'inline-flex min-h-7 items-center rounded-full px-2 py-1 text-[10px] font-black tabular-nums',
              trend === 'up' && `${colors.trend_up} bg-emerald-100 dark:bg-emerald-900/40`,
              trend === 'down' && `${colors.trend_down} bg-rose-100 dark:bg-rose-900/40`,
              trend === 'neutral' && 'bg-muted text-muted-foreground',
            )}
          >
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '–'} {trendValue}
          </span>
        ) : null}
      </div>

      <div className="mt-3 min-w-0">
        <p className={cn('break-words font-black tabular-nums leading-tight tracking-tight', compact ? 'text-xl' : 'text-[1.65rem] sm:text-2xl')}>
          {value}
        </p>
        <p className={cn('mt-1 font-bold text-muted-foreground', compact ? 'text-[11px]' : 'text-xs')}>{label}</p>
        {sub ? <p className="mt-1 line-clamp-2 text-[10px] font-medium leading-4 text-muted-foreground/80">{sub}</p> : null}
      </div>
    </article>
  );
}
