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
  /** Show today's day/date only when the current workflow is genuinely time-sensitive. */
  showTodayContext?: boolean;
  className?: string;
}

function getTodayContext(isArabic: boolean) {
  const locale = isArabic ? 'ar-EG' : 'en-GB';
  const now = new Date();

  return {
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
 * Canonical MALEK page identity.
 *
 * The header behaves like document chrome rather than another card: identity
 * first, context immediately beneath it, one obvious primary action at the
 * edge. Time context is opt-in instead of repeated across the whole product.
 * Presentation belongs to the shared visual-wave contract on every viewport;
 * this component must not hard-reset the mobile surface with utility overrides.
 */
export function PageHeader({
  title,
  description,
  count,
  backTo,
  backLabel = 'العودة',
  primaryAction,
  secondaryActions,
  showTodayContext = false,
  className,
}: PageHeaderProps) {
  const resolvedPrimaryAction = primaryAction;
  const hasSupportingTools = Boolean(backTo || secondaryActions);
  const { language } = getAppLanguageState();
  const isArabic = language === 'ar';
  const todayContext = showTodayContext ? getTodayContext(isArabic) : null;

  return (
    <div
      data-page-header
      className={cn('min-w-0 space-y-1.5', className)}
    >
      <header
        data-global-page-context
        data-unified-surface="page-header"
        className="flex min-w-0 flex-col gap-2 border-b border-border/60 pb-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:pb-3.5"
        aria-label={todayContext
          ? isArabic
            ? `${title} — ${todayContext.todayLabel} ${todayContext.weekday} ${todayContext.date}`
            : `${title} — ${todayContext.todayLabel}, ${todayContext.weekday} ${todayContext.date}`
          : title}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1
              data-global-page-title
              className="min-w-0 text-[1.35rem] font-black leading-7 tracking-[-0.02em] [overflow-wrap:anywhere] sm:text-[1.65rem] sm:leading-9"
            >
              {title}
            </h1>
            {count !== undefined ? (
              <span
                className="inline-flex min-h-6 shrink-0 items-center rounded-full bg-muted/60 px-2 py-0.5 text-xs font-bold tabular-nums text-muted-foreground"
                aria-label={`${isArabic ? 'عدد السجلات' : 'Records'} ${count}`}
              >
                {count}
              </span>
            ) : null}
          </div>

          {description ? (
            <p className="max-w-3xl text-[0.8125rem] font-medium leading-5 text-muted-foreground [overflow-wrap:anywhere] sm:text-sm sm:leading-6">
              {description}
            </p>
          ) : null}

          {todayContext ? (
            <div
              data-global-today-context
              className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-muted-foreground"
            >
              <CalendarDays className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span data-global-day-label className="font-black text-foreground">{todayContext.todayLabel}</span>
              <span aria-hidden="true">·</span>
              <span data-global-today-date className="min-w-0 truncate">
                <span data-global-today-weekday>{todayContext.weekday}</span>
                <span aria-hidden="true">، </span>
                <span data-global-today-day-date>{todayContext.date}</span>
              </span>
            </div>
          ) : null}
        </div>

        {resolvedPrimaryAction ? (
          <div data-page-primary-action className="shrink-0 self-start sm:self-center">
            {resolvedPrimaryAction}
          </div>
        ) : null}
      </header>

      {hasSupportingTools ? (
        <div
          data-page-supporting-tools
          className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2"
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
