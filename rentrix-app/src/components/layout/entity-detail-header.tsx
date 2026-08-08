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

/**
 * Shared header for entity detail pages and form pages — back action,
 * title, optional subtitle/status, and a trailing actions slot. Replaces
 * the repeated "PageHeader + back Button inside action slot" pattern that
 * was hand-assembled per feature (contracts, properties, owners…).
 *
 * @example
 * <EntityDetailHeader
 *   title="تفاصيل العقد"
 *   subtitle={`العقد رقم #${contract.id.slice(0, 8)}`}
 *   backTo="/contracts"
 *   backLabel="العودة"
 *   status={<StatusBadge tone={contractStatusTone[contract.status]}>{contractStatusLabels[contract.status]}</StatusBadge>}
 *   actions={<Button asChild className="min-h-11"><Link to="/contracts/$contractId/edit" params={{ contractId }}>تعديل</Link></Button>}
 * />
 */
export function EntityDetailHeader({ title, subtitle, backTo, backLabel = 'العودة', status, actions, className }: EntityDetailHeaderProps) {
  return (
    <header
      data-page-header
      className={cn(
        'rounded-[1.5rem] border border-border/70 bg-card px-4 py-4 shadow-card sm:px-6 sm:py-5',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-5">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="min-w-0 text-balance text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
            {status}
          </div>
          {subtitle && <p className="mt-0.5 max-w-3xl text-[0.8125rem] leading-5 text-muted-foreground sm:mt-1 sm:text-sm sm:leading-6">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:gap-2">
          {backTo && (
            <Button variant="secondary" size="sm" className="min-h-11" asChild>
              <Link to={backTo}>
                <ArrowLeft className="me-1 size-3.5 rtl:rotate-180 sm:me-1.5 sm:size-4" />
                <span className="hidden sm:inline">{backLabel}</span>
                <span className="sm:hidden">رجوع</span>
              </Link>
            </Button>
          )}
          {actions}
        </div>
      </div>
    </header>
  );
}
