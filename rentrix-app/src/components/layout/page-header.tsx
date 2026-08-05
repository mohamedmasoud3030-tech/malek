import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PageHeaderActions } from './page-header-actions';

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
 * Mobile: primary always visible compact, secondary collapsed into overflow menu.
 * Destructive actions separated, touch targets 44px, safe-area preserved.
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
      className={cn('border-b border-border/60 pb-3 sm:pb-4', className)}
    >
      <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-4">
        {/* Title + description */}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="min-w-0 text-balance text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
            {count !== undefined ? (
              <span
                className="inline-flex min-h-5 items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground"
                aria-label={`عدد السجلات ${count}`}
              >
                {count}
              </span>
            ) : null}
          </div>
          {description ? (
            <p className="mt-0.5 max-w-3xl text-[0.8125rem] leading-5 text-muted-foreground sm:mt-1 sm:text-sm sm:leading-6">
              {description}
            </p>
          ) : null}
        </div>

        {/* Actions — mobile aware */}
        {hasActions ? (
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {backTo ? (
              <Button variant="secondary" size="sm" asChild className="min-h-11">
                <Link to={backTo}>
                  <ArrowLeft className="me-1 size-3.5 rtl:rotate-180 sm:me-1.5 sm:size-4" />
                  <span className="hidden sm:inline">{backLabel}</span>
                  <span className="sm:hidden">رجوع</span>
                </Link>
              </Button>
            ) : null}
            <PageHeaderActions title={title} primaryAction={resolvedPrimaryAction} secondaryActions={secondaryActions} />
          </div>
        ) : null}
      </div>
    </header>
  );
}
