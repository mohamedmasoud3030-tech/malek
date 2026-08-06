import type { KeyboardEvent, ReactNode } from 'react';
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
  /** Card accent color (logical inline-start border indicator) */
  accent?: 'primary' | 'success' | 'warning' | 'danger' | 'none';
  /** Whether to show skeleton loading state */
  loading?: boolean;
  /** Children rendered inside card body */
  children?: ReactNode;
}

const accentColors: Record<NonNullable<MobileCardProps['accent']>, string> = {
  primary: 'border-s-primary bg-primary/5',
  success: 'border-s-success bg-success-bg',
  warning: 'border-s-warning bg-warning-bg',
  danger: 'border-s-danger bg-danger-bg',
  none: '',
};

const variantStyles: Record<NonNullable<MobileCardProps['variant']>, string> = {
  default: 'border border-border/80 bg-card shadow-[0_8px_24px_hsl(var(--foreground)/0.055)]',
  outlined: 'border-2 border-border bg-transparent',
  filled: 'border border-transparent bg-muted/40',
  elevated: 'border border-border/70 bg-card shadow-[0_16px_38px_hsl(var(--foreground)/0.09)]',
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

  const handlePrimaryKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onClick?.();
  };

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-[15px] font-bold leading-6 text-foreground">{title}</div>
          {subtitle && (
            <div className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-muted-foreground">
              {subtitle}
            </div>
          )}
        </div>
        {badge && <div className="shrink-0 pt-0.5">{badge}</div>}
      </div>

      {meta && <div className="mt-3 rounded-2xl bg-muted/45 p-3 text-xs leading-5 text-muted-foreground">{meta}</div>}
      {stats && <div className="mt-3 rounded-2xl border border-border/60 bg-background/55 p-3">{stats}</div>}
      {children}
      {footer && (
        <div className="mt-3 text-[11px] font-bold leading-5 text-muted-foreground">{footer}</div>
      )}
    </>
  );

  if (loading) {
    return (
      <div data-mobile-card className={cn('rounded-3xl border bg-card p-4 shadow-sm', className)}>
        <div className="space-y-3">
          <div className="h-5 w-2/3 rounded bg-muted" />
          <div className="h-3 w-1/3 rounded bg-muted" />
          <div className="h-12 rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div
      data-mobile-card
      className={cn(
        'relative overflow-hidden rounded-3xl p-4 transition-all duration-150 motion-reduce:transition-none',
        variantStyles[variant],
        accent !== 'none' && 'border-s-4',
        accentColors[accent],
        className,
      )}
    >
      {interactive ? (
        <button
          data-mobile-card-primary
          type="button"
          role="button"
          onClick={onClick}
          onKeyDown={handlePrimaryKeyDown}
          className="block w-full cursor-pointer text-start outline-none focus-visible:rounded-2xl focus-visible:ring-4 focus-visible:ring-primary/20"
        >
          {content}
        </button>
      ) : (
        <div>{content}</div>
      )}

      {actions && (
        <div
          className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-3"
          role="presentation"
        >
          {actions}
        </div>
      )}
    </div>
  );
}

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
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
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
          <span className="text-2xl font-bold">{value}</span>
          {trend && (
            <span className={cn(
              'text-sm',
              trend === 'up' && 'text-success',
              trend === 'down' && 'text-danger',
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
  const content = (
    <>
      {leftIcon && (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {leftIcon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-bold">{title}</p>
        {subtitle && (
          <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </>
  );

  return (
    <div
      data-list-item-card
      className={cn(
        'flex items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card p-3 shadow-sm transition-colors motion-reduce:transition-none',
        className,
      )}
    >
      {interactive ? (
        <button
          type="button"
          role="button"
          onClick={onClick}
          className="flex min-w-0 flex-1 items-center gap-3 text-start outline-none focus-visible:rounded-xl focus-visible:ring-4 focus-visible:ring-primary/20"
        >
          {content}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{content}</div>
      )}
      <div className="flex shrink-0 items-center gap-2">
        {badge}
        {rightElement}
      </div>
    </div>
  );
}
