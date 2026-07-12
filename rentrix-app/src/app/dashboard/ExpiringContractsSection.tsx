import { Link } from '@tanstack/react-router';
import { Clock } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatDate } from '@/hooks/useCompanyFormatters';
import { DASHBOARD_WINDOW_DAYS, type ExpiringContractRow } from './dashboard.utils';

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
        action={<Link to="/contracts">عرض الكل</Link>}
      />

      {isLoading && <Skeleton className="h-36 rounded-2xl" />}

      {!isLoading && rows.length === 0 && (
        <EmptyState
          title={`لا توجد عقود تنتهي خلال ${DASHBOARD_WINDOW_DAYS} يوماً`}
          description="ستظهر هنا العقود القريبة من الانتهاء عند توفرها."
        />
      )}

      {!isLoading && rows.length > 0 && (
        <div className="space-y-2.5">
          {rows.map((row) => {
            const urgency = row.daysRemaining <= 7 ? 'rose' : row.daysRemaining <= 14 ? 'amber' : 'emerald';
            return (
              <Link key={row.id} to="/contracts/$contractId" params={{ contractId: row.id }}>
                <div className={cn(
                  'rounded-2xl border border-border/60 bg-card p-4 hover:shadow-md transition-all',
                  row.daysRemaining <= 7 && 'border-rose-300 dark:border-rose-800/60',
                )}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{row.tenantName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{row.location}</p>
                    </div>
                    <span className={cn(
                      'shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold',
                      urgency === 'rose'    && 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
                      urgency === 'amber'   && 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
                      urgency === 'emerald' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
                    )}>
                      <Clock className="size-4" />
                      {row.daysRemaining} يوم
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground/70">
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
