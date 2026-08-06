/**
 * MALEK Visual Wave 2 — Finance & Reporting Visual Foundations
 *
 * This file provides presentation-only utilities that enforce Wave 2 contract:
 * - No business logic changes
 * - No accounting calculations
 * - No database / RLS / RPC changes
 * - Semantic tokens only
 * - KPI drill-down with filter preservation
 * - Desktop tables stay tables
 * - Mobile cards open detail
 * - Status semantics unified
 *
 * All components here are pure presentational wrappers.
 * Data fetching / mutations remain in existing hooks/services.
 */

import type { LucideIcon } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { KpiCard, type KpiAccent } from '@/components/ui/kpi-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { useCallback } from 'react';

// ─────────────────────────────────────────────
// Status semantics — unified mapping
// ─────────────────────────────────────────────

export type FinanceSemanticTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';

export type FinanceStatusKind =
  | 'posted'
  | 'paid'
  | 'success'
  | 'partial'
  | 'aging'
  | 'warning'
  | 'overdue'
  | 'blocked'
  | 'failed'
  | 'danger'
  | 'draft'
  | 'informational'
  | 'info'
  | 'archived'
  | 'void'
  | 'inactive'
  | 'neutral'
  | 'other';

const statusKindToTone: Record<FinanceStatusKind, FinanceSemanticTone> = {
  posted: 'success',
  paid: 'success',
  success: 'success',
  partial: 'warning',
  aging: 'warning',
  warning: 'warning',
  overdue: 'danger',
  blocked: 'danger',
  failed: 'danger',
  danger: 'danger',
  draft: 'info',
  informational: 'info',
  info: 'info',
  archived: 'neutral',
  void: 'neutral',
  inactive: 'neutral',
  neutral: 'neutral',
  other: 'neutral',
};

export function getFinanceStatusTone(kind: FinanceStatusKind): FinanceSemanticTone {
  return statusKindToTone[kind] ?? 'neutral';
}

export function mapInvoiceStatusToFinanceKind(rawStatus: string | null | undefined): FinanceStatusKind {
  const s = (rawStatus ?? '').toLowerCase().trim();
  if (['paid', 'posted'].includes(s)) return 'paid';
  if (['partial', 'partially_paid'].includes(s)) return 'partial';
  if (['overdue'].includes(s)) return 'overdue';
  if (['unpaid', 'open', 'draft'].includes(s)) return s === 'draft' ? 'draft' : 'info';
  if (['cancelled', 'void', 'archived'].includes(s)) return 'archived';
  if (['failed', 'blocked'].includes(s)) return 'failed';
  return 'other';
}

export function mapExpenseStatusToFinanceKind(status: string | null | undefined): FinanceStatusKind {
  const s = (status ?? '').toLowerCase();
  if (s === 'paid' || s === 'approved') return 'success';
  if (s === 'pending' || s === 'partial') return 'warning';
  if (s === 'overdue' || s === 'rejected') return 'danger';
  if (s === 'draft') return 'draft';
  if (s === 'void' || s === 'cancelled') return 'archived';
  return 'neutral';
}

export function mapCommissionStatusToFinanceKind(status: string | null | undefined): FinanceStatusKind {
  const s = (status ?? '').toLowerCase();
  if (s === 'paid') return 'paid';
  if (s === 'approved') return 'info';
  if (s === 'pending') return 'partial';
  if (s === 'cancelled') return 'archived';
  return 'neutral';
}

export function mapBankLineStatusToFinanceKind(status: string | null | undefined): FinanceStatusKind {
  const s = (status ?? '').toLowerCase();
  if (s === 'matched') return 'success';
  if (s === 'ignored') return 'archived';
  if (s === 'unmatched') return 'warning';
  return 'neutral';
}

export function mapDepositStatusToFinanceKind(status: string | null | undefined): FinanceStatusKind {
  const s = (status ?? '').toLowerCase();
  if (s === 'refunded') return 'success';
  if (s === 'held') return 'info';
  if (s === 'partial') return 'warning';
  if (s === 'void') return 'archived';
  return 'neutral';
}

// ─────────────────────────────────────────────
// Finance Status Badge — unified
// ─────────────────────────────────────────────

