import type { LucideIcon } from 'lucide-react';
import { AlertCircle, ArrowLeft, Inbox, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { SemanticTone } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

/** Semantic tint for the panel's icon tile. `primary` is the report default. */
export type ReportPanelTone = Exclude<SemanticTone, 'secondary'>;

const panelIconTone: Record<ReportPanelTone, string> = {
  primary: 'border border-primary/15 bg-primary/10 text-primary shadow-sm',
  neutral: 'bg-muted text-muted-foreground ring-1 ring-current/10',
  info: 'bg-info-bg text-info-text ring-1 ring-current/10',
  success: 'bg-success-bg text-success-text ring-1 ring-current/10',
  warning: 'bg-warning-bg text-warning-text ring-1 ring-current/10',
  danger: 'bg-danger-bg text-danger-text ring-1 ring-current/10',
};

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
  /** Semantic tint of the icon tile — lets a signal panel carry urgency. */
  tone?: ReportPanelTone;
  /**
   * Command-center density: one compact header row (icon + title + trailing
   * action on a single line) instead of the roomier report header. Used by the
   * Today dashboard so it stays a brief, not a card gallery.
   */
  dense?: boolean;
  /** Element id applied to the title so the panel can be `aria-labelledby`. */
  titleId?: string;
  /** Accessible name for the panel's own loading state. */
  loadingLabel?: string;
  'aria-labelledby'?: string;
  'aria-label'?: string;
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
  tone = 'primary',
  dense = false,
  titleId,
  loadingLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-label': ariaLabel,
}: ReportPanelProps) {
  return (
    <Card
      data-report-panel
      data-report-panel-density={dense ? 'dense' : undefined}
      role={ariaLabelledBy || ariaLabel ? 'region' : undefined}
      aria-labelledby={ariaLabelledBy}
      aria-label={ariaLabel}
      className={cn('relative min-w-0 overflow-hidden rounded-2xl border-border/60 shadow-card', className)}
    >
      <CardHeader
        className={cn(
          'border-b border-border/60',
          dense
            ? 'flex min-h-12 flex-row items-center justify-between gap-3 px-3.5 py-2.5 sm:min-h-14 sm:px-4 lg:min-h-12 lg:py-2'
            : 'flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:py-4',
        )}
      >
        <div className={cn('flex min-w-0 gap-3', dense ? 'items-center gap-2.5 sm:gap-3' : 'items-start')}>
          {Icon ? (
            <span
              className={cn(
                'grid shrink-0 place-items-center',
                dense ? 'size-9 rounded-lg' : 'size-10 rounded-xl',
                panelIconTone[tone],
              )}
            >
              <Icon className={dense ? 'size-4' : 'size-[1.125rem]'} aria-hidden="true" />
            </span>
          ) : null}
          <div className="min-w-0">
            {eyebrow ? <p className="mb-1 text-xs font-extrabold text-primary">{eyebrow}</p> : null}
            <CardTitle
              id={titleId}
              className={cn(
                'font-extrabold',
                dense ? 'truncate text-[13.5px] leading-5 sm:text-sm' : 'text-sm sm:text-[15px]',
              )}
            >
              {title}
            </CardTitle>
            {description ? (
              <CardDescription
                className={cn(
                  dense
                    ? 'mt-0.5 line-clamp-1 text-[11px] font-medium leading-4'
                    : 'mt-1 max-w-3xl leading-5',
                )}
              >
                {description}
              </CardDescription>
            ) : null}
          </div>
        </div>
        {action ? (
          <div className={cn('shrink-0', dense && 'flex items-center gap-1.5 text-xs')} data-print-actions>
            {action}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className={cn('p-0', contentClassName)}>{isLoading ? <ReportPanelSkeleton ariaLabel={loadingLabel} /> : children}</CardContent>
    </Card>
  );
}

export function ReportPanelSkeleton({ className, ariaLabel = 'جارٍ تحميل التقرير' }: Readonly<{ className?: string; ariaLabel?: string }>) {
  return <div className={cn('space-y-3 p-4 sm:p-5', className)} role="status" aria-live="polite" aria-label={ariaLabel}><Skeleton className="h-4 w-36" /><Skeleton className="h-16 w-full rounded-xl" /><Skeleton className="h-16 w-full rounded-xl" /><Skeleton className="h-16 w-4/5 rounded-xl" /></div>;
}

export function ReportState({ kind = 'empty', title, message, className }: Readonly<{ kind?: 'empty' | 'error'; title?: string; message: string; className?: string }>) {
  const Icon = kind === 'error' ? AlertCircle : Inbox;
  return <div className={cn('flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-5 text-center text-sm sm:min-h-32', kind === 'error' ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-border/70 bg-muted/20 text-muted-foreground', className)} role={kind === 'error' ? 'alert' : 'status'}><span className={cn('grid size-10 place-items-center rounded-xl', kind === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-background text-muted-foreground shadow-sm')}><Icon className="size-5" aria-hidden="true" /></span><div className="max-w-xl">{title ? <p className="font-bold text-foreground">{title}</p> : null}<p className={cn('leading-6', title && 'mt-1')}>{message}</p></div></div>;
}

export type ReportDrillActionProps = Readonly<{
  /** Business-language destination, e.g. "المتأخرات والأعمار". */
  label: string;
  onClick: () => void;
  /** `outline` for a panel header action, `ghost` for an in-row affordance. */
  variant?: 'outline' | 'ghost';
  /** Required when the visible label is not descriptive on its own. */
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}>;

/**
 * The one drill-through affordance for report surfaces.
 *
 * Every report body needs the same control — "open the workspace that owns
 * this detail" — and each one had grown its own version: a bordered native
 * element here, an ad-hoc shared-button + arrow combination there, each with a
 * different size, weight and arrow treatment. This is that control, once: the
 * canonical MALEK `Button`, the 44px minimum touch target, and a single
 * forward-arrow convention for the RTL reading direction.
 *
 * It routes only. It never computes, formats or re-states a figure, so it
 * cannot become a second place where a report's numbers live.
 */
export function ReportDrillAction({ label, onClick, variant = 'outline', ariaLabel, disabled = false, className }: ReportDrillActionProps) {
  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      data-report-drill
      className={cn('min-h-11 shrink-0 gap-1.5 text-xs font-black text-primary', className)}
    >
      {label}
      <ArrowLeft className="size-3.5 shrink-0" aria-hidden="true" />
    </Button>
  );
}

export type ReportSegmentedTabItem<TId extends string> = Readonly<{
  id: TId;
  label: string;
  /** Optional quiet second line (e.g. "12 حساب"). */
  sub?: string;
  icon?: LucideIcon;
}>;

/**
 * The one segmented switcher for report bodies that hold several equally
 * weighted panels (the accounting statements, the general-ledger workspaces).
 *
 * Both of those surfaces had grown a byte-identical local implementation of
 * this control — same grid, same muted track, same active card treatment —
 * differing only in whether a second line was rendered. This is that control
 * once: canonical 44px targets, correct `tablist`/`tab` semantics wired to the
 * caller's panel ids, and a single active-state grammar.
 *
 * It switches panels only. It never owns data or formatting.
 */
export function ReportSegmentedTabs<TId extends string>({
  items,
  activeId,
  onChange,
  ariaLabel,
  panelIdPrefix,
  className,
}: Readonly<{
  items: ReadonlyArray<ReportSegmentedTabItem<TId>>;
  activeId: TId;
  onChange: (id: NoInfer<TId>) => void;
  ariaLabel: string;
  /** Panel element ids follow `${panelIdPrefix}-${item.id}`. */
  panelIdPrefix: string;
  className?: string;
}>) {
  return (
    <div
      className={cn('grid gap-1 rounded-xl border border-border/60 bg-muted/20 p-1', className)}
      style={{ gridTemplateColumns: `repeat(${Math.max(1, items.length)}, minmax(0, 1fr))` }}
      role="tablist"
      aria-label={ariaLabel}
      data-report-segmented-tabs
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`${panelIdPrefix}-${item.id}`}
            onClick={() => onChange(item.id)}
            className={cn(
              'flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-start transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
              isActive ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground hover:bg-background/80 hover:text-foreground',
            )}
          >
            {Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
            <span className="min-w-0">
              <span className="block truncate text-xs font-black">{item.label}</span>
              {item.sub ? <span className="block truncate text-[10px] font-bold text-muted-foreground">{item.sub}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Canonical divided list inside a panel.
 *
 * `as="ul"` keeps real list semantics for ranked queues (the Today dashboard's
 * «يحتاج انتباهك» and longest-vacancies lists); the default `div` stays for
 * report bodies that group heterogeneous rows.
 */
export function ReportList({
  children,
  className,
  as: Component = 'div',
  label,
}: Readonly<{ children: React.ReactNode; className?: string; as?: 'div' | 'ul'; label?: string }>) {
  return (
    <Component
      className={cn('divide-y divide-border/60', className)}
      role={Component === 'ul' ? 'list' : undefined}
      aria-label={label}
    >
      {children}
    </Component>
  );
}

/** Semantic tint rendered as a leading (RTL: start) stripe on a row. */
export type ReportRowTone = Exclude<SemanticTone, 'primary' | 'secondary'>;

const rowToneStripe: Record<ReportRowTone, string> = {
  neutral: 'border-s-transparent',
  info: 'border-s-info-text/55',
  success: 'border-s-success-text/55',
  warning: 'border-s-warning-text/55',
  danger: 'border-s-danger-text/60',
};

/**
 * Canonical panel row.
 *
 * `dense` is the command-center rhythm (50px minimum row, 13/11px type) used by
 * the Today dashboard; the default stays the roomier report rhythm. `tone`
 * expresses urgency with a start stripe plus the row's own text — never colour
 * alone. `as="li"` lets a ranked queue keep real list semantics.
 *
 * The row is presentational: when it is clickable, the caller wraps it in the
 * canonical `Link`/`Button` that owns navigation and the focus ring.
 */
export function ReportListRow({
  title,
  subtitle,
  value,
  meta,
  action,
  className,
  dense = false,
  tone,
  as: Component = 'div',
}: Readonly<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  value?: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  dense?: boolean;
  tone?: ReportRowTone;
  as?: 'div' | 'li';
}>) {
  return (
    <Component
      className={cn(
        'grid min-w-0 transition-colors hover:bg-muted/25',
        dense
          ? 'min-h-[3.125rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-2 sm:px-4'
          : 'gap-2 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5',
        tone ? cn('border-s-2', rowToneStripe[tone]) : undefined,
        className,
      )}
    >
      <div className="min-w-0">
        <div className={cn('break-words font-bold', dense ? 'truncate text-[13px] leading-5' : 'text-sm leading-5')}>{title}</div>
        {subtitle ? (
          <div className={cn('break-words text-muted-foreground', dense ? 'mt-0.5 truncate text-[11px] font-medium leading-4' : 'mt-1 text-xs leading-5')}>
            {subtitle}
          </div>
        ) : null}
        {meta ? (
          <div className={cn('text-muted-foreground sm:hidden', dense ? 'mt-0.5 truncate text-[11px] leading-4' : 'mt-2 text-xs')}>
            {meta}
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        {meta ? (
          <div className={cn('hidden text-muted-foreground sm:block', dense ? 'text-[11px]' : 'text-xs')}>{meta}</div>
        ) : null}
        {value ? (
          <div className={cn('shrink-0 font-extrabold tabular-nums', dense ? 'text-[13px]' : 'text-sm')}>{value}</div>
        ) : null}
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </Component>
  );
}

export function ReportColumns({ children, className }: Readonly<{ children: React.ReactNode; className?: string }>) {
  return <div className={cn('grid gap-4 lg:grid-cols-2', className)}>{children}</div>;
}

export function ReportProgress({ label, value, helper, tone = 'neutral' }: Readonly<{ label: string; value: number; helper?: string; tone?: 'good' | 'warning' | 'critical' | 'neutral' }>) {
  const boundedValue = Math.max(0, Math.min(100, value));
  return <div data-report-visual className="rounded-xl border border-border/60 bg-background p-3.5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold">{label}</p>{helper ? <p className="mt-1 text-xs leading-4 text-muted-foreground">{helper}</p> : null}</div><span className={cn('rounded-lg px-2 py-1 text-xs font-extrabold tabular-nums', tone === 'good' && 'bg-success/10 text-success', tone === 'warning' && 'bg-warning/10 text-warning', tone === 'critical' && 'bg-danger/10 text-danger', tone === 'neutral' && 'bg-muted text-muted-foreground')} dir="ltr">{Math.round(boundedValue)}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full transition-[width] duration-500', tone === 'good' && 'bg-success', tone === 'warning' && 'bg-warning', tone === 'critical' && 'bg-danger', tone === 'neutral' && 'bg-primary')} style={{ width: `${boundedValue}%` }} /></div></div>;
}

export function ReportInsightNote({ title, children, className }: Readonly<{ title: string; children: React.ReactNode; className?: string }>) {
  return <div data-report-insight className={cn('rounded-2xl border border-primary/15 bg-primary/[0.045] p-4 text-sm leading-6', className)}><div className="flex items-center gap-2 text-primary"><Sparkles className="size-4" aria-hidden="true" /><p className="font-extrabold">{title}</p></div><div className="mt-2 text-muted-foreground">{children}</div></div>;
}

export type ReportSummaryItem = Readonly<{
  label: string;
  value: string;
  detail?: string;
  tone?: 'default' | 'good' | 'warning' | 'critical';
}>;

/**
 * Compact contextual executive strip. One report, a handful of relevant figures,
 * no dashboard card grid. Reads as a single quiet line under the report header;
 * on mobile it collapses to a horizontally scrollable row.
 */
export function ReportSummaryStrip({ items, className, dataReportSummary }: Readonly<{ items: readonly ReportSummaryItem[]; className?: string; dataReportSummary?: string }>) {
  return (
    <div
      data-report-summary={dataReportSummary}
      className={cn('no-scrollbar -mx-1 flex items-stretch gap-x-1 overflow-x-auto overscroll-x-contain px-1 sm:mx-0 sm:flex-wrap sm:gap-x-0 sm:overflow-visible sm:px-0', className)}
    >
      {items.map((item, index) => (
        <div
          key={item.label}
          className={cn(
            'min-w-max shrink-0 border-border/60 px-1 py-1 sm:px-3 sm:py-0',
            'sm:border-e sm:last:border-e-0',
            index > 0 && 'border-s sm:border-s-0',
            item.tone === 'warning' && 'text-warning',
            item.tone === 'critical' && 'text-danger',
            item.tone === 'good' && 'text-success',
          )}
        >
          <p className="text-[11px] font-bold leading-4 text-muted-foreground sm:text-xs">{item.label}</p>
          <p className="mt-0.5 text-sm font-black leading-5 tabular-nums" dir="ltr">{item.value}</p>
          {item.detail ? <p className="mt-0.5 whitespace-nowrap text-[11px] font-medium leading-4 text-muted-foreground">{item.detail}</p> : null}
        </div>
      ))}
    </div>
  );
}


