import { CalendarDays, LayoutDashboard } from 'lucide-react';
import { formatCompanyDate } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';
import type { DashboardSnapshot } from '../dashboard-snapshot';

interface HeroBannerProps {
  snapshot: DashboardSnapshot | undefined;
  isLoading: boolean;
  settings: CompanySettingsContract;
  today: string;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'صباح الخير';
  if (hour < 17) return 'مساء الخير';
  return 'مساء النور';
}

export function HeroBanner({ snapshot, isLoading, settings, today }: HeroBannerProps) {
  const periodEnd = snapshot?.period.dateTo ?? today;

  return (
    <header className="rounded-3xl border border-border/60 bg-card p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <LayoutDashboard className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-muted-foreground">{getGreeting()}</p>
            <h1 className="mt-0.5 text-xl font-black tracking-tight sm:text-2xl">لوحة التحكم</h1>
            <p className="mt-1 max-w-2xl text-sm font-medium text-muted-foreground">
              ابدأ بالأعمال التي تحتاج قراراً، ثم راجع مؤشرات الأداء وقوائم المتابعة.
            </p>
          </div>
        </div>

        <div
          className="flex min-h-11 items-center gap-2 self-start rounded-2xl border border-border/60 bg-muted/45 px-3 text-xs font-bold text-muted-foreground sm:self-center"
          aria-label="تاريخ تحديث لوحة التحكم"
        >
          <CalendarDays className="size-4" aria-hidden="true" />
          {isLoading ? 'جارٍ تحديث البيانات' : `حتى ${formatCompanyDate(settings, `${periodEnd}T00:00:00`)}`}
        </div>
      </div>
    </header>
  );
}
