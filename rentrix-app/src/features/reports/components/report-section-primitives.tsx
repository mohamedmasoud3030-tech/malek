import type { LucideIcon } from 'lucide-react';
import { AlertCircle, Inbox, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type ReportPanelProps = Readonly<{
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
  isLoading?: boolean;
  className?: string;
  contentClassName?: string;
  eyebrow?: string;
}>;

export function ReportPanel({
  title,
  description,
  icon: Icon,
  action,
  children,
  isLoading = false,
  className,
  contentClassName,
  eyebrow,
}: ReportPanelProps) {
  return (
    <Card className={cn('min-w-0 overflow-hidden rounded-2xl border-border/60 shadow-card', className)}>
      <CardHeader className="flex flex-col gap-3 border-b border-border/60 bg-gradient-to-l from-primary/[0.045] via-transparent to-transparent px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:py-4">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-primary/15 bg-primary/10 text-primary shadow-sm">
              <Icon className="size-[1.125rem]" aria-hidden="true" />
            </span>
          ) : null}
          <div className="min-w-0">
            {eyebrow ? <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary">{eyebrow}</p> : null}
            <CardTitle className="text-sm font-extrabold sm:text-[15px]">{title}</CardTitle>
            {description ? <CardDescription className="mt-1 max-w-3xl leading-5">{description}</CardDescription> : null}
          </div>
        </div>
        {action ? <div className="shrink-0" data-print-actions>{action}</div> : null}
      </CardHeader>
      <CardContent className={cn('p-0', contentClassName)}>
        {isLoading ? <ReportPanelSkeleton /> : children}
      </CardContent>
    </Card>
  );
}

export function ReportPanelSkeleton({ className }: Readonly<{ className?: string }>) {
  return (
    <div className={cn('space-y-3 p-4 sm:p-5', className)} role="status" aria-live="polite" aria-label="جارٍ تحميل التقرير">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-16 w-4/5 rounded-xl" />
    </div>
  );
}

export function ReportState({
  kind = 'empty',
  title,
  message,
  className,
}: Readonly<{
  kind?: 'empty' | 'error';
  title?: string;
  message: string;
  className?: string;
}>) {
  const Icon = kind === 'error' ? AlertCircle : Inbox;
  return (
    <div
      className={cn(
        'flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-5 text-center text-sm sm:min-h-32',
        kind === 'error'
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-border/70 bg-muted/20 text-muted-foreground',
        className,
      )}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      <span className={cn(
        'grid size-10 place-items-center rounded-xl',
        kind === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-background text-muted-foreground shadow-sm',
      )}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="max-w-xl">
        {title ? <p className="font-bold text-foreground">{title}</p> : null}
        <p className={cn('leading-6', title && 'mt-1')}>{message}</p>
      </div>
    </div>
  );
}

export function ReportList({ children, className }: Readonly<{ children: React.ReactNode; className?: string }>) {
  return <div className={cn('divide-y divide-border/60', className)}>{children}</div>;
}

export function ReportListRow({
  title,
  subtitle,
  value,
  meta,
  action,
  className,
}: Readonly<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  value?: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}>) {
  return (
    <div className={cn(
      'grid min-w-0 gap-2 px-4 py-3.5 transition-colors hover:bg-muted/25 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5',
      className,
    )}>
      <div className="min-w-0">
        <div className="break-words text-sm font-bold leading-5">{title}</div>
        {subtitle ? <div className="mt-1 break-words text-xs leading-5 text-muted-foreground">{subtitle}</div> : null}
        {meta ? <div className="mt-2 text-xs text-muted-foreground sm:hidden">{meta}</div> : null}
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        {meta ? <div className="hidden text-xs text-muted-foreground sm:block">{meta}</div> : null}
        {value ? <div className="shrink-0 text-sm font-extrabold tabular-nums">{value}</div> : null}
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

export function ReportColumns({ children, className }: Readonly<{ children: React.ReactNode; className?: string }>) {
  return <div className={cn('grid gap-4 lg:grid-cols-2', className)}>{children}</div>;
}

export function ReportProgress({
  label,
  value,
  helper,
  tone = 'neutral',
}: Readonly<{
  label: string;
  value: number;
  helper?: string;
  tone?: 'good' | 'warning' | 'critical' | 'neutral';
}>) {
  const boundedValue = Math.max(0, Math.min(100, value));
  return (
    <div className="rounded-xl border border-border/60 bg-background p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold">{label}</p>
          {helper ? <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{helper}</p> : null}
        </div>
        <span className={cn(
          'rounded-lg px-2 py-1 text-xs font-extrabold tabular-nums',
          tone === 'good' && 'bg-success/10 text-success',
          tone === 'warning' && 'bg-warning/10 text-warning',
          tone === 'critical' && 'bg-danger/10 text-danger',
          tone === 'neutral' && 'bg-muted text-muted-foreground',
        )} dir="ltr">
          {Math.round(boundedValue)}%
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500',
            tone === 'good' && 'bg-success',
            tone === 'warning' && 'bg-warning',
            tone === 'critical' && 'bg-danger',
            tone === 'neutral' && 'bg-primary',
          )}
          style={{ width: `${boundedValue}%` }}
        />
      </div>
    </div>
  );
}

export function ReportInsightNote({
  title,
  children,
  className,
}: Readonly<{
  title: string;
  children: React.ReactNode;
  className?: string;
}>) {
  return (
    <div className={cn('rounded-2xl border border-primary/15 bg-primary/[0.045] p-4 text-sm leading-6', className)}>
      <div className="flex items-center gap-2 text-primary">
        <Sparkles className="size-4" aria-hidden="true" />
        <p className="font-extrabold">{title}</p>
      </div>
      <div className="mt-2 text-muted-foreground">{children}</div>
    </div>
  );
}
