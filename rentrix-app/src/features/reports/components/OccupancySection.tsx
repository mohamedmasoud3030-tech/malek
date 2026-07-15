import { Building2, CalendarClock, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { defaultCompanyLocalSettings } from '@/lib/companySettings';
import { formatCompanyNumber } from '@/lib/companyFormatters';
import { formatDate, formatShortId } from '@/features/financials/components/financials-formatters';
import { DocumentTemplates, type DocumentSettings } from '@/services/documents/DocumentTemplates';
import { buildExpiringContractsRows, buildOccupancyRows, expiringContractWindowDays, getTodayLocalDateString } from '../reports-page.helpers';
import { ReportCard, SafeAnchor } from './common';

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
  const handlePrintOccupancyReport = () => {
    const totalUnits = occupancyRows.reduce((acc, r) => acc + r.occupied + r.vacant, 0);
    const totalOccupied = occupancyRows.reduce((acc, r) => acc + r.occupied, 0);
    const totalVacant = occupancyRows.reduce((acc, r) => acc + r.vacant, 0);
    const occupancyRate = totalUnits > 0 ? ((totalOccupied / totalUnits) * 100).toFixed(1) : '0';
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
            rows: occupancyRows.map((r) => ({
              label: r.property,
              value: `إجمالي الوحدات: ${r.occupied + r.vacant} | المشغولة: ${r.occupied} | الشاغرة: ${r.vacant}`,
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
    <ReportCard
      title="مؤشرات الإشغال، الشواغر، والعقود القريبة من الانتهاء"
      description="متابعة نسبة استغلال الوحدات في كل عقار وتتبع الشواغر وتنبيهات العقود المتوقع انتهاؤها."
      action={
        <Button variant="outline" size="sm" onClick={handlePrintOccupancyReport} className="min-h-9 gap-1.5 text-xs font-bold">
          <Printer className="size-3.5 text-primary" aria-hidden="true" />
          طباعة تقرير الشواغر والإشغال A4
        </Button>
      }
      isLoading={isLoading}
    >
      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-background/80 p-3">
          <p className="mb-2 flex items-center justify-between gap-2 font-bold">
            <span>الإشغال والشاغر حسب العقار</span>
            <Building2 className="size-4 text-muted-foreground" />
          </p>
          <div className="space-y-2">
            {occupancyRows.map((row) => (
              <div key={row.propertyId} className="rounded-xl bg-muted/30 p-3 text-sm">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-bold">{row.property}</span>
                    {!row.hasTitle && row.shortPropertyId ? (
                      <span className="ms-2 text-[10px] text-muted-foreground/70" dir="ltr">#{row.shortPropertyId}</span>
                    ) : null}
                  </div>
                  <span className="text-muted-foreground">{formatCompanyNumber(defaultCompanyLocalSettings, row.occupied + row.vacant)} وحدة</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <KpiCard label="مشغولة" value={formatCompanyNumber(defaultCompanyLocalSettings, row.occupied)} icon={Building2} accent="emerald" sub="وحدات مؤجرة" compact />
                  <KpiCard label="شاغرة" value={formatCompanyNumber(defaultCompanyLocalSettings, row.vacant)} icon={Building2} accent="amber" sub="وحدات متاحة" compact />
                </div>
              </div>
            ))}
            {occupancyRows.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد وحدات متاحة لحساب الإشغال.</p> : null}
          </div>
        </div>
        <div className="rounded-2xl border bg-background/80 p-3">
          <p className="mb-2 flex items-center justify-between gap-2 font-bold">
            <span>عقود تنتهي خلال {expiringContractWindowDays} يوم</span>
            <CalendarClock className="size-4 text-muted-foreground" />
          </p>
          <div className="space-y-2">
            {expiringRows.map((row) => (
              <div key={row.contractId} className="rounded-xl bg-muted/30 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <SafeAnchor href={`/contracts/${encodeURIComponent(row.contractId)}`} label={formatShortId(row.contractId)} />
                  <StatusBadge tone={row.daysRemaining <= 15 ? 'red' : 'gold'}>{formatCompanyNumber(defaultCompanyLocalSettings, row.daysRemaining)} يوم</StatusBadge>
                </div>
                <p className="mt-2 font-medium">{row.tenantName}</p>
                <p className="text-muted-foreground">{row.propertyTitle} · {row.unitNumber} · {formatDate(row.endDate)}</p>
              </div>
            ))}
            {expiringRows.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد عقود نشطة تنتهي قريباً ضمن البيانات الحالية.</p> : null}
          </div>
        </div>
      </div>
    </ReportCard>
  );
}
