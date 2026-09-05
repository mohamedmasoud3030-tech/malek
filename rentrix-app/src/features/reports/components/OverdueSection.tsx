import { FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  formatInvoiceStatusLabel,
  formatMoney,
} from '@/features/financials/components/financials-formatters';
import type { OverdueInvoiceReportRow } from '@/features/financials/reports/financialReportsService';
import {
  useAgedReceivablesReport,
  useArrearsSummaryReport,
} from '@/features/financials/reports/useFinancialReports';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { documentService } from '@/services/documents/DocumentService';
import { runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import {
  toReportDocumentPayload,
  type ReportDocumentData,
} from '@/services/documents/documentPayloadAdapters';
import {
  agingBucketKeys,
  buildAgingBucketChartRows,
  buildReportCsvFilename,
  downloadCsv,
  getTodayLocalDateString,
} from '../reports-page.helpers';
import {
  ReportColumns,
  ReportInsightNote,
  ReportProgress,
  ReportState,
  ReportSummaryStrip,
} from '@/components/ui/report-section-primitives';
import { AgingBucketsPanel } from './overdue/aging-buckets-panel';
import {
  getAgingLabel,
  OverdueInvoicesPanel,
} from './overdue/overdue-invoices-panel';
import { formatLatinNumber } from '@/lib/formatters';
import {
  csvRowsToXlsxBlob,
  downloadBlob,
  xlsxFilenameFromCsv,
} from '@/lib/tabular-export';
import { ReportDocumentActions } from './report-document-actions';

const UNAVAILABLE_VALUE = '—';
const UNAVAILABLE_DETAIL = 'الملخص المعتمد غير متاح';

/**
 * المتأخرات والأعمار — answers "who is actually overdue, by how much, and how
 * old is the debt?".
 *
 * Semantic contract (Phase 2A parity):
 * - Executive figures (total overdue / invoice count / average delay / >90
 *   exposure) come exclusively from the authoritative arrears summary read
 *   model. The section never rebuilds them from rendered rows; when the
 *   summary is unavailable it says so instead of showing a substitute or a
 *   fabricated zero.
 * - `totalOverdue` excludes current/not-yet-due balances by definition of the
 *   arrears service; the aged-receivables panel may include a "غير متأخر"
 *   bucket because aged receivables cover outstanding, which is a wider set
 *   than overdue. That bucket is explicitly marked as not overdue.
 * - Document/CSV table totals remain the sum of the detailed table itself
 *   (a table footer, not a replacement executive metric).
 */
export function OverdueSection({
  rows,
  agedReport,
  summary,
  canExportReports,
  isLoading,
}: Readonly<{
  rows: OverdueInvoiceReportRow[];
  agedReport:
    | NonNullable<ReturnType<typeof useAgedReceivablesReport>['data']>
    | undefined;
  summary:
    | NonNullable<ReturnType<typeof useArrearsSummaryReport>['data']>
    | undefined;
  canExportReports: boolean;
  isLoading: boolean;
}>) {
  const bucketRows = buildAgingBucketChartRows(
    agedReport?.buckets,
    agingBucketKeys,
  );
  const currentBucketLabel = agedReport?.buckets?.current?.label;

  // Authoritative arrears summary only — no row-derived replacement truth.
  const hasArrearsSummary = Boolean(summary);
  const totalOverdue = summary?.totalOverdue;
  const overdueInvoiceCount = summary?.overdueInvoiceCount;
  const averageDelay = summary?.averageDaysOverdue;
  const over90Amount = summary?.over90Amount;
  const over90Count = summary?.over90InvoiceCount;
  const over90Share =
    typeof totalOverdue === 'number' &&
    totalOverdue > 0 &&
    typeof over90Amount === 'number'
      ? (over90Amount / totalOverdue) * 100
      : 0;
  const reportAsOf =
    summary?.asOf ?? agedReport?.asOf ?? getTodayLocalDateString();

  // Presentation-only concentration context over the served rows (drill
  // priority). It never replaces an executive financial figure.
  const exposureByContract = new Map<
    string,
    { tenantName: string; total: number }
  >();
  for (const row of rows) {
    const current = exposureByContract.get(row.contractId) ?? {
      tenantName: row.tenantName ?? 'مستأجر غير محدد',
      total: 0,
    };
    current.total += row.remainingAmount;
    exposureByContract.set(row.contractId, current);
  }
  const topExposure = Array.from(exposureByContract.entries()).sort(
    (a, b) => b[1].total - a[1].total,
  )[0];
  const topExposureShare =
    topExposure && typeof totalOverdue === 'number' && totalOverdue > 0
      ? (topExposure[1].total / totalOverdue) * 100
      : 0;

  // The detailed invoices table remains the source of its own footer total for
  // document output — a table sum, not a substitute for the arrears summary.
  const tableRemainingTotal = rows.reduce(
    (total, row) => total + row.remainingAmount,
    0,
  );

  const {
    companySettings: documentSettings,
    isReady: isDocumentSettingsReady,
  } = useDocumentSettings();
  const currencySymbol =
    documentSettings.currencySymbol || documentSettings.currency;

  const buildOverdueReportData = (): ReportDocumentData => ({
    reportTitle: 'كشف المتأخرات والديون التفصيلي',
    reportType: 'Overdue_Debts_Report',
    periodFrom: reportAsOf,
    periodTo: reportAsOf,
    sections: [
      {
        title: `الفواتير المتأخرة حتى ${reportAsOf}`,
        columns: [
          'الفاتورة',
          'المستأجر',
          'الهاتف',
          'العقار / الوحدة',
          'العقد',
          'الاستحقاق',
          'أيام التأخير',
          'الأصلي',
          'المدفوع',
          'المتبقي',
          'التعتيق',
          'الحالة',
        ],
        rows: rows.map((row) => [
          row.invoiceReference ?? row.shortInvoiceId,
          row.tenantName || 'غير محدد',
          row.tenantPhone || '—',
          [row.propertyTitle, row.unitNumber ? `وحدة ${row.unitNumber}` : null]
            .filter(Boolean)
            .join(' · ') || 'غير محدد',
          row.contractReference || 'عقد بلا مرجع',
          row.dueDate,
          `${formatLatinNumber(row.daysOverdue, 'ar')} يوم`,
          `${formatLatinNumber(row.amount, 'ar-OM')} ${currencySymbol}`,
          `${formatLatinNumber(row.paidAmount, 'ar-OM')} ${currencySymbol}`,
          `${formatLatinNumber(row.remainingAmount, 'ar-OM')} ${currencySymbol}`,
          getAgingLabel(row.daysOverdue),
          formatInvoiceStatusLabel(row.status),
        ]),
        totals: [
          'إجمالي جدول الفواتير',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          `${formatLatinNumber(tableRemainingTotal, 'ar-OM')} ${currencySymbol}`,
          '',
          '',
        ],
      },
    ],
    totalSummary: hasArrearsSummary
      ? `حتى ${reportAsOf} | إجمالي المتأخر المعتمد: ${formatLatinNumber(totalOverdue ?? 0, 'ar-OM')} ${currencySymbol} | عدد الفواتير المتأخرة: ${formatLatinNumber(overdueInvoiceCount ?? rows.length, 'ar')} | متوسط التأخير: ${formatLatinNumber(Math.round(averageDelay ?? 0), 'ar')} يوم | أكثر من 90 يوم: ${formatLatinNumber(over90Amount ?? 0, 'ar-OM')} ${currencySymbol}`
      : `حتى ${reportAsOf} | ملخص المتأخرات المعتمد غير متاح — الجدول التفصيلي أعلاه هو المصدر المعروض.`,
  });

  const handlePrintOverdueReport = async () => {
    await runGuardedDocumentAction({
      isReady: isDocumentSettingsReady,
      operation: () =>
        documentService.printDocument('generic_report', {
          settings: documentSettings,
          payload: toReportDocumentPayload(buildOverdueReportData()),
        }),
      fallbackMessage: 'تعذرت طباعة التقرير.',
    });
  };

  const handleDownloadOverdueReport = async () => {
    await runGuardedDocumentAction({
      isReady: isDocumentSettingsReady,
      operation: () =>
        documentService.downloadDocumentPdf('generic_report', {
          settings: documentSettings,
          payload: toReportDocumentPayload(buildOverdueReportData()),
        }),
      fallbackMessage: 'تعذر تنزيل ملف PDF.',
    });
  };

  const invoiceActions = canExportReports ? (
    <ReportDocumentActions
      className="flex flex-wrap gap-2"
      reportLabel="كشف المتأخرات والديون التفصيلي"
      reportShareTarget={{
        reportId: 'collections-arrears-cheques',
        view: 'arrears',
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
      reportShareSummary={
        hasArrearsSummary
          ? `إجمالي المتأخرات: ${formatMoney(totalOverdue)} | فواتير متأخرة: ${formatLatinNumber(overdueInvoiceCount ?? rows.length, 'ar')}`
          : `فواتير متأخرة معروضة: ${formatLatinNumber(rows.length, 'ar')} | الملخص المعتمد غير متاح`
      }
      onPrint={handlePrintOverdueReport}
      onDownloadPdf={handleDownloadOverdueReport}
      csv={{ filename: buildReportCsvFilename('overdue-invoices'), rows }}
    />
  ) : undefined;

  const agingCsvRows = bucketRows.map((row) => ({
    bucket: row.bucket,
    total: row.total,
    invoiceCount: row.invoiceCount,
  }));
  const agingCsvFilename = buildReportCsvFilename('aged-receivables');
  const agingAction = canExportReports ? (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          downloadBlob(
            csvRowsToXlsxBlob(agingCsvRows, 'تعتيق المتأخرات'),
            xlsxFilenameFromCsv(agingCsvFilename),
          )
        }
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
    <div className="space-y-3">
      <ReportSummaryStrip
        dataReportSummary="overdue"
        items={[
          {
            label: 'إجمالي المتأخر',
            value: hasArrearsSummary
              ? formatMoney(totalOverdue)
              : UNAVAILABLE_VALUE,
            detail: hasArrearsSummary
              ? 'لا يشمل الرصيد الجاري'
              : UNAVAILABLE_DETAIL,
          },
          {
            label: 'الفواتير المتأخرة',
            value: hasArrearsSummary
              ? formatLatinNumber(overdueInvoiceCount ?? 0, 'ar')
              : UNAVAILABLE_VALUE,
            detail: hasArrearsSummary ? 'فواتير مفتوحة' : UNAVAILABLE_DETAIL,
          },
          {
            label: 'متوسط التأخير',
            value: hasArrearsSummary
              ? `${formatLatinNumber(Math.round(averageDelay ?? 0), 'ar')} يوم`
              : UNAVAILABLE_VALUE,
            detail: hasArrearsSummary
              ? 'متوسط عمر المتأخر'
              : UNAVAILABLE_DETAIL,
          },
          {
            label: 'أكثر من 90 يوم',
            value: hasArrearsSummary
              ? formatMoney(over90Amount)
              : UNAVAILABLE_VALUE,
            detail: hasArrearsSummary
              ? `${formatLatinNumber(over90Count ?? 0, 'ar')} عالية المخاطر`
              : UNAVAILABLE_DETAIL,
            tone:
              hasArrearsSummary && over90Share > 40 ? 'critical' : undefined,
          },
        ]}
      />

      <OverdueInvoicesPanel
        rows={rows}
        action={invoiceActions}
        isLoading={isLoading}
      />

      <ReportColumns>
        <AgingBucketsPanel
          rows={bucketRows}
          currentBucketLabel={currentBucketLabel}
          action={agingAction}
          isLoading={isLoading}
        />
        <div className="space-y-3">
          {hasArrearsSummary ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <ReportProgress
                label="تركيز الذمم القديمة"
                value={over90Share}
                helper="حصة الذمم التي تجاوزت 90 يومًا من إجمالي المتأخر"
                tone={
                  over90Share <= 20
                    ? 'good'
                    : over90Share <= 40
                      ? 'warning'
                      : 'critical'
                }
              />
              <ReportProgress
                label="أكبر انكشاف عقد"
                value={topExposureShare}
                helper={
                  topExposure
                    ? `${topExposure[1].tenantName} · ${formatMoney(topExposure[1].total)}`
                    : 'لا توجد ذمم'
                }
                tone={
                  topExposureShare <= 20
                    ? 'good'
                    : topExposureShare <= 35
                      ? 'warning'
                      : 'critical'
                }
              />
            </div>
          ) : (
            <ReportState
              title="ملخص المتأخرات المعتمد غير متاح"
              message="لم يصل ملخص المتأخرات من الخادم، لذلك لن يعرض مالك إجماليات أو مؤشرات محسوبة محليًا بدلًا منه. الجدول التفصيلي يبقى متاحًا كما ورد من المصدر."
            />
          )}
          <ReportInsightNote title="أولوية المتابعة">
            {!hasArrearsSummary
              ? 'تعذر تحميل ملخص المتأخرات المعتمد؛ استخدم الجدول التفصيلي مع الترتيب حسب العمر أو الرصيد إلى حين توفر الملخص.'
              : over90Share >= 40
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
