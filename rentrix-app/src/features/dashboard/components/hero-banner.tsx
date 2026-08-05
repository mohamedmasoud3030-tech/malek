import { Building2, CalendarDays, LayoutDashboard, RefreshCw, ShieldCheck } from 'lucide-react';
import { formatCompanyDate } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';
import type { DashboardSnapshot } from '../dashboard-snapshot';

interface HeroBannerProps {
  snapshot: DashboardSnapshot | undefined;
  isLoading: boolean;
  settings: CompanySettingsContract;
  today: string;
  /** True while any background refetch is in flight. */
  isRefreshing?: boolean;
  /** Epoch ms of the last successful snapshot load. */
  lastUpdatedAt?: number;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'صباح الخير';
  if (hour < 17) return 'مساء الخير';
  return 'مساء النور';
}

function formatUpdatedTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString('ar-OM', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function HeroBanner({ snapshot, isLoading, settings, today, isRefreshing = false, lastUpdatedAt }: HeroBannerProps) {
  const periodEnd = snapshot?.period.dateTo ?? today;
  const freshnessLabel = isLoading
    ? 'جارٍ تحميل البيانات'
    : isRefreshing
      ? 'جارٍ تحديث البيانات'
      : lastUpdatedAt
        ? `آخر تحديث ${formatUpdatedTime(lastUpdatedAt)}`
        : `حتى ${formatCompanyDate(settings, `${periodEnd}T00:00:00`)}`;

  return (
    <header className="rounded-2xl border border-border/70 bg-card p-4 shadow-card sm:p-5" data-dashboard-hero>
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <LayoutDashboard className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-primary">{getGreeting()}، هذه مساحة قرارك اليوم</p>
            <h1 className="mt-1 text-2xl font-bold leading-tight sm:text-3xl">لوحة التحكم</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              ابدأ بالأعمال العاجلة، ثم راقب التحصيل وصحة المحفظة من مكان واحد.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap xl:justify-end">
          <div className="flex min-h-11 items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 text-xs font-semibold text-muted-foreground" aria-label="تاريخ تحديث لوحة التحكم">
            {isRefreshing ? (
              <RefreshCw className="size-4 shrink-0 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden="true" />
            )}
            <span>{freshnessLabel}</span>
          </div>
          <div className="flex min-h-11 items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 text-xs font-semibold">
            <Building2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span><b dir="ltr" className="tabular-nums">{snapshot?.operational.occupancyRate ?? 0}%</b> إشغال</span>
          </div>
          <div className="col-span-2 flex min-h-11 items-center gap-2 rounded-xl border border-success/20 bg-success/10 px-3 text-xs font-semibold text-success sm:col-span-1">
            <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
            <span><b dir="ltr" className="tabular-nums">{snapshot?.operational.activeContracts ?? 0}</b> عقد نشط</span>
          </div>
        </div>
      </div>
    </header>
  );
}
