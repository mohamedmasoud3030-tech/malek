import { Building2, CalendarDays, LayoutDashboard, ShieldCheck } from 'lucide-react';
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
    <header className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-bl from-primary/15 via-card to-card p-4 shadow-elevated sm:p-6" data-dashboard-hero>
      <div className="pointer-events-none absolute -start-12 -top-16 size-48 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-card">
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
          <div className="flex min-h-11 items-center gap-2 rounded-2xl border border-border/70 bg-background/70 px-3 text-xs font-semibold text-muted-foreground backdrop-blur-sm" aria-label="تاريخ تحديث لوحة التحكم">
            <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{isLoading ? 'جارٍ تحديث البيانات' : `حتى ${formatCompanyDate(settings, `${periodEnd}T00:00:00`)}`}</span>
          </div>
          <div className="flex min-h-11 items-center gap-2 rounded-2xl border border-border/70 bg-background/70 px-3 text-xs font-semibold backdrop-blur-sm">
            <Building2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span><b dir="ltr" className="tabular-nums">{snapshot?.operational.occupancyRate ?? 0}%</b> إشغال</span>
          </div>
          <div className="col-span-2 flex min-h-11 items-center gap-2 rounded-2xl border border-success/20 bg-success/5 px-3 text-xs font-semibold text-success sm:col-span-1">
            <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
            <span><b dir="ltr" className="tabular-nums">{snapshot?.operational.activeContracts ?? 0}</b> عقد نشط</span>
          </div>
        </div>
      </div>
    </header>
  );
}
