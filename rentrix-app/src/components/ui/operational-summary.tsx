import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type OperationalSummaryTone = 'primary' | 'warning' | 'destructive';

const glowToneClasses: Record<OperationalSummaryTone, string> = {
  primary: 'bg-primary/20',
  warning: 'bg-warning/20',
  destructive: 'bg-destructive/20',
};

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
    <article data-operational-metric className="group relative overflow-hidden rounded-2xl border border-border/75 bg-card p-4 shadow-card">
      <div
        className="absolute inset-inline-end-0 inset-block-start-0 size-24 rounded-full bg-primary/7 blur-2xl transition-colors group-hover:bg-primary/12"
        aria-hidden="true"
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-muted-foreground">{label}</p>
          <p className="mt-2 truncate text-2xl font-black tabular-nums">{value}</p>
          <p className="mt-1 text-[11px] font-medium text-muted-foreground">{hint}</p>
        </div>
        <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/15 bg-primary/8 text-primary">
          <Icon className="size-5" aria-hidden="true" />
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
    <article data-operational-command className="relative overflow-hidden rounded-2xl border border-sidebar-border bg-sidebar p-5 text-sidebar-foreground shadow-elevated">
      <div
        className={cn(
          'absolute -inset-inline-end-12 -inset-block-start-16 size-48 rounded-full blur-3xl',
          glowToneClasses[tone],
        )}
        aria-hidden="true"
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold text-sidebar-foreground/65">{label}</p>
            <p className="mt-2 truncate text-4xl font-black tabular-nums">{value}</p>
          </div>
          <span
            className={cn(
              'grid size-12 shrink-0 place-items-center rounded-2xl border border-sidebar-border bg-sidebar-accent',
              iconToneClasses[tone],
            )}
          >
            <Icon className="size-6" aria-hidden="true" />
          </span>
        </div>

        {normalizedProgress !== undefined ? (
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-sidebar-accent">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${normalizedProgress}%` }}
              aria-hidden="true"
            />
          </div>
        ) : null}

        {description ? (
          <div className="mt-4 text-xs font-medium leading-5 text-sidebar-foreground/72">
            {description}
          </div>
        ) : null}

        {footer ? (
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-sidebar-foreground/72">
            {footer}
          </div>
        ) : null}
      </div>
    </article>
  );
}
