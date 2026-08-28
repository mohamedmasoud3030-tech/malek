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
          <section aria-label="بيانات الوحدة">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-4 border-b border-border/60 pb-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <DoorOpen className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-black">وحدة {unit.unit_number}</h3>
                  <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                    <Building2 className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{property?.title ?? 'العقار غير محدد'}</span>
                  </p>
                </div>
              </div>
              {status ? <StatusBadge tone={status === 'occupied' ? 'success' : status === 'available' ? 'info' : 'warning'}>{unitStatusLabels[status]}</StatusBadge> : null}
            </div>
            <DetailFields
              columns={3}
              fields={[
                { label: 'رقم الوحدة', value: unit.unit_number },
                { label: 'الدور', value: unit.floor ?? '—' },
                { label: 'الإيجار المرجعي', value: <span dir="ltr">{companyFormatters.money(unit.rent_amount ?? 0)}</span> },
                ...(unit.daily_reference_rate != null
                  ? [{ label: 'سعر اليوم المرجعي للإقامة القصيرة', value: <span dir="ltr">{companyFormatters.money(unit.daily_reference_rate)}</span> }]
                  : []),
                { label: 'العقار', value: property?.title ?? '—' },
                { label: 'الحالة', value: status ? unitStatusLabels[status] : '—' },
                { label: 'ملاحظات', value: unit.notes ?? '—', wide: true },
              ]}
            />
          </section>
          <ContextualDocumentsSection entityType="unit" entityId={unit.id} entityLabel="الوحدة" />
        </div>
      ) : null}
    </EntityPreviewDialog>
  );
}
