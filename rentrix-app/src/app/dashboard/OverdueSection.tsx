import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatMoney } from '@/hooks/useCompanyFormatters';
import type { OverdueTenantRow } from './dashboard.utils';

interface OverdueSectionProps {
  rows: OverdueTenantRow[];
  isLoading: boolean;
  settings: ReturnType<typeof import('@/hooks/useCompanyFormatters').useCompanyFormatters>;
}

export function OverdueSection({ rows, isLoading, settings }: OverdueSectionProps) {
  const { date, money } = settings;
  return (
    <div>
      <SectionHeader
        title="أعلى المتأخرات"
        action={<Link to="/arrears">عرض الكل</Link>}
      />

      {isLoading && <Skeleton className="h-36 rounded-2xl" />}

      {!isLoading && rows.length === 0 && (
        <EmptyState title="لا توجد فواتير متأخرة" description="ستظهر أعلى المتأخرات هنا عند وجود فواتير غير مسددة." />
      )}

      {!isLoading && rows.length > 0 && (
        <div className="space-y-2.5">
          {rows.map((row) => (
            <div key={row.invoiceId} className="rounded-2xl border border-border/60 bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{row.tenantName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{row.location}</p>
                </div>
                <StatusBadge tone={row.daysOverdue > 90 ? 'red' : 'gold'}>{row.daysOverdue} يوم</StatusBadge>
              </div>
              <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/40">
                <span className="text-xs text-muted-foreground">
                  استحقاق: {date(row.dueDate)}
                </span>
                <span className="font-black text-sm text-rose-600 dark:text-rose-400" dir="ltr">
                  {money(row.remainingAmount)}
                </span>
              </div>
            </div>
          ))}
          <Button asChild variant="secondary" className="w-full rounded-2xl">
            <Link to="/arrears">فتح المتأخرات</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
