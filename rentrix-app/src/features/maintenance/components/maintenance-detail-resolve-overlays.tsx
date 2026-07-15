import type { UseFormReturn } from 'react-hook-form';
import { EntityForm } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import type { Maintenance } from '../maintenance-service';
import type { MaintenanceResolveFormValues } from '../useMaintenancePageController';
import {
  maintenancePriorityLabels,
  maintenancePriorityTone,
  maintenanceStatusLabels,
  maintenanceStatusTone,
} from './maintenance-list';

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
        <div className="space-y-4 text-sm">
          <div className="grid gap-3 rounded-2xl border border-border/60 bg-muted/15 p-4 sm:grid-cols-2">
            <div>
              <span className="text-xs font-medium text-muted-foreground">الحالة</span>
              <div className="mt-1">
                <StatusBadge tone={maintenanceStatusTone[request.status as keyof typeof maintenanceStatusTone] ?? 'gray'}>
                  {maintenanceStatusLabels[request.status as keyof typeof maintenanceStatusLabels] ?? request.status ?? '—'}
                </StatusBadge>
              </div>
            </div>

            <div>
              <span className="text-xs font-medium text-muted-foreground">الأولوية</span>
              <div className="mt-1">
                <StatusBadge tone={maintenancePriorityTone[request.priority as keyof typeof maintenancePriorityTone] ?? 'gray'}>
                  {maintenancePriorityLabels[request.priority as keyof typeof maintenancePriorityLabels] ?? request.priority ?? '—'}
                </StatusBadge>
              </div>
            </div>

            <div>
              <span className="text-xs font-medium text-muted-foreground">الفني / المسؤول</span>
              <p className="mt-1 font-medium">{request.assigned_to || request.technician_name || '—'}</p>
            </div>

            <div>
              <span className="text-xs font-medium text-muted-foreground">تاريخ الجدولة</span>
              <p className="mt-1 font-medium">{request.scheduled_date || '—'}</p>
            </div>

            <div>
              <span className="text-xs font-medium text-muted-foreground">التكلفة الفعلية</span>
              <p className="mt-1 font-semibold text-primary">{request.cost != null ? `${request.cost} ر.ع` : '—'}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
            <span className="text-xs font-medium text-muted-foreground">الوصف</span>
            <p className="mt-1 text-sm font-normal leading-relaxed whitespace-pre-wrap">{request.description || 'لا يوجد وصف متاح.'}</p>
          </div>

          {request.attachment_url ? (
            <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
              <span className="text-xs font-medium text-muted-foreground">المرفق</span>
              <div className="mt-2 overflow-hidden rounded-xl border border-border/50">
                <img
                  src={request.attachment_url}
                  alt="مرفق طلب الصيانة"
                  className="max-h-60 w-full object-cover"
                />
              </div>
            </div>
          ) : null}
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
