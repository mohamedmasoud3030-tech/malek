import { Building2, CalendarDays, FileSpreadsheet, Printer, ReceiptText, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import type { DailyCollectionReportRow } from '@/features/financials/reports/financialReportsService';
import { DocumentTemplates, type DocumentSettings } from '@/services/documents/DocumentTemplates';
import { buildReportCsvFilename, downloadCsv, getTodayLocalDateString, toDailyCollectionCsv, type RentRollReportRow } from '../reports-page.helpers';
import { ReportColumns } from './report-section-primitives';
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

type ReceiptRow = Readonly<{
  id: string;
  receipt_number: string;
  payment_date: string;
  amount: number;
  tenant_name: string | null;
}>;

export function CollectionsSection({ rows, receiptRows, rentRollRows, canExportReports, isLoading }: Readonly<{
  rows: DailyCollectionReportRow[];
  receiptRows: ReceiptRow[];
  rentRollRows: RentRollReportRow[];
  canExportReports: boolean;
  isLoading: boolean;
}>) {
  const totalCollected = rows.reduce((total, row) => total + row.totalPaid, 0);
  const paymentsCount = rows.reduce((total, row) => total + row.paymentsCount, 0);
  const activeContracts = rentRollRows.filter((row) => row.statusLabel === 'نشط').length;

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
        totalSummary: `إجمالي المبلغ المحصل: ${totalCollected.toLocaleString('ar-OM')} ر.ع`,
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
        <KpiCard label="أيام التحصيل" value={rows.length.toLocaleString('ar')} icon={CalendarDays} sub="أيام بها حركة" />
        <KpiCard label="الإيصالات" value={receiptRows.length.toLocaleString('ar')} icon={ReceiptText} sub="متاحة للطباعة" />
        <KpiCard label="العقود النشطة" value={activeContracts.toLocaleString('ar')} icon={Building2} sub={`${rentRollRows.length.toLocaleString('ar')} عقود بالسجل`} />
      </ResponsiveCardGrid>

      <DailyCollectionsPanel rows={rows} action={dailyActions} isLoading={isLoading} />

      <ReportColumns>
        <ReceiptLinksPanel rows={receiptRows} isLoading={isLoading} />
        <RentRollPanel rows={rentRollRows} action={rentRollAction} isLoading={isLoading} />
      </ReportColumns>
    </div>
  );
}