type FinanceStatusBadgeProps = Readonly<{
  kind: FinanceStatusKind;
  label: string;
  withDot?: boolean;
  className?: string;
}>;

export function FinanceStatusBadge({ kind, label, withDot = true, className }: FinanceStatusBadgeProps) {
  const tone = getFinanceStatusTone(kind);
  return (
    <span data-finance-status data-kind={kind} className={cn('inline-flex items-center', className)}>
      <StatusBadge tone={tone} dot={withDot} className="gap-1.5">
        {withDot ? <span data-finance-status-icon aria-hidden="true" /> : null}
        <span>{label}</span>
      </StatusBadge>
    </span>
  );
}

// ─────────────────────────────────────────────
// Filter preservation utilities
// ─────────────────────────────────────────────

export type FinanceFilterContext = Record<string, unknown>;

export function preserveFinanceFilters(
  currentSearch: FinanceFilterContext,
  updates: FinanceFilterContext,
): FinanceFilterContext {
  return {
    ...currentSearch,
    ...updates,
  };
}

export function buildDrillDownSearch(
  currentSearch: FinanceFilterContext,
  drillParams: FinanceFilterContext,
): FinanceFilterContext {
  // Preserve period, property, owner, tenant, status, existing filters
  const preservedKeys = ['dateFrom', 'dateTo', 'propertyId', 'tenantId', 'ownerId', 'status', 'section', 'asOf', 'costCenterId', 'contractId'];
  const preserved: FinanceFilterContext = {};
  for (const key of preservedKeys) {
    if (currentSearch[key] !== undefined && currentSearch[key] !== '') {
      preserved[key] = currentSearch[key];
    }
  }
  return {
    ...preserved,
    ...drillParams,
  };
}

// ─────────────────────────────────────────────
// Finance KPI Card with drill-down
// ─────────────────────────────────────────────

type FinanceKpiCardProps = Readonly<{
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  accent?: KpiAccent;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  // Drill-down destination — if provided, card becomes clickable
  drillTo?: string;
  drillSearch?: FinanceFilterContext;
  drillAriaLabel?: string;
  // For when drill is within same page (filter change)
  onDrill?: () => void;
  className?: string;
  // Unit for accessibility
  unit?: string;
}>;

export function FinanceKpiCard({
  label,
  value,
  sub,
  icon,
  accent = 'primary',
  trend,
  trendValue,
  drillTo,
  drillSearch,
  drillAriaLabel,
  onDrill,
  className,
  unit,
}: FinanceKpiCardProps) {
  const isDrillable = Boolean(drillTo || onDrill);

  const cardContent = (
    <KpiCard
      label={label}
      value={value}
      sub={sub}
      icon={icon}
      accent={accent}
      trend={trend}
      trendValue={trendValue}
      className={cn(className, 'transition-shadow focus-visible:outline-none')}
    />
  );

  // If drillTo is provided, wrap with Link preserving filters
  if (drillTo) {
    return (
      <Link
        to={drillTo as never}
        search={drillSearch as never}
        aria-label={drillAriaLabel ?? `${label}: ${value}${unit ? ` ${unit}` : ''} — عرض التفاصيل`}
        data-finance-kpi-drill
        data-drillable={isDrillable ? 'true' : 'false'}
        className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <div data-finance-kpi-grid data-drillable={isDrillable ? 'true' : 'false'} className="h-full">
          {cardContent}
        </div>
      </Link>
    );
  }

  if (onDrill) {
    return (
      <button
        type="button"
        onClick={onDrill}
        aria-label={drillAriaLabel ?? `${label}: ${value}${unit ? ` ${unit}` : ''} — عرض التفاصيل`}
        data-finance-kpi-drill
        data-drillable={isDrillable ? 'true' : 'false'}
        className="block w-full rounded-xl text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <div data-finance-kpi-grid data-drillable={isDrillable ? 'true' : 'false'} className="h-full">
          {cardContent}
        </div>
      </button>
    );
  }

  return <div data-finance-kpi-grid className="h-full">{cardContent}</div>;
}

// ─────────────────────────────────────────────
// Finance Page Hierarchy shells
// ─────────────────────────────────────────────

