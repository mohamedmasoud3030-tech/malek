import { memo } from 'react';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { AlertCircle, CheckCircle2, ShieldQuestion } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NeedsAttentionItem, NeedsAttentionSignal } from '../needs-attention-signal';
import {
  DashboardSignalEmpty,
  DashboardSignalHeader,
  DashboardSignalList,
  DashboardSignalLoading,
  DashboardSignalMain,
  DashboardSignalPanel,
  dashboardSignalRowClass,
} from './dashboard-signal-primitives';

/** Visible queue length — the rest lives in the owning workspaces. */
export const NEEDS_ATTENTION_VISIBLE_LIMIT = 6;

interface NeedsAttentionSectionProps {
  signal: NeedsAttentionSignal;
  isLoading: boolean;
  isError?: boolean;
  /** Some contributing sources failed; visible rows are valid but incomplete. */
  isPartial?: boolean;
}

const severityTone: Record<NeedsAttentionItem['severity'], 'danger' | 'warning' | 'info'> = {
  danger: 'danger',
  warning: 'warning',
  info: 'info',
};

/**
 * «يحتاج انتباهك» — one ranked, actionable queue instead of unrelated metrics.
 * The badge counts decision items, not raw records, so an aggregate action such
 * as maintenance remains one clear owner task even when several records sit
 * behind it.
 */
export const NeedsAttentionSection = memo(function NeedsAttentionSection({ signal, isLoading, isError = false, isPartial = false }: NeedsAttentionSectionProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const visibleItems = signal.items.slice(0, NEEDS_ATTENTION_VISIBLE_LIMIT);
  const hiddenCount = signal.totalCount - visibleItems.length;
  const dangerCount = signal.items.reduce((count, item) => count + (item.severity === 'danger' ? 1 : 0), 0);
  const panelClassName = dangerCount > 0
    ? 'border-danger/25 bg-gradient-to-b from-danger-bg/35 via-card to-card shadow-[0_12px_34px_-28px_hsl(var(--color-danger-text))]'
    : isPartial || signal.totalCount > 0
      ? 'border-warning/25 bg-gradient-to-b from-warning-bg/30 via-card to-card'
      : 'border-success/20 bg-gradient-to-b from-success-bg/20 via-card to-card';

  return (
    <DashboardSignalPanel labelledBy="needs-attention-title" className={panelClassName}>
      <DashboardSignalHeader
        id="needs-attention-title"
        title="يحتاج انتباهك"
        meta={
          isLoading
            ? 'جارٍ تجميع الأولويات'
            : isPartial
              ? `${signal.totalCount} أولوية ظاهرة · بعض المصادر غير متاحة`
              : signal.totalCount > 0
                ? `${signal.totalCount} أولوية تحتاج قراراً أو متابعة${dangerCount > 0 ? ` · منها ${dangerCount} عاجلة` : ''}`
                : 'لا توجد أولويات عاجلة الآن'
        }
        icon={isPartial ? ShieldQuestion : signal.totalCount > 0 ? AlertCircle : CheckCircle2}
        tone={isPartial ? 'info' : dangerCount > 0 ? 'danger' : signal.totalCount > 0 ? 'warning' : 'success'}
        trailing={signal.totalCount > 0 ? (
          <span className={cn(
            'inline-flex min-h-7 items-center rounded-full border px-2.5 text-[11px] font-black tabular-nums',
            dangerCount > 0
              ? 'border-danger/20 bg-danger-bg text-danger-text'
              : 'border-warning/20 bg-warning-bg text-warning-text',
          )}>
            {signal.totalCount}
          </span>
        ) : undefined}
      />

      {isLoading ? <DashboardSignalLoading label="جارٍ تحميل الأولويات التي تحتاج انتباهاً" /> : null}

      {!isLoading && isError ? (
        <DashboardSignalEmpty
          role="alert"
          title="تعذر تحميل الأولويات"
          description="راجع تنبيه أعلى الصفحة ثم أعد المحاولة. لن نعرض قائمة فارغة عند فشل التحميل."
        />
      ) : null}

      {!isLoading && !isError && isPartial && signal.totalCount === 0 ? (
        <DashboardSignalEmpty
          role="status"
          title="تعذر اكتمال قائمة الأولويات"
          description="لم تظهر أولويات من المصادر المتاحة، لكن لا يمكن تأكيد خلو القائمة حتى تنجح بقية القراءات."
        />
      ) : null}

      {!isLoading && !isError && !isPartial && signal.totalCount === 0 ? (
        <DashboardSignalEmpty
          title="كل شيء تحت السيطرة"
          description="لا متأخرات عاجلة ولا صيانة طارئة ولا عقود على وشك الانتهاء. راجع المؤشرات للأداء الحالي."
        />
      ) : null}

      {!isLoading && !isError && visibleItems.length > 0 ? (
        <>
          <DashboardSignalList label="الأولويات التي تحتاج انتباهاً">
            {visibleItems.map((item) => {
              const tone = severityTone[item.severity];
              const ariaLabel = `${item.title} — ${item.meta}`;
              const content = (
                <>
                  <DashboardSignalMain title={item.title} meta={item.meta} />
                  <span
                    className={cn(
                      'grid size-6 shrink-0 place-items-center rounded-full ring-1 ring-current/10',
                      tone === 'danger' ? 'bg-danger-bg text-danger-text' : tone === 'warning' ? 'bg-warning-bg text-warning-text' : 'bg-info-bg text-info-text',
                    )}
                    aria-hidden="true"
                  >
                    <ShieldQuestion className="size-3.5" />
                  </span>
                </>
              );

              return (
                <li key={item.key} role="listitem" className="min-w-0">
                  {item.contractId ? (
                    <button
                      type="button"
                      onClick={() =>
                        (navigate as unknown as (opts: unknown) => void)({
                          to: '/contracts/$contractId',
                          params: { contractId: item.contractId },
                          state: { backgroundLocation: location } as unknown as Record<string, unknown>,
                        })
                      }
                      className={dashboardSignalRowClass(tone)}
                      data-dashboard-queue-link
                      data-needs-attention-link
                      aria-label={ariaLabel}
                    >
                      {content}
                    </button>
                  ) : (
                    <Link
                      to={item.to}
                      className={dashboardSignalRowClass(tone)}
                      data-dashboard-queue-link
                      data-needs-attention-link
                      aria-label={ariaLabel}
                    >
                      {content}
                    </Link>
                  )}
                </li>
              );
            })}
          </DashboardSignalList>
          {hiddenCount > 0 ? (
            <p className="border-t border-border/60 bg-muted/[0.08] px-3.5 py-2 text-[11px] font-bold text-muted-foreground sm:px-4" data-dashboard-attention-more>
              +{hiddenCount} أولويات أخرى في مساحات العمل المرتبطة
            </p>
          ) : null}
        </>
      ) : null}
    </DashboardSignalPanel>
  );
});
