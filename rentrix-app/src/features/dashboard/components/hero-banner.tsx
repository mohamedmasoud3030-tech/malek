import { AlertTriangle, Building2, CalendarDays, RefreshCw, ShieldCheck, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { formatCompanyDate, formatCompanyMoney } from '@/lib/companyFormatters';
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

function compactNumber(value: number | undefined, fallback: string) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
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
  const isSnapshotReady = Boolean(snapshot);
  const activeContracts = compactNumber(snapshot?.contracts.active, isLoading ? '…' : 'غير متاح');
  const occupancyRate = compactNumber(snapshot?.occupancy.occupancyRate, isLoading ? '…' : 'غير متاح');
  const occupancyValue = `${occupancyRate}${isSnapshotReady || isLoading ? '%' : ''}`;
  const collectedAmount = snapshot?.collections.collectedAmount;
  const totalOverdue = snapshot?.arrears.totalOverdue;

  return (
    <div
      className="space-y-3"
      data-dashboard-hero
      data-dashboard-context="today"
      aria-label="ملخص اليوم"
    >
      <PageHeader
        title="اليوم"
        description={`${getGreeting()} — ابدأ بما يحتاج قرارك. ما يحتاج تنفيذًا الآن، ثم وضع المكتب، ثم التفاصيل عند الحاجة.`}
        secondaryActions={(
          <span className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-bold text-muted-foreground" aria-label="تاريخ تحديث بيانات اليوم">
            {isRefreshing ? (
              <RefreshCw className="size-4 shrink-0 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden="true" />
            )}
            {freshnessLabel}
          </span>
        )}
      />

      <ResponsiveCardGrid gap="sm" aria-label="ملخص تنفيذي اليوم">
        {typeof collectedAmount === 'number' && collectedAmount !== 0 ? (
          <KpiCard
            label="التحصيل"
            value={formatCompanyMoney(settings, collectedAmount)}
            sub="التحصيل الشهري"
            icon={TrendingUp}
            accent="emerald"
            compact
          />
        ) : null}
        {typeof totalOverdue === 'number' && totalOverdue !== 0 ? (
          <KpiCard
            label="متأخرات"
            value={formatCompanyMoney(settings, totalOverdue)}
            sub="تحتاج متابعة تحصيل"
            icon={AlertTriangle}
            accent="rose"
            compact
          />
        ) : null}
        <KpiCard
          label="الإشغال"
          value={occupancyValue}
          sub="نسبة الوحدات المشغولة"
          icon={Building2}
          accent="sky"
          compact
        />
        <KpiCard
          label="عقود نشطة"
          value={activeContracts}
          sub="العقود الحالية"
          icon={ShieldCheck}
          accent="emerald"
          compact
        />
      </ResponsiveCardGrid>
    </div>
  );
}
