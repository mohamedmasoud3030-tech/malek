import { Building2, CalendarDays, FileSpreadsheet, Printer, ReceiptText, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import type { DailyCollectionReportRow } from '@/features/financials/reports/financialReportsService';
import { useCollectionSummaryReport } from '@/features/financials/reports/useFinancialReports';
import { DocumentTemplates, type DocumentSettings } from '@/services/documents/DocumentTemplates';
import { buildReportCsvFilename, downloadCsv, getTodayLocalDateString, toDailyCollectionCsv, type RentRollReportRow } from '../reports-page.helpers';
import { ReportColumns, ReportInsightNote, ReportProgress } from './report-section-primitives';
import { DailyCollectionsPanel } from './collections/daily-collections-panel';
import { ReceiptLinksPanel } from './collections/receipt-links-panel';
import { RentRollPanel } from './collections/rent-roll-panel';

const defaultSettings: DocumentSettings = {
  company: {
    name: 'رينتريكس لإدارة العقارات',
    address: 'سلطنة عمان - مسقط',
    phone: '+968 24000000',
  },
  currency: 'OMR',
  currencySymbol: 'ر.ع',
};

const paymentMethodLabels = {
  cash: 'نقدًا',
  bank_transfer: 'تحويل بنكي',
  card: 'بطاقة',
  check: 'شيك',
  other: 'أخرى',
} as const;

type ReceiptRow = Readonly<{
  id: string;
  receipt_number: string;
  payment_date: string;
  amount: number;
  tenant_name: string | null;
}>;

export function CollectionsSection({ summary, rows, receiptRows, rentRollRows, canExportReports, isLoading }: Readonly<{
  summary: NonNullable<ReturnType<typeof useCollectionSummaryReport>['data']> | undefined;
  rows: DailyCollectionReportRow[];
  receiptRows: ReceiptRow[];
  rentRollRows: RentRollReportRow[];
  canExportReports: boolean;
  isLoading: boolean;
}>) {
  const totalCollected = summary?.paid ?? rows.reduce((total, row) => total + row.totalPaid, 0);
  const paymentsCount = rows.reduce((total, row) => total + row.paymentsCount, 0);
  const activeContracts = rentRollRows.filter((row) => row.statusLabel === 'نشط').length;
  const collectionRate = summary && summary.invoiced > 0 ? (summary.paid / summary.invoiced) * 100 : 0;
  const methodTotals = rows.reduce((totals, row) => {
    for (const key of Object.keys(totals) as Array<keyof typeof totals>) totals[key] += row.methodTotals[key];
    return totals;
  }, { cash: 0, bank_transfer: 0, card: 0, check: 0, other: 0 });
  const dominantMethod = (Object.entries(methodTotals) as Array<[keyof typeof methodTotals, number]>)
    .sort((a, b) => b[1] - a[1])[0];
  const dominantMethodShare = dominantMethod && totalCollected > 0 ? (dominantMethod[1] / totalCollected) * 100 : 0;
  const averagePayment = paymentsCount > 0 ? totalCollected / paymentsCount : 0;

  const handlePrintCollectionsReport = () => {
    const todayStr = getTodayLocalDateString();
    DocumentTemplates.renderReportPdf(
      {
        reportTitle: 'كشف حركة التحصيلات اليومية والتدفقات النقدية',
        reportType: 'Daily_Collections_Report',
        periodFrom: todayStr,
        periodTo: todayStr,
        sections: [
          {
            title: 'جدول المقبوضات حسب التاريخ وطرق السداد',
            rows: rows.map((row) => ({
              label: `تاريخ ${row.paymentDate} - (${row.paymentsCount} عمليات سداد)`,
              value: `إجمالي اليوم: ${row.totalPaid.toLocaleString('ar-OM')} ر.ع | نقداً: ${row.methodTotals.cash} | تحويل: ${row.methodTotals.bank_transfer} | شيك: ${row.methodTotals.check}`,
            })),
            totals: ['إجمالي المقبوضات للفترة', `${totalCollected.toLocaleString('ar-OM')} ر.ع`],
          },
        ],
        totalSummary: `إجمالي المبلغ المحصل: ${totalCollected.toLocaleString('ar-OM')} ر.ع | كفاءة التحصيل: ${Math.round(collectionRate)}%`,
      },
      defaultSettings,
    );
  };

  const dailyActions = canExportReports ? (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={handlePrintCollectionsReport} className="min-h-10 gap-1.5 text-xs">
        <Printer className="size-3.5" aria-hidden="true" />
        طباعة A4
      </Button>
      <Button variant="secondary" size="sm" onClick={() => downloadCsv(buildReportCsvFilename('daily-collection'), toDailyCollectionCsv(rows))} className="min-h-10 gap-1.5 text-xs">
        <FileSpreadsheet className="size-3.5" aria-hidden="true" />
        CSV
      </Button>
    </div>
  ) : undefined;

  const rentRollAction = canExportReports ? (
    <Button variant="secondary" size="sm" onClick={() => downloadCsv(buildReportCsvFilename('rent-roll'), rentRollRows)} className="min-h-10 gap-1.5 text-xs">
      <FileSpreadsheet className="size-3.5" aria-hidden="true" />
      CSV
    </Button>
  ) : undefined;

  return (
    <div className="space-y-4">
      <ResponsiveCardGrid>
        <KpiCard label="إجمالي التحصيل" value={formatMoney(totalCollected)} icon={WalletCards} sub={`${paymentsCount.toLocaleString('ar')} مدفوعات`} />
        <KpiCard label="كفاءة التحصيل" value={`${Math.round(collectionRate).toLocaleString('ar')}%`} icon={CalendarDays} sub={`${formatMoney(summary?.outstanding ?? 0)} مستحق`} />
        <KpiCard label="متوسط الدفعة" value={formatMoney(averagePayment)} icon={ReceiptText} sub={`${receiptRows.length.toLocaleString('ar')} إيصالات متاحة`} />
        <KpiCard label="العقود النشطة" value={activeContracts.toLocaleString('ar')} icon={Building2} sub={`${rentRollRows.length.toLocaleString('ar')} عقود بالسجل`} />
      </ResponsiveCardGrid>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ReportProgress
          label="نسبة التحصيل من الفواتير"
          value={collectionRate}
          helper={`${formatMoney(summary?.paid ?? totalCollected)} من ${formatMoney(summary?.invoiced ?? 0)}`}
          tone={collectionRate >= 85 ? 'good' : collectionRate >= 65 ? 'warning' : 'critical'}
        />
        <ReportProgress
          label="تركيز طريقة السداد الأولى"
          value={dominantMethodShare}
          helper={dominantMethod ? `${paymentMethodLabels[dominantMethod[0]]} · ${formatMoney(dominantMethod[1])}` : 'لا توجد تحصيلات'}
          tone={dominantMethodShare <= 65 ? 'good' : dominantMethodShare <= 85 ? 'warning' : 'critical'}
        />
      </div>

      <ReportInsightNote title="قراءة التحصيل">
        {collectionRate < 65
          ? 'المحصّل أقل من ثلثي قيمة الفواتير في النطاق؛ راجع المتأخرات والعقود ذات الرصيد الأعلى.'
          : dominantMethodShare > 85
            ? 'التحصيل يعتمد بشدة على طريقة سداد واحدة؛ راجع الضوابط التشغيلية والتسوية اليومية لهذه الطريقة.'
            : 'معدل التحصيل وتوزيع طرق السداد متوازنان نسبيًا داخل الفترة.'}
      </ReportInsightNote>

      <DailyCollectionsPanel rows={rows} action={dailyActions} isLoading={isLoading} />

      <ReportColumns>
        <ReceiptLinksPanel rows={receiptRows} isLoading={isLoading} />
        <RentRollPanel rows={rentRollRows} action={rentRollAction} isLoading={isLoading} />
      </ReportColumns>
    </div>
  );
}
