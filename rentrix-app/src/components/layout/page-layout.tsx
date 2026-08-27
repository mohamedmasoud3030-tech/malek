import type { ReactNode } from 'react';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { getAppLanguageState } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface PageLayoutProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  dir?: 'rtl' | 'ltr';
  size?: 'default' | 'wide' | 'full';
  lang?: string;
  /** Scoped visual system for approved operational workspaces only. */
  visualVariant?: 'malek-pro';
  /**
   * Explicit refresh affordance in the shared context strip. Operational
   * pages whose data can go stale without a focus refetch (the dashboard
   * snapshot, for example) wire this so freshness stays one honest,
   * consistent tap away — never a per-page duplicate card.
   */
  onRefresh?: () => void;
  refreshing?: boolean;
}

const pageSizes: Record<NonNullable<PageLayoutProps['size']>, string> = {
  default: 'mx-auto w-full max-w-[82rem] xl:max-w-[90rem]',
  wide: 'mx-auto w-full max-w-[96rem] 2xl:max-w-[104rem]',
  full: 'w-full',
};

function TodayContextStrip({ onRefresh, refreshing }: Readonly<{ onRefresh?: () => void; refreshing?: boolean }>) {
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

  return (
    <div
      data-global-today-context
      aria-label={isArabic ? 'اليوم والتاريخ' : 'Today and date'}
      className="sticky top-[calc(3rem+env(safe-area-inset-top,0px))] z-10 mx-3 mt-2 flex min-h-14 items-center rounded-2xl border border-border/70 bg-card/96 px-3 shadow-sm backdrop-blur-sm sm:top-[calc(3.5rem+env(safe-area-inset-top,0px))] sm:mx-4 sm:min-h-16 sm:px-4 lg:mx-6"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary sm:size-11"
          aria-hidden="true"
        >
          <CalendarDays className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-base font-black leading-tight text-foreground sm:text-lg">
            {isArabic ? 'اليوم' : 'Today'}
          </p>
          <p className="mt-0.5 truncate text-xs font-semibold leading-5 text-muted-foreground sm:text-sm" data-global-today-date>
            <span data-global-today-weekday>{weekday}</span>
            <span aria-hidden="true"> · </span>
            <span data-global-today-day-date>{date}</span>
          </p>
        </div>
      </div>
      {onRefresh ? (
        <button
          type="button"
          data-global-refresh
          aria-label={isArabic ? 'تحديث' : 'Refresh'}
          title={isArabic ? 'تحديث' : 'Refresh'}
          onClick={onRefresh}
          disabled={refreshing}
          className="ms-auto grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"
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
  visualVariant,
  onRefresh,
  refreshing,
}: PageLayoutProps) {
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
          'min-w-0 space-y-2.5 pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] sm:space-y-3 md:space-y-3.5 md:pb-6 lg:space-y-5 lg:pb-10',
          contentClassName,
        )}
      >
        <TodayContextStrip onRefresh={onRefresh} refreshing={refreshing} />
        {children}
      </div>
    </div>
  );
}
