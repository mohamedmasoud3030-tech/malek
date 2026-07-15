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
 *   actions={<Button asChild><Link to="/contracts/$contractId/edit" params={{ contractId }}>تعديل</Link></Button>}
 * />
 */
export function EntityDetailHeader({ title, subtitle, backTo, backLabel = 'العودة', status, actions, className }: EntityDetailHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {status}
        </div>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {backTo && (
          <Button variant="secondary" asChild>
            <Link to={backTo}>
              <ArrowLeft className="me-2 size-4" />
              {backLabel}
            </Link>
          </Button>
        )}
        {actions}
      </div>
    </div>
  );
}
