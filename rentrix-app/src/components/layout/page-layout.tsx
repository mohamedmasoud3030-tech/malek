import { Link, useMatches } from '@tanstack/react-router';
import { ArrowLeft, CalendarDays, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { APP_BRAND_NAME } from '@/lib/brand';
import { getAppLanguageState } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { PageHeaderActions } from './page-header-actions';

export interface PageLayoutProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  dir?: 'rtl' | 'ltr';
  size?: 'default' | 'wide' | 'full';
  lang?: string;
  title?: string;
  description?: ReactNode;
  count?: number | string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  backTo?: string;
  backLabel?: string;
  /** Kept for source compatibility while all pages use one visual system. */
  visualVariant?: 'malek-pro';
  /** Optional page-level refresh. It becomes the primary action only when no explicit primaryAction exists. */
  onRefresh?: () => void;
  refreshing?: boolean;
}

const pageSizes: Record<NonNullable<PageLayoutProps['size']>, string> = {
  default: 'mx-auto w-full max-w-[82rem] xl:max-w-[90rem]',
  wide: 'mx-auto w-full max-w-[96rem] 2xl:max-w-[104rem]',
  full: 'w-full',
};

function getTodayContext() {
  const { language } = getAppLanguageState();
  const isArabic = language === 'ar';
  const locale = isArabic ? 'ar-EG' : 'en-GB';
  const now = new Date();

  return {
    isArabic,
    todayLabel: isArabic ? 'اليوم' : 'Today',
    weekday: new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(now),
    date: new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(now),
  };
}

export function PageLayout({
  children,
  className,
  contentClassName,
  dir,
  lang,
  size = 'default',
  title,
  description,
  count,
  primaryAction,
  secondaryActions,
  backTo,
  backLabel = 'العودة',
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
  const resolvedTitle = title?.trim() || routeTitle || APP_BRAND_NAME;
  const { isArabic, todayLabel, weekday, date } = getTodayContext();
  const refreshAction = onRefresh ? (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className="min-h-11"
      onClick={onRefresh}
      disabled={refreshing}
      aria-label={isArabic ? 'تحديث' : 'Refresh'}
    >
      <RefreshCw className={cn('me-1.5 size-4', refreshing && 'animate-spin')} aria-hidden="true" />
      {isArabic ? 'تحديث' : 'Refresh'}
    </Button>
  ) : null;
  const resolvedPrimaryAction = primaryAction ?? refreshAction;
  const hasSupportingTools = Boolean(backTo || secondaryActions);

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
        <header
          data-global-page-context
          data-global-today-context
          data-page-header
          className="mx-3 mt-2 flex min-h-14 min-w-0 items-center gap-3 rounded-2xl border border-border/70 bg-card px-3 py-2.5 shadow-card sm:mx-4 sm:px-4 sm:py-3 lg:mx-6"
          aria-label={
            isArabic
              ? `${resolvedTitle} — ${todayLabel} ${weekday} ${date}`
              : `${resolvedTitle} — ${todayLabel}, ${weekday} ${date}`
          }
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex min-w-0 items-center gap-1.5">
              <h1
                data-global-page-title
                className="min-w-0 truncate text-xl font-black leading-7 sm:text-[1.375rem] sm:leading-8"
              >
                {resolvedTitle}
              </h1>
              {count !== undefined ? (
                <span
                  className="inline-flex min-h-6 shrink-0 items-center rounded-md border border-border bg-muted/45 px-2 py-0.5 text-xs font-bold tabular-nums text-muted-foreground"
                  aria-label={`${isArabic ? 'عدد السجلات' : 'Records'} ${count}`}
                >
                  {count}
                </span>
              ) : null}
            </div>

            <span className="hidden h-5 w-px shrink-0 bg-border sm:block" aria-hidden="true" />

            <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <span
                className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"
                aria-hidden="true"
              >
                <CalendarDays className="size-4" />
              </span>
              <span data-global-day-label className="hidden shrink-0 text-xs font-black text-foreground sm:inline">
                {todayLabel}
              </span>
              <p className="min-w-0 truncate text-[0.8125rem] font-medium leading-5" data-global-today-date>
                <span data-global-today-weekday>{weekday}</span>
                <span aria-hidden="true"> · </span>
                <span data-global-today-day-date>{date}</span>
              </p>
            </div>
          </div>

          {resolvedPrimaryAction ? (
            <div data-page-primary-action className="shrink-0">
              {resolvedPrimaryAction}
            </div>
          ) : null}
        </header>

        {description ? (
          <p className="mx-3 max-w-3xl text-[0.8125rem] leading-5 text-muted-foreground [overflow-wrap:anywhere] sm:mx-4 lg:mx-6">
            {description}
          </p>
        ) : null}

        {hasSupportingTools ? (
          <div
            data-page-supporting-tools
            className="mx-3 flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:mx-4 sm:gap-2 lg:mx-6"
          >
            {backTo ? (
              <Button variant="secondary" size="sm" asChild className="min-h-11">
                <Link to={backTo}>
                  <ArrowLeft className="me-1 size-3.5 rtl:rotate-180" aria-hidden="true" />
                  <span className="hidden sm:inline">{backLabel}</span>
                  <span className="sm:hidden">رجوع</span>
                </Link>
              </Button>
            ) : null}
            <PageHeaderActions title={resolvedTitle} secondaryActions={secondaryActions} />
          </div>
        ) : null}

        {children}
      </div>
    </div>
  );
}
