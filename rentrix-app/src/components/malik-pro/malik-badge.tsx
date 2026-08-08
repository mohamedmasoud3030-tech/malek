/*
 * ============================================
 * MALIK PRO - Badge Component
 * Status badges with semantic colors
 * ============================================
 */

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type MalikBadgeVariant = 
  | 'success'    // Green - Completed
  | 'warning'    // Orange - Pending
  | 'danger'     // Red - Urgent/Error
  | 'info'       // Blue - Info
  | 'neutral'    // Gray - Neutral
  | 'primary'    // Green soft - Primary
  | 'secondary'; // Blue soft - Secondary

export interface MalikBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: MalikBadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

const variantClasses: Record<MalikBadgeVariant, string> = {
  success: 'bg-[hsl(var(--malik-success-bg))] text-[hsl(var(--malik-success))]',
  warning: 'bg-[hsl(var(--malik-warning-bg))] text-[hsl(var(--malik-warning))]',
  danger: 'bg-[hsl(var(--malik-danger-bg))] text-[hsl(var(--malik-danger))]',
  info: 'bg-[hsl(var(--malik-info-bg))] text-[hsl(var(--malik-info))]',
  neutral: 'bg-[hsl(var(--malik-neutral-bg))] text-[hsl(var(--malik-neutral))]',
  primary: 'bg-[hsl(var(--malik-primary-soft))] text-[hsl(var(--malik-primary-dark))]',
  secondary: 'bg-[hsl(var(--malik-secondary-soft))] text-[hsl(var(--malik-secondary-dark))]',
};

const dotClasses: Record<MalikBadgeVariant, string> = {
  success: 'bg-[hsl(var(--malik-success))]',
  warning: 'bg-[hsl(var(--malik-warning))]',
  danger: 'bg-[hsl(var(--malik-danger))]',
  info: 'bg-[hsl(var(--malik-info))]',
  neutral: 'bg-[hsl(var(--malik-neutral))]',
  primary: 'bg-[hsl(var(--malik-primary))]',
  secondary: 'bg-[hsl(var(--malik-secondary))]',
};

export function MalikBadge({
  variant = 'neutral',
  size = 'md',
  dot = false,
  icon,
  className,
  children,
  ...props
}: MalikBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-3 py-1 text-xs',
  };

  return (
    <span
      data-malik-badge
      className={cn(
        'inline-flex items-center gap-1.5 font-bold rounded-full whitespace-nowrap',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn('size-1.5 rounded-full', dotClasses[variant])}
          aria-hidden="true"
        />
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
}

// ── Status Badge with Predefined States ──
export type MalikStatusType = 
  | 'open' | 'in_progress' | 'resolved' | 'closed'
  | 'paid' | 'unpaid' | 'partial' | 'overdue'
  | 'urgent' | 'high' | 'medium' | 'low'
  | 'active' | 'inactive' | 'pending' | 'cancelled';

const statusConfig: Record<MalikStatusType, { variant: MalikBadgeVariant; label: string }> = {
  // Maintenance Status
  open: { variant: 'info', label: 'مفتوح' },
  in_progress: { variant: 'warning', label: 'قيد التنفيذ' },
  resolved: { variant: 'success', label: 'تم الحل' },
  closed: { variant: 'neutral', label: 'مغلق' },
  
  // Invoice Status
  paid: { variant: 'success', label: 'مدفوع' },
  unpaid: { variant: 'danger', label: 'غير مدفوع' },
  partial: { variant: 'warning', label: 'جزئي' },
  overdue: { variant: 'danger', label: 'متأخر' },
  
  // Priority
  urgent: { variant: 'danger', label: 'عاجلة' },
  high: { variant: 'warning', label: 'عالية' },
  medium: { variant: 'info', label: 'متوسطة' },
  low: { variant: 'neutral', label: 'منخفضة' },
  
  // Contract Status
  active: { variant: 'success', label: 'نشط' },
  inactive: { variant: 'neutral', label: 'غير نشط' },
  pending: { variant: 'warning', label: 'قيد الانتظار' },
  cancelled: { variant: 'danger', label: 'ملغي' },
};

export function MalikStatusBadge({
  status,
  dot = true,
  size = 'md',
  className,
}: {
  status: MalikStatusType;
  dot?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const config = statusConfig[status] || { variant: 'neutral' as const, label: status };

  return (
    <MalikBadge
      variant={config.variant}
      dot={dot}
      size={size}
      className={className}
    >
      {config.label}
    </MalikBadge>
  );
}

// ── Contract Status Badge ──
export function MalikContractStatusBadge({
  status,
}: {
  status: 'active' | 'expired' | 'pending' | 'terminated';
}) {
  const statusMap = {
    active: { variant: 'success' as const, label: 'نشط' },
    expired: { variant: 'neutral' as const, label: 'منتهي' },
    pending: { variant: 'warning' as const, label: 'قيد التوقيع' },
    terminated: { variant: 'danger' as const, label: 'ملغي' },
  };

  const config = statusMap[status];

  return (
    <MalikBadge variant={config.variant} dot>
      {config.label}
    </MalikBadge>
  );
}

// ── Payment Status Badge ──
export function MalikPaymentStatusBadge({
  status,
}: {
  status: 'completed' | 'pending' | 'failed' | 'refunded';
}) {
  const statusMap = {
    completed: { variant: 'success' as const, label: 'مكتمل' },
    pending: { variant: 'warning' as const, label: 'قيد المعالجة' },
    failed: { variant: 'danger' as const, label: 'فشل' },
    refunded: { variant: 'info' as const, label: 'مرتجع' },
  };

  const config = statusMap[status];

  return (
    <MalikBadge variant={config.variant} dot>
      {config.label}
    </MalikBadge>
  );
}
