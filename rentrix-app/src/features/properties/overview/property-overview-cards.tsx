import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatMoney, formatNumber, formatDate } from '@/hooks/useCompanyFormatters';
import type { Property } from '@/types/domain';
import { PropertyInfoItem } from '../components/property-info-item';
import { propertyStatusTone, translatePropertyType } from '../components/property-status';
import { propertyStatusLabels } from '../property-schema';
import { summarizePropertyUnits } from '../property-unit-summary';
import type { Unit } from '@/types/domain';

export function PropertyIdentityCard({ property }: Readonly<{ property: Property }>) {
  return (
    <section aria-labelledby="property-identity-heading">
      <header className="border-b border-border/60 pb-2.5">
        <h2 id="property-identity-heading" className="text-base font-black">معلومات العقار</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">البيانات الأساسية للعقار مع معلومات المالك وقيم الشراء والتقييم.</p>
      </header>
      <ResponsiveCardGrid desktopColumns={4} gap="lg" className="mt-1">
        <PropertyInfoItem label="النوع" value={translatePropertyType(property.type)} />
        <div className="min-w-0 border-b border-border/60 py-3">
          <p className="text-xs font-medium text-muted-foreground">الحالة</p>
          <div className="mt-1">
            <StatusBadge tone={propertyStatusTone[property.status]}>{propertyStatusLabels[property.status]}</StatusBadge>
          </div>
        </div>
        <PropertyInfoItem label="اسم المالك للعرض" value={property.owner_name ?? '—'} />
        <PropertyInfoItem label="قيمة الشراء" value={formatMoney(property.purchase_value)} />
        <PropertyInfoItem label="القيمة الحالية" value={formatMoney(property.current_value)} />
        <PropertyInfoItem label="تاريخ الإنشاء" value={formatDate(property.created_at)} />
        <div className="min-w-0 border-b border-border/60 py-3 md:col-span-2">
          <p className="text-xs font-medium text-muted-foreground">ملاحظات</p>
          <p className="mt-1 break-words leading-7 [overflow-wrap:anywhere]">{property.notes ?? '—'}</p>
        </div>
      </ResponsiveCardGrid>
    </section>
  );
}

export function PropertyUnitsSummaryCard({ units }: Readonly<{ units: Unit[] }>) {
  const unitSummary = summarizePropertyUnits(units);

  return (
    <section aria-labelledby="property-units-summary-heading">
      <header className="border-b border-border/60 pb-2.5">
        <h2 id="property-units-summary-heading" className="text-base font-black">ملخص الوحدات</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">مؤشرات قراءة فقط محسوبة من الوحدات المسجلة لهذا العقار.</p>
      </header>
      <ResponsiveCardGrid desktopColumns={6} gap="lg" className="mt-1">
        <PropertyInfoItem label="إجمالي الوحدات" value={formatNumber(unitSummary.totalUnits)} />
        <PropertyInfoItem label="الوحدات المتاحة" value={formatNumber(unitSummary.availableUnits)} />
        <PropertyInfoItem label="الوحدات المشغولة" value={formatNumber(unitSummary.occupiedUnits)} />
        <PropertyInfoItem label="وحدات الصيانة" value={formatNumber(unitSummary.maintenanceUnits)} />
        <PropertyInfoItem label="الوحدات المحجوزة" value={formatNumber(unitSummary.reservedUnits)} />
        <PropertyInfoItem label="إجمالي الإيجار المتوقع" value={formatMoney(unitSummary.expectedRentTotal)} />
      </ResponsiveCardGrid>
    </section>
  );
}
