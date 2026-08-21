import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type OperationalSummaryTone = 'primary' | 'warning' | 'destructive';

const iconToneClasses: Record<OperationalSummaryTone, string> = {
  primary: 'text-sidebar-accent-foreground',
  warning: 'text-warning',
  destructive: 'text-destructive',
};

export function OperationalMetricCard({
  label,
  value,
  hint,
  icon: Icon,
}: Readonly<{
  label: string;
  value: ReactNode;
  hint: string;
  icon: LucideIcon;
}>) {
  return (
    <article data-operational-metric className="group relative min-w-0 overflow-hidden rounded-xl border border-border/75 bg-card p-3 shadow-card before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-l before:from-transparent before:via-primary/45 before:to-transparent sm:p-3.5">
      <div className="relative flex min-w-0 items-start justify-between gap-2.5">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold text-muted-foreground sm:text-xs">{label}</p>
          <p className="mt-1.5 truncate text-xl font-black tabular-nums sm:text-2xl">{value}</p>
          <p className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-4 text-muted-foreground sm:text-[11px]">{hint}</p>
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-primary/15 bg-primary/8 text-primary sm:size-10">
          <Icon className="size-4 sm:size-[1.05rem]" aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}

export function OperationalCommandPanel({
  label,
  value,
  icon: Icon,
  progress,
  description,
  footer,
  tone = 'primary',
}: Readonly<{
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  progress?: number;
  description?: ReactNode;
  footer?: ReactNode;
  tone?: OperationalSummaryTone;
}>) {
  const normalizedProgress = progress === undefined
    ? undefined
    : Math.min(100, Math.max(0, progress));

  return (
    <article data-operational-command className="relative min-w-0 overflow-hidden rounded-xl border border-sidebar-border bg-sidebar p-3.5 text-sidebar-foreground shadow-card sm:p-4">
      <div className="relative">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-bold text-sidebar-foreground/65 sm:text-xs">{label}</p>
            <p className="mt-1.5 truncate text-2xl font-black tabular-nums sm:text-3xl">{value}</p>
          </div>
          <span
            className={cn(
              'grid size-10 shrink-0 place-items-center rounded-xl border border-sidebar-border bg-sidebar-accent sm:size-11',
              iconToneClasses[tone],
            )}
          >
            <Icon className="size-[1.1rem] sm:size-5" aria-hidden="true" />
          </span>
        </div>

        {normalizedProgress !== undefined ? (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sidebar-accent">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${normalizedProgress}%` }}
              aria-hidden="true"
            />
          </div>
        ) : null}

        {description ? (
          <div className="mt-2.5 text-[11px] font-medium leading-4 text-sidebar-foreground/72 sm:text-xs sm:leading-5">
            {description}
          </div>
        ) : null}

        {footer ? (
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold text-sidebar-foreground/72 sm:text-[11px]">
            {footer}
          </div>
        ) : null}
      </div>
    </article>
  );
}
