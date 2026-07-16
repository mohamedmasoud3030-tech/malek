import { Hourglass } from 'lucide-react';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import type { AgingBucketChartRow } from '../../reports-page.helpers';
import { ReportList, ReportListRow, ReportPanel, ReportState } from '../report-section-primitives';

export function AgingBucketsPanel({
  rows,
  action,
  isLoading,
}: Readonly<{
  rows: AgingBucketChartRow[];
  action?: React.ReactNode;
  isLoading: boolean;
}>) {
  const maximum = Math.max(...rows.map((row) => row.total), 0);

  return (
    <ReportPanel
      title="تعتيق الذمم"
      description="توزيع الرصيد المستحق حسب عمر الدين."
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
            return (
              <ReportListRow
                key={row.bucket}
                title={row.bucket}
                subtitle={`${row.invoiceCount.toLocaleString('ar')} فواتير`}
                meta={(
                  <span className="block h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
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
