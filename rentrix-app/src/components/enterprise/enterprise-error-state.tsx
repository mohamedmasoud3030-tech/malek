/**
 * EnterpriseErrorState — Enterprise UX Foundation (Wave 4A)
 *
 * Recoverable error surface for the enterprise layer. Delegates to the shared
 * `ErrorState` primitive (retry button, danger tokens, role="alert") and adds
 * an inline variant for toolbars/drawers. No business logic.
 */

import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';

export interface EnterpriseErrorStateProps {
  title?: string;
  description?: string;
  /** Raw error — message (if readable) is shown as technical detail. */
  error?: unknown;
  onRetry?: () => void;
  /** Extra actions next to retry (e.g. "contact support"). */
  action?: ReactNode;
  /** `inline` renders a borderless single-line alert for cramped contexts. */
  context?: 'page' | 'panel' | 'inline';
  className?: string;
}

export function EnterpriseErrorState({
  title = 'تعذر تحميل البيانات',
  description,
  error,
  onRetry,
  action,
  context = 'page',
  className,
}: EnterpriseErrorStateProps) {
  if (context === 'inline') {
    return (
      <div
        data-enterprise-error-state
        role="alert"
        className={cn(
          'flex items-center gap-2 rounded-xl bg-danger-bg px-3 py-2 text-sm font-medium text-danger',
          className,
        )}
      >
        <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-bold underline underline-offset-2 transition-colors hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
          >
            إعادة المحاولة
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div data-enterprise-error-state data-context={context} className={cn('w-full', className)}>
      <ErrorState
        title={title}
        description={description}
        error={error}
        onRetry={onRetry}
        action={action}
        compact={context === 'panel'}
      />
    </div>
  );
}
