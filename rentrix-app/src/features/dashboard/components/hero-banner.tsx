import { Home, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { CompanySettingsContract } from '@/lib/companySettings';
import type { DashboardSnapshot } from '../dashboard-snapshot';
import { formatCompanyDate, formatCompanyMoney } from '@/lib/companyFormatters';

interface HeroBannerProps {
  snapshot: DashboardSnapshot | undefined;
  isLoading: boolean;
  settings: CompanySettingsContract;
  today: string;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'صباح الخير';
  if (h < 17) return 'مساء الخير';
  return 'مساء النور';
}

export function HeroBanner({ snapshot, isLoading, settings, today }: HeroBannerProps) {
  const activeContracts = snapshot?.operational.activeContracts ?? 0;
  const vacantUnits = snapshot?.operational.vacantUnits ?? 0;
  const collected = snapshot?.financial.collectedRent ?? 0;
  const netPosition = snapshot?.financial.netPosition ?? 0;
  const occupancy = snapshot?.operational.occupancyRate ?? 0;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 text-white sm:p-6">
      <div className="pointer-events-none absolute -left-8 -top-8 size-40 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-8 -right-4 size-32 rounded-full bg-violet-500/20 blur-3xl" />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-400">{getGreeting()}</p>
            <h1 className="mt-0.5 text-xl font-black sm:text-2xl">لوحة التحكم</h1>
            <p className="mt-1 text-xs font-bold text-slate-400">
              ملخص تشغيلي ومالي مبني على بيانات الفترة الحالية
            </p>
          </div>
          <div className="shrink-0 rounded-2xl bg-white/10 px-3 py-2 text-xs font-bold text-slate-300 backdrop-blur-sm">
            {formatCompanyDate(settings, `${snapshot?.period.dateTo ?? today}T00:00:00`)}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <HeroMetric
            isLoading={isLoading}
            label="عقد نشط"
            value={String(activeContracts)}
            large
          />
          <HeroMetric
            isLoading={isLoading}
            label="محصّل هذا الشهر"
            value={formatCompanyMoney(settings, collected)}
            ltr
          />
          <HeroMetric
            isLoading={isLoading}
            label="نسبة الإشغال"
            value={`${occupancy}%`}
          />
          <HeroMetric
            isLoading={isLoading}
            label="صافي الدخل"
            value={formatCompanyMoney(settings, netPosition)}
            ltr
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold',
              vacantUnits > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300',
            )}
          >
            <Home className="size-3" />
            {vacantUnits > 0 ? `${vacantUnits} وحدة شاغرة` : 'لا شواغر'}
          </div>
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold',
              netPosition >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300',
            )}
          >
            <TrendingUp className="size-3" />
            المحصل بعد المصروفات {formatCompanyMoney(settings, netPosition)}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroMetric({
  label,
  value,
  isLoading,
  large = false,
  ltr = false,
}: Readonly<{
  label: string;
  value: string;
  isLoading: boolean;
  large?: boolean;
  ltr?: boolean;
}>) {
  return (
    <div className="rounded-2xl bg-white/5 px-3 py-3 ring-1 ring-white/10">
      {isLoading ? (
        <Skeleton className={cn('bg-white/10', large ? 'h-9 w-16' : 'h-6 w-20')} />
      ) : (
        <p className={cn('font-black tabular-nums', large ? 'text-3xl' : 'text-lg')} dir={ltr ? 'ltr' : undefined}>
          {value}
        </p>
      )}
      <p className="mt-1 text-[11px] font-semibold text-slate-400">{label}</p>
    </div>
  );
}
