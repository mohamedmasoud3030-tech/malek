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

export function OccupancySection({ occupancyRows, expiringRows, isLoading }: Readonly<{
  occupancyRows: ReturnType<typeof buildOccupancyRows>;
  expiringRows: ReturnType<typeof buildExpiringContractsRows>;
  isLoading: boolean;
}>) {
  const totalUnits = occupancyRows.reduce((total, row) => total + row.occupied + row.vacant, 0);
  const totalOccupied = occupancyRows.reduce((total, row) => total + row.occupied, 0);
  const totalVacant = occupancyRows.reduce((total, row) => total + row.vacant, 0);
  const occupancyRate = totalUnits > 0 ? Math.round((totalOccupied / totalUnits) * 100) : 0;

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
        ],
        totalSummary: `معدل الإشغال الكلي: ${occupancyRate}% | عدد الوحدات الشاغرة الجاهزة للتأجير: ${totalVacant} وحدة`,
      },
      defaultSettings,
    );
  };

  return (
    <div className="space-y-4">
      <ResponsiveCardGrid>
        <KpiCard label="إجمالي الوحدات" value={formatCompanyNumber(defaultCompanyLocalSettings, totalUnits)} icon={Building2} sub={`${occupancyRows.length.toLocaleString('ar')} عقارات`} />
        <KpiCard label="نسبة الإشغال" value={`${occupancyRate}%`} icon={TrendingUp} sub={`${totalOccupied.toLocaleString('ar')} وحدة مشغولة`} />
        <KpiCard label="الوحدات الشاغرة" value={formatCompanyNumber(defaultCompanyLocalSettings, totalVacant)} icon={DoorOpen} sub="متاحة أو غير مشغولة" />
        <KpiCard label="عقود تنتهي قريبًا" value={expiringRows.length.toLocaleString('ar')} icon={CalendarClock} sub={`خلال ${expiringContractWindowDays} يوم`} />
      </ResponsiveCardGrid>

      <ReportColumns>
        <ReportPanel
          title="الإشغال حسب العقار"
          description="نسبة الاستغلال والوحدات المشغولة والشاغرة لكل عقار."
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
