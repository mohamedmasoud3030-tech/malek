import { MONEY_STEP } from '@/lib/money';
import type { UseFormReturn } from 'react-hook-form';
import { EntityForm } from '@/components/ui/entity-form';
import { ContextualDocumentsSection } from '@/components/documents/contextual-documents-section';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { Input } from '@/components/ui/input';
import { SelectionCard } from '@/components/ui/selection-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { formatDefaultCompanyMoney } from '@/lib/companyFormatters';
import type { ServiceProviderCategory, ServiceProviderOption } from '@/features/service-providers/service-provider-service';
import type { Maintenance, MaintenanceChargeTarget } from '../maintenance-service';
import type { MaintenanceResolveFormValues } from '../useMaintenancePageController';
import {
  maintenancePriorityLabels,
  maintenancePriorityTone,
  maintenanceStatusLabels,
  maintenanceStatusTone,
} from './maintenance-list';

export type ChargeTarget = MaintenanceChargeTarget;

export const chargeTargetLabels: Record<ChargeTarget, string> = {
  OWNER: 'المالك',
  TENANT: 'المستأجر',
  COMPANY: 'المكتب',
};

export const chargeTargetShortLabels: Record<ChargeTarget, { title: string; desc: string }> = {
  OWNER: { title: 'المالك', desc: 'تحميل التكلفة على المالك عبر مسار مصروفات المالك المعتمد' },
  TENANT: { title: 'المستأجر', desc: 'تحميل التكلفة على المستأجر عبر المسار المالي المعتمد' },
  COMPANY: { title: 'المكتب', desc: 'اعتبارها مصروفاً تشغيلياً على شركة الإدارة' },
};

export type MaintenanceDetailsOverlayProps = Readonly<{
  request: Maintenance | null;
  providerOptions: ServiceProviderOption[];
  providerCategories: ServiceProviderCategory[];
  onOpenChange: (open: boolean) => void;
}>;

