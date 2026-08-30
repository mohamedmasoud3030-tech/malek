import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DashboardSignalTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const toneClasses: Record<DashboardSignalTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-info-bg text-info-text',
  success: 'bg-success-bg text-success-text',
  warning: 'bg-warning-bg text-warning-text',
  danger: 'bg-danger-bg text-danger-text',
};

const rowToneClasses: Record<DashboardSignalTone, string> = {
  neutral: 'border-s-transparent',
  info: 'border-s-info-text/55',
  success: 'border-s-success-text/55',
  warning: 'border-s-warning-text/55',
  danger: 'border-s-danger-text/60',
};

export function DashboardSignalPanel({
  children,
  labelledBy,
  className,
}: Readonly<{
  children: ReactNode;
  labelledBy?: string;
  className?: string;
}>) {
  return (
    <section
      aria-labelledby={labelledBy}
      data-dashboard-signal-panel
      className={cn(
        'relative min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm',
        'shadow-[inset_0_1px_0_hsl(var(--border)/0.2)] sm:rounded-2xl sm:shadow-card',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function DashboardSignalHeader({
  id,
  title,
  meta,
  icon: Icon,
  tone = 'neutral',
  trailing,
}: Readonly<{
  id: string;
  title: string;
  meta?: ReactNode;
  icon: LucideIcon;
  tone?: DashboardSignalTone;
  trailing?: ReactNode;
}>) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 px-3.5 py-2.5 sm:min-h-14 sm:px-4 lg:min-h-12 lg:py-2" data-dashboard-signal-header>
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg ring-1 ring-current/10', toneClasses[tone])} aria-hidden="true">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <h3 id={id} className="truncate text-[13.5px] font-extrabold leading-5 text-foreground sm:text-sm">{title}</h3>
          {meta ? <p className="mt-0.5 line-clamp-1 text-[11px] font-medium leading-4 text-muted-foreground">{meta}</p> : null}
        </div>
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-1.5 text-xs">{trailing}</div> : null}
    </div>
  );
}

export function DashboardSignalList({ children, label }: Readonly<{ children: ReactNode; label?: string }>) {
  return (
    <ul className="divide-y divide-border/55 border-t border-border/60" role="list" aria-label={label} data-dashboard-signal-list>
      {children}
    </ul>
  );
}

export function dashboardSignalRowClass(tone: DashboardSignalTone = 'neutral', className?: string) {
  return cn(
    'grid min-h-[3.125rem] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-s-2 px-3.5 py-2 text-start outline-none transition-[background-color,border-color,transform]',
    'hover:bg-muted/35 focus-visible:bg-muted/35 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/25 active:translate-y-px sm:px-4',
    rowToneClasses[tone],
    className,
  );
}

export function DashboardSignalMain({
  title,
  meta,
  detail,
}: Readonly<{
  title: ReactNode;
  meta?: ReactNode;
  detail?: ReactNode;
}>) {
  return (
    <span className="min-w-0">
      <span className="block truncate text-[13px] font-bold leading-5 text-foreground">{title}</span>
      {meta ? <span className="mt-0.5 block truncate text-[11px] font-medium leading-4 text-muted-foreground">{meta}</span> : null}
      {detail ? <span className="mt-0.5 hidden truncate text-[11px] leading-4 text-muted-foreground sm:block">{detail}</span> : null}
    </span>
  );
}

export function DashboardSignalSide({ children }: Readonly<{ children: ReactNode }>) {
  return <span className="flex shrink-0 flex-col items-end gap-1 text-[11px] font-semibold text-muted-foreground">{children}</span>;
}

export function DashboardSignalEmpty({
  title,
  description,
  role = 'status',
}: Readonly<{
  title: string;
  description?: string;
  role?: 'status' | 'alert';
}>) {
  return (
    <div className="border-t border-border/60 bg-muted/[0.08] px-3.5 py-3 sm:px-4" role={role} data-dashboard-signal-empty>
      <p className="text-xs font-bold text-foreground">{title}</p>
      {description ? <p className="mt-0.5 hidden text-[11px] leading-4 text-muted-foreground sm:block">{description}</p> : null}
    </div>
  );
}

export function DashboardSignalLoading({ label }: Readonly<{ label: string }>) {
  return (
    <div className="border-t border-border/60 px-3.5 py-3 sm:px-4" aria-label={label}>
      <div className="h-10 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

export const dashboardSectionActionClass =
  'rounded-lg px-2 py-1 text-[11px] font-bold text-primary outline-none transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/25';
