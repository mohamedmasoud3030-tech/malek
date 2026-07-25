import { Link, useParams } from '@tanstack/react-router';
import { Edit } from 'lucide-react';
import { useState } from 'react';
import { AsyncContentState } from '@/components/async-content-state';
import { EntityDetailHeader } from '@/components/layout/entity-detail-header';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { UnitFormModal } from '@/features/units/unit-form-modal';
import { useUnits } from '@/features/units/use-units';
import { formatMoney } from '@/hooks/useCompanyFormatters';
import { PropertyInfoItem } from '../components/property-info-item';
import { useProperty } from '../use-properties';
import { unitStatusLabels } from '@/features/units/unit-schema';

const unitStatusTone = { available: 'success', occupied: 'info', maintenance: 'warning', reserved: 'neutral' } as const;

export function PropertyUnitDetailPage() {
  const params = useParams({ strict: false });
  const propertyId = typeof params.propertyId === 'string' ? params.propertyId : '';
  const unitId = typeof params.unitId === 'string' ? params.unitId : '';
  const propertyQuery = useProperty(propertyId);
  const unitsQuery = useUnits(propertyId);
  const [editOpen, setEditOpen] = useState(false);

  const property = propertyQuery.data;
  const unit = unitsQuery.data?.find((candidate) => candidate.id === unitId);

  return (
    <AsyncContentState
      status={unitsQuery.isLoading ? 'loading' : unitsQuery.isError ? 'error' : !unit ? 'empty' : 'ready'}
      error={unitsQuery.error}
      errorTitle="تعذر تحميل تفاصيل الوحدة"
      emptyTitle="الوحدة غير موجودة"
    >
      {unit && (
        <div className="space-y-6">
          <EntityDetailHeader
            title={`وحدة ${unit.unit_number}`}
            subtitle={property ? property.title : undefined}
            backTo={`/properties/${propertyId}/units`}
            backLabel="العودة للوحدات"
            status={
              <StatusBadge tone={unitStatusTone[unit.status as keyof typeof unitStatusTone] ?? 'neutral'}>
                {unitStatusLabels[unit.status as keyof typeof unitStatusLabels] ?? unit.status}
              </StatusBadge>
            }
            actions={
              <Button variant="secondary" className="min-h-10" onClick={() => setEditOpen(true)}>
                <Edit className="me-1 size-4" aria-hidden="true" />
                تعديل الوحدة
              </Button>
            }
          />

          <div className="grid gap-4 md:grid-cols-2">
            <PropertyInfoItem label="رقم الوحدة" value={`وحدة ${unit.unit_number}`} />
            <PropertyInfoItem label="الدور" value={unit.floor ?? '—'} />
            <PropertyInfoItem label="قيمة الإيجار المسجلة" value={formatMoney(unit.rent_amount)} />
            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-card md:col-span-2">
              <p className="text-xs font-medium text-muted-foreground">العقار التابع له</p>
              <p className="mt-1">
                {property ? (
                  <Link to="/properties/$propertyId" params={{ propertyId: property.id }} className="font-semibold text-primary hover:underline">
                    {property.title}
                  </Link>
                ) : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-card md:col-span-2">
              <p className="text-xs font-medium text-muted-foreground">ملاحظات الوحدة</p>
              <p className="mt-1 leading-7">{unit.notes ?? '—'}</p>
            </div>
          </div>

          <UnitFormModal propertyId={propertyId} unit={unit} open={editOpen} onOpenChange={setEditOpen} />
        </div>
      )}
    </AsyncContentState>
  );
}
