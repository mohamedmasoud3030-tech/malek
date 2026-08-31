import { Hourglass } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import type { AgingBucketChartRow } from '../../reports-page.helpers';
import { ReportList, ReportListRow, ReportPanel, ReportState } from '@/components/ui/report-section-primitives';
import { formatLatinNumber } from '@/lib/formatters';

/**
 * Aged receivables distribution. Aged receivables cover the outstanding
 * balance, which is wider than overdue: the current (not-yet-due) bucket is
 * part of outstanding but must never be presented as overdue debt. The
 * caller passes `currentBucketLabel` from the authoritative report so the
 * current bucket is explicitly badged as "ليس متأخرًا" instead of blending
 * into the arrears buckets.
 */
export function AgingBucketsPanel({
  rows,
  currentBucketLabel,
  action,
  isLoading,
}: Readonly<{
  rows: AgingBucketChartRow[];
  /** Authoritative label of the current/not-yet-due bucket, when present. */
  currentBucketLabel?: string;
  action?: React.ReactNode;
  isLoading: boolean;
}>) {
  const maximum = Math.max(...rows.map((row) => row.total), 0);

  return (
    <ReportPanel
      title="تعتيق الذمم"
      description="توزيع الرصيد المستحق حسب عمر الدين. شريحة «غير متأخر» رصيد جارٍ لم يحن استحقاقه ولا تُحتسب ضمن المتأخرات."
      icon={Hourglass}
      action={action}
      isLoading={isLoading}
    >
      {rows.length === 0 ? (
        <div className="p-4"><ReportState message="لا توجد ذمم لعرض التعتيق المحاسبي." /></div>
      ) : (
        <ReportList>
          {rows.map((row) => {
            const width = maximum > 0 ? Math.max(4, Math.round((row.total / maximum) * 100)) : 0;
            const isCurrentBucket = Boolean(currentBucketLabel) && row.bucket === currentBucketLabel;
            return (
              <ReportListRow
                key={row.bucket}
                title={(
                  <span className="flex flex-wrap items-center gap-2">
                    <span>{row.bucket}</span>
                    {isCurrentBucket ? <StatusBadge tone="neutral">ليس متأخرًا</StatusBadge> : null}
                  </span>
                )}
                subtitle={`${formatLatinNumber(row.invoiceCount, 'ar')} فواتير`}
                meta={(
                  <span className="block h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                    <span
                      className={`block h-full rounded-full ${isCurrentBucket ? 'bg-muted-foreground/40' : 'bg-primary'}`}
                      style={{ width: `${width}%` }}
                    />
                  </span>
                )}
                value={<span dir="ltr">{formatMoney(row.total)}</span>}
              />
            );
          })}
        </ReportList>
      )}
    </ReportPanel>
  );
}
