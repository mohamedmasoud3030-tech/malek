import { DetailFields } from '@/components/ui/detail-fields';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatMoney, formatNumber, formatDate } from '@/hooks/useCompanyFormatters';
import type { Property } from '@/types/domain';
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
      <DetailFields
        className="mt-1"
        columns={3}
        fields={[
          { label: 'النوع', value: translatePropertyType(property.type) },
          {
            label: 'الحالة',
            value: (
              <StatusBadge tone={propertyStatusTone[property.status]}>
                {propertyStatusLabels[property.status]}
              </StatusBadge>
            ),
          },
          { label: 'اسم المالك للعرض', value: property.owner_name ?? '—' },
          { label: 'قيمة الشراء', value: formatMoney(property.purchase_value) },
          { label: 'القيمة الحالية', value: formatMoney(property.current_value) },
          { label: 'تاريخ الإنشاء', value: formatDate(property.created_at) },
          { label: 'ملاحظات', value: property.notes ?? '—', wide: true },
        ]}
      />
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
      <DetailFields
        className="mt-1"
        columns={2}
        fields={[
          { label: 'إجمالي الوحدات', value: formatNumber(unitSummary.totalUnits) },
          { label: 'الوحدات المتاحة', value: formatNumber(unitSummary.availableUnits) },
          { label: 'الوحدات المشغولة', value: formatNumber(unitSummary.occupiedUnits) },
          { label: 'وحدات الصيانة', value: formatNumber(unitSummary.maintenanceUnits) },
          { label: 'الوحدات المحجوزة', value: formatNumber(unitSummary.reservedUnits) },
          { label: 'إجمالي الإيجار المتوقع', value: formatMoney(unitSummary.expectedRentTotal) },
        ]}
      />
    </section>
  );
}
