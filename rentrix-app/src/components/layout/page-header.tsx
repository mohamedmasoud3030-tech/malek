import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  count?: number | string;
  backTo?: string;
  backLabel?: string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  /** @deprecated Use primaryAction for the main page action. */
  action?: ReactNode;
  className?: string;
}

/**
 * Reusable page header — title, optional count/back control, and action slots.
 * The primary action remains visually first on narrow screens, while secondary
 * actions wrap/scroll in their own lane instead of competing with the title.
 */
export function PageHeader({
  title,
  description,
  count,
  backTo,
  backLabel = 'العودة',
  primaryAction,
  secondaryActions,
  action,
  className,
}: PageHeaderProps) {
  const resolvedPrimaryAction = primaryAction ?? action;
  const hasActions = Boolean(backTo || resolvedPrimaryAction || secondaryActions);

  return (
    <header className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="text-xl font-black tracking-tight">{title}</h1>
          {count !== undefined ? (
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-black text-muted-foreground" aria-label={`عدد السجلات ${count}`}>
              {count}
            </span>
          ) : null}
        </div>
        {description && (
          <p className="mt-0.5 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
        )}
      </div>

      {hasActions ? (
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          {secondaryActions ? (
            <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 sm:overflow-visible sm:pb-0" aria-label="إجراءات ثانوية">
              {secondaryActions}
            </div>
          ) : null}
          <div className="flex shrink-0 gap-2">
            {backTo ? (
              <Button variant="secondary" asChild>
                <Link to={backTo}>
                  <ArrowLeft className="me-2 size-4 rtl:rotate-180" />
                  {backLabel}
                </Link>
              </Button>
            ) : null}
            {resolvedPrimaryAction}
          </div>
        </div>
      ) : null}
    </header>
  );
}
