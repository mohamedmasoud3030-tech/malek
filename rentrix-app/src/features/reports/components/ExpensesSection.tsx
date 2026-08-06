import { Building2, ClipboardList, Download, FileSpreadsheet, Printer, ReceiptText, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { formatMoney, formatShortId } from '@/features/financials/components/financials-formatters';
import { useExpenseBreakdownReport } from '@/features/financials/reports/useFinancialReports';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { documentService } from '@/services/documents/DocumentService';
import { toReportDocumentPayload, type ReportDocumentData } from '@/services/documents/documentPayloadAdapters';
import { buildReportCsvFilename, downloadCsv, getTodayLocalDateString } from '../reports-page.helpers';
import {
  ReportColumns,
  ReportInsightNote,
  ReportList,
  ReportListRow,
  ReportPanel,
  ReportProgress,
  ReportState,
} from './report-section-primitives';
import { formatLatinNumber } from '@/lib/formatters';

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
  const topCategory = [...categoryRows].sort((a, b) => b.total - a.total)[0];
  const topProperty = [...propertyRows].sort((a, b) => b.total - a.total)[0];
  const topCategoryShare = topCategory && totalExpenses > 0 ? (topCategory.total / totalExpenses) * 100 : 0;
  const topPropertyShare = topProperty && totalExpenses > 0 ? (topProperty.total / totalExpenses) * 100 : 0;

  const { companySettings: documentSettings, isReady: isDocumentSettingsReady } = useDocumentSettings();
  const currencySymbol = documentSettings.currencySymbol || documentSettings.currency;

  const buildExpensesReportData = (): ReportDocumentData => {
    const todayStr = getTodayLocalDateString();
    return {
      reportTitle: 'تقرير وتوزيع المصروفات التشغيلية',
      reportType: 'Operational_Expenses_Report',
      periodFrom: todayStr,
      periodTo: todayStr,
      sections: [
        {
          title: 'توزيع المصروفات حسب التصنيف',
          columns: ['التصنيف', 'عدد السندات', 'المبلغ الإجمالي'],
          rows: categoryRows.map((row) => [
            row.category,
            row.count,
            `${formatLatinNumber(row.total, 'ar-OM')} ${currencySymbol}`,
          ]),
          totals: ['الإجمالي العام', '', `${formatLatinNumber(totalExpenses, 'ar-OM')} ${currencySymbol}`],
        },
        {
          title: 'توزيع المصروفات حسب العقارات',
          columns: ['العقار', 'عدد الحركات', 'المبلغ الإجمالي'],
          rows: propertyRows.map((row) => [
            row.propertyTitle ?? formatShortId(row.propertyId),
            row.count,
            `${formatLatinNumber(row.total, 'ar-OM')} ${currencySymbol}`,
          ]),
        },
      ],
      totalSummary: `إجمالي النفقات: ${formatLatinNumber(totalExpenses, 'ar-OM')} ${currencySymbol} | عدد السندات: ${expensesCount}`,
    };
  };

  const handlePrintExpensesReport = async () => {
    try {
      await documentService.printDocument('generic_report', { settings: documentSettings, payload: toReportDocumentPayload(buildExpensesReportData()) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذرت طباعة التقرير.');
    }
  };

  const handleDownloadExpensesReport = async () => {
    try {
      await documentService.downloadDocumentPdf('generic_report', { settings: documentSettings, payload: toReportDocumentPayload(buildExpensesReportData()) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر تنزيل ملف PDF.');
    }
  };

  const actions = canExportReports ? (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={handlePrintExpensesReport} disabled={!isDocumentSettingsReady} className="min-h-10 gap-1.5 text-xs">
        <Printer className="size-3.5" aria-hidden="true" />
        طباعة A4
      </Button>
      <Button variant="outline" size="sm" onClick={handleDownloadExpensesReport} disabled={!isDocumentSettingsReady} className="min-h-10 gap-1.5 text-xs">
        <Download className="size-3.5" aria-hidden="true" />
        تنزيل PDF
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
        <KpiCard label="التصنيفات" value={formatLatinNumber(categoryRows.length, 'ar')} icon={ClipboardList} sub={topCategory ? `الأعلى: ${topCategory.category}` : 'لا توجد تصنيفات'} />
        <KpiCard label="العقارات المتأثرة" value={formatLatinNumber(propertyRows.length, 'ar')} icon={Building2} sub={topProperty ? `الأعلى: ${topProperty.propertyTitle ?? formatShortId(topProperty.propertyId)}` : 'لا توجد عقارات'} />
      </ResponsiveCardGrid>

      <div className="grid gap-3 sm:grid-cols-2">
        <ReportProgress
          label="تركيز أكبر تصنيف"
          value={topCategoryShare}
          helper={topCategory ? `${topCategory.category} · ${formatMoney(topCategory.total)}` : 'لا توجد مصروفات'}
          tone={topCategoryShare <= 40 ? 'good' : topCategoryShare <= 60 ? 'warning' : 'critical'}
        />
        <ReportProgress
          label="تركيز أكبر عقار"
          value={topPropertyShare}
          helper={topProperty ? `${topProperty.propertyTitle ?? formatShortId(topProperty.propertyId)} · ${formatMoney(topProperty.total)}` : 'لا توجد مصروفات'}
          tone={topPropertyShare <= 45 ? 'good' : topPropertyShare <= 65 ? 'warning' : 'critical'}
        />
      </div>

      <ReportInsightNote title="قراءة المصروفات">
        {topCategoryShare > 60
          ? 'معظم المصروفات متركزة في تصنيف واحد؛ راجع تفاصيل هذا التصنيف والتكرار قبل اعتماد الفترة.'
          : topPropertyShare > 65
            ? 'عقار واحد يتحمل الحصة الأكبر من المصروفات؛ راجع الصيانة والخدمات المرتبطة به.'
            : 'المصروفات موزعة نسبيًا بين التصنيفات والعقارات دون تركّز حاد.'}
      </ReportInsightNote>

      <ReportColumns>
        <ReportPanel
          title="المصروفات حسب التصنيف"
          description="ترتيب مباشر لقيمة وعدد الحركات في كل تصنيف."
          eyebrow="تحليل التكلفة"
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
                  subtitle={`${formatLatinNumber(row.count, 'ar')} حركة`}
                  value={<span dir="ltr">{formatMoney(row.total)}</span>}
                />
              ))}
            </ReportList>
          )}
        </ReportPanel>

        <ReportPanel
          title="المصروفات حسب العقار"
          description="العقارات الأعلى تحمّلًا للتكاليف داخل النطاق."
          eyebrow="تحليل المحفظة"
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
                  subtitle={`${formatLatinNumber(row.count, 'ar')} حركة`}
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
