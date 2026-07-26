import { CalendarRange, Download, FileSpreadsheet, Link2, Printer, Scale, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatMoney, formatShortId } from '@/features/financials/components/financials-formatters';
import type { DeferredRevenueAudit } from '../reports-insights';
import { buildReportCsvFilename, downloadCsv } from '../reports-page.helpers';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { DocumentTemplates, type ReportDocumentData } from '@/services/documents/DocumentTemplates';
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

export function DeferredRevenueReportSection({
  audit,
  asOf,
  canExportReports,
  isLoading,
}: Readonly<{
  audit: DeferredRevenueAudit;
  asOf: string;
  canExportReports: boolean;
  isLoading: boolean;
}>) {
  const { schedule } = audit;
  const linkCoverage = audit.postedReceiptsCount > 0
    ? (audit.linkedReceiptsCount / audit.postedReceiptsCount) * 100
    : 0;

  const { settings: documentSettings, isReady: isDocumentSettingsReady } = useDocumentSettings();
  const currencySymbol = documentSettings.currencySymbol || documentSettings.currency;

  const buildDeferredRevenueReportData = (): ReportDocumentData => ({
    reportTitle: 'تقرير الإيرادات المؤجلة والاستحقاق',
    reportType: 'Deferred_Revenue_Report',
    periodFrom: schedule.schedules[0]?.periodStart ?? asOf,
    periodTo: asOf,
    sections: [
      {
        title: 'ملخص الاستحقاق',
        rows: [
          { label: 'التحصيلات المقدمة الموثقة', value: `${formatLatinNumber(schedule.totalUpfrontCollections, 'ar-OM')} ${currencySymbol}` },
          { label: 'الإيراد المعترف به للشهر الحالي', value: `${formatLatinNumber(schedule.totalRecognizedRevenueCurrentMonth, 'ar-OM')} ${currencySymbol}` },
          { label: 'الإيراد المعترف به حتى التاريخ', value: `${formatLatinNumber(schedule.totalRecognizedRevenueToDate, 'ar-OM')} ${currencySymbol}` },
          { label: 'الالتزام المؤجل المتبقي', value: `${formatLatinNumber(schedule.totalDeferredLiability, 'ar-OM')} ${currencySymbol}` },
        ],
      },
      {
        title: 'جداول الاعتراف حسب العقد',
        columns: ['العقد', 'المستأجر', 'العقار', 'التحصيل المقدم', 'الاستهلاك الشهري', 'المؤجل المتبقي'],
        rows: schedule.schedules.map((row) => [
          formatShortId(row.contractId),
          row.tenantName,
          row.propertyTitle,
          `${formatLatinNumber(row.totalCollected, 'ar-OM')} ${currencySymbol}`,
          `${formatLatinNumber(row.monthlyAmortizationAmount, 'ar-OM')} ${currencySymbol}`,
          `${formatLatinNumber(row.deferredRevenueRemaining, 'ar-OM')} ${currencySymbol}`,
        ]),
      },
    ],
    totalSummary: `عقود مؤهلة: ${audit.candidateContractsCount} | إيصالات مقدمة: ${audit.candidateReceiptsCount} | تغطية الربط: ${Math.round(linkCoverage)}%`,
  });

  const handlePrint = async () => {
    try {
      await DocumentTemplates.printReportDocument(buildDeferredRevenueReportData(), documentSettings);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذرت طباعة التقرير.');
    }
  };

  const handleDownload = async () => {
    try {
      await DocumentTemplates.downloadReportPdf(buildDeferredRevenueReportData(), documentSettings);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر تنزيل ملف PDF.');
    }
  };

  const actions = canExportReports ? (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" className="min-h-10 gap-1.5 text-xs" onClick={handlePrint} disabled={!isDocumentSettingsReady}>
        <Printer className="size-3.5" aria-hidden="true" />
        طباعة A4
      </Button>
      <Button type="button" variant="outline" size="sm" className="min-h-10 gap-1.5 text-xs" onClick={handleDownload} disabled={!isDocumentSettingsReady}>
        <Download className="size-3.5" aria-hidden="true" />
        تنزيل PDF
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="min-h-10 gap-1.5 text-xs"
        onClick={() => downloadCsv(
          buildReportCsvFilename('deferred-revenue'),
          schedule.schedules.map((row) => ({
            contract_id: row.contractId,
            tenant: row.tenantName,
            property: row.propertyTitle,
            period_start: row.periodStart,
            period_end: row.periodEnd,
            total_collected: row.totalCollected,
            monthly_amortization: row.monthlyAmortizationAmount,
            recognized_current_month: row.recognizedRevenueCurrentMonth,
            recognized_to_date: row.recognizedRevenueToDate,
            deferred_remaining: row.deferredRevenueRemaining,
          })),
        )}
      >
        <FileSpreadsheet className="size-3.5" aria-hidden="true" />
        CSV
      </Button>
    </div>
  ) : undefined;

  return (
    <div className="space-y-4">
      <ResponsiveCardGrid>
        <KpiCard label="تحصيلات مقدمة موثقة" value={formatMoney(schedule.totalUpfrontCollections)} icon={WalletCards} sub={`${formatLatinNumber(audit.candidateReceiptsCount, 'ar')} إيصالات`} />
        <KpiCard label="اعتراف الشهر الحالي" value={formatMoney(schedule.totalRecognizedRevenueCurrentMonth)} icon={CalendarRange} sub={`حتى ${asOf}`} />
        <KpiCard label="معترف به حتى التاريخ" value={formatMoney(schedule.totalRecognizedRevenueToDate)} icon={Scale} sub={`${formatLatinNumber(audit.candidateContractsCount, 'ar')} عقود`} />
        <KpiCard label="التزام مؤجل متبقٍ" value={formatMoney(schedule.totalDeferredLiability)} icon={Link2} sub="سيُعترف به خلال مدد العقود" />
      </ResponsiveCardGrid>

      <ReportColumns>
        <ReportPanel
          title="جداول الاعتراف بالإيراد"
          description="كل صف مبني على إيصال منشور مرتبط بعقد، وتاريخ السداد في أو قبل بداية العقد."
          eyebrow="تقرير محاسبي فعلي"
          icon={Scale}
          action={actions}
          isLoading={isLoading}
        >
          {schedule.schedules.length === 0 ? (
            <div className="p-4 sm:p-5">
              <ReportState
                title="لا توجد تحصيلات مقدمة مؤهلة"
                message="لم يُعثر على إيصال منشور مرتبط بعقد وتاريخه في أو قبل بداية العقد حتى تاريخ التقرير."
              />
            </div>
          ) : (
            <ReportList>
              {schedule.schedules.map((row) => (
                <ReportListRow
                  key={row.contractId}
                  title={(
                    <a className="hover:text-primary hover:underline" href={`/contracts/${encodeURIComponent(row.contractId)}`}>
                      {row.tenantName}
                    </a>
                  )}
                  subtitle={`${row.propertyTitle} · ${row.periodStart} — ${row.periodEnd}`}
                  meta={`${formatLatinNumber(row.elapsedMonths, 'ar')} من ${formatLatinNumber(row.totalMonths, 'ar')} شهر`}
                  value={(
                    <div className="text-end">
                      <p dir="ltr">{formatMoney(row.deferredRevenueRemaining)}</p>
                      <p className="mt-1 text-[10px] font-semibold text-muted-foreground" dir="ltr">
                        شهريًا {formatMoney(row.monthlyAmortizationAmount)}
                      </p>
                    </div>
                  )}
                />
              ))}
            </ReportList>
          )}
        </ReportPanel>

        <div className="space-y-4">
          <ReportPanel
            title="تدقيق جاهزية المصدر"
            description="قياس جودة ربط الإيصالات بالعقود قبل الاعتماد على التقرير محاسبيًا."
            eyebrow="جودة البيانات"
            icon={Link2}
            isLoading={isLoading}
            action={<StatusBadge tone={linkCoverage >= 90 ? 'success' : linkCoverage >= 70 ? 'warning' : 'danger'}>{Math.round(linkCoverage)}% مرتبط</StatusBadge>}
          >
            <div className="space-y-3 p-4">
              <ReportProgress
                label="تغطية ربط الإيصالات"
                value={linkCoverage}
                helper={`${formatLatinNumber(audit.linkedReceiptsCount, 'ar')} من ${formatLatinNumber(audit.postedReceiptsCount, 'ar')} إيصالات منشورة`}
                tone={linkCoverage >= 90 ? 'good' : linkCoverage >= 70 ? 'warning' : 'critical'}
              />
              <div className="grid grid-cols-2 gap-2">
                <SourceMetric label="إيصالات مرتبطة" value={audit.linkedReceiptsCount} amount={audit.linkedReceiptsAmount} />
                <SourceMetric label="غير مرتبطة" value={audit.unlinkedReceiptsCount} amount={audit.unlinkedReceiptsAmount} />
                <SourceMetric label="إيصالات مقدمة" value={audit.candidateReceiptsCount} amount={schedule.totalUpfrontCollections} />
                <SourceMetric label="روابط غير صالحة" value={audit.invalidContractLinksCount} amount={0} />
              </div>
            </div>
          </ReportPanel>

          <ReportInsightNote title="منهجية التقرير">
            {audit.methodology}
          </ReportInsightNote>
        </div>
      </ReportColumns>
    </div>
  );
}

function SourceMetric({ label, value, amount }: Readonly<{ label: string; value: number; amount: number }>) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
      <p className="text-[10px] font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-extrabold tabular-nums" dir="ltr">{formatLatinNumber(value, 'ar')}</p>
      {amount > 0 ? <p className="mt-1 text-[10px] text-muted-foreground" dir="ltr">{formatMoney(amount)}</p> : null}
    </div>
  );
}
