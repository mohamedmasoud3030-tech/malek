import { FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import type { DailyCollectionReportRow } from '@/features/financials/reports/financialReportsService';
import { useCollectionSummaryReport } from '@/features/financials/reports/useFinancialReports';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { documentService } from '@/services/documents/DocumentService';
import { runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import {
  toReportDocumentPayload,
  type ReportDocumentData,
} from '@/services/documents/documentPayloadAdapters';
import {
  buildReportCsvFilename,
  downloadCsv,
  toDailyCollectionCsv,
  type RentRollReportRow,
} from '../reports-page.helpers';
import {
  ReportColumns,
  ReportInsightNote,
  ReportProgress,
  ReportState,
  ReportSummaryStrip,
} from '@/components/ui/report-section-primitives';
import { DailyCollectionsPanel } from './collections/daily-collections-panel';
import {
  ReceiptLinksPanel,
  type CollectionReceiptRow,
} from './collections/receipt-links-panel';
import { RentRollPanel } from './collections/rent-roll-panel';
import { formatLatinNumber } from '@/lib/formatters';
import {
  csvRowsToXlsxBlob,
  downloadBlob,
  xlsxFilenameFromCsv,
} from '@/lib/tabular-export';
import { ReportDocumentActions } from './report-document-actions';

const paymentMethodLabels = {
  cash: 'نقدًا',
  bank_transfer: 'تحويل بنكي',
  card: 'بطاقة',
  check: 'شيك',
  other: 'أخرى',
} as const;

export function CollectionsSection({
  summary,
  collectionRate,
  rows,
  receiptRows,
  rentRollRows,
  canExportReports,
  isLoading,
  from,
  to,
}: Readonly<{
  summary:
    | NonNullable<ReturnType<typeof useCollectionSummaryReport>['data']>
    | undefined;
  /** Dashboard Truth RPC value. Presentation must render it, never derive paid / invoiced here. */
  collectionRate?: number;
  rows: DailyCollectionReportRow[];
  receiptRows: CollectionReceiptRow[];
  rentRollRows: RentRollReportRow[];
  canExportReports: boolean;
  isLoading: boolean;
  from: string;
  to: string;
}>) {
  // The detailed daily report remains the source of its own table total for document output.
  // Executive financial metrics below come from the authoritative summary instead of being
  // reconstructed from rendered rows.
  const dailyRowsTotal = rows.reduce((total, row) => total + row.totalPaid, 0);
  const totalCollected = summary?.paid ?? dailyRowsTotal;
  const isCollectionRateAvailable =
    typeof collectionRate === 'number' && Number.isFinite(collectionRate);
  const collectionRateLabel = isCollectionRateAvailable
    ? `${formatLatinNumber(Math.round(collectionRate!), 'ar')}%`
    : 'غير متاحة';

  const methodTotals = rows.reduce(
    (totals, row) => {
      for (const key of Object.keys(totals) as Array<keyof typeof totals>)
        totals[key] += row.methodTotals[key];
      return totals;
    },
    { cash: 0, bank_transfer: 0, card: 0, check: 0, other: 0 },
  );
  const dominantMethod = (
    Object.entries(methodTotals) as Array<[keyof typeof methodTotals, number]>
  ).sort((a, b) => b[1] - a[1])[0];
  const paymentMethodTotal = Object.values(methodTotals).reduce(
    (total, value) => total + value,
    0,
  );
  const dominantMethodShare =
    dominantMethod && paymentMethodTotal > 0
      ? (dominantMethod[1] / paymentMethodTotal) * 100
      : 0;

  const {
    companySettings: documentSettings,
    isReady: isDocumentSettingsReady,
  } = useDocumentSettings();
  const currencySymbol =
    documentSettings.currencySymbol || documentSettings.currency;

  const buildCollectionsReportData = (): ReportDocumentData => ({
    reportTitle: 'كشف حركة التحصيلات اليومية والتدفقات النقدية',
    reportType: 'Daily_Collections_Report',
    periodFrom: from,
    periodTo: to,
    sections: [
      {
        title: 'جدول المقبوضات حسب التاريخ وطرق السداد',
        columns: [
          'التاريخ',
          'عدد العمليات',
          'نقداً',
          'تحويل بنكي',
          'شيكات',
          'إجمالي التحصيل',
        ],
        rows: rows.map((row) => [
          row.paymentDate,
          row.paymentsCount,
          `${formatLatinNumber(row.methodTotals.cash, 'ar-OM')}`,
          `${formatLatinNumber(row.methodTotals.bank_transfer, 'ar-OM')}`,
          `${formatLatinNumber(row.methodTotals.check, 'ar-OM')}`,
          `${formatLatinNumber(row.totalPaid, 'ar-OM')} ${currencySymbol}`,
        ]),
        totals: [
          'الإجمالي العام',
          '',
          '',
          '',
          '',
          `${formatLatinNumber(dailyRowsTotal, 'ar-OM')} ${currencySymbol}`,
        ],
      },
      {
        title: 'سياق الإيصالات والتحصيلات',
        columns: [
          'الإيصال',
          'المستأجر',
          'العقار / الوحدة',
          'الفاتورة',
          'طريقة الدفع',
          'المبلغ',
          'الحالة',
        ],
        rows: receiptRows.map((receipt) => [
          receipt.receipt_number,
          receipt.tenant_name ?? 'غير محدد',
          `${receipt.property_title ?? 'عقار غير محدد'} / ${receipt.unit_number ?? '—'}`,
          receipt.invoice_reference ?? '—',
          paymentMethodLabels[
            receipt.payment_method as keyof typeof paymentMethodLabels
          ] ?? receipt.payment_method,
          `${formatLatinNumber(receipt.amount, 'ar-OM')} ${currencySymbol}`,
          receipt.status === 'posted' ? 'مرحّل' : 'ملغى',
        ]),
      },
    ],
    totalSummary: `إجمالي المبلغ المحصل: ${formatLatinNumber(totalCollected, 'ar-OM')} ${currencySymbol} | كفاءة التحصيل: ${collectionRateLabel}`,
  });

  const handlePrintCollectionsReport = async () => {
    await runGuardedDocumentAction({
      isReady: isDocumentSettingsReady,
      operation: () =>
        documentService.printDocument('generic_report', {
          settings: documentSettings,
          payload: toReportDocumentPayload(buildCollectionsReportData()),
        }),
      fallbackMessage: 'تعذرت طباعة التقرير.',
    });
  };

  const handleDownloadCollectionsReport = async () => {
    await runGuardedDocumentAction({
      isReady: isDocumentSettingsReady,
      operation: () =>
        documentService.downloadDocumentPdf('generic_report', {
          settings: documentSettings,
          payload: toReportDocumentPayload(buildCollectionsReportData()),
        }),
      fallbackMessage: 'تعذر تنزيل ملف PDF.',
    });
  };

  const dailyActions = canExportReports ? (
    <ReportDocumentActions
      className="flex flex-wrap gap-2"
      reportLabel="كشف حركة التحصيلات اليومية والتدفقات النقدية"
      reportShareTarget={{
        reportId: 'collections-arrears-cheques',
        view: 'period',
        filters: {
          from,
          to,
          asOf: to,
          propertyId: '',
          unitId: '',
          tenantId: '',
          ownerId: '',
          contractId: '',
        },
      }}
      reportShareSummary={`إجمالي المبلغ المحصل: ${formatMoney(totalCollected)} | كفاءة التحصيل: ${collectionRateLabel}`}
      onPrint={handlePrintCollectionsReport}
      onDownloadPdf={handleDownloadCollectionsReport}
      csv={{
        filename: buildReportCsvFilename('daily-collection'),
        rows: toDailyCollectionCsv(rows),
      }}
    />
  ) : undefined;

  const rentRollCsvFilename = buildReportCsvFilename('rent-roll');
  const rentRollAction = canExportReports ? (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          downloadBlob(
            csvRowsToXlsxBlob(rentRollRows, 'سجل الإيجارات'),
            xlsxFilenameFromCsv(rentRollCsvFilename),
          )
        }
        className="min-h-11 gap-1.5 text-xs"
        disabled={rentRollRows.length === 0}
      >
        <FileSpreadsheet className="size-3.5" aria-hidden="true" />
        Excel
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => downloadCsv(rentRollCsvFilename, rentRollRows)}
        className="min-h-11 gap-1.5 text-xs"
        disabled={rentRollRows.length === 0}
      >
        <FileText className="size-3.5" aria-hidden="true" />
        CSV
      </Button>
    </div>
  ) : undefined;

  const collectionRateTone = !isCollectionRateAvailable
    ? 'default'
    : collectionRate! >= 85
      ? 'good'
      : collectionRate! >= 65
        ? 'warning'
        : 'critical';

  return (
    <div className="space-y-3">
      <ReportSummaryStrip
        dataReportSummary="collections"
        items={[
          {
            label: 'المفوتر',
            value: summary ? formatMoney(summary.invoiced) : '—',
            detail: summary
              ? `${formatLatinNumber(summary.invoicesCount, 'ar')} فاتورة`
              : 'بيانات الفترة غير متاحة',
          },
          {
            label: 'المحصّل',
            value: summary ? formatMoney(summary.paid) : '—',
            detail: summary
              ? `${formatLatinNumber(summary.receiptsCount, 'ar')} إيصال`
              : 'بيانات الفترة غير متاحة',
          },
          {
            label: 'الرصيد المستحق',
            value: summary ? formatMoney(summary.outstanding) : '—',
            detail: 'يشمل الجاري والمتأخر',
          },
          {
            label: 'كفاءة التحصيل',
            value: collectionRateLabel,
            detail: 'مؤشر خادمي معتمد',
            tone: collectionRateTone,
          },
        ]}
      />

      <ReportInsightNote title="قراءة التحصيل">
        {!isCollectionRateAvailable
          ? 'تعذر تحميل مؤشر كفاءة التحصيل المعتمد حاليًا؛ تبقى تفاصيل التحصيل متاحة دون افتراض نسبة بديلة.'
          : collectionRate! < 65
            ? 'المحصّل أقل من ثلثي قيمة الفواتير في النطاق؛ راجع المتأخرات والعقود ذات الرصيد الأعلى.'
            : dominantMethodShare > 85
              ? 'التحصيل يعتمد بشدة على طريقة سداد واحدة؛ راجع الضوابط التشغيلية والتسوية اليومية لهذه الطريقة.'
              : 'معدل التحصيل وتوزيع طرق السداد متوازنان نسبيًا داخل الفترة.'}
      </ReportInsightNote>

      <div className="grid gap-3 lg:grid-cols-2">
        {isCollectionRateAvailable ? (
          <ReportProgress
            label="نسبة التحصيل من الفواتير"
            value={collectionRate!}
            helper={
              summary
                ? `${formatMoney(summary.paid)} من ${formatMoney(summary.invoiced)}`
                : 'تفاصيل الفترة غير متاحة'
            }
            tone={
              collectionRate! >= 85
                ? 'good'
                : collectionRate! >= 65
                  ? 'warning'
                  : 'critical'
            }
          />
        ) : (
          <ReportState
            title="كفاءة التحصيل غير متاحة"
            message="لم يصل المؤشر المعتمد من الخادم، لذلك لن يعرض مالك نسبة محسوبة محليًا بدلًا منه."
          />
        )}
        <ReportProgress
          label="تركيز طريقة السداد الأولى"
          value={dominantMethodShare}
          helper={
            dominantMethod
              ? `${paymentMethodLabels[dominantMethod[0]]} · ${formatMoney(dominantMethod[1])}`
              : 'لا توجد تحصيلات'
          }
          tone={
            dominantMethodShare <= 65
              ? 'good'
              : dominantMethodShare <= 85
                ? 'warning'
                : 'critical'
          }
        />
      </div>

      <DailyCollectionsPanel
        rows={rows}
        action={dailyActions}
        isLoading={isLoading}
      />

      <ReportColumns>
        <ReceiptLinksPanel rows={receiptRows} isLoading={isLoading} />
        <RentRollPanel
          rows={rentRollRows}
          action={rentRollAction}
          isLoading={isLoading}
        />
      </ReportColumns>
    </div>
  );
}
