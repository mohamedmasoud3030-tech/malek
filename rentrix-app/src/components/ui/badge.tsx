import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'outline';

const variants: Record<BadgeVariant, string> = {
  default: 'bg-muted text-muted-foreground ring-border',
  primary: 'bg-primary/10 text-primary ring-primary/20',
  success: 'bg-success-bg text-success ring-success/20',
  warning: 'bg-warning-bg text-warning ring-warning/20',
  danger: 'bg-danger-bg text-danger ring-danger/20',
  info: 'bg-info-bg text-info ring-info/20',
  outline: 'bg-transparent text-foreground ring-border',
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  children: ReactNode;
  dot?: boolean;
};

/**
 * Compact label pill for counts, tags, and lightweight status markers.
 * For domain status mapping prefer StatusBadge.
 */
export function Badge({ variant = 'default', className, children, dot = false, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset',
        variants[variant],
        className,
      )}
      {...props}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
