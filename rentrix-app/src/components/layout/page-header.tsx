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
 * Single page title/action surface for all user-facing modules.
 *
 * Mobile keeps the title compact and actions reachable without horizontal
 * overflow. Desktop preserves the familiar title-left/actions-right layout.
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
    <header
      data-page-header
      className={cn(
        'overflow-hidden rounded-[1.4rem] border border-border/70 bg-card/92 px-4 py-4 shadow-[0_10px_30px_hsl(var(--foreground)/0.055)] backdrop-blur sm:rounded-3xl sm:px-5 sm:py-5',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="min-w-0 text-balance text-xl font-black leading-8 tracking-tight sm:text-2xl">{title}</h1>
            {count !== undefined ? (
              <span
                className="inline-flex min-h-7 items-center rounded-full border border-border/60 bg-muted/70 px-2.5 py-1 text-xs font-black tabular-nums text-muted-foreground"
                aria-label={`عدد السجلات ${count}`}
              >
                {count}
              </span>
            ) : null}
          </div>
          {description ? (
            <p className="mt-1.5 max-w-3xl text-sm font-medium leading-6 text-muted-foreground">{description}</p>
          ) : null}
        </div>

        {hasActions ? (
          <div className="grid w-full min-w-0 gap-2 sm:w-auto sm:max-w-[60%] sm:grid-flow-col sm:items-center sm:justify-end">
            {secondaryActions ? (
              <div
                className="no-scrollbar flex min-w-0 items-center gap-2 overflow-x-auto pb-0.5 sm:flex-wrap sm:justify-end sm:overflow-visible sm:pb-0"
                aria-label="إجراءات ثانوية"
              >
                {secondaryActions}
              </div>
            ) : null}
            <div className="grid min-w-0 grid-cols-1 gap-2 xs:grid-cols-2 sm:flex sm:shrink-0 sm:justify-end">
              {backTo ? (
                <Button variant="secondary" asChild className="w-full sm:w-auto">
                  <Link to={backTo}>
                    <ArrowLeft className="me-2 size-4 rtl:rotate-180" />
                    {backLabel}
                  </Link>
                </Button>
              ) : null}
              {resolvedPrimaryAction ? <div className="[&>*]:w-full sm:[&>*]:w-auto">{resolvedPrimaryAction}</div> : null}
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
