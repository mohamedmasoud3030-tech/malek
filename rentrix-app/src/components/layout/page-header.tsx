import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PageHeaderActions } from './page-header-actions';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  count?: number | string;
  backTo?: string;
  backLabel?: string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  /** @deprecated Use primaryAction for the main page action. */
  action?: ReactNode;
  className?: string;
}

/** Compact shared page heading. Operational density stays high on mobile. */
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
      data-unified-surface="page-header"
      className={cn(
        'rounded-2xl border border-border/70 bg-card px-3 py-2 shadow-card sm:px-4 sm:py-2.5',
        className,
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2.5 sm:gap-4">
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <h1 className="min-w-0 break-words text-balance text-lg font-black leading-7 [overflow-wrap:anywhere] sm:text-xl">{title}</h1>
            {count !== undefined ? (
              <span
                className="inline-flex min-h-5 shrink-0 items-center rounded-md border border-border bg-muted/45 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground"
                aria-label={`عدد السجلات ${count}`}
              >
                {count}
              </span>
            ) : null}
          </div>
          {description ? (
            <p className="mt-0.5 max-w-3xl break-words text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere] sm:text-[13px]">
              {description}
            </p>
          ) : null}
        </div>

        {hasActions ? (
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            {backTo ? (
              <Button variant="secondary" size="sm" asChild className="min-h-11">
                <Link to={backTo}>
                  <ArrowLeft className="me-1 size-3.5 rtl:rotate-180" />
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
