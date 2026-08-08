/*
 * ============================================
 * MALIK PRO - Loading & Empty State Components
 * ============================================
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// ── Loading State ──
export function MalikLoadingState({
  message = 'جارٍ التحميل...',
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 py-12',
        className
      )}
    >
      <div className="relative">
        <div className="size-12 rounded-full border-4 border-[hsl(var(--malik-border))]" />
        <div className="absolute inset-0 size-12 rounded-full border-4 border-t-[hsl(var(--malik-primary))] animate-spin" />
      </div>
      <p className="text-sm font-medium text-[hsl(var(--malik-foreground-muted))]">
        {message}
      </p>
    </div>
  );
}

// ── Empty State ──
export function MalikEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-malik-empty
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
    >
      {icon && (
        <div
          data-malik-empty-icon
          className="mb-4"
        >
          {icon}
        </div>
      )}
      <h3
        data-malik-empty-title
        className="mb-2 text-base font-bold"
      >
        {title}
      </h3>
      {description && (
        <p
          data-malik-empty-desc
          className="max-w-sm text-sm"
        >
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ── Error State ──
export function MalikErrorState({
  title = 'حدث خطأ',
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
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 py-12 px-4 text-center',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center size-16 rounded-2xl',
          'bg-[hsl(var(--malik-danger-bg))] text-[hsl(var(--malik-danger))]'
        )}
      >
        <svg
          className="size-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h3 className="text-base font-bold text-[hsl(var(--malik-foreground))]">
        {title}
      </h3>
      <p className="max-w-sm text-sm text-[hsl(var(--malik-foreground-muted))]">
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            'mt-2 px-4 py-2 rounded-lg',
            'text-sm font-bold',
            'bg-[hsl(var(--malik-primary))] text-white',
            'hover:bg-[hsl(var(--malik-primary-dark))]',
            'transition-colors duration-150'
          )}
        >
          إعادة المحاولة
        </button>
      )}
    </div>
  );
}

// ── Skeleton Loader ──
export function MalikSkeleton({
  className,
  lines = 1,
}: {
  className?: string;
  lines?: number;
}) {
  if (lines === 1) {
    return (
      <div
        data-malik-skeleton
        className={cn('h-4 w-full rounded', className)}
      />
    );
  }

  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          data-malik-skeleton
          className={cn('h-4 rounded', className)}
          style={{ width: `${100 - i * 10}%` }}
        />
      ))}
    </div>
  );
}

// ── Card Skeleton ──
export function MalikCardSkeleton({
  showHeader = true,
  showFooter = false,
  className,
}: {
  showHeader?: boolean;
  showFooter?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[hsl(var(--malik-border))] bg-[hsl(var(--malik-card))] p-4',
        className
      )}
    >
      {showHeader && (
        <div className="flex items-center gap-3 mb-4">
          <div data-malik-skeleton className="size-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div data-malik-skeleton className="h-4 w-24 rounded" />
            <div data-malik-skeleton className="h-3 w-16 rounded" />
          </div>
        </div>
      )}
      <div className="space-y-2">
        <div data-malik-skeleton className="h-3 w-full rounded" />
        <div data-malik-skeleton className="h-3 w-3/4 rounded" />
      </div>
      {showFooter && (
        <div className="flex gap-2 mt-4 pt-4 border-t border-[hsl(var(--malik-border-light))]">
          <div data-malik-skeleton className="h-9 w-20 rounded-lg" />
          <div data-malik-skeleton className="h-9 flex-1 rounded-lg" />
        </div>
      )}
    </div>
  );
}
