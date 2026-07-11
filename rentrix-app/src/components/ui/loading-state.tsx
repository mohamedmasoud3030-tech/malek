import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';

type LoadingStateVariant = 'page' | 'section' | 'cards' | 'table' | 'inline';

type LoadingStateProps = {
  variant?: LoadingStateVariant;
  label?: string;
  className?: string;
  rows?: number;
};

/**
 * Shared loading shells for pages, KPI grids, tables, and inline blocks.
 */
export function LoadingState({
  variant = 'section',
  label = 'جارٍ التحميل...',
  className,
  rows = 4,
}: LoadingStateProps) {
  if (variant === 'inline') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={label}
        className={cn('flex items-center gap-2 text-sm font-bold text-muted-foreground', className)}
      >
        <span className="size-4 animate-pulse rounded-full bg-primary/40" />
        <span>{label}</span>
      </div>
    );
  }

  if (variant === 'cards') {
    return (
      <div role="status" aria-live="polite" aria-label={label} className={cn('grid grid-cols-2 gap-3 sm:grid-cols-4', className)}>
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div role="status" aria-live="polite" aria-label={label} className={cn('space-y-2', className)}>
        <Skeleton className="h-12 rounded-2xl" />
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-14 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (variant === 'page') {
    return (
      <div role="status" aria-live="polite" aria-label={label} className={cn('space-y-5', className)}>
        <Skeleton className="h-28 rounded-3xl" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" aria-label={label} className={cn('space-y-3', className)}>
      <Skeleton className="h-8 w-48 rounded-xl" />
      <Skeleton className="h-40 rounded-2xl" />
    </div>
  );
}