/** Read-only details preview for a single maintenance request. */
export function MaintenanceDetailsOverlay({ request, providerOptions, providerCategories, onOpenChange }: MaintenanceDetailsOverlayProps) {
  const providerName = providerOptions.find((provider) => provider.id === request?.service_provider_id)?.name;
  const categoryName = providerCategories.find((category) => category.id === request?.service_provider_category_id)?.name;
  const chargedTo = request?.charged_to?.toUpperCase() as ChargeTarget | undefined;
  return (
    <EntityPreviewDialog
      open={request != null}
      onOpenChange={(open) => { if (!open) onOpenChange(false); }}
      title="معاينة طلب الصيانة"
      description={request?.title ?? 'تفاصيل الطلب داخل مكوّن المعاينة الموحد.'}
    >
      {request ? (
        <div className="space-y-4 text-sm">
          <div className="grid gap-3 rounded-2xl border border-border/60 bg-muted/15 p-4 sm:grid-cols-2">
            <div>
              <span className="text-xs font-medium text-muted-foreground">الحالة</span>
              <div className="mt-1">
                <StatusBadge tone={maintenanceStatusTone[request.status as keyof typeof maintenanceStatusTone] ?? 'neutral'}>
                  {maintenanceStatusLabels[request.status as keyof typeof maintenanceStatusLabels] ?? request.status ?? '—'}
                </StatusBadge>
              </div>
            </div>

            <div>
              <span className="text-xs font-medium text-muted-foreground">الأولوية</span>
              <div className="mt-1">
                <StatusBadge tone={maintenancePriorityTone[request.priority as keyof typeof maintenancePriorityTone] ?? 'neutral'}>
                  {maintenancePriorityLabels[request.priority as keyof typeof maintenancePriorityLabels] ?? request.priority ?? '—'}
                </StatusBadge>
              </div>
            </div>

            <div>
              <span className="text-xs font-medium text-muted-foreground">الفني / المسؤول</span>
              <p className="mt-1 font-medium">{request.assigned_to || request.technician_name || '—'}</p>
            </div>

            <div>
              <span className="text-xs font-medium text-muted-foreground">نوع الخدمة</span>
              <p className="mt-1 font-medium">{categoryName || (request.service_provider_category_id ? 'نوع مؤرشف أو غير متاح' : '—')}</p>
            </div>

            <div>
              <span className="text-xs font-medium text-muted-foreground">مزود الخدمة</span>
              <p className="mt-1 font-medium">{providerName || (request.service_provider_id ? 'مزود مؤرشف أو غير متاح' : '—')}</p>
            </div>

            <div>
              <span className="text-xs font-medium text-muted-foreground">تاريخ الجدولة</span>
              <p className="mt-1 font-medium">{request.scheduled_date || '—'}</p>
            </div>

            <div>
              <span className="text-xs font-medium text-muted-foreground">التكلفة الفعلية</span>
              <p className="mt-1 font-semibold text-primary">{request.cost != null ? formatDefaultCompanyMoney(request.cost) : '—'}</p>
            </div>

            <div>
              <span className="text-xs font-medium text-muted-foreground">يتحمل التكلفة</span>
              <p className="mt-1 font-semibold">{chargedTo && chargeTargetLabels[chargedTo] ? chargeTargetLabels[chargedTo] : 'لم تُحدد بعد'}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
            <span className="text-xs font-medium text-muted-foreground">الوصف</span>
            <p className="mt-1 whitespace-pre-wrap text-sm font-normal leading-relaxed">{request.description || 'لا يوجد وصف متاح.'}</p>
          </div>

          {request.attachment_url ? (
            <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
              <span className="text-xs font-medium text-muted-foreground">المرفق</span>
              <div className="mt-2 overflow-hidden rounded-xl border border-border/50">
                <img src={request.attachment_url} alt="مرفق طلب الصيانة" className="max-h-60 w-full object-cover" />
              </div>
            </div>
          ) : null}
          <ContextualDocumentsSection entityType="maintenance" entityId={request.id} entityLabel="طلب الصيانة" />
        </div>
      ) : null}
    </EntityPreviewDialog>
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

/** Overlay for entering actual cost and assigning charge target upon maintenance resolution. */
export function MaintenanceResolveOverlay({ target, form, isSubmitting, firstError, onOpenChange, onSubmit }: MaintenanceResolveOverlayProps) {
  const chargeTarget = form.watch('chargedTo');

  return (
    <EntityForm.Overlay
      open={target != null}
      onOpenChange={(open) => { if (!open && !isSubmitting) onOpenChange(false); }}
      title="تم التنفيذ — مراجعة التكلفة والمسؤولية"
      description="بعد انتهاء العمل، سجّل التكلفة الفعلية وحدد من يتحملها. الإغلاق النهائي يظل خطوة مستقلة بعد المراجعة."
    >
      <EntityForm.Root aria-busy={isSubmitting} onSubmit={form.handleSubmit(onSubmit)}>
        <EntityForm.ErrorSummary message={firstError} />
        <EntityForm.Section title="التكلفة وتوزيع المسؤولية" description={target ? target.title : undefined}>
          <EntityForm.Field label="التكلفة الفعلية للأعمال" error={form.formState.errors.cost?.message}>
            <Input dir="ltr" type="number" min="0" step={MONEY_STEP} inputMode="decimal" {...form.register('cost')} aria-invalid={Boolean(form.formState.errors.cost)} />
          </EntityForm.Field>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-muted-foreground">من يتحمل التكلفة؟</label>
            <div className="grid gap-3 sm:grid-cols-3">
              {(Object.keys(chargeTargetShortLabels) as ChargeTarget[]).map((key) => {
                const info = chargeTargetShortLabels[key];
                return (
                  <SelectionCard
                    key={key}
                    selected={chargeTarget === key}
                    title={info.title}
                    description={info.desc}
                    onClick={() => form.setValue('chargedTo', key, { shouldDirty: true, shouldValidate: true })}
                  />
                );
              })}
            </div>
            {form.formState.errors.chargedTo?.message ? (
              <p className="text-xs font-semibold text-destructive">{form.formState.errors.chargedTo.message}</p>
            ) : null}
          </div>

          <EntityForm.Field label="ملاحظات وتوجيهات التسوية (اختياري)">
            <Textarea className="min-h-20" placeholder="اكتب أي ملاحظات فنية أو سبب تحميل التكلفة..." {...form.register('notes')} />
          </EntityForm.Field>
        </EntityForm.Section>
        <EntityForm.Actions
          submitLabel={isSubmitting ? 'جارٍ حفظ التنفيذ...' : 'تأكيد تم التنفيذ وتوجيه التكلفة'}
          onCancel={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
        />
      </EntityForm.Root>
    </EntityForm.Overlay>
  );
}
