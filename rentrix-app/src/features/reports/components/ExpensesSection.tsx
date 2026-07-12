import { Building2, ClipboardList, FileSpreadsheet, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { formatMoney, formatShortId } from '@/features/financials/components/financials-formatters';
import { useExpenseBreakdownReport } from '@/features/financials/reports/useFinancialReports';
import { buildReportCsvFilename, downloadCsv } from '../reports-page.helpers';
import { ReportCard } from './common';

export function ExpensesSection({ report, canExportReports, isLoading }: Readonly<{
  report: NonNullable<ReturnType<typeof useExpenseBreakdownReport>['data']> | undefined;
  canExportReports: boolean;
  isLoading: boolean;
}>) {
  const categoryRows = report?.byCategory ?? [];
  const propertyRows = report?.byProperty ?? [];

  return (
    <ReportCard
      title="تحليل المصروفات للفترة"
      description="تفصيل المصروفات حسب التصنيف والعقار من تقرير المصروفات الموجود."
      action={canExportReports ? <Button variant="secondary" onClick={() => downloadCsv(buildReportCsvFilename('expense-breakdown'), [...categoryRows, ...propertyRows])}><FileSpreadsheet className="me-2 size-4" />تصدير CSV</Button> : undefined}
      isLoading={isLoading}
    >
      <ResponsiveCardGrid className="p-4" desktopColumns={3}>
        <KpiCard label="إجمالي المصروفات" value={formatMoney(report?.totalExpenses ?? 0)} icon={WalletCards} accent="rose" sub={`${report?.expensesCount ?? 0} مصروفات`} />
        <KpiCard label="تصنيفات المصروفات" value={(categoryRows.length).toLocaleString('ar')} icon={ClipboardList} accent="amber" sub="حسب category المحفوظ" />
        <KpiCard label="عقارات بها مصروفات" value={(propertyRows.length).toLocaleString('ar')} icon={Building2} accent="sky" sub="حسب معرّف العقار المحفوظ" />
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
