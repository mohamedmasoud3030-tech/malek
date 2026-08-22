import { Activity, Building2, CalendarDays, RefreshCw, ShieldCheck, TrendingUp, AlertTriangle } from 'lucide-react';
import { formatCompanyDate, formatCompanyMoney } from '@/lib/companyFormatters';
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
  const activeContracts = compactNumber(snapshot?.contracts.active, isLoading ? '…' : 'غير متاح');
  const occupancyRate = compactNumber(snapshot?.occupancy.occupancyRate, isLoading ? '…' : 'غير متاح');

  // Executive metrics — the most decision-relevant numbers surface here so the
  // owner reads the office's position before scrolling into any queue.
  const collectedAmount = snapshot?.collections.collectedAmount;
  const totalOverdue = snapshot?.arrears.totalOverdue;

  return (
    <header
      className="dashboard-ops-header"
      data-dashboard-hero
      data-dashboard-context="today"
      aria-labelledby="dashboard-title"
    >
      <div className="dashboard-ops-header__main">
        <div className="dashboard-ops-header__eyebrow">
          <Activity className="size-4" aria-hidden="true" />
          <span>{getGreeting()} — ابدأ بما يحتاج قرارك</span>
        </div>
        <h1 id="dashboard-title" className="dashboard-ops-header__title">اليوم</h1>
        <p className="dashboard-ops-header__support">ما يحتاج تنفيذًا الآن، ثم وضع المكتب، ثم التفاصيل عند الحاجة.</p>
      </div>

      <dl className="dashboard-ops-header__meta" aria-label="ملخص تنفيذي اليوم">
        {typeof collectedAmount === 'number' && collectedAmount !== 0 ? (
        <div className="dashboard-ops-header__pill dashboard-ops-header__pill--money" aria-label="التحصيل الشهري">
          {isRefreshing ? (
            <RefreshCw className="size-4 shrink-0 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <TrendingUp className="size-4 shrink-0 text-primary" aria-hidden="true" />
          )}
          <dt>التحصيل</dt>
          <dd className={cn(isLoading && 'dashboard-ops-header__pill--loading')}>
            <b dir="ltr" className="tabular-nums">
              {typeof collectedAmount === 'number' ? formatCompanyMoney(settings, collectedAmount) : isLoading ? '…' : 'غير متاح'}
            </b>
          </dd>
        </div>
        ) : null}

        {typeof totalOverdue === 'number' && totalOverdue !== 0 ? (
        <div className={cn('dashboard-ops-header__pill dashboard-ops-header__pill--danger', isLoading && 'dashboard-ops-header__pill--loading')}>
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          <dt>متأخرات</dt>
          <dd>
            <b dir="ltr" className="tabular-nums">
              {formatCompanyMoney(settings, totalOverdue)}
            </b>
          </dd>
        </div>
        ) : null}

        <div className={cn('dashboard-ops-header__pill', isLoading && 'dashboard-ops-header__pill--loading')}>
          <Building2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <dt>الإشغال</dt>
          <dd>
            <b dir="ltr" className="tabular-nums">{occupancyRate}</b>{isSnapshotReady || isLoading ? '%' : ''}
          </dd>
        </div>

        <div className={cn('dashboard-ops-header__pill dashboard-ops-header__pill--success', isLoading && 'dashboard-ops-header__pill--loading')}>
          <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
          <dt>عقود نشطة</dt>
          <dd><b dir="ltr" className="tabular-nums">{activeContracts}</b></dd>
        </div>

        <div className="dashboard-ops-header__pill dashboard-ops-header__pill--freshness" aria-label="تاريخ تحديث بيانات اليوم">
          {isRefreshing ? (
            <RefreshCw className="size-4 shrink-0 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden="true" />
          )}
          <dt className="sr-only">التحديث</dt>
          <dd>{freshnessLabel}</dd>
        </div>
      </dl>
    </header>
  );
}
