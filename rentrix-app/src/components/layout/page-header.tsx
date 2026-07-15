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
 * Page title + actions — flat design (not a card).
 *
 * The page header is a clean typographic surface, not a decorative card.
 * It sits at the top of the page content area, providing hierarchy through
 * typography and spacing alone.
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
        'pb-4 border-b border-border/60',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {/* Title + description */}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="min-w-0 text-balance text-2xl font-bold tracking-tight">{title}</h1>
            {count !== undefined ? (
              <span
                className="inline-flex min-h-6 items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground"
                aria-label={`عدد السجلات ${count}`}
              >
                {count}
              </span>
            ) : null}
          </div>
          {description ? (
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
          ) : null}
        </div>

        {/* Actions */}
        {hasActions ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:flex-shrink-0 sm:justify-end">
            {secondaryActions ? (
              <div
                className="no-scrollbar flex min-w-0 items-center gap-2 overflow-x-auto sm:flex-wrap sm:justify-end sm:overflow-visible"
                aria-label="إجراءات ثانوية"
              >
                {secondaryActions}
              </div>
            ) : null}
            {backTo ? (
              <Button variant="secondary" size="sm" asChild>
                <Link to={backTo}>
                  <ArrowLeft className="me-1.5 size-4 rtl:rotate-180" />
                  {backLabel}
                </Link>
              </Button>
            ) : null}
            {resolvedPrimaryAction ? resolvedPrimaryAction : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
