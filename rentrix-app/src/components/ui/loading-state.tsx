import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';

type LoadingStateVariant = 'page' | 'section' | 'cards' | 'table' | 'inline';

type LoadingStateProps = {
  variant?: LoadingStateVariant;
  label?: string;
  className?: string;
  rows?: number;
};

/** Shared loading skeletons for pages, KPI grids, tables, and inline blocks. */
export function LoadingState({
  variant = 'section',
  label = 'جارٍ التحميل...',
  className,
  rows = 4,
}: LoadingStateProps) {
  if (variant === 'inline') {
    return (
      <div
        data-loading-state
        role="status"
        aria-live="polite"
        aria-label={label}
        className={cn('flex items-center gap-2 text-sm font-medium text-muted-foreground', className)}
      >
        <span className="size-4 rounded-full bg-primary/30" />
        <span>{label}</span>
      </div>
    );
  }

  if (variant === 'cards') {
    return (
      <div
        data-loading-state
        role="status"
        aria-live="polite"
        aria-label={label}
        className={cn('grid grid-cols-2 gap-3 sm:grid-cols-4', className)}
      >
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div
        data-loading-state
        role="status"
        aria-live="polite"
        aria-label={label}
        className={cn('space-y-2', className)}
      >
        <Skeleton className="h-10 rounded-lg" />
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-12 rounded-lg" />
        ))}
      </div>
    );
  }

  if (variant === 'page') {
    return (
      <div
        data-loading-state
        role="status"
        aria-live="polite"
        aria-label={label}
        className={cn('space-y-5', className)}
      >
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div
      data-loading-state
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn('space-y-3', className)}
    >
      <Skeleton className="h-8 w-48 rounded-lg" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}
