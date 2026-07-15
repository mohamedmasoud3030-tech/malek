import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatMoney } from '@/hooks/useCompanyFormatters';
import type { OverdueTenantRow } from '../dashboard-utils';

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
        action={<Link to="/arrears" className="text-[0.8125rem] font-medium text-primary hover:underline">عرض الكل</Link>}
      />

      {isLoading && <Skeleton className="h-36 rounded-xl" />}

      {!isLoading && rows.length === 0 && (
        <EmptyState title="لا توجد فواتير متأخرة" description="ستظهر أعلى المتأخرات هنا عند وجود فواتير غير مسددة." />
      )}

      {!isLoading && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((row) => {
            const isHighRisk = row.daysOverdue > 90;
            return (
              <div
                key={row.invoiceId}
                className={`rounded-xl border border-border/70 bg-card p-4 border-s-2 ${isHighRisk ? 'border-s-danger' : 'border-s-warning'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{row.tenantName}</p>
                    <p className="mt-0.5 truncate text-[0.8125rem] text-muted-foreground">{row.location}</p>
                  </div>
                  <StatusBadge tone={isHighRisk ? 'danger' : 'warning'}>{row.daysOverdue} يوم</StatusBadge>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2">
                  <span className="text-[0.8125rem] text-muted-foreground">
                    استحقاق: {date(row.dueDate)}
                  </span>
                  <span className="font-bold text-sm text-danger tabular-nums" dir="ltr">
                    {money(row.remainingAmount)}
                  </span>
                </div>
              </div>
            );
          })}
          <Button asChild variant="secondary" className="w-full">
            <Link to="/arrears">فتح المتأخرات</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
