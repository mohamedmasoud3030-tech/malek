import { memo } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { AlertCircle, CheckCircle2, ShieldQuestion } from 'lucide-react';
import { ReportList, ReportListRow, ReportPanel, ReportState } from '@/components/ui/report-section-primitives';
import { cn } from '@/lib/utils';
import type { NeedsAttentionItem, NeedsAttentionSignal } from '../needs-attention-signal';

/**
 * The row is presentational (`ReportListRow`); this class belongs to the
 * caller-owned interactive element that wraps it, so the whole row stays one
 * 50px target with an inset focus ring.
 */
const queueRowLinkClass =
  'block w-full min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/25';

/** Visible queue length — the rest lives in the owning workspaces. */
export const NEEDS_ATTENTION_VISIBLE_LIMIT = 6;

interface NeedsAttentionSectionProps {
  signal: NeedsAttentionSignal;
  isLoading: boolean;
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
export const NeedsAttentionSection = memo(function NeedsAttentionSection({ signal, isLoading, isPartial = false }: NeedsAttentionSectionProps) {
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
    <ReportPanel
      dense
      className={panelClassName}
      icon={isPartial ? ShieldQuestion : signal.totalCount > 0 ? AlertCircle : CheckCircle2}
      tone={isPartial ? 'info' : dangerCount > 0 ? 'danger' : signal.totalCount > 0 ? 'warning' : 'success'}
      title="يحتاج انتباهك"
      titleId="needs-attention-title"
      aria-labelledby="needs-attention-title"
      description={
        isLoading
          ? 'جارٍ تجميع الأولويات'
          : isPartial
            ? `${signal.totalCount} أولوية ظاهرة · بعض المصادر غير متاحة`
            : signal.totalCount > 0
              ? `${signal.totalCount} أولوية تحتاج قراراً أو متابعة${dangerCount > 0 ? ` · منها ${dangerCount} عاجلة` : ''}`
              : 'لا توجد أولويات عاجلة الآن'
      }
      action={signal.totalCount > 0 ? (
        <span className={cn(
          'inline-flex min-h-7 items-center rounded-full border px-2.5 text-[11px] font-black tabular-nums',
          dangerCount > 0
            ? 'border-danger/20 bg-danger-bg text-danger-text'
            : 'border-warning/20 bg-warning-bg text-warning-text',
        )}>
          {signal.totalCount}
        </span>
      ) : undefined}
      isLoading={isLoading}
      loadingLabel="جارٍ تحميل الأولويات التي تحتاج انتباهاً"
    >
      {!isLoading && isPartial && signal.totalCount === 0 ? (
        <ReportState
          kind="empty"
          title="تعذر اكتمال قائمة الأولويات"
          message="لم تظهر أولويات من المصادر المتاحة، لكن لا يمكن تأكيد خلو القائمة حتى تنجح بقية القراءات."
          className="min-h-0 rounded-none border-0 border-t border-dashed border-border/60 bg-muted/[0.08] py-3 sm:min-h-0"
        />
      ) : null}

      {!isLoading && !isPartial && signal.totalCount === 0 ? (
        <ReportState
          kind="empty"
          title="كل شيء تحت السيطرة"
          message="لا متأخرات عاجلة ولا صيانة طارئة ولا عقود على وشك الانتهاء. راجع المؤشرات للأداء الحالي."
          className="min-h-0 rounded-none border-0 border-t border-dashed border-border/60 bg-muted/[0.08] py-3 sm:min-h-0"
        />
      ) : null}

      {!isLoading && visibleItems.length > 0 ? (
        <>
          <ReportList as="ul" label="الأولويات التي تحتاج انتباهاً">
            {visibleItems.map((item) => {
              const tone = severityTone[item.severity];
              const ariaLabel = `${item.title} — ${item.meta}`;
              const row = (
                <ReportListRow
                  dense
                  tone={tone}
                  title={item.title}
                  subtitle={item.meta}
                  action={
                    <span
                      className={cn(
                        'grid size-6 shrink-0 place-items-center rounded-full ring-1 ring-current/10',
                        tone === 'danger' ? 'bg-danger-bg text-danger-text' : tone === 'warning' ? 'bg-warning-bg text-warning-text' : 'bg-info-bg text-info-text',
                      )}
                      aria-hidden="true"
                    >
                      <ShieldQuestion className="size-3.5" />
                    </span>
                  }
                />
              );

              return (
                <li key={item.key} className="min-w-0">
                  {item.contractId ? (
                    <Link
                      to="/contracts/$contractId"
                      params={{ contractId: item.contractId }}
                      state={{ backgroundLocation: location } as never}
                      className={queueRowLinkClass}
                      data-dashboard-queue-link
                      data-needs-attention-link
                      aria-label={ariaLabel}
                    >
                      {row}
                    </Link>
                  ) : (
                    <Link
                      to={item.to}
                      search={item.search}
                      className={queueRowLinkClass}
                      data-dashboard-queue-link
                      data-needs-attention-link
                      aria-label={ariaLabel}
                    >
                      {row}
                    </Link>
                  )}
                </li>
              );
            })}
          </ReportList>
          {hiddenCount > 0 ? (
            <p className="border-t border-border/60 bg-muted/[0.08] px-3.5 py-2 text-[11px] font-bold text-muted-foreground sm:px-4" data-dashboard-attention-more>
              +{hiddenCount} أولويات أخرى في مساحات العمل المرتبطة
            </p>
          ) : null}
        </>
      ) : null}
    </ReportPanel>
  );
});
