import { CalendarDays, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
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

function formatUpdatedTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString('ar-OM', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Compact dashboard context header.
 *
 * The global app toolbar owns date/day identity, so the dashboard does not
 * repeat a marketing-style hero or duplicate its KPI payload here. This block
 * only identifies the workspace and communicates snapshot freshness.
 */
export function HeroBanner({ snapshot, isLoading, settings, today, isRefreshing = false, lastUpdatedAt }: HeroBannerProps) {
  const periodEnd = snapshot?.period.dateTo ?? today;
  const freshnessLabel = isLoading
    ? 'جارٍ تحميل بيانات اليوم'
    : isRefreshing
      ? 'جارٍ تحديث البيانات'
      : lastUpdatedAt
        ? `آخر تحديث ${formatUpdatedTime(lastUpdatedAt)}`
        : `حتى ${formatCompanyDate(settings, `${periodEnd}T00:00:00`)}`;

  return (
    <div
      className="space-y-2"
      data-dashboard-hero
      data-dashboard-context="today"
      aria-label="سياق لوحة التحكم"
    >
      <PageHeader
        title="اليوم"
        secondaryActions={(
          <span
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border/80 bg-card px-3 text-xs font-bold text-muted-foreground"
            aria-label="حالة تحديث بيانات لوحة التحكم"
          >
            {isRefreshing ? (
              <RefreshCw className="size-4 shrink-0 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden="true" />
            )}
            {freshnessLabel}
          </span>
        )}
      />
    </div>
  );
}
