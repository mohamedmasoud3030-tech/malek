import { Building2, DoorOpen } from 'lucide-react';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { DetailFields } from '@/components/ui/detail-fields';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAllUnits } from '../use-units';
import { useProperties } from '@/features/properties/use-properties';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import { normalizeUnitStatus, unitStatusLabels } from '../unit-schema';

const ALL_PROPERTIES_PARAMS = { page: 1, pageSize: 500, search: '', status: 'all' as const };

export function UnitPreviewDialog({
  unitId,
  open,
  onOpenChange,
}: Readonly<{
  unitId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>) {
  const unitsQuery = useAllUnits();
  const propertiesQuery = useProperties(ALL_PROPERTIES_PARAMS);
  const unit = unitsQuery.data?.find((candidate) => candidate.id === unitId);
  const property = propertiesQuery.data?.rows.find((candidate) => candidate.id === unit?.property_id);
  const status = unit ? normalizeUnitStatus(String(unit.status)) : null;

  return (
    <EntityPreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      title={unit ? `معاينة الوحدة ${unit.unit_number}` : 'معاينة الوحدة'}
      description="تفاصيل الوحدة الأساسية بدون مغادرة سجل الوحدات."
    >
      {unitsQuery.isLoading || propertiesQuery.isLoading ? <LoadingState label="جارٍ تحميل تفاصيل الوحدة" /> : null}
      {unitsQuery.isError || propertiesQuery.isError ? (
        <ErrorState
          title="تعذر تحميل الوحدة"
          error={unitsQuery.error ?? propertiesQuery.error}
          onRetry={() => {
            void unitsQuery.refetch();
            void propertiesQuery.refetch();
          }}
        />
      ) : null}
      {unit ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><DoorOpen className="size-6" /></span>
                <div>
                  <h3 className="text-xl font-black">وحدة {unit.unit_number}</h3>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><Building2 className="size-4" />{property?.title ?? 'العقار غير محدد'}</p>
                </div>
              </div>
              {status ? <StatusBadge tone={status === 'occupied' ? 'success' : status === 'available' ? 'info' : 'warning'}>{unitStatusLabels[status]}</StatusBadge> : null}
            </div>
            <DetailFields
              columns={3}
              fields={[
                { label: 'رقم الوحدة', value: unit.unit_number },
                { label: 'الدور', value: unit.floor ?? '—' },
                { label: 'الإيجار', value: <span dir="ltr">{formatMoney(unit.rent_amount ?? 0)}</span> },
                { label: 'العقار', value: property?.title ?? '—' },
                { label: 'الحالة', value: status ? unitStatusLabels[status] : '—' },
                { label: 'ملاحظات', value: unit.notes ?? '—', wide: true },
              ]}
            />
          </div>
        </div>
      ) : null}
    </EntityPreviewDialog>
  );
}
