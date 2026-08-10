import { Building2, DoorOpen, MapPin, Pencil, UserRound } from 'lucide-react';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { ContextualDocumentsSection } from '@/components/documents/contextual-documents-section';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DetailFields } from '@/components/ui/detail-fields';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { useDialogNavigate } from '@/app/router/background-location';
import { useProperty } from '../use-properties';
import { useUnits } from '@/features/units/use-units';
import { propertyStatusLabels } from '../property-schema';
import { propertyStatusTone } from './property-status';

export function PropertyPreviewDialog({
  propertyId,
  open,
  onOpenChange,
  onEdit,
}: Readonly<{
  propertyId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (propertyId: string) => void;
}>) {
  const dialogNavigate = useDialogNavigate();
  const propertyQuery = useProperty(propertyId ?? '');
  const unitsQuery = useUnits(propertyId ?? '');
  const property = propertyQuery.data;
  const units = unitsQuery.data ?? [];
  const occupiedUnits = units.filter((unit) => unit.status === 'occupied').length;
  const availableUnits = units.filter((unit) => unit.status === 'available').length;

  return (
    <EntityPreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      title="معاينة العقار"
      description={property ? `${property.title ?? 'عقار'} — التفاصيل الأساسية والوحدات بدون مغادرة سجل العقارات.` : 'تحميل تفاصيل العقار...'}
      actions={property && onEdit ? (
        <Button className="min-h-11" onClick={() => onEdit(property.id)}>
          <Pencil className="me-2 size-4" />تعديل
        </Button>
      ) : undefined}
    >
      {propertyQuery.isLoading ? <LoadingState label="جارٍ تحميل تفاصيل العقار" /> : null}
      {propertyQuery.isError ? (
        <ErrorState
          title="تعذر تحميل العقار"
          error={propertyQuery.error}
          onRetry={() => { void propertyQuery.refetch(); }}
        />
      ) : null}
      {property ? (
        <div className="space-y-5">
          <Card>
            <CardContent className="space-y-5 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <Building2 className="size-6" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-xl font-black">{property.title ?? 'عقار'}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="size-4 shrink-0" aria-hidden="true" />
                      {property.address ?? 'العنوان غير محدد'}
                    </p>
                  </div>
                </div>
                <StatusBadge tone={propertyStatusTone[property.status]}>{propertyStatusLabels[property.status]}</StatusBadge>
              </div>

              <DetailFields
                columns={3}
                fields={[
                  { label: 'النوع', value: property.type ?? '—' },
                  { label: 'المالك', value: property.owner_name ? <span className="inline-flex items-center gap-1.5"><UserRound className="size-4" />{property.owner_name}</span> : '—' },
                  { label: 'الحالة', value: propertyStatusLabels[property.status] },
                ]}
              />
            </CardContent>
          </Card>

          <ResponsiveCardGrid>
            <KpiCard label="إجمالي الوحدات" value={units.length} icon={DoorOpen} accent="primary" />
            <KpiCard label="الوحدات المشغولة" value={occupiedUnits} icon={DoorOpen} accent="emerald" />
            <KpiCard label="الوحدات المتاحة" value={availableUnits} icon={DoorOpen} accent="sky" />
          </ResponsiveCardGrid>

          <Card>
            <CardContent className="p-5 sm:p-6">
              <h4 className="font-black">الوحدات</h4>
              {unitsQuery.isLoading ? <LoadingState variant="cards" rows={3} className="mt-4" /> : null}
              {!unitsQuery.isLoading && units.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">لا توجد وحدات مسجلة لهذا العقار حتى الآن.</p>
              ) : null}
              {units.length > 0 ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {units.slice(0, 6).map((unit) => (
                    <button
                      key={unit.id}
                      type="button"
                      className="min-h-11 rounded-2xl border border-border/70 bg-muted/20 p-4 text-start outline-none transition hover:border-primary/35 hover:bg-primary/5 focus-visible:ring-4 focus-visible:ring-primary/25"
                      onClick={() => dialogNavigate({
                        to: '/properties/$propertyId/units/$unitId',
                        params: { propertyId: property.id, unitId: unit.id },
                      })}
                      aria-label={`فتح ملف الوحدة ${unit.unit_number}`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="font-black">وحدة {unit.unit_number}</span>
                        <StatusBadge tone={unit.status === 'occupied' ? 'success' : unit.status === 'available' ? 'info' : 'warning'}>{unit.status}</StatusBadge>
                      </span>
                      <span className="mt-2 block text-xs text-muted-foreground">الدور: {unit.floor ?? '—'} · فتح الملف</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
          <ContextualDocumentsSection entityType="property" entityId={property.id} entityLabel="العقار" />
        </div>
      ) : null}
    </EntityPreviewDialog>
  );
}
