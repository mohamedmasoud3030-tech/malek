import { Building2, ClipboardList, FileSpreadsheet, Printer, ReceiptText, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { formatMoney, formatShortId } from '@/features/financials/components/financials-formatters';
import { useExpenseBreakdownReport } from '@/features/financials/reports/useFinancialReports';
import { DocumentTemplates, type DocumentSettings } from '@/services/documents/DocumentTemplates';
import { buildReportCsvFilename, downloadCsv, getTodayLocalDateString } from '../reports-page.helpers';
import { ReportColumns, ReportList, ReportListRow, ReportPanel, ReportState } from './report-section-primitives';

const defaultSettings: DocumentSettings = {
  company: {
    name: 'رينتريكس لإدارة العقارات',
    address: 'سلطنة عمان - مسقط',
    phone: '+968 24000000',
  },
  currency: 'OMR',
  currencySymbol: 'ر.ع',
};

export function ExpensesSection({ report, canExportReports, isLoading }: Readonly<{
  report: NonNullable<ReturnType<typeof useExpenseBreakdownReport>['data']> | undefined;
  canExportReports: boolean;
  isLoading: boolean;
}>) {
  const categoryRows = report?.byCategory ?? [];
  const propertyRows = report?.byProperty ?? [];
  const totalExpenses = report?.totalExpenses ?? 0;
  const expensesCount = report?.expensesCount ?? 0;
  const averageExpense = expensesCount > 0 ? totalExpenses / expensesCount : 0;

  const handlePrintExpensesReport = () => {
    const todayStr = getTodayLocalDateString();
    DocumentTemplates.renderReportPdf(
      {
        reportTitle: 'تقرير وتوزيع المصروفات التشغيلية',
        reportType: 'Operational_Expenses_Report',
        periodFrom: todayStr,
        periodTo: todayStr,
        sections: [
          {
            title: 'توزيع المصروفات حسب التصنيف',
            rows: categoryRows.map((row) => ({
              label: row.category,
              value: `المبلغ: ${row.total.toLocaleString('ar-OM')} ر.ع | عدد السندات: ${row.count}`,
            })),
            totals: ['إجمالي المصروفات التشغيلية', `${totalExpenses.toLocaleString('ar-OM')} ر.ع`],
          },
          {
            title: 'توزيع المصروفات حسب العقارات',
            rows: propertyRows.map((row) => ({
              label: row.propertyTitle ?? formatShortId(row.propertyId),
              value: `المبلغ: ${row.total.toLocaleString('ar-OM')} ر.ع | عدد الحركات: ${row.count}`,
            })),
          },
        ],
        totalSummary: `إجمالي النفقات: ${totalExpenses.toLocaleString('ar-OM')} ر.ع | عدد السندات: ${expensesCount}`,
      },
      defaultSettings,
    );
  };

  const actions = canExportReports ? (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={handlePrintExpensesReport} className="min-h-10 gap-1.5 text-xs">
        <Printer className="size-3.5" aria-hidden="true" />
        طباعة A4
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => downloadCsv(buildReportCsvFilename('expense-breakdown'), [...categoryRows, ...propertyRows])}
        className="min-h-10 gap-1.5 text-xs"
      >
        <FileSpreadsheet className="size-3.5" aria-hidden="true" />
        CSV
      </Button>
    </div>
  ) : undefined;

  return (
    <div className="space-y-4">
      <ResponsiveCardGrid>
        <KpiCard label="إجمالي المصروفات" value={formatMoney(totalExpenses)} icon={WalletCards} sub={`${expensesCount} مصروفات`} />
        <KpiCard label="متوسط المصروف" value={formatMoney(averageExpense)} icon={ReceiptText} sub="لكل حركة مسجلة" />
        <KpiCard label="التصنيفات" value={categoryRows.length.toLocaleString('ar')} icon={ClipboardList} sub="أنواع مصروفات فعالة" />
        <KpiCard label="العقارات المتأثرة" value={propertyRows.length.toLocaleString('ar')} icon={Building2} sub="عقارات لها مصروفات" />
      </ResponsiveCardGrid>

      <ReportColumns>
        <ReportPanel
          title="المصروفات حسب التصنيف"
          description="ترتيب مباشر لقيمة وعدد الحركات في كل تصنيف."
          icon={ClipboardList}
          action={actions}
          isLoading={isLoading}
        >
          {categoryRows.length === 0 ? (
            <div className="p-4"><ReportState message="لا توجد مصروفات في الفترة المحددة." /></div>
          ) : (
            <ReportList>
              {categoryRows.map((row) => (
                <ReportListRow
                  key={row.category}
                  title={row.category}
                  subtitle={`${row.count.toLocaleString('ar')} حركة`}
                  value={<span dir="ltr">{formatMoney(row.total)}</span>}
                />
              ))}
            </ReportList>
          )}
        </ReportPanel>

        <ReportPanel
          title="المصروفات حسب العقار"
          description="العقارات الأعلى تحمّلًا للتكاليف داخل النطاق."
          icon={Building2}
          isLoading={isLoading}
        >
          {propertyRows.length === 0 ? (
            <div className="p-4"><ReportState message="لا توجد مصروفات مرتبطة بعقارات في الفترة المحددة." /></div>
          ) : (
            <ReportList>
              {propertyRows.map((row) => (
                <ReportListRow
                  key={row.propertyId}
                  title={row.propertyTitle ?? formatShortId(row.propertyId)}
                  subtitle={`${row.count.toLocaleString('ar')} حركة`}
                  value={<span dir="ltr">{formatMoney(row.total)}</span>}
                />
              ))}
            </ReportList>
          )}
        </ReportPanel>
      </ReportColumns>
    </div>
  );
}
