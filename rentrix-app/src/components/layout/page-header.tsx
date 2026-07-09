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
 * Reusable page header — the single production page title/action surface.
 * Actions stay reachable on mobile without overflowing or crowding the title.
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
    <header className={cn('rounded-3xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur sm:p-5', className)}>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="text-xl font-black tracking-tight sm:text-2xl">{title}</h1>
            {count !== undefined ? (
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-black text-muted-foreground" aria-label={`عدد السجلات ${count}`}>
                {count}
              </span>
            ) : null}
          </div>
          {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </div>

        {hasActions ? (
          <div className="flex w-full min-w-0 flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
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
      </div>
    </header>
  );
}
