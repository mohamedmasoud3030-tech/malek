import { Building2, CalendarClock } from 'lucide-react';
import { KpiCard } from '@/components/ui/kpi-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { defaultCompanyLocalSettings } from '@/lib/companySettings';
import { formatCompanyNumber } from '@/lib/companyFormatters';
import { formatDate, formatMoney, formatShortId } from '@/features/financials/components/financials-formatters';
import { buildExpiringContractsRows, buildOccupancyRows, expiringContractWindowDays } from '../reports-page.helpers';
import { ReportCard, SafeAnchor } from './common';

export function OccupancySection({ occupancyRows, expiringRows, isLoading }: Readonly<{
  occupancyRows: ReturnType<typeof buildOccupancyRows>;
  expiringRows: ReturnType<typeof buildExpiringContractsRows>;
  isLoading: boolean;
}>) {
  return (
    <ReportCard
      title="الإشغال والعقود القريبة من الانتهاء"
      description="مؤشر إشغال الوحدات الحالية، وتنبيه عقود تنتهي خلال 60 يوم."
      isLoading={isLoading}
    >
      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-background/80 p-3">
          <p className="mb-2 flex items-center justify-between gap-2 font-black">
            <span>الإشغال حسب العقار</span>
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
                  <KpiCard label="مشغولة" value={formatCompanyNumber(defaultCompanyLocalSettings, row.occupied)} icon={Building2} accent="emerald" sub="من حالة الوحدة" compact />
                  <KpiCard label="شاغرة/أخرى" value={formatCompanyNumber(defaultCompanyLocalSettings, row.vacant)} icon={Building2} accent="amber" sub="غير occupied" compact />
                </div>
              </div>
            ))}
            {occupancyRows.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد وحدات متاحة لحساب الإشغال.</p> : null}
          </div>
        </div>
        <div className="rounded-2xl border bg-background/80 p-3">
          <p className="mb-2 flex items-center justify-between gap-2 font-black">
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
