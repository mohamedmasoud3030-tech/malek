import { useEffect, useId, useRef, useState } from 'react';
import { CalendarDays, MoreVertical, RefreshCw } from 'lucide-react';
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
  /** Callback to refresh snapshot data. */
  onRefresh?: () => void;
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
 * Compact MALEK dashboard context strip.
 *
 * Density & Layout:
 *   [calendar icon] اليوم  ·  weekday + date      [freshness] [ ⋮ ]
 *
 * Designed to be intentionally compact on phone screens (390/393/430px) without
 * excessive height or hero padding. The ⋮ action control is RTL-aligned,
 * reliable, and sits on a 44px tap target.
 */
export function HeroBanner({
  snapshot,
  isLoading,
  settings,
  today,
  isRefreshing = false,
  lastUpdatedAt,
  onRefresh,
}: HeroBannerProps) {
  const language = getAppLanguageState().language;
  const { weekday, date } = formatTodayParts(language, new Date());
  const periodEnd = snapshot?.period.dateTo ?? today;
  const freshnessLabel = isLoading
    ? 'جارٍ التحميل'
    : isRefreshing
      ? 'جارٍ التحديث'
      : lastUpdatedAt
        ? `آخر تحديث ${formatUpdatedTime(lastUpdatedAt)}`
        : `حتى ${formatCompanyDate(settings, `${periodEnd}T00:00:00`)}`;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <div
      className="flex min-h-10 flex-nowrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-card px-2.5 py-1.5 shadow-card sm:min-h-11 sm:px-3 sm:py-2"
      data-dashboard-hero
      data-dashboard-context="today"
      data-dashboard-today-context
      aria-label="سياق اليوم"
    >
      {/* Brand/context side: Icon + Today + Date */}
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary sm:size-8.5"
          aria-hidden="true"
        >
          <CalendarDays className="size-4" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[0.875rem] font-black leading-tight text-foreground sm:text-[0.9375rem]">اليوم</h1>
          <p className="truncate text-[11px] font-semibold leading-tight text-muted-foreground sm:text-xs" data-dashboard-today-date>
            <span data-dashboard-today-weekday>{weekday}</span>
            <span aria-hidden="true"> · </span>
            <span data-dashboard-today-day-date>{date}</span>
          </p>
        </div>
      </div>

      {/* Actions side: Freshness indicator + ⋮ action control */}
      <div ref={rootRef} className="relative flex shrink-0 items-center gap-1">
        <span
          className="inline-flex min-h-6 items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-[10px] font-bold text-muted-foreground sm:min-h-7 sm:gap-1.5 sm:px-2.5 sm:text-[11px]"
          aria-label="حالة تحديث بيانات لوحة التحكم"
        >
          {isRefreshing ? (
            <RefreshCw
              className="size-3 shrink-0 animate-spin text-primary motion-reduce:animate-none sm:size-3.5"
              aria-hidden="true"
            />
          ) : (
            <CalendarDays className="size-3 shrink-0 text-primary sm:size-3.5" aria-hidden="true" />
          )}
          <span>{freshnessLabel}</span>
        </span>

        {/* The ⋮ action control — 44px tap target wrapper, RTL-aware */}
        <span className="relative grid size-11 shrink-0 place-items-center" data-dashboard-today-action-hit>
          <button
            ref={triggerRef}
            type="button"
            aria-label="خيارات اليوم"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? menuId : undefined}
            onClick={() => setMenuOpen((open) => !open)}
            data-dashboard-today-action
            data-today-menu-trigger
            className="grid size-8 place-items-center rounded-lg border border-border/60 text-muted-foreground outline-none transition hover:bg-muted hover:text-foreground active:scale-95 focus-visible:ring-4 focus-visible:ring-primary/20"
          >
            <MoreVertical className="size-4" aria-hidden="true" />
          </button>
        </span>

        {menuOpen ? (
          <div
            id={menuId}
            role="menu"
            aria-label="خيارات اليوم"
            className="absolute end-0 top-11 z-50 min-w-36 overflow-hidden rounded-xl border border-border/80 bg-card p-1 shadow-elevated"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onRefresh?.();
              }}
              className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 text-start text-xs font-bold text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/25"
            >
              <RefreshCw className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>تحديث البيانات</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
