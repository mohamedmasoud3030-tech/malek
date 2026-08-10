import { Building2, DoorOpen } from 'lucide-react';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { ContextualDocumentsSection } from '@/components/documents/contextual-documents-section';
import { DetailFields } from '@/components/ui/detail-fields';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { useCompanyFormatters } from '@/hooks/useCompanyFormatters';
import { useUnitDetail } from '../use-units';
import { normalizeUnitStatus, unitStatusLabels } from '../unit-schema';


export function UnitPreviewDialog({
  unitId,
  open,
  onOpenChange,
}: Readonly<{
  unitId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>) {
  const unitQuery = useUnitDetail(unitId ?? '');
  const companyFormatters = useCompanyFormatters();
  const unit = unitQuery.data;
  const property = unit?.property;
  const status = unit ? normalizeUnitStatus(String(unit.status)) : null;

  return (
    <EntityPreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      title={unit ? `معاينة الوحدة ${unit.unit_number}` : 'معاينة الوحدة'}
      description="تفاصيل الوحدة الأساسية بدون مغادرة سجل الوحدات."
    >
      {unitQuery.isLoading ? <LoadingState label="جارٍ تحميل تفاصيل الوحدة" /> : null}
      {unitQuery.isError ? (
        <ErrorState
          title="تعذر تحميل الوحدة"
          error={unitQuery.error}
          onRetry={() => {
            void unitQuery.refetch();
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
                { label: 'الإيجار', value: <span dir="ltr">{companyFormatters.money(unit.rent_amount ?? 0)}</span> },
                { label: 'العقار', value: property?.title ?? '—' },
                { label: 'الحالة', value: status ? unitStatusLabels[status] : '—' },
                { label: 'ملاحظات', value: unit.notes ?? '—', wide: true },
              ]}
            />
          </div>
          <ContextualDocumentsSection entityType="unit" entityId={unit.id} entityLabel="الوحدة" />
        </div>
      ) : null}
    </EntityPreviewDialog>
  );
}
