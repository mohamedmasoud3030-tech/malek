import { AlertTriangle, CalendarClock, Download, FileSpreadsheet, Printer, ReceiptText, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import type { OverdueInvoiceReportRow } from '@/features/financials/reports/financialReportsService';
import { useAgedReceivablesReport, useArrearsSummaryReport } from '@/features/financials/reports/useFinancialReports';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { DocumentTemplates, type ReportDocumentData } from '@/services/documents/DocumentTemplates';
import { agingBucketKeys, buildAgingBucketChartRows, buildReportCsvFilename, downloadCsv, getTodayLocalDateString } from '../reports-page.helpers';
import { ReportColumns, ReportInsightNote, ReportProgress } from './report-section-primitives';
import { AgingBucketsPanel } from './overdue/aging-buckets-panel';
import { OverdueInvoicesPanel } from './overdue/overdue-invoices-panel';

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

  const { settings: documentSettings, isReady: isDocumentSettingsReady } = useDocumentSettings();
  const currencySymbol = documentSettings.currencySymbol || documentSettings.currency;

  const buildOverdueReportData = (): ReportDocumentData => {
    const todayStr = getTodayLocalDateString();
    return {
      reportTitle: 'كشف المتأخرات والديون التفصيلي',
      reportType: 'Overdue_Debts_Report',
      periodFrom: todayStr,
      periodTo: todayStr,
      sections: [
        {
          title: 'جدول الفواتير والذمم المتأخرة السداد',
          columns: ['رقم الفاتورة', 'المستأجر', 'تاريخ الاستحقاق', 'أيام التأخير', 'المبلغ المتبقي'],
          rows: rows.map((row) => [
            row.shortInvoiceId,
            row.tenantName || 'غير محدد',
            row.dueDate,
            `${row.daysOverdue} يوم`,
            `${row.remainingAmount} ${currencySymbol}`,
          ]),
          totals: ['إجمالي المتأخرات', '', '', '', `${totalOverdue.toLatinLocaleString('ar-OM')} ${currencySymbol}`],
        },
      ],
      totalSummary: `عدد الفواتير المتأخرة: ${rows.length} | متوسط التأخير: ${Math.round(averageDelay)} يوم | أكثر من 90 يوم: ${over90Amount.toLatinLocaleString('ar-OM')} ${currencySymbol}`,
    };
  };

  const handlePrintOverdueReport = async () => {
    try {
      await DocumentTemplates.printReportDocument(buildOverdueReportData(), documentSettings);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذرت طباعة التقرير.');
    }
  };

  const handleDownloadOverdueReport = async () => {
    try {
      await DocumentTemplates.downloadReportPdf(buildOverdueReportData(), documentSettings);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر تنزيل ملف PDF.');
    }
  };

  const invoiceActions = canExportReports ? (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={handlePrintOverdueReport} disabled={!isDocumentSettingsReady} className="min-h-10 gap-1.5 text-xs">
        <Printer className="size-3.5" aria-hidden="true" />
        طباعة A4
      </Button>
      <Button variant="outline" size="sm" onClick={handleDownloadOverdueReport} disabled={!isDocumentSettingsReady} className="min-h-10 gap-1.5 text-xs">
        <Download className="size-3.5" aria-hidden="true" />
        تنزيل PDF
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
        <KpiCard label="الفواتير المتأخرة" value={(summary?.overdueInvoiceCount ?? rows.length).toLatinLocaleString('ar')} icon={ReceiptText} sub="فواتير مفتوحة" />
        <KpiCard label="متوسط التأخير" value={`${Math.round(averageDelay).toLatinLocaleString('ar')} يوم`} icon={CalendarClock} sub="متوسط عمر الفواتير المتأخرة" />
        <KpiCard label="أكثر من 90 يوم" value={formatMoney(over90Amount)} icon={AlertTriangle} sub={`${over90Count.toLatinLocaleString('ar')} فواتير عالية المخاطر`} />
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
