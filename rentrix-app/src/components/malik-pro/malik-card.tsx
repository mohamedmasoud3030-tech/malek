/*
 * ============================================
 * MALIK PRO - Card Component
 * Soft rounded cards with subtle shadows
 * ============================================
 */

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type MalikCardVariant = 'default' | 'flat' | 'elevated' | 'interactive';

export interface MalikCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: MalikCardVariant;
  accent?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'none';
  children: ReactNode;
}

const variantClasses: Record<MalikCardVariant, string> = {
  default: [
    'bg-[hsl(var(--malik-card))]',
    'border border-[hsl(var(--malik-border))]',
    'shadow-[var(--malik-shadow-card)]',
  ].join(' '),
  flat: [
    'bg-[hsl(var(--malik-card))]',
    'border border-[hsl(var(--malik-border-light))]',
  ].join(' '),
  elevated: [
    'bg-[hsl(var(--malik-card))]',
    'border border-[hsl(var(--malik-border))]',
    'shadow-[var(--malik-shadow-elevated)]',
  ].join(' '),
  interactive: [
    'bg-[hsl(var(--malik-card))]',
    'border border-[hsl(var(--malik-border))]',
    'shadow-[var(--malik-shadow-card)]',
    'cursor-pointer',
    'hover:shadow-[var(--malik-shadow-card-hover)]',
    'hover:border-[hsl(var(--malik-primary)/0.4)]',
    'hover:-translate-y-0.5',
    'transition-all duration-200',
  ].join(' '),
};

const accentClasses = {
  primary: 'border-r-4 border-r-[hsl(var(--malik-primary))]',
  success: 'border-r-4 border-r-[hsl(var(--malik-success))]',
  warning: 'border-r-4 border-r-[hsl(var(--malik-warning))]',
  danger: 'border-r-4 border-r-[hsl(var(--malik-danger))]',
  info: 'border-r-4 border-r-[hsl(var(--malik-info))]',
  none: '',
};

export function MalikCard({
  variant = 'default',
  accent,
  className,
  children,
  ...props
}: MalikCardProps) {
  return (
    <div
      data-malik-card
      className={cn(
        'rounded-xl overflow-hidden',
        variantClasses[variant],
        accent && accentClasses[accent],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Card Header
export function MalikCardHeader({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      data-malik-card-header
      className={cn(
        'flex items-start justify-between gap-4 p-4',
        'border-b border-[hsl(var(--malik-border-light))]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Card Content
export function MalikCardContent({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      data-malik-card-content
      className={cn('p-4', className)}
      {...props}
    >
      {children}
    </div>
  );
}

// Card Footer
export function MalikCardFooter({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      data-malik-card-footer
      className={cn(
        'flex items-center gap-3 p-4',
        'border-t border-[hsl(var(--malik-border-light))]',
        'bg-[hsl(var(--malik-muted)/0.3)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Info Card - For summary displays
export function MalikInfoCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div data-malik-info-card className={className}>
      <span data-malik-info-card-label>{label}</span>
      <span data-malik-info-card-value>{value}</span>
    </div>
  );
}

// Amount Card - For currency displays
export function MalikAmountCard({
  amount,
  currency = 'ر.ع',
  variant = 'default',
  label,
  className,
}: {
  amount: number | string;
  currency?: string;
  variant?: 'success' | 'danger' | 'default';
  label?: string;
  className?: string;
}) {
  const colorClasses = {
    success: 'bg-[hsl(var(--malik-success-bg))] text-[hsl(var(--malik-success))]',
    danger: 'bg-[hsl(var(--malik-danger-bg))] text-[hsl(var(--malik-danger))]',
    default: 'bg-[hsl(var(--malik-muted))] text-[hsl(var(--malik-foreground))]',
  };

  return (
    <div
      data-malik-receipt-amount
      className={cn(
        'flex flex-col items-center justify-center p-6 rounded-xl',
        colorClasses[variant],
        className
      )}
    >
      <span data-malik-receipt-amount-value className="text-3xl font-black tabular-nums">
        {currency} {amount}
      </span>
      {label && (
        <span data-malik-receipt-amount-label className="mt-1 text-sm font-medium">
          {label}
        </span>
      )}
    </div>
  );
}
