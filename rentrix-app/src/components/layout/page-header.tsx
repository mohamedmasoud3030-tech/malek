import { Link } from '@tanstack/react-router';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { getAppLanguageState } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { PageHeaderActions } from './page-header-actions';

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  count?: number | string;
  backTo?: string;
  backLabel?: string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  /** @deprecated Use primaryAction for the main page action. */
  action?: ReactNode;
  className?: string;
}

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

/**
 * The one visible page chrome across MALEK.
 * The bar owns page name + today/date + exactly one primary page action.
 * Supporting description, back navigation and secondary actions stay below it.
 */
export function PageHeader({
  title,
  description,
  count,
  backTo,
  backLabel = 'العودة',
  primaryAction,
  secondaryActions,
  action,
  className,
}: PageHeaderProps) {
  const resolvedPrimaryAction = primaryAction ?? action;
  const hasSupportingTools = Boolean(backTo || secondaryActions);
  const { isArabic, todayLabel, weekday, date } = getTodayContext();

  return (
    <div data-page-header className={cn('min-w-0 space-y-2', className)}>
      <header
        data-global-page-context
        data-global-today-context
        data-unified-surface="page-header"
        className="flex min-h-14 min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border/70 bg-card px-3 py-2.5 shadow-card sm:flex-nowrap sm:px-4 sm:py-3"
        aria-label={
          isArabic
            ? `${title} — ${todayLabel} ${weekday} ${date}`
            : `${title} — ${todayLabel}, ${weekday} ${date}`
        }
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5 sm:flex-nowrap">
          <div className="flex min-w-0 max-w-full items-center gap-1.5">
            <h1
              data-global-page-title
              className="min-w-0 truncate text-xl font-black leading-7 [overflow-wrap:anywhere] sm:text-[1.375rem] sm:leading-8"
            >
              {title}
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

          <div className="flex min-w-0 max-w-full basis-full items-center gap-2 text-muted-foreground sm:basis-auto sm:flex-1">
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
        <p className="px-3 text-[0.8125rem] leading-5 text-muted-foreground [overflow-wrap:anywhere] sm:px-4">
          {description}
        </p>
      ) : null}

      {hasSupportingTools ? (
        <div
          data-page-supporting-tools
          className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 px-3 sm:gap-2 sm:px-4"
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
          <PageHeaderActions title={title} secondaryActions={secondaryActions} />
        </div>
      ) : null}
    </div>
  );
}
