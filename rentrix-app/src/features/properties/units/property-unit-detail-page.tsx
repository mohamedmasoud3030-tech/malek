import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { Edit } from 'lucide-react';
import { useState } from 'react';
import { AsyncContentState } from '@/components/async-content-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { UnitFormModal } from '@/features/units/unit-form-modal';
import { useUnits } from '@/features/units/use-units';
import { formatMoney } from '@/hooks/useCompanyFormatters';
import { PropertyInfoItem } from '../components/property-info-item';
import { useProperty } from '../use-properties';
import { unitStatusLabels } from '@/features/units/unit-schema';

const unitStatusTone = { available: 'green', occupied: 'blue', maintenance: 'gold', reserved: 'gray' } as const;

export function PropertyUnitDetailPage() {
  const params = useParams({ strict: false });
  const propertyId = typeof params.propertyId === 'string' ? params.propertyId : '';
  const unitId = typeof params.unitId === 'string' ? params.unitId : '';
  const propertyQuery = useProperty(propertyId);
  const unitsQuery = useUnits(propertyId);
  const navigate = useNavigate();
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
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">تفاصيل وحدة {unit.unit_number}</CardTitle>
                <CardDescription>البيانات والمواصفات الفنية للوحدة التابعة للعقار الحالي.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" className="min-h-10" onClick={() => setEditOpen(true)}>
                  <Edit className="me-1 size-4" aria-hidden="true" />
                  تعديل الوحدة
                </Button>
                <Button variant="ghost" className="min-h-10" onClick={() => navigate({ to: '/properties/$propertyId/units', params: { propertyId } })}>
                  العودة للقائمة
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <PropertyInfoItem label="رقم الوحدة" value={`وحدة ${unit.unit_number}`} />
              <PropertyInfoItem label="الدور" value={unit.floor ?? '—'} />
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-xs font-bold text-muted-foreground">الحالة التشغيلية</p>
                <div className="mt-2">
                  <StatusBadge tone={unitStatusTone[unit.status as keyof typeof unitStatusTone] ?? 'gray'}>
                    {unitStatusLabels[unit.status as keyof typeof unitStatusLabels] ?? unit.status}
                  </StatusBadge>
                </div>
              </div>
              <PropertyInfoItem label="قيمة الإيجار المسجلة" value={formatMoney(unit.rent_amount)} />
              <div className="rounded-2xl border border-border bg-background p-4 md:col-span-2">
                <p className="text-xs font-bold text-muted-foreground">العقار التابع له</p>
                <p className="mt-1">
                  {property ? (
                    <Link to="/properties/$propertyId" params={{ propertyId: property.id }} className="text-primary font-black hover:underline">
                      {property.title}
                    </Link>
                  ) : '—'}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-background p-4 md:col-span-2">
                <p className="text-xs font-bold text-muted-foreground">ملاحظات الوحدة</p>
                <p className="mt-1 leading-7">{unit.notes ?? '—'}</p>
              </div>
            </CardContent>
          </Card>

          <UnitFormModal propertyId={propertyId} unit={unit} open={editOpen} onOpenChange={setEditOpen} />
        </div>
      )}
    </AsyncContentState>
  );
}
