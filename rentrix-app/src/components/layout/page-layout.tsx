import { useMatches } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { APP_BRAND_NAME } from '@/lib/brand';
import { getAppLanguageState } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface PageLayoutProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  dir?: 'rtl' | 'ltr';
  size?: 'default' | 'wide' | 'full';
  lang?: string;
  /** Page name used only for accessible context; visible naming belongs to PageHeader. */
  title?: string;
  /** Scoped visual system for approved operational workspaces only. */
  visualVariant?: 'malek-pro';
  /** Explicit refresh affordance for operational pages whose data can go stale. */
  onRefresh?: () => void;
  refreshing?: boolean;
}

const pageSizes: Record<NonNullable<PageLayoutProps['size']>, string> = {
  default: 'mx-auto w-full max-w-[82rem] xl:max-w-[90rem]',
  wide: 'mx-auto w-full max-w-[96rem] 2xl:max-w-[104rem]',
  full: 'w-full',
};

function DayContextStrip({
  contextTitle,
  onRefresh,
  refreshing,
}: Readonly<{ contextTitle: string; onRefresh?: () => void; refreshing?: boolean }>) {
  const { language } = getAppLanguageState();
  const isArabic = language === 'ar';
  const locale = isArabic ? 'ar-EG' : 'en-GB';
  const now = new Date();
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(now);
  const date = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(now);
  const todayLabel = isArabic ? 'اليوم' : 'Today';

  return (
    <div
      data-global-page-context
      data-global-today-context
      aria-label={isArabic ? `${contextTitle} — ${todayLabel} ${weekday} ${date}` : `${contextTitle} — ${todayLabel}, ${weekday} ${date}`}
      className="mx-3 mt-2 flex min-h-14 min-w-0 items-center rounded-2xl border border-border/60 bg-card px-3 sm:mx-4 sm:px-4 lg:mx-6"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"
          aria-hidden="true"
        >
          <CalendarDays className="size-4" />
        </span>
        <p data-global-day-label className="shrink-0 text-xs font-black leading-5 text-foreground">
          {todayLabel}
        </p>
        <span className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />
        <p className="min-w-0 truncate text-[0.8125rem] font-medium leading-5 text-muted-foreground" data-global-today-date>
          <span data-global-today-weekday>{weekday}</span>
          <span aria-hidden="true"> · </span>
          <span data-global-today-day-date>{date}</span>
        </p>
      </div>

      {onRefresh ? (
        <button
          type="button"
          data-global-refresh
          aria-label={isArabic ? 'تحديث' : 'Refresh'}
          title={isArabic ? 'تحديث' : 'Refresh'}
          onClick={onRefresh}
          disabled={refreshing}
          className="ms-2 grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"
        >
          <RefreshCw className={cn('size-4.5', refreshing && 'animate-spin')} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

export function PageLayout({
  children,
  className,
  contentClassName,
  dir,
  lang,
  size = 'default',
  title,
  visualVariant,
  onRefresh,
  refreshing,
}: PageLayoutProps) {
  const matches = useMatches();
  const routeTitle =
    ([...matches]
      .reverse()
      .find((match) => (match.staticData as { title?: string } | undefined)?.title)
      ?.staticData as { title?: string } | undefined)?.title;
  const contextTitle = title?.trim() || routeTitle || APP_BRAND_NAME;

  return (
    <div
      data-page-layout
      data-visual-wave={visualVariant}
      className={cn('min-w-0 overflow-x-clip', className)}
      dir={dir}
      lang={lang}
    >
      <div
        className={cn(
          pageSizes[size],
          'min-w-0 space-y-2.5 pb-[var(--mobile-dock-clearance,5.25rem)] sm:space-y-3 md:space-y-3.5 md:pb-6 lg:space-y-5 lg:pb-10',
          contentClassName,
        )}
      >
        <DayContextStrip contextTitle={contextTitle} onRefresh={onRefresh} refreshing={refreshing} />
        {children}
      </div>
    </div>
  );
}
