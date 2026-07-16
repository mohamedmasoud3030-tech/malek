import { AlertTriangle, CalendarClock, FileSpreadsheet, Printer, ReceiptText, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import type { OverdueInvoiceReportRow } from '@/features/financials/reports/financialReportsService';
import { useAgedReceivablesReport, useArrearsSummaryReport } from '@/features/financials/reports/useFinancialReports';
import { DocumentTemplates, type DocumentSettings } from '@/services/documents/DocumentTemplates';
import { agingBucketKeys, buildAgingBucketChartRows, buildReportCsvFilename, downloadCsv, getTodayLocalDateString } from '../reports-page.helpers';
import { ReportColumns, ReportInsightNote, ReportProgress } from './report-section-primitives';
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

export function OverdueSection({ rows, agedReport, summary, canExportReports, isLoading }: Readonly<{
  rows: OverdueInvoiceReportRow[];
  agedReport: NonNullable<ReturnType<typeof useAgedReceivablesReport>['data']> | undefined;
  summary: NonNullable<ReturnType<typeof useArrearsSummaryReport>['data']> | undefined;
  canExportReports: boolean;
  isLoading: boolean;
}>) {
  const bucketRows = buildAgingBucketChartRows(agedReport?.buckets, agingBucketKeys);
  const totalOverdue = summary?.totalOverdue ?? rows.reduce((total, row) => total + row.remainingAmount, 0);
  const averageDelay = summary?.averageDaysOverdue ?? (
    rows.length > 0 ? rows.reduce((total, row) => total + row.daysOverdue, 0) / rows.length : 0
  );
  const over90Amount = summary?.over90Amount ?? bucketRows[bucketRows.length - 1]?.total ?? 0;
  const over90Count = summary?.over90InvoiceCount ?? bucketRows[bucketRows.length - 1]?.invoiceCount ?? 0;
  const over90Share = totalOverdue > 0 ? (over90Amount / totalOverdue) * 100 : 0;

  const exposureByContract = new Map<string, { tenantName: string; total: number }>();
  for (const row of rows) {
    const current = exposureByContract.get(row.contractId) ?? {
      tenantName: row.tenantName ?? 'مستأجر غير محدد',
      total: 0,
    };
    current.total += row.remainingAmount;
    exposureByContract.set(row.contractId, current);
  }
  const topExposure = Array.from(exposureByContract.entries())
    .sort((a, b) => b[1].total - a[1].total)[0];
  const topExposureShare = topExposure && totalOverdue > 0 ? (topExposure[1].total / totalOverdue) * 100 : 0;

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
        totalSummary: `عدد الفواتير المتأخرة: ${rows.length} | متوسط التأخير: ${Math.round(averageDelay)} يوم | أكثر من 90 يوم: ${over90Amount.toLocaleString('ar-OM')} ر.ع`,
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
        <KpiCard label="الفواتير المتأخرة" value={(summary?.overdueInvoiceCount ?? rows.length).toLocaleString('ar')} icon={ReceiptText} sub="فواتير مفتوحة" />
        <KpiCard label="متوسط التأخير" value={`${Math.round(averageDelay).toLocaleString('ar')} يوم`} icon={CalendarClock} sub="متوسط عمر الفواتير المتأخرة" />
        <KpiCard label="أكثر من 90 يوم" value={formatMoney(over90Amount)} icon={AlertTriangle} sub={`${over90Count.toLocaleString('ar')} فواتير عالية المخاطر`} />
      </ResponsiveCardGrid>

      <OverdueInvoicesPanel rows={rows} action={invoiceActions} isLoading={isLoading} />

      <ReportColumns>
        <AgingBucketsPanel rows={bucketRows} action={agingAction} isLoading={isLoading} />
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <ReportProgress
              label="تركيز الذمم القديمة"
              value={over90Share}
              helper="حصة الذمم التي تجاوزت 90 يومًا من إجمالي المتأخر"
              tone={over90Share <= 20 ? 'good' : over90Share <= 40 ? 'warning' : 'critical'}
            />
            <ReportProgress
              label="أكبر انكشاف عقد"
              value={topExposureShare}
              helper={topExposure ? `${topExposure[1].tenantName} · ${formatMoney(topExposure[1].total)}` : 'لا توجد ذمم'}
              tone={topExposureShare <= 20 ? 'good' : topExposureShare <= 35 ? 'warning' : 'critical'}
            />
          </div>
          <ReportInsightNote title="أولوية المتابعة">
            {over90Share >= 40
              ? 'الذمم القديمة تمثل حصة مرتفعة من المتأخرات؛ ابدأ بالعقود التي تجاوزت 90 يومًا ثم رتّب الباقي حسب الرصيد.'
              : topExposureShare >= 35
                ? 'جزء كبير من المتأخرات متركز في عقد واحد؛ راجع العقد والمستأجر وخطة التحصيل قبل التوسع في المتابعة.'
                : 'التعرض موزع نسبيًا؛ استخدم ترتيب الفواتير حسب العمر والقيمة لتنفيذ متابعة منهجية.'}
          </ReportInsightNote>
        </div>
      </ReportColumns>
    </div>
  );
}
