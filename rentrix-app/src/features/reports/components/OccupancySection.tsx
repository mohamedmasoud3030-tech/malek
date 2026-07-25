import { Building2, CalendarClock, Download, DoorOpen, Printer, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { StatusBadge } from '@/components/ui/status-badge';
import { defaultCompanyLocalSettings } from '@/lib/companySettings';
import { formatCompanyNumber } from '@/lib/companyFormatters';
import { formatDate, formatShortId } from '@/features/financials/components/financials-formatters';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { DocumentTemplates, type ReportDocumentData } from '@/services/documents/DocumentTemplates';
import { toast } from 'sonner';
import { buildExpiringContractsRows, buildOccupancyRows, expiringContractWindowDays, getTodayLocalDateString } from '../reports-page.helpers';
import { SafeAnchor } from './common';
import {
  ReportColumns,
  ReportInsightNote,
  ReportList,
  ReportListRow,
  ReportPanel,
  ReportProgress,
  ReportState,
} from './report-section-primitives';

export function OccupancySection({ occupancyRows, expiringRows, isLoading }: Readonly<{
  occupancyRows: ReturnType<typeof buildOccupancyRows>;
  expiringRows: ReturnType<typeof buildExpiringContractsRows>;
  isLoading: boolean;
}>) {
  const totalUnits = occupancyRows.reduce((total, row) => total + row.occupied + row.vacant, 0);
  const totalOccupied = occupancyRows.reduce((total, row) => total + row.occupied, 0);
  const totalVacant = occupancyRows.reduce((total, row) => total + row.vacant, 0);
  const occupancyRate = totalUnits > 0 ? Math.round((totalOccupied / totalUnits) * 100) : 0;
  const vacancyRate = totalUnits > 0 ? (totalVacant / totalUnits) * 100 : 0;
  const renewalPressure = totalOccupied > 0 ? (expiringRows.length / totalOccupied) * 100 : 0;
  const highestVacancyProperty = [...occupancyRows].sort((a, b) => b.vacant - a.vacant)[0];
  const highestVacancyShare = totalVacant > 0 && highestVacancyProperty
    ? (highestVacancyProperty.vacant / totalVacant) * 100
    : 0;

  const { settings: documentSettings, isReady: isDocumentSettingsReady } = useDocumentSettings();

  const buildOccupancyReportData = (): ReportDocumentData => {
    const todayStr = getTodayLocalDateString();
    return {
      reportTitle: 'تقرير نسب الإشغال والشواغر العقارية',
      reportType: 'Occupancy_Vacancy_Report',
      periodFrom: todayStr,
      periodTo: todayStr,
      sections: [
        {
          title: 'جدول نسبة الإشغال والشاغر حسب كل عقار',
          columns: ['العقار', 'إجمالي الوحدات', 'المشغولة', 'الشاغرة', 'نسبة الإشغال'],
          rows: occupancyRows.map((row) => {
            const total = row.occupied + row.vacant;
            const rate = total > 0 ? Math.round((row.occupied / total) * 100) : 0;
            return [
              row.property,
              total,
              row.occupied,
              row.vacant,
              `${rate}%`,
            ];
          }),
          totals: ['الإجمالي العام', `${totalOccupied + totalVacant}`, `${totalOccupied}`, `${totalVacant}`, `${occupancyRate}%`],
        },
        {
          title: `العقود المنتهية خلال ${expiringContractWindowDays} يوم`,
          columns: ['المستأجر', 'العقار والوحدة', 'تاريخ الانتهاء', 'الأيام المتبقية'],
          rows: expiringRows.map((row) => [
            row.tenantName,
            `${row.propertyTitle} · ${row.unitNumber}`,
            row.endDate,
            `${row.daysRemaining} يوم`,
          ]),
        },
      ],
      totalSummary: `معدل الإشغال: ${occupancyRate}% | الشواغر: ${totalVacant} | عقود قريبة من الانتهاء: ${expiringRows.length}`,
    };
  };

  const handlePrintOccupancyReport = async () => {
    try {
      await DocumentTemplates.printReportDocument(buildOccupancyReportData(), documentSettings);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذرت طباعة التقرير.');
    }
  };

  const handleDownloadOccupancyReport = async () => {
    try {
      await DocumentTemplates.downloadReportPdf(buildOccupancyReportData(), documentSettings);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر تنزيل ملف PDF.');
    }
  };

  return (
    <div className="space-y-4">
      <ResponsiveCardGrid>
        <KpiCard label="إجمالي الوحدات" value={formatCompanyNumber(defaultCompanyLocalSettings, totalUnits)} icon={Building2} sub={`${occupancyRows.length.toLocaleString('ar')} عقارات`} />
        <KpiCard label="نسبة الإشغال" value={`${occupancyRate}%`} icon={TrendingUp} sub={`${totalOccupied.toLocaleString('ar')} وحدة مشغولة`} />
        <KpiCard label="الوحدات الشاغرة" value={formatCompanyNumber(defaultCompanyLocalSettings, totalVacant)} icon={DoorOpen} sub={`${Math.round(vacancyRate).toLocaleString('ar')}% من المحفظة`} />
        <KpiCard label="عقود تنتهي قريبًا" value={expiringRows.length.toLocaleString('ar')} icon={CalendarClock} sub={`خلال ${expiringContractWindowDays} يوم`} />
      </ResponsiveCardGrid>

      <div className="grid gap-3 sm:grid-cols-2">
        <ReportProgress
          label="إشغال المحفظة"
          value={occupancyRate}
          helper={`${totalOccupied.toLocaleString('ar')} مشغولة من ${totalUnits.toLocaleString('ar')} وحدة`}
          tone={occupancyRate >= 90 ? 'good' : occupancyRate >= 75 ? 'warning' : 'critical'}
        />
        <ReportProgress
          label="ضغط التجديد القادم"
          value={renewalPressure}
          helper={`${expiringRows.length.toLocaleString('ar')} عقود من ${totalOccupied.toLocaleString('ar')} وحدات مشغولة`}
          tone={renewalPressure <= 15 ? 'good' : renewalPressure <= 30 ? 'warning' : 'critical'}
        />
      </div>

      <ReportInsightNote title="قراءة الإشغال">
        {occupancyRate < 75
          ? 'الإشغال منخفض نسبيًا؛ ابدأ بالعقار الأعلى شواغرًا وراجع التسعير وحالة الوحدات الجاهزة للتأجير.'
          : renewalPressure > 30
            ? 'نسبة كبيرة من العقود النشطة تنتهي قريبًا؛ جهّز خطة تجديد مبكرة لتفادي ارتفاع الشواغر.'
            : highestVacancyShare > 60
              ? `معظم الشواغر متركزة في ${highestVacancyProperty?.property ?? 'عقار واحد'}؛ عالج السبب محليًا بدل اتخاذ قرار على مستوى المحفظة كلها.`
              : 'الإشغال مستقر وضغط التجديد ضمن نطاق يمكن متابعته تشغيليًا.'}
      </ReportInsightNote>

      <ReportColumns>
        <ReportPanel
          title="الإشغال حسب العقار"
          description="نسبة الاستغلال والوحدات المشغولة والشاغرة لكل عقار."
          eyebrow="استغلال المحفظة"
          icon={Building2}
          action={(
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={handlePrintOccupancyReport} disabled={!isDocumentSettingsReady} className="min-h-10 gap-1.5 text-xs">
                <Printer className="size-3.5" aria-hidden="true" />
                طباعة A4
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadOccupancyReport} disabled={!isDocumentSettingsReady} className="min-h-10 gap-1.5 text-xs">
                <Download className="size-3.5" aria-hidden="true" />
                تنزيل PDF
              </Button>
            </div>
          )}
          isLoading={isLoading}
        >
          {occupancyRows.length === 0 ? (
            <div className="p-4"><ReportState message="لا توجد وحدات متاحة لحساب الإشغال." /></div>
          ) : (
            <ReportList>
              {occupancyRows.map((row) => {
                const propertyTotal = row.occupied + row.vacant;
                const rate = propertyTotal > 0 ? Math.round((row.occupied / propertyTotal) * 100) : 0;
                return (
                  <ReportListRow
                    key={row.propertyId}
                    title={(
                      <span>
                        {row.property}
                        {!row.hasTitle && row.shortPropertyId ? <span className="ms-2 text-[10px] text-muted-foreground" dir="ltr">#{row.shortPropertyId}</span> : null}
                      </span>
                    )}
                    subtitle={`${formatCompanyNumber(defaultCompanyLocalSettings, row.occupied)} مشغولة · ${formatCompanyNumber(defaultCompanyLocalSettings, row.vacant)} شاغرة`}
                    meta={`${propertyTotal.toLocaleString('ar')} وحدة`}
                    value={<span dir="ltr">{rate}%</span>}
                  />
                );
              })}
            </ReportList>
          )}
        </ReportPanel>

        <ReportPanel
          title={`العقود المنتهية خلال ${expiringContractWindowDays} يوم`}
          description="أقرب العقود التي تحتاج قرار تجديد أو إخلاء."
          eyebrow="مخاطر التجديد"
          icon={CalendarClock}
          isLoading={isLoading}
        >
          {expiringRows.length === 0 ? (
            <div className="p-4"><ReportState message="لا توجد عقود نشطة تنتهي قريبًا ضمن البيانات الحالية." /></div>
          ) : (
            <ReportList>
              {expiringRows.map((row) => (
                <ReportListRow
                  key={row.contractId}
                  title={row.tenantName}
                  subtitle={`${row.propertyTitle} · ${row.unitNumber} · ${formatDate(row.endDate)}`}
                  meta={<SafeAnchor href={`/contracts/${encodeURIComponent(row.contractId)}`} label={formatShortId(row.contractId)} />}
                  value={<StatusBadge tone={row.daysRemaining <= 15 ? 'danger' : 'warning'}>{formatCompanyNumber(defaultCompanyLocalSettings, row.daysRemaining)} يوم</StatusBadge>}
                />
              ))}
            </ReportList>
          )}
        </ReportPanel>
      </ReportColumns>
    </div>
  );
}
