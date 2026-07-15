import { Building2, ClipboardList, FileSpreadsheet, Printer, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { formatMoney, formatShortId } from '@/features/financials/components/financials-formatters';
import { useExpenseBreakdownReport } from '@/features/financials/reports/useFinancialReports';
import { DocumentTemplates, type DocumentSettings } from '@/services/documents/DocumentTemplates';
import { buildReportCsvFilename, downloadCsv, getTodayLocalDateString } from '../reports-page.helpers';
import { ReportCard } from './common';

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
            rows: categoryRows.map((r) => ({
              label: r.category,
              value: `المبلغ: ${r.total.toLocaleString('ar-OM')} ر.ع | عدد السندات: ${r.count}`,
            })),
            totals: ['إجمالي المصروفات التشغيلية', `${(report?.totalExpenses ?? 0).toLocaleString('ar-OM')} ر.ع`],
          },
          {
            title: 'توزيع المصروفات حسب العقارات',
            rows: propertyRows.map((r) => ({
              label: r.propertyTitle ?? formatShortId(r.propertyId),
              value: `المبلغ: ${r.total.toLocaleString('ar-OM')} ر.ع | عدد الحركات: ${r.count}`,
            })),
          },
        ],
        totalSummary: `إجمالي النفقات: ${(report?.totalExpenses ?? 0).toLocaleString('ar-OM')} ر.ع | عدد السندات: ${report?.expensesCount ?? 0}`,
      },
      defaultSettings,
    );
  };

  return (
    <ReportCard
      title="تحليل المصروفات والتكاليف التشغيلية للفترة"
      description="تفصيل المصروفات والنفقات حسب نوع التصنيف والعقار ومركز التكلفة المسجل."
      action={canExportReports ? (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrintExpensesReport} className="min-h-9 gap-1.5 text-xs font-bold">
            <Printer className="size-3.5 text-primary" aria-hidden="true" />
            طباعة تقرير المصروفات A4
          </Button>
          <Button variant="secondary" size="sm" onClick={() => downloadCsv(buildReportCsvFilename('expense-breakdown'), [...categoryRows, ...propertyRows])} className="min-h-9 text-xs">
            <FileSpreadsheet className="me-1.5 size-3.5" />
            تصدير CSV
          </Button>
        </div>
      ) : undefined}
      isLoading={isLoading}
    >
      <ResponsiveCardGrid className="p-4" desktopColumns={3}>
        <KpiCard label="إجمالي المصروفات" value={formatMoney(report?.totalExpenses ?? 0)} icon={WalletCards} accent="rose" sub={`${report?.expensesCount ?? 0} مصروفات`} />
        <KpiCard label="تصنيفات المصروفات" value={(categoryRows.length).toLocaleString('ar')} icon={ClipboardList} accent="amber" sub="حسب نوع التصنيف" />
        <KpiCard label="عقارات بها مصروفات" value={(propertyRows.length).toLocaleString('ar')} icon={Building2} accent="sky" sub="حسب العقار المرتبط" />
      </ResponsiveCardGrid>
      <div className="grid gap-4 p-4 pt-0 lg:grid-cols-2">
        <div className="rounded-2xl border bg-background/80 p-3">
          <p className="mb-2 font-black">حسب التصنيف</p>
          <div className="space-y-2">
            {categoryRows.map((row) => (
              <div key={row.category} className="flex items-center justify-between gap-3 rounded-xl bg-muted/30 p-3 text-sm">
                <span>{row.category} · {row.count.toLocaleString('ar')}</span>
                <span className="font-black" dir="ltr">{formatMoney(row.total)}</span>
              </div>
            ))}
            {categoryRows.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد مصروفات في الفترة المحددة.</p> : null}
          </div>
        </div>
        <div className="rounded-2xl border bg-background/80 p-3">
          <p className="mb-2 font-black">حسب العقار</p>
          <div className="space-y-2">
            {propertyRows.map((row) => (
              <div key={row.propertyId} className="flex items-center justify-between gap-3 rounded-xl bg-muted/30 p-3 text-sm">
                <span>{row.propertyTitle ?? formatShortId(row.propertyId)} · {row.count.toLocaleString('ar')}</span>
                <span className="font-black" dir="ltr">{formatMoney(row.total)}</span>
              </div>
            ))}
            {propertyRows.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد مصروفات مرتبطة بعقارات في الفترة المحددة.</p> : null}
          </div>
        </div>
      </div>
    </ReportCard>
  );
}
