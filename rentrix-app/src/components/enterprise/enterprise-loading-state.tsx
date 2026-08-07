/**
 * EnterpriseLoadingState — Enterprise UX Foundation (Wave 4A)
 *
 * Single entry point for loading skeletons across the enterprise layer.
 * Wraps the shared `LoadingState` primitive and adds drawer/form presets so
 * every future module renders the same loading grammar.
 */

import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/ui/loading-state';
import { Skeleton } from '@/components/ui/skeleton';

export type EnterpriseLoadingContext =
  | 'page'
  | 'section'
  | 'cards'
  | 'table'
  | 'inline'
  | 'drawer'
  | 'form'
  | 'stats';

export interface EnterpriseLoadingStateProps {
  context?: EnterpriseLoadingContext;
  label?: string;
  rows?: number;
  className?: string;
}

export function EnterpriseLoadingState({
  context = 'section',
  label = 'جارٍ التحميل...',
  rows = 4,
  className,
}: EnterpriseLoadingStateProps) {
  if (context === 'drawer') {
    return (
      <div
        data-enterprise-loading-state
        data-context="drawer"
        role="status"
        aria-live="polite"
        aria-label={label}
        className={cn('space-y-4', className)}
      >
        <Skeleton className="h-6 w-40 rounded-lg" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-2/3 rounded-lg" />
      </div>
    );
  }

  if (context === 'form') {
    return (
      <div
        data-enterprise-loading-state
        data-context="form"
        role="status"
        aria-live="polite"
        aria-label={label}
        className={cn('space-y-5', className)}
      >
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="space-y-3 rounded-2xl border border-border p-4">
            <Skeleton className="h-5 w-32 rounded-md" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-10 rounded-lg" />
            </div>
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  const variant =
    context === 'stats' ? 'cards' : context === 'inline' ? 'inline' : context;

  return (
    <LoadingState
      variant={variant}
      label={label}
      rows={rows}
      className={className}
    />
  );
}
