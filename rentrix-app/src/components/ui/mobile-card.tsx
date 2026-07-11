import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type MobileCardProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  meta?: ReactNode;
  stats?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
};

/**
 * Standard mobile list-item surface. Use instead of ad-hoc bordered cards
 * so every entity list looks and behaves the same under 768px.
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

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition',
        interactive && 'cursor-pointer hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.99]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-black text-foreground">{title}</div>
          {subtitle ? <div className="mt-0.5 truncate text-xs font-bold text-muted-foreground">{subtitle}</div> : null}
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>

      {meta ? <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">{meta}</div> : null}
      {stats ? <div className="mt-3">{stats}</div> : null}
      {children}

      {actions ? (
        <div
          className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3"
          onClick={stopActions}
          onKeyDown={stopActions}
          role="presentation"
        >
          {actions}
        </div>
      ) : null}

      {footer ? <div className="mt-3 text-[11px] font-bold text-muted-foreground">{footer}</div> : null}
    </div>
  );
}
