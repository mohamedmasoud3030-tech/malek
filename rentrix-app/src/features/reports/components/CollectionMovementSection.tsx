import { ReceiptText } from 'lucide-react';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import type { DailyCollectionReportRow } from '@/features/financials/reports/financialReportsService';
import type { CollectionSummaryReport } from '@/features/financials/reports/financial-reporting/report-types';
import { ReportPanel, ReportState, ReportSummaryStrip } from '@/components/ui/report-section-primitives';
import { DailyCollectionsPanel } from './collections/daily-collections-panel';
import { ReceiptLinksPanel, type CollectionReceiptRow } from './collections/receipt-links-panel';

type CollectionMovementProps = Readonly<{
  summary: CollectionSummaryReport | undefined;
  rows: DailyCollectionReportRow[];
  receiptRows: CollectionReceiptRow[];
  from: string;
  to: string;
  canExportReports: boolean;
  isLoading: boolean;
}>;

/**
 * حركة التحصيل — the cash-movement perspective of the collections workspace.
 * Reuses the same daily-collection and receipt-link panels (and the same read
 * model) as the period summary; it adds no new data source of its own.
 */
export function CollectionMovementSection({
  summary,
  rows,
  receiptRows,
  isLoading,
}: CollectionMovementProps) {
  const totalCollected = summary?.paid ?? rows.reduce((total, row) => total + row.totalPaid, 0);
  const paymentsCount = rows.reduce((total, row) => total + row.paymentsCount, 0);

  return (
    <div className="space-y-4">
      <ReportPanel
        title="حركة التحصيل"
        description="التحصيل اليومي حسب طرق السداد وأحدث الإيصالات المرتبطة — نفس مصدر ملخص الفترة."
        eyebrow="تدفق نقدي تشغيلي"
        icon={ReceiptText}
        isLoading={isLoading}
      >
        <div className="px-4 pt-3 sm:px-5">
          <ReportSummaryStrip
            dataReportSummary="collection-movement"
            items={[
              { label: 'إجمالي المحصّل', value: formatMoney(totalCollected), tone: 'good' },
              { label: 'عدد الدفعات', value: String(paymentsCount) },
              { label: 'الإيصالات المعروضة', value: String(receiptRows.length) },
            ]}
          />
        </div>
        {rows.length === 0 && receiptRows.length === 0 ? (
          <div className="p-4">
            <ReportState message="لا توجد حركة تحصيل في الفترة المحددة." />
          </div>
        ) : null}
      </ReportPanel>

      <DailyCollectionsPanel rows={rows} isLoading={isLoading} />
      <ReceiptLinksPanel rows={receiptRows} isLoading={isLoading} />
    </div>
  );
}

export type { CollectionMovementProps };
