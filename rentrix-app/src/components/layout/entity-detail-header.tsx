import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EntityDetailHeaderProps {
  title: string;
  subtitle?: string;
  /** Route to navigate back to. Pass a router `to` string, e.g. "/contracts". */
  backTo?: string;
  backLabel?: string;
  status?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** Shared detail-page header aligned to the canonical PageHeader rhythm. */
export function EntityDetailHeader({
  title,
  subtitle,
  backTo,
  backLabel = 'العودة',
  status,
  actions,
  className,
}: EntityDetailHeaderProps) {
  return (
    <header
      data-page-header
      data-entity-detail-header
      data-unified-surface="page-header"
      className={cn(
        'rounded-2xl border border-border/70 bg-card px-3 py-2.5 shadow-card sm:px-4 sm:py-3',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <h1 className="min-w-0 break-words text-balance text-xl font-black leading-7 [overflow-wrap:anywhere] sm:text-[1.375rem] sm:leading-8">
              {title}
            </h1>
            {status}
          </div>
          {subtitle ? (
            <p className="mt-0.5 max-w-3xl break-words text-[0.8125rem] leading-5 text-muted-foreground [overflow-wrap:anywhere]">
              {subtitle}
            </p>
          ) : null}
        </div>

        {backTo || actions ? (
          <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 sm:w-auto sm:shrink-0 sm:gap-2">
            {backTo ? (
              <Button variant="secondary" size="sm" className="min-h-11" asChild>
                <Link to={backTo}>
                  <ArrowLeft className="me-1 size-3.5 rtl:rotate-180" aria-hidden="true" />
                  <span className="hidden sm:inline">{backLabel}</span>
                  <span className="sm:hidden">رجوع</span>
                </Link>
              </Button>
            ) : null}
            {actions ? <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 sm:flex-none sm:gap-2">{actions}</div> : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
