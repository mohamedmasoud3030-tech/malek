import { Link } from '@tanstack/react-router';
import { Clock } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import { formatDate } from '@/hooks/useCompanyFormatters';
import { DASHBOARD_WINDOW_DAYS, type ExpiringContractRow } from '../dashboard-utils';

interface ExpiringContractsSectionProps {
  rows: ExpiringContractRow[];
  isLoading: boolean;
  settings: ReturnType<typeof import('@/hooks/useCompanyFormatters').useCompanyFormatters>;
}

export function ExpiringContractsSection({ rows, isLoading, settings }: ExpiringContractsSectionProps) {
  const { date } = settings;
  return (
    <div>
      <SectionHeader
        title="العقود المنتهية قريباً"
        action={<Link to="/contracts" data-dashboard-section-action className="text-[0.8125rem] font-medium text-primary hover:underline">عرض الكل</Link>}
      />

      {isLoading && <Skeleton className="h-36 rounded-xl" />}

      {!isLoading && rows.length === 0 && (
        <EmptyState
          title={`لا توجد عقود تنتهي خلال ${DASHBOARD_WINDOW_DAYS} يوماً`}
          description="ستظهر هنا العقود القريبة من الانتهاء عند توفرها."
        />
      )}

      {!isLoading && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((row) => {
            const tone = row.daysRemaining <= 7 ? 'danger' : row.daysRemaining <= 14 ? 'warning' : 'success';
            return (
              <Link key={row.id} to="/contracts/$contractId" params={{ contractId: row.id }}>
                <div className={cn(
                  'rounded-xl border border-border/70 bg-card p-4 transition-shadow hover:shadow-card-hover',
                  row.daysRemaining <= 7 && 'border-s-2 border-s-danger',
                  row.daysRemaining > 7 && row.daysRemaining <= 14 && 'border-s-2 border-s-warning',
                )}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{row.tenantName}</p>
                      <p className="mt-0.5 truncate text-[0.8125rem] text-muted-foreground">{row.location}</p>
                    </div>
                    <StatusBadge tone={tone}>
                      <Clock className="size-3" aria-hidden="true" />
                      {row.daysRemaining} يوم
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    ينتهي: {date(row.endDate)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
