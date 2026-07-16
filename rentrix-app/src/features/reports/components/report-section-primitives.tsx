import type { LucideIcon } from 'lucide-react';
import { AlertCircle, Inbox } from 'lucide-react';
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
}: ReportPanelProps) {
  return (
    <Card className={cn('min-w-0 overflow-hidden border-border/60', className)}>
      <CardHeader className="flex flex-col gap-3 border-b border-border/60 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" aria-hidden="true" />
            </span>
          ) : null}
          <div className="min-w-0">
            <CardTitle className="text-sm font-bold">{title}</CardTitle>
            {description ? <CardDescription className="mt-1 leading-5">{description}</CardDescription> : null}
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
    <div className={cn('space-y-3 p-4', className)} role="status" aria-live="polite" aria-label="جارٍ تحميل التقرير">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

export function ReportState({
  kind = 'empty',
  message,
  className,
}: Readonly<{
  kind?: 'empty' | 'error';
  message: string;
  className?: string;
}>) {
  const Icon = kind === 'error' ? AlertCircle : Inbox;
  return (
    <div
      className={cn(
        'flex min-h-24 items-center gap-3 rounded-xl border border-dashed p-4 text-sm',
        kind === 'error'
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-border/70 bg-muted/20 text-muted-foreground',
        className,
      )}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
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
    <div className={cn('grid min-w-0 gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5', className)}>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{title}</div>
        {subtitle ? <div className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</div> : null}
        {meta ? <div className="mt-2 text-xs text-muted-foreground sm:hidden">{meta}</div> : null}
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        {meta ? <div className="hidden text-xs text-muted-foreground sm:block">{meta}</div> : null}
        {value ? <div className="shrink-0 text-sm font-bold tabular-nums">{value}</div> : null}
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

export function ReportColumns({ children, className }: Readonly<{ children: React.ReactNode; className?: string }>) {
  return <div className={cn('grid gap-4 lg:grid-cols-2', className)}>{children}</div>;
}