export function FinancePageRoot({
  children,
  className,
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  return (
    <div
      data-finance-root
      data-visual-wave="malek-pro"
      className={cn('min-w-0 overflow-x-clip', className)}
    >
      {children}
    </div>
  );
}

export function FinanceSection({
  children,
  ariaLabel,
  className,
}: Readonly<{ children: React.ReactNode; ariaLabel: string; className?: string }>) {
  return (
    <section aria-label={ariaLabel} data-finance-section className={cn('space-y-3', className)}>
      {children}
    </section>
  );
}

export function FinanceCluster({
  children,
  className,
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  return (
    <div data-finance-cluster className={cn('space-y-3', className)}>
      {children}
    </div>
  );
}

export function FinanceKpiGrid({
  children,
  desktopColumns = 4,
  className,
}: Readonly<{ children: React.ReactNode; desktopColumns?: 2 | 3 | 4 | 5 | 6; className?: string }>) {
  return (
    <div
      data-finance-kpi-grid
      className={cn(
        'grid gap-3',
        desktopColumns === 2 && 'sm:grid-cols-2',
        desktopColumns === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        desktopColumns === 4 && 'sm:grid-cols-2 lg:grid-cols-4',
        desktopColumns === 5 && 'sm:grid-cols-2 lg:grid-cols-5',
        desktopColumns === 6 && 'sm:grid-cols-2 lg:grid-cols-6',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FinanceFilterBar({
  children,
  actions,
  ariaLabel = 'فلاتر المالية',
  className,
}: Readonly<{
  children: React.ReactNode;
  actions?: React.ReactNode;
  ariaLabel?: string;
  className?: string;
}>) {
  return (
    <div
      data-finance-filter-bar
      aria-label={ariaLabel}
      className={cn('space-y-3', className)}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">{children}</div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function FinanceTableWrapper({
  children,
  ariaLabel,
  className,
}: Readonly<{ children: React.ReactNode; ariaLabel: string; className?: string }>) {
  return (
    <div
      data-finance-table-wrapper
      data-entity-table-wrapper
      aria-label={ariaLabel}
      className={cn('overflow-hidden rounded-2xl border bg-card shadow-card', className)}
    >
      <div
        data-entity-table-scroll
        tabIndex={0}
        role="region"
        aria-label={`${ariaLabel} — منطقة جدول قابلة للتمرير أفقياً عند الحاجة`}
        className="overflow-x-auto focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
      >
        {children}
      </div>
    </div>
  );
}

export function FinanceMobileCard({
  title,
  subtitle,
  badge,
  amount,
  statusLabel,
  date,
  counterparty,
  onOpenDetail,
  primaryAction,
  secondaryActions,
  stats,
  footer,
  className,
}: Readonly<{
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  amount: React.ReactNode;
  statusLabel?: string;
  date?: string;
  counterparty?: string;
  onOpenDetail?: () => void;
  primaryAction?: React.ReactNode;
  secondaryActions?: React.ReactNode;
  stats?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}>) {
  return (
    <div
      data-finance-mobile-card
      data-mobile-card
      className={cn(
        'rounded-2xl border bg-card p-4 text-right shadow-card transition-shadow hover:shadow-card-hover',
        className,
      )}
    >
      <button
        type="button"
        onClick={onOpenDetail}
        aria-label={`${title} — فتح التفاصيل`}
        className="w-full text-right focus-visible:outline-none"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{title}</p>
            {subtitle ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p> : null}
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              {date ? (
                <div className="rounded-lg bg-muted/40 p-2">
                  <span className="block text-[10px] text-muted-foreground">التاريخ</span>
                  <span className="mt-0.5 block font-bold">{date}</span>
                </div>
              ) : null}
              {counterparty ? (
                <div className="rounded-lg bg-muted/40 p-2">
                  <span className="block text-[10px] text-muted-foreground">الطرف</span>
                  <span className="mt-0.5 block truncate font-bold">{counterparty}</span>
                </div>
              ) : null}
              {amount ? (
                <div className="col-span-2 rounded-lg bg-primary/5 p-2 ring-1 ring-primary/10">
                  <span className="block text-[10px] font-bold text-muted-foreground">المبلغ</span>
                  <span data-finance-amount className="mt-0.5 block text-sm font-black tabular-nums">
                    {amount}
                  </span>
                  {statusLabel ? <span className="mt-1 block text-[11px] text-muted-foreground">{statusLabel}</span> : null}
                </div>
              ) : null}
            </div>
          </div>
          {badge ? <div className="shrink-0">{badge}</div> : null}
        </div>
      </button>

      {stats ? <div className="mt-3">{stats}</div> : null}

      {(primaryAction || secondaryActions) ? (
        <div className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3">
          {primaryAction ? (
            <div data-mobile-primary-action className="w-full">
              {primaryAction}
            </div>
          ) : null}
          {secondaryActions ? (
            <div data-mobile-secondary-actions className="flex flex-wrap gap-2">
              {secondaryActions}
            </div>
          ) : null}
        </div>
      ) : null}

      {footer ? <div className="mt-3 text-xs text-muted-foreground">{footer}</div> : null}
    </div>
  );
}

// ─────────────────────────────────────────────
// Finance alert — critical alerts / blocked actions
// ─────────────────────────────────────────────

export function FinanceAlert({
  tone = 'info',
  title,
  description,
  action,
  role = 'status',
}: Readonly<{
  tone?: FinanceSemanticTone;
  title: string;
  description?: string;
  action?: React.ReactNode;
  role?: 'alert' | 'status';
}>) {
  return (
    <div
      data-finance-alert
      data-tone={tone}
      role={role}
      className={cn(
        'rounded-2xl border p-3 text-sm leading-6',
        tone === 'danger' && 'border-destructive/25 bg-destructive/5 text-destructive',
        tone === 'warning' && 'border-warning/25 bg-warning/10 text-warning',
        tone === 'success' && 'border-success/25 bg-success/5 text-success',
        tone === 'info' && 'border-info/25 bg-info/5 text-info',
        tone === 'neutral' && 'border-border bg-muted/30 text-muted-foreground',
        tone === 'primary' && 'border-primary/25 bg-primary/5 text-primary',
      )}
    >
      <p className="font-bold">{title}</p>
      {description ? <p className="mt-1 text-xs leading-5 opacity-90">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

// ─────────────────────────────────────────────
// Finance numeric LTR island
// ─────────────────────────────────────────────

export function FinanceAmount({
  children,
  className,
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  return (
    <span data-finance-amount dir="ltr" className={cn('inline-block tabular-nums font-bold', className)}>
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────
// State components — explicit loading/empty/error
// ─────────────────────────────────────────────

export function FinanceLoadingState({ label = 'جارٍ تحميل البيانات المالية...' }: { label?: string }) {
  return (
    <div
      data-finance-loading
      data-finance-state="loading"
      role="status"
      aria-label={label}
      aria-live="polite"
      className="rounded-2xl border border-dashed bg-muted/20 p-6 text-center"
    >
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <div className="mt-3 flex justify-center gap-2" aria-hidden="true">
        <span className="size-2 animate-pulse rounded-full bg-muted-foreground/30" />
        <span className="size-2 animate-pulse rounded-full bg-muted-foreground/30 [animation-delay:150ms]" />
        <span className="size-2 animate-pulse rounded-full bg-muted-foreground/30 [animation-delay:300ms]" />
      </div>
    </div>
  );
}

export function FinanceErrorState({
  title = 'تعذر تحميل البيانات المالية',
  description = 'راجع الاتصال أو الصلاحيات ثم أعد المحاولة.',
  onRetry,
}: Readonly<{ title?: string; description?: string; onRetry?: () => void }>) {
  return (
    <div
      data-finance-error
      data-finance-state="error"
      role="alert"
      aria-live="assertive"
      className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4"
    >
      <p className="text-sm font-bold text-destructive">{title}</p>
      <p className="mt-1 text-xs leading-5 text-destructive/80">{description}</p>
      {onRetry ? (
        <Button variant="secondary" className="mt-3 min-h-11" onClick={onRetry}>
          إعادة المحاولة
        </Button>
      ) : null}
    </div>
  );
}

export function FinanceEmptyState({
  title,
  description,
  action,
}: Readonly<{ title: string; description?: string; action?: React.ReactNode }>) {
  return (
    <div
      data-finance-empty
      data-finance-state="empty"
      role="status"
      className="rounded-2xl border bg-card p-6 text-center shadow-card"
    >
      <p className="text-sm font-bold">{title}</p>
      {description ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
