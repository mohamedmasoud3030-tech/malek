import type { UseFormReturn } from 'react-hook-form';
import { EntityForm } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Maintenance } from '../maintenance-service';
import type { MaintenanceResolveFormValues } from '../useMaintenancePageController';
import { maintenanceStatusLabels } from './maintenance-list';

export type MaintenanceDetailsOverlayProps = Readonly<{
  request: Maintenance | null;
  onOpenChange: (open: boolean) => void;
}>;

/** Read-only details overlay for a single maintenance request. */
export function MaintenanceDetailsOverlay({ request, onOpenChange }: MaintenanceDetailsOverlayProps) {
  return (
    <EntityForm.Overlay
      open={request != null}
      onOpenChange={(open) => { if (!open) onOpenChange(false); }}
      title="تفاصيل طلب الصيانة"
      description={request?.title ?? undefined}
    >
      {request ? (
        <div className="space-y-3 text-sm">
          <p className="rounded-2xl border p-3"><strong>الحالة:</strong> {maintenanceStatusLabels[request.status as keyof typeof maintenanceStatusLabels] ?? request.status}</p>
          <p className="rounded-2xl border p-3"><strong>الوصف:</strong> {request.description || '—'}</p>
          <p className="rounded-2xl border p-3"><strong>الفني:</strong> {request.assigned_to || request.technician_name || '—'}</p>
          <p className="rounded-2xl border p-3"><strong>التكلفة:</strong> {request.cost ?? 0}</p>
        </div>
      ) : null}
    </EntityForm.Overlay>
  );
}

export type MaintenanceResolveOverlayProps = Readonly<{
  target: Maintenance | null;
  form: UseFormReturn<MaintenanceResolveFormValues>;
  isSubmitting: boolean;
  firstError: string | undefined;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: MaintenanceResolveFormValues) => void;
}>;

/** Overlay for entering the actual cost when resolving/closing a maintenance request. */
export function MaintenanceResolveOverlay({ target, form, isSubmitting, firstError, onOpenChange, onSubmit }: MaintenanceResolveOverlayProps) {
  return (
    <EntityForm.Overlay
      open={target != null}
      onOpenChange={(open) => { if (!open && !isSubmitting) onOpenChange(false); }}
      title="إغلاق طلب الصيانة"
      description="أدخل التكلفة الفعلية. سيتم تسجيلها كمصروف صيانة وفق منطق النظام الحالي."
    >
      <EntityForm.Root aria-busy={isSubmitting} onSubmit={form.handleSubmit(onSubmit)}>
        <EntityForm.ErrorSummary message={firstError} />
        <EntityForm.Section title="التكلفة الفعلية" description={target ? target.title : undefined}>
          <EntityForm.Field
            label="التكلفة الفعلية (ر.ع)"
            error={form.formState.errors.cost?.message}
          >
            <Input dir="ltr" type="number" min="0" step="0.01" inputMode="decimal" {...form.register('cost')} aria-invalid={Boolean(form.formState.errors.cost)} />
          </EntityForm.Field>
          <EntityForm.Field label="ملاحظات (اختياري)">
            <Textarea className="min-h-20" {...form.register('notes')} />
          </EntityForm.Field>
        </EntityForm.Section>
        <EntityForm.Actions
          submitLabel={isSubmitting ? 'جارٍ الحفظ...' : 'تأكيد الإغلاق'}
          onCancel={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
        />
      </EntityForm.Root>
    </EntityForm.Overlay>
  );
}
