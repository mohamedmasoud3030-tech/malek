import { AlertTriangle, CalendarClock, FileSpreadsheet, Printer, ReceiptText, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import type { OverdueInvoiceReportRow } from '@/features/financials/reports/financialReportsService';
import { useAgedReceivablesReport } from '@/features/financials/reports/useFinancialReports';
import { DocumentTemplates, type DocumentSettings } from '@/services/documents/DocumentTemplates';
import { agingBucketKeys, buildAgingBucketChartRows, buildReportCsvFilename, downloadCsv, getTodayLocalDateString } from '../reports-page.helpers';
import { ReportColumns } from './report-section-primitives';
import { AgingBucketsPanel } from './overdue/aging-buckets-panel';
import { OverdueInvoicesPanel } from './overdue/overdue-invoices-panel';

const defaultSettings: DocumentSettings = {
  company: {
    name: 'رينتريكس لإدارة العقارات',
    address: 'سلطنة عمان - مسقط',
    phone: '+968 24000000',
  },
  currency: 'OMR',
  currencySymbol: 'ر.ع',
};

export function OverdueSection({ rows, agedReport, canExportReports, isLoading }: Readonly<{
  rows: OverdueInvoiceReportRow[];
  agedReport: NonNullable<ReturnType<typeof useAgedReceivablesReport>['data']> | undefined;
  canExportReports: boolean;
  isLoading: boolean;
}>) {
  const bucketRows = buildAgingBucketChartRows(agedReport?.buckets, agingBucketKeys);
  const totalOverdue = rows.reduce((total, row) => total + row.remainingAmount, 0);
  const oldestDelay = rows.reduce((maximum, row) => Math.max(maximum, row.daysOverdue), 0);
  const criticalBucket = bucketRows[bucketRows.length - 1];

  const handlePrintOverdueReport = () => {
    const todayStr = getTodayLocalDateString();
    DocumentTemplates.renderReportPdf(
      {
        reportTitle: 'كشف المتأخرات والديون التفصيلي',
        reportType: 'Overdue_Debts_Report',
        periodFrom: todayStr,
        periodTo: todayStr,
        sections: [
          {
            title: 'جدول الفواتير والذمم المتأخرة السداد',
            rows: rows.map((row) => ({
              label: `${row.tenantName || 'مستأجر'} - (فاتورة #${row.shortInvoiceId})`,
              value: `المبلغ: ${row.remainingAmount} ر.ع | أيام التأخير: ${row.daysOverdue} يوم | الاستحقاق: ${row.dueDate}`,
            })),
            totals: ['إجمالي المتأخرات', `${totalOverdue.toLocaleString('ar-OM')} ر.ع`],
          },
        ],
        totalSummary: `عدد الفواتير المتأخرة: ${rows.length} | الإجمالي المستحق: ${totalOverdue.toLocaleString('ar-OM')} ر.ع`,
      },
      defaultSettings,
    );
  };

  const invoiceActions = canExportReports ? (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={handlePrintOverdueReport} className="min-h-10 gap-1.5 text-xs">
        <Printer className="size-3.5" aria-hidden="true" />
        طباعة A4
      </Button>
      <Button variant="secondary" size="sm" onClick={() => downloadCsv(buildReportCsvFilename('overdue-invoices'), rows)} className="min-h-10 gap-1.5 text-xs">
        <FileSpreadsheet className="size-3.5" aria-hidden="true" />
        CSV
      </Button>
    </div>
  ) : undefined;

  const agingAction = canExportReports ? (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => downloadCsv(buildReportCsvFilename('aged-receivables'), bucketRows.map((row) => ({ bucket: row.bucket, total: row.total, invoiceCount: row.invoiceCount })))}
      className="min-h-10 gap-1.5 text-xs"
    >
      <FileSpreadsheet className="size-3.5" aria-hidden="true" />
      CSV
    </Button>
  ) : undefined;

  return (
    <div className="space-y-4">
      <ResponsiveCardGrid>
        <KpiCard label="إجمالي المتأخر" value={formatMoney(totalOverdue)} icon={WalletCards} sub="رصيد يحتاج تحصيل" />
        <KpiCard label="الفواتير المتأخرة" value={rows.length.toLocaleString('ar')} icon={ReceiptText} sub="فواتير مفتوحة" />
        <KpiCard label="أطول تأخير" value={`${oldestDelay.toLocaleString('ar')} يوم`} icon={CalendarClock} sub="أقدم فاتورة متأخرة" />
        <KpiCard label="أكثر من 90 يوم" value={formatMoney(criticalBucket?.total ?? 0)} icon={AlertTriangle} sub={`${criticalBucket?.invoiceCount.toLocaleString('ar') ?? '٠'} فواتير`} />
      </ResponsiveCardGrid>

      <OverdueInvoicesPanel rows={rows} action={invoiceActions} isLoading={isLoading} />

      <ReportColumns>
        <AgingBucketsPanel rows={bucketRows} action={agingAction} isLoading={isLoading} />
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
          <p className="font-bold text-foreground">أولوية المتابعة</p>
          <p className="mt-2">ابدأ بالفواتير الأعلى عمرًا ورصيدًا، ثم استخدم رابط العقد للوصول إلى المستأجر والوحدة قبل إجراء التحصيل.</p>
          <p className="mt-3">هذه القراءة تعتمد على تاريخ التقرير الحالي ولا تغيّر أي فاتورة أو حركة مالية.</p>
        </div>
      </ReportColumns>
    </div>
  );
}
