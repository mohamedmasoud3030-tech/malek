/*
 * ============================================
 * MALIK PRO - Alert Component
 * Notification and warning messages
 * ============================================
 */

import type { ReactNode } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Info,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type MalikAlertVariant = 'success' | 'warning' | 'danger' | 'info';

export interface MalikAlertProps {
  variant?: MalikAlertVariant;
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}

const alertConfig = {
  success: {
    icon: CheckCircle2,
    iconClass: 'text-[hsl(var(--malik-success))]',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-[hsl(var(--malik-warning))]',
  },
  danger: {
    icon: XCircle,
    iconClass: 'text-[hsl(var(--malik-danger))]',
  },
  info: {
    icon: Info,
    iconClass: 'text-[hsl(var(--malik-info))]',
  },
};

export function MalikAlert({
  variant = 'info',
  title,
  icon,
  children,
  className,
  dismissible = false,
  onDismiss,
}: MalikAlertProps) {
  const config = alertConfig[variant];
  const Icon = icon || config.icon;

  return (
    <div
      data-malik-alert={variant}
      className={cn(
        'flex gap-3 p-4 rounded-xl border',
        variant === 'success' && 'bg-[hsl(var(--malik-success-bg))] border-[hsl(var(--malik-success)/0.2)]',
        variant === 'warning' && 'bg-[hsl(var(--malik-warning-bg))] border-[hsl(var(--malik-warning)/0.2)]',
        variant === 'danger' && 'bg-[hsl(var(--malik-danger-bg))] border-[hsl(var(--malik-danger)/0.2)]',
        variant === 'info' && 'bg-[hsl(var(--malik-info-bg))] border-[hsl(var(--malik-info)/0.2)]',
        className
      )}
      role="alert"
    >
      <div className={cn('shrink-0 mt-0.5', config.iconClass)}>
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="flex-1">
        {title && (
          <p className="font-bold text-sm mb-1">
            {variant === 'success' && 'text-[hsl(var(--malik-success))]'}
            {variant === 'warning' && 'text-[hsl(var(--malik-warning))]'}
            {variant === 'danger' && 'text-[hsl(var(--malik-danger))]'}
            {variant === 'info' && 'text-[hsl(var(--malik-info))]'}
            {title}
          </p>
        )}
        <div className="text-sm text-[hsl(var(--malik-foreground))]">
          {children}
        </div>
      </div>
      {dismissible && onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-[hsl(var(--malik-foreground-muted))] hover:text-[hsl(var(--malik-foreground))]"
          aria-label="إغلاق"
        >
          <XCircle className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

// ── Inline Alert ──
export function MalikInlineAlert({
  variant = 'info',
  message,
  className,
}: {
  variant?: MalikAlertVariant;
  message: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 text-xs font-medium',
        'text-[hsl(var(--malik-foreground-muted))]',
        className
      )}
    >
      <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

// ── Loading Alert ──
export function MalikLoadingAlert({
  message = 'جارٍ التحميل...',
}: {
  message?: string;
}) {
  return (
    <div
      data-malik-alert="info"
      className="flex items-center gap-3 p-4 rounded-xl border border-[hsl(var(--malik-info)/0.2)] bg-[hsl(var(--malik-info-bg))]"
    >
      <div className="shrink-0">
        <div className="size-5 animate-spin rounded-full border-2 border-[hsl(var(--malik-info))] border-t-transparent" />
      </div>
      <span className="text-sm text-[hsl(var(--malik-info))]">{message}</span>
    </div>
  );
}

// ── Success Alert ──
export function MalikSuccessAlert({
  title,
  message,
  className,
}: {
  title?: string;
  message: string;
  className?: string;
}) {
  return (
    <MalikAlert variant="success" title={title} className={className}>
      {message}
    </MalikAlert>
  );
}

// ── Error Alert ──
export function MalikErrorAlert({
  title,
  message,
  onRetry,
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <MalikAlert variant="danger" title={title || 'حدث خطأ'} className={className}>
      <p>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 text-sm font-bold text-[hsl(var(--malik-danger))] hover:underline"
        >
          إعادة المحاولة
        </button>
      )}
    </MalikAlert>
  );
}
