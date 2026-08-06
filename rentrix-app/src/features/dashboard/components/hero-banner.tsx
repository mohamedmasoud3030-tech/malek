import { Activity, Building2, CalendarDays, RefreshCw, ShieldCheck } from 'lucide-react';
import { formatCompanyDate } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';
import { cn } from '@/lib/utils';
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
  const activeContracts = compactNumber(snapshot?.operational.activeContracts, isLoading ? '…' : 'غير متاح');
  const occupancyRate = compactNumber(snapshot?.operational.occupancyRate, isLoading ? '…' : 'غير متاح');

  return (
    <header
      className="dashboard-ops-header"
      data-dashboard-hero
      data-dashboard-context="compact"
      aria-labelledby="dashboard-title"
    >
      <div className="dashboard-ops-header__main">
        <div className="dashboard-ops-header__eyebrow">
          <Activity className="size-4" aria-hidden="true" />
          <span>{getGreeting()} — متابعة تشغيلية مختصرة</span>
        </div>
        <h1 id="dashboard-title" className="dashboard-ops-header__title">لوحة التحكم</h1>
        <p className="dashboard-ops-header__support">الأعمال العاجلة، مؤشرات التحصيل، وحالة المحفظة في لقطة واحدة.</p>
      </div>

      <dl className="dashboard-ops-header__meta" aria-label="سياق لوحة التحكم">
        <div className="dashboard-ops-header__pill" aria-label="تاريخ تحديث لوحة التحكم">
          {isRefreshing ? (
            <RefreshCw className="size-4 shrink-0 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden="true" />
          )}
          <dt className="sr-only">التحديث</dt>
          <dd>{freshnessLabel}</dd>
        </div>
        <div className={cn('dashboard-ops-header__pill', isLoading && 'dashboard-ops-header__pill--loading')}>
          <Building2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <dt>الإشغال</dt>
          <dd>
            <b dir="ltr" className="tabular-nums">{occupancyRate}</b>{isSnapshotReady || isLoading ? '%' : ''}
          </dd>
        </div>
        <div className={cn('dashboard-ops-header__pill dashboard-ops-header__pill--success', isLoading && 'dashboard-ops-header__pill--loading')}>
          <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
          <dt>العقود النشطة</dt>
          <dd><b dir="ltr" className="tabular-nums">{activeContracts}</b></dd>
        </div>
      </dl>
    </header>
  );
}
