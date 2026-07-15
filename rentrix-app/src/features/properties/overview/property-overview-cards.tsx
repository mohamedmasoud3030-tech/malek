import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card>
      <CardHeader>
        <CardTitle>معلومات العقار</CardTitle>
        <CardDescription>البيانات الأساسية للعقار مع معلومات المالك وقيم الشراء والتقييم.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveCardGrid desktopColumns={4} gap="lg">
          <PropertyInfoItem label="النوع" value={translatePropertyType(property.type)} />
          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-card">
            <p className="text-xs font-medium text-muted-foreground">الحالة</p>
            <div className="mt-2">
              <StatusBadge tone={propertyStatusTone[property.status]}>{propertyStatusLabels[property.status]}</StatusBadge>
            </div>
          </div>
          <PropertyInfoItem label="اسم المالك للعرض" value={property.owner_name ?? '—'} />
          <PropertyInfoItem label="قيمة الشراء" value={formatMoney(property.purchase_value)} />
          <PropertyInfoItem label="القيمة الحالية" value={formatMoney(property.current_value)} />
          <PropertyInfoItem label="تاريخ الإنشاء" value={formatDate(property.created_at)} />
          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-card md:col-span-2">
            <p className="text-xs font-medium text-muted-foreground">ملاحظات</p>
            <p className="mt-1 leading-7">{property.notes ?? '—'}</p>
          </div>
        </ResponsiveCardGrid>
      </CardContent>
    </Card>
  );
}

export function PropertyUnitsSummaryCard({ units }: Readonly<{ units: Unit[] }>) {
  const unitSummary = summarizePropertyUnits(units);

  return (
    <Card>
      <CardHeader>
        <CardTitle>ملخص الوحدات</CardTitle>
        <CardDescription>مؤشرات قراءة فقط محسوبة من الوحدات المسجلة لهذا العقار.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveCardGrid desktopColumns={6} gap="lg">
          <PropertyInfoItem label="إجمالي الوحدات" value={formatNumber(unitSummary.totalUnits)} />
          <PropertyInfoItem label="الوحدات المتاحة" value={formatNumber(unitSummary.availableUnits)} />
          <PropertyInfoItem label="الوحدات المشغولة" value={formatNumber(unitSummary.occupiedUnits)} />
          <PropertyInfoItem label="وحدات الصيانة" value={formatNumber(unitSummary.maintenanceUnits)} />
          <PropertyInfoItem label="الوحدات المحجوزة" value={formatNumber(unitSummary.reservedUnits)} />
          <PropertyInfoItem label="إجمالي الإيجار المتوقع" value={formatMoney(unitSummary.expectedRentTotal)} />
        </ResponsiveCardGrid>
      </CardContent>
    </Card>
  );
}
