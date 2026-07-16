import { Building2, CalendarClock, DoorOpen, Printer, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { StatusBadge } from '@/components/ui/status-badge';
import { defaultCompanyLocalSettings } from '@/lib/companySettings';
import { formatCompanyNumber } from '@/lib/companyFormatters';
import { formatDate, formatShortId } from '@/features/financials/components/financials-formatters';
import { DocumentTemplates, type DocumentSettings } from '@/services/documents/DocumentTemplates';
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

const defaultSettings: DocumentSettings = {
  company: {
    name: 'رينتريكس لإدارة العقارات',
    address: 'سلطنة عمان - مسقط',
    phone: '+968 24000000',
  },
  currency: 'OMR',
  currencySymbol: 'ر.ع',
};

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

  const handlePrintOccupancyReport = () => {
    const todayStr = getTodayLocalDateString();
    DocumentTemplates.renderReportPdf(
      {
        reportTitle: 'تقرير نسب الإشغال والشواغر العقارية',
        reportType: 'Occupancy_Vacancy_Report',
        periodFrom: todayStr,
        periodTo: todayStr,
        sections: [
          {
            title: 'جدول نسبة الإشغال والشاغر حسب كل عقار',
            rows: occupancyRows.map((row) => ({
              label: row.property,
              value: `إجمالي الوحدات: ${row.occupied + row.vacant} | المشغولة: ${row.occupied} | الشاغرة: ${row.vacant}`,
            })),
            totals: ['إجمالي إشغال المحفظة', `مشغولة: ${totalOccupied} / شاغرة: ${totalVacant} | نسبة الإشغال العامة: ${occupancyRate}%`],
          },
          {
            title: `العقود المنتهية خلال ${expiringContractWindowDays} يوم`,
            rows: expiringRows.map((row) => ({
              label: `${row.tenantName} · ${row.propertyTitle} · ${row.unitNumber}`,
              value: `ينتهي في ${row.endDate} | متبقي ${row.daysRemaining} يوم`,
            })),
          },
        ],
        totalSummary: `معدل الإشغال: ${occupancyRate}% | الشواغر: ${totalVacant} | عقود قريبة من الانتهاء: ${expiringRows.length}`,
      },
      defaultSettings,
    );
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
            <Button variant="outline" size="sm" onClick={handlePrintOccupancyReport} className="min-h-10 gap-1.5 text-xs">
              <Printer className="size-3.5" aria-hidden="true" />
              طباعة A4
            </Button>
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
                  value={<StatusBadge tone={row.daysRemaining <= 15 ? 'red' : 'gold'}>{formatCompanyNumber(defaultCompanyLocalSettings, row.daysRemaining)} يوم</StatusBadge>}
                />
              ))}
            </ReportList>
          )}
        </ReportPanel>
      </ReportColumns>
    </div>
  );
}
