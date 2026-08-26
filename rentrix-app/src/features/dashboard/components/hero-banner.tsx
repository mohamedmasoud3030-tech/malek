import { CalendarDays, RefreshCw } from 'lucide-react';
import { getAppLanguageState } from '@/lib/i18n';
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
 * Localized weekday + date for the Today context strip.
 * The Day + Date used to live centered in the top app header; it now lives
 * here, where it belongs to the dashboard context instead of the chrome.
 */
function formatTodayParts(language: string, now: Date) {
  const isArabic = language === 'ar';
  const locale = isArabic ? 'ar-EG' : 'en-GB';
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(now);
  const date = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(now);
  return { weekday, date };
}

/**
 * Compact dashboard context strip (NOT a hero card).
 *
 * Single-line composition, balanced for Arabic RTL and English LTR:
 *   [icon] اليوم / Today  ·  weekday + date        [freshness, when useful]
 * No oversized minimum heights, no duplicated date, no decorative padding.
 */
export function HeroBanner({ snapshot, isLoading, settings, today, isRefreshing = false, lastUpdatedAt }: HeroBannerProps) {
  const language = getAppLanguageState().language;
  const { weekday, date } = formatTodayParts(language, new Date());
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
      className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-border/70 bg-card px-3 py-2 shadow-card sm:min-h-12"
      data-dashboard-hero
      data-dashboard-context="today"
      data-dashboard-today-context
      aria-label="سياق اليوم"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
          <CalendarDays className="size-4" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[0.9375rem] font-black leading-5 text-foreground">اليوم</h1>
          <p className="truncate text-xs font-semibold leading-4 text-muted-foreground" data-dashboard-today-date>
            <span data-dashboard-today-weekday>{weekday}</span>
            <span aria-hidden="true"> · </span>
            <span data-dashboard-today-day-date>{date}</span>
          </p>
        </div>
      </div>

      <span
        className="inline-flex min-h-7 items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1 text-[11px] font-bold text-muted-foreground"
        aria-label="حالة تحديث بيانات لوحة التحكم"
      >
        {isRefreshing ? (
          <RefreshCw className="size-3.5 shrink-0 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <CalendarDays className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
        )}
        {freshnessLabel}
      </span>
    </div>
  );
}
