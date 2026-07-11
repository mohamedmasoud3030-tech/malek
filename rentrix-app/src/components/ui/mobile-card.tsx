import type { KeyboardEvent, MouseEvent, ReactNode, CSSProperties } from 'react';
import { cn } from '@/lib/utils';

export interface MobileCardProps {
  /** Card title - required */
  title: ReactNode;
  /** Optional subtitle below title */
  subtitle?: ReactNode;
  /** Badge/status indicator - typically StatusBadge */
  badge?: ReactNode;
  /** Meta information section (details, tags, etc.) */
  meta?: ReactNode;
  /** Statistics section (amounts, counts, etc.) */
  stats?: ReactNode;
  /** Action buttons row */
  actions?: ReactNode;
  /** Footer text */
  footer?: ReactNode;
  /** Click handler for interactive cards */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Card style variant */
  variant?: 'default' | 'outlined' | 'filled' | 'elevated';
  /** Card accent color (border-left indicator) */
  accent?: 'primary' | 'success' | 'warning' | 'danger' | 'none';
  /** Whether to show skeleton loading state */
  loading?: boolean;
  /** Children rendered inside card body */
  children?: ReactNode;
}

const accentColors: Record<NonNullable<MobileCardProps['accent']>, string> = {
  primary: 'border-l-primary bg-primary/5 dark:bg-primary/10',
  success: 'border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30',
  warning: 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/30',
  danger: 'border-l-red-500 bg-red-50/50 dark:bg-red-950/30',
  none: '',
};

const variantStyles: Record<NonNullable<MobileCardProps['variant']>, string> = {
  default: 'border bg-card shadow-sm',
  outlined: 'border-2 border-border bg-transparent',
  filled: 'bg-muted/30 border-transparent',
  elevated: 'border bg-card shadow-lg',
};

/**
 * Enhanced mobile card with better touch targets and responsive behavior.
 * Use for entity cards in mobile-first lists.
 */
export function MobileCard({
  title,
  subtitle,
  badge,
  meta,
  stats,
  actions,
  footer,
  onClick,
  className,
  variant = 'default',
  accent = 'none',
  loading = false,
  children,
}: MobileCardProps) {
  const interactive = typeof onClick === 'function';

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.();
    }
  };

  const stopActions = (event: MouseEvent | KeyboardEvent) => {
    event.stopPropagation();
  };

  if (loading) {
    return (
      <div className={cn('rounded-2xl border bg-card p-4', className)}>
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-2/3 rounded bg-muted" />
          <div className="h-3 w-1/3 rounded bg-muted" />
          <div className="h-12 rounded bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'rounded-2xl p-4 transition-all duration-150',
        variantStyles[variant],
        accent !== 'none' && 'border-l-4',
        accentColors[accent],
        interactive && 'cursor-pointer hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.99]',
        className,
      )}
    >
      {/* Header: Title + Badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-black text-foreground">{title}</div>
          {subtitle && (
            <div className="mt-0.5 truncate text-xs font-bold text-muted-foreground">
              {subtitle}
            </div>
          )}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>

      {/* Meta: Details and tags */}
      {meta && <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">{meta}</div>}

      {/* Stats: Financial figures and numbers */}
      {stats && <div className="mt-3">{stats}</div>}

      {/* Custom children */}
      {children}

      {/* Actions: Buttons row with proper touch targets */}
      {actions && (
        <div
          className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3"
          onClick={stopActions}
          onKeyDown={stopActions}
          role="presentation"
        >
          {actions}
        </div>
      )}

      {/* Footer: Subtle text */}
      {footer && (
        <div className="mt-3 text-[11px] font-bold text-muted-foreground">{footer}</div>
      )}
    </div>
  );
}

// ============================================================
// Stat Card Component (for dashboard-like displays)
// ============================================================

export interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: 'primary' | 'success' | 'warning' | 'danger';
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'primary',
  trend,
  className,
}: StatCardProps) {
  const accentStyles = {
    primary: 'text-primary',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    danger: 'text-red-600',
  };

  const trendIcons = {
    up: '↑',
    down: '↓',
    neutral: '→',
  };

  return (
    <MobileCard
      className={cn('border-t-4 border-t-current', className)}
      variant="default"
      title={
        <div className="flex items-center justify-between gap-2">
          <span>{label}</span>
          {Icon && <Icon className={cn('size-5', accentStyles[accent])} />}
        </div>
      }
      stats={
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black">{value}</span>
          {trend && (
            <span className={cn(
              'text-sm',
              trend === 'up' && 'text-emerald-600',
              trend === 'down' && 'text-red-600',
              trend === 'neutral' && 'text-muted-foreground',
            )}>
              {trendIcons[trend]}
            </span>
          )}
        </div>
      }
      footer={sub}
    />
  );
}

// ============================================================
// List Item Card (compact single-line cards)
// ============================================================

export interface ListItemCardProps {
  title: string;
  subtitle?: string;
  leftIcon?: ReactNode;
  rightElement?: ReactNode;
  badge?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function ListItemCard({
  title,
  subtitle,
  leftIcon,
  rightElement,
  badge,
  onClick,
  className,
}: ListItemCardProps) {
  const interactive = typeof onClick === 'function';
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex items-center justify-between gap-3 rounded-xl border bg-card p-3 transition-colors',
        interactive && 'cursor-pointer hover:bg-muted/50 active:bg-muted',
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {leftIcon && (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {leftIcon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-sm">{title}</p>
          {subtitle && (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badge}
        {rightElement}
      </div>
    </div>
  );
}
