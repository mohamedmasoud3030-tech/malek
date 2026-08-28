import { AlertTriangle, CalendarClock, FileSpreadsheet, FileText, ReceiptText, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { formatInvoiceStatusLabel, formatMoney } from '@/features/financials/components/financials-formatters';
import type { OverdueInvoiceReportRow } from '@/features/financials/reports/financialReportsService';
import { useAgedReceivablesReport, useArrearsSummaryReport } from '@/features/financials/reports/useFinancialReports';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { documentService } from '@/services/documents/DocumentService';
import { runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import { toReportDocumentPayload, type ReportDocumentData } from '@/services/documents/documentPayloadAdapters';
import { agingBucketKeys, buildAgingBucketChartRows, buildReportCsvFilename, downloadCsv, getTodayLocalDateString } from '../reports-page.helpers';
import { ReportColumns, ReportInsightNote, ReportProgress } from './report-section-primitives';
import { AgingBucketsPanel } from './overdue/aging-buckets-panel';
import { getAgingLabel, OverdueInvoicesPanel } from './overdue/overdue-invoices-panel';
import { formatLatinNumber } from '@/lib/formatters';
import { csvRowsToXlsxBlob, downloadBlob, xlsxFilenameFromCsv } from '@/lib/tabular-export';
import { ReportShareActions } from './ReportShareActions';

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
  const reportAsOf = summary?.asOf ?? agedReport?.asOf ?? getTodayLocalDateString();

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

  const { companySettings: documentSettings, isReady: isDocumentSettingsReady } = useDocumentSettings();
  const currencySymbol = documentSettings.currencySymbol || documentSettings.currency;

  const buildOverdueReportData = (): ReportDocumentData => ({
    reportTitle: 'كشف المتأخرات والديون التفصيلي',
    reportType: 'Overdue_Debts_Report',
    periodFrom: reportAsOf,
    periodTo: reportAsOf,
    sections: [
      {
        title: `الفواتير المتأخرة حتى ${reportAsOf}`,
        columns: ['الفاتورة', 'المستأجر', 'الهاتف', 'العقار / الوحدة', 'العقد', 'الاستحقاق', 'أيام التأخير', 'الأصلي', 'المدفوع', 'المتبقي', 'التعتيق', 'الحالة'],
        rows: rows.map((row) => [
          row.invoiceReference ?? row.shortInvoiceId,
          row.tenantName || 'غير محدد',
          row.tenantPhone || '—',
          [row.propertyTitle, row.unitNumber ? `وحدة ${row.unitNumber}` : null].filter(Boolean).join(' · ') || 'غير محدد',
          row.contractReference || 'عقد بلا مرجع',
          row.dueDate,
          `${formatLatinNumber(row.daysOverdue, 'ar')} يوم`,
          `${formatLatinNumber(row.amount, 'ar-OM')} ${currencySymbol}`,
          `${formatLatinNumber(row.paidAmount, 'ar-OM')} ${currencySymbol}`,
          `${formatLatinNumber(row.remainingAmount, 'ar-OM')} ${currencySymbol}`,
          getAgingLabel(row.daysOverdue),
          formatInvoiceStatusLabel(row.status),
        ]),
        totals: ['إجمالي المتأخرات', '', '', '', '', '', '', '', '', `${formatLatinNumber(totalOverdue, 'ar-OM')} ${currencySymbol}`, '', ''],
      },
    ],
    totalSummary: `حتى ${reportAsOf} | عدد الفواتير المتأخرة: ${rows.length} | متوسط التأخير: ${Math.round(averageDelay)} يوم | أكثر من 90 يوم: ${formatLatinNumber(over90Amount, 'ar-OM')} ${currencySymbol}`,
  });

  const handlePrintOverdueReport = async () => {
    await runGuardedDocumentAction({
      isReady: isDocumentSettingsReady,
      operation: () => documentService.printDocument('generic_report', { settings: documentSettings, payload: toReportDocumentPayload(buildOverdueReportData()) }),
      fallbackMessage: 'تعذرت طباعة التقرير.',
    });
  };

  const handleDownloadOverdueReport = async () => {
    await runGuardedDocumentAction({
      isReady: isDocumentSettingsReady,
      operation: () => documentService.downloadDocumentPdf('generic_report', { settings: documentSettings, payload: toReportDocumentPayload(buildOverdueReportData()) }),
      fallbackMessage: 'تعذر تنزيل ملف PDF.',
    });
  };

  const invoiceActions = canExportReports ? (
    <ReportShareActions
      className="flex flex-wrap gap-2"
      reportLabel="كشف المتأخرات والديون التفصيلي"
      target={{
        section: 'analytics',
        view: 'overdue',
        filters: {
          from: reportAsOf,
          to: reportAsOf,
          asOf: reportAsOf,
          propertyId: '',
          unitId: '',
          tenantId: '',
          ownerId: '',
          contractId: '',
        },
      }}
      summaryText={`إجمالي المتأخرات: ${formatMoney(totalOverdue)} | فواتير متأخرة: ${formatLatinNumber(rows.length, 'ar')}`}
      onPrint={handlePrintOverdueReport}
      onDownloadPdf={handleDownloadOverdueReport}
      csv={{ filename: buildReportCsvFilename('overdue-invoices'), rows }}
    />
  ) : undefined;

  const agingCsvRows = bucketRows.map((row) => ({ bucket: row.bucket, total: row.total, invoiceCount: row.invoiceCount }));
  const agingCsvFilename = buildReportCsvFilename('aged-receivables');
  const agingAction = canExportReports ? (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => downloadBlob(csvRowsToXlsxBlob(agingCsvRows, 'تعتيق المتأخرات'), xlsxFilenameFromCsv(agingCsvFilename))}
        className="min-h-11 gap-1.5 text-xs"
        disabled={agingCsvRows.length === 0}
      >
        <FileSpreadsheet className="size-3.5" aria-hidden="true" />
        Excel
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => downloadCsv(agingCsvFilename, agingCsvRows)}
        className="min-h-11 gap-1.5 text-xs"
        disabled={agingCsvRows.length === 0}
      >
        <FileText className="size-3.5" aria-hidden="true" />
        CSV
      </Button>
    </div>
  ) : undefined;

  return (
    <div className="space-y-4">
      <ResponsiveCardGrid data-report-summary="overdue">
        <KpiCard label="إجمالي المتأخر" value={formatMoney(totalOverdue)} icon={WalletCards} sub="رصيد يحتاج تحصيل" />
        <KpiCard label="الفواتير المتأخرة" value={formatLatinNumber((summary?.overdueInvoiceCount ?? rows.length), 'ar')} icon={ReceiptText} sub="فواتير مفتوحة" />
        <KpiCard label="متوسط التأخير" value={`${formatLatinNumber(Math.round(averageDelay), 'ar')} يوم`} icon={CalendarClock} sub="متوسط عمر الفواتير المتأخرة" />
        <KpiCard label="أكثر من 90 يوم" value={formatMoney(over90Amount)} icon={AlertTriangle} sub={`${formatLatinNumber(over90Count, 'ar')} فواتير عالية المخاطر`} />
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
