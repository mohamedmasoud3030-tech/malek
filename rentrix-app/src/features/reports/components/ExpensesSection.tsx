import { Building2, ClipboardList, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatMoney, formatShortId } from '@/features/financials/components/financials-formatters';
import { useExpenseBreakdownReport } from '@/features/financials/reports/useFinancialReports';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { documentService } from '@/services/documents/DocumentService';
import { runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import { toReportDocumentPayload, type ReportDocumentData } from '@/services/documents/documentPayloadAdapters';
import { buildReportCsvFilename } from '../reports-page.helpers';
import {
  ReportColumns,
  ReportInsightNote,
  ReportList,
  ReportListRow,
  ReportPanel,
  ReportProgress,
  ReportState,
  ReportSummaryStrip,
} from '@/components/ui/report-section-primitives';
import { formatLatinNumber } from '@/lib/formatters';
import { ReportShareActions } from './ReportShareActions';
import type { ReportDrillHandler } from '../report-workspaces';

export function ExpensesSection({
  report,
  canExportReports,
  isLoading,
  from,
  to,
  onDrill,
}: Readonly<{
  report: NonNullable<ReturnType<typeof useExpenseBreakdownReport>['data']> | undefined;
  canExportReports: boolean;
  isLoading: boolean;
  from: string;
  to: string;
  onDrill?: ReportDrillHandler;
}>) {
  const categoryRows = report?.byCategory ?? [];
  const propertyRows = report?.byProperty ?? [];
  const totalExpenses = report?.totalExpenses ?? 0;
  const expensesCount = report?.expensesCount ?? 0;
  const averageExpense = expensesCount > 0 ? totalExpenses / expensesCount : undefined;

  const topCategory = [...categoryRows].sort((a, b) => b.total - a.total)[0];
  const topProperty = [...propertyRows].sort((a, b) => b.total - a.total)[0];
  const topCategoryShare = topCategory && totalExpenses > 0 ? (topCategory.total / totalExpenses) * 100 : 0;
  const topPropertyShare = topProperty && totalExpenses > 0 ? (topProperty.total / totalExpenses) * 100 : 0;

  const { companySettings: documentSettings, isReady: isDocumentSettingsReady } = useDocumentSettings();
  const currencySymbol = documentSettings.currencySymbol || documentSettings.currency;

  const buildExpensesReportData = (): ReportDocumentData => ({
    reportTitle: 'تقرير وتوزيع المصروفات التشغيلية',
    reportType: 'Operational_Expenses_Report',
    periodFrom: from,
    periodTo: to,
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
  });

  const handlePrintExpensesReport = async () => {
    await runGuardedDocumentAction({
      isReady: isDocumentSettingsReady,
      operation: () =>
        documentService.printDocument('generic_report', {
          settings: documentSettings,
          payload: toReportDocumentPayload(buildExpensesReportData()),
        }),
      fallbackMessage: 'تعذرت طباعة التقرير.',
    });
  };

  const handleDownloadExpensesReport = async () => {
    await runGuardedDocumentAction({
      isReady: isDocumentSettingsReady,
      operation: () =>
        documentService.downloadDocumentPdf('generic_report', {
          settings: documentSettings,
          payload: toReportDocumentPayload(buildExpensesReportData()),
        }),
      fallbackMessage: 'تعذر تنزيل ملف PDF.',
    });
  };

  const actions = canExportReports ? (
    <ReportShareActions
      className="flex flex-wrap gap-2"
      reportLabel="تقرير وتوزيع المصروفات التشغيلية"
      target={{
        section: 'analytics',
        view: 'expenses',
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
      summaryText={`إجمالي المصروفات: ${formatMoney(totalExpenses)} | حركات مسجلة: ${formatLatinNumber(expensesCount, 'ar')}`}
      onPrint={handlePrintExpensesReport}
      onDownloadPdf={handleDownloadExpensesReport}
      csv={{ filename: buildReportCsvFilename('expense-breakdown'), rows: [...categoryRows, ...propertyRows] }}
    />
  ) : undefined;

  return (
    <div className="space-y-3">
      <ReportSummaryStrip
        dataReportSummary="expenses"
        items={[
          {
            label: 'إجمالي المصروفات',
            value: formatMoney(totalExpenses),
            detail: `${formatLatinNumber(expensesCount, 'ar')} حركة`,
          },
          {
            label: 'متوسط المصروف',
            value: averageExpense !== undefined ? formatMoney(averageExpense) : '—',
            detail: averageExpense !== undefined ? 'لكل حركة مسجلة' : 'لا حركات في الفترة',
          },
          {
            label: 'التصنيفات',
            value: formatLatinNumber(categoryRows.length, 'ar'),
            detail: topCategory ? `الأعلى: ${topCategory.category}` : 'لا توجد تصنيفات',
          },
          {
            label: 'العقارات المتأثرة',
            value: formatLatinNumber(propertyRows.length, 'ar'),
            detail: topProperty
              ? `الأعلى: ${topProperty.propertyTitle ?? formatShortId(topProperty.propertyId)}`
              : 'لا توجد عقارات',
          },
        ]}
      />

      <ReportInsightNote title="قراءة المصروفات">
        {topCategoryShare > 60
          ? 'معظم المصروفات متركزة في تصنيف واحد؛ راجع تفاصيل هذا التصنيف والتكرار قبل اعتماد الفترة.'
          : topPropertyShare > 65
            ? 'عقار واحد يتحمل الحصة الأكبر من المصروفات؛ راجع الصيانة والخدمات المرتبطة به.'
            : 'المصروفات موزعة نسبيًا بين التصنيفات والعقارات دون تركّز حاد.'}
      </ReportInsightNote>

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
            <div className="p-4">
              <ReportState message="لا توجد مصروفات في الفترة المحددة." />
            </div>
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
          description={
            onDrill
              ? 'العقارات الأعلى تحمّلًا — افتح النظرة التشغيلية مع فلتر العقار.'
              : 'العقارات الأعلى تحمّلًا للتكاليف داخل النطاق.'
          }
          eyebrow="تحليل المحفظة"
          icon={Building2}
          isLoading={isLoading}
        >
          {propertyRows.length === 0 ? (
            <div className="p-4">
              <ReportState message="لا توجد مصروفات مرتبطة بعقارات في الفترة المحددة." />
            </div>
          ) : (
            <ReportList>
              {propertyRows.map((row) => {
                const label = row.propertyTitle ?? formatShortId(row.propertyId);
                return (
                  <ReportListRow
                    key={row.propertyId}
                    title={label}
                    subtitle={`${formatLatinNumber(row.count, 'ar')} حركة`}
                    value={<span dir="ltr">{formatMoney(row.total)}</span>}
                    action={
                      onDrill ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDrill('operations', 'operations_overview', { propertyId: row.propertyId })}
                          className="min-h-9 gap-1 px-2 text-xs text-muted-foreground hover:text-primary"
                          aria-label={`فتح النظرة التشغيلية لـ ${label}`}
                        >
                          عرض
                          <ArrowLeft className="size-3.5" aria-hidden="true" />
                        </Button>
                      ) : undefined
                    }
                  />
                );
              })}
            </ReportList>
          )}
        </ReportPanel>
      </ReportColumns>
    </div>
  );
}
