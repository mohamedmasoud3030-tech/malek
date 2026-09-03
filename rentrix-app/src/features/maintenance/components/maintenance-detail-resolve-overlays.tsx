import { PlayCircle } from 'lucide-react';
import { MONEY_STEP } from '@/lib/money';
import type { UseFormReturn } from 'react-hook-form';
import { EntityForm } from '@/components/ui/entity-form';
import { ContextualDocumentsSection } from '@/components/documents/contextual-documents-section';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SelectionCard } from '@/components/ui/selection-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { formatDefaultCompanyMoney } from '@/lib/companyFormatters';
import { cn } from '@/lib/utils';
import type { ServiceProviderCategory, ServiceProviderOption } from '@/features/service-providers/service-provider-service';
import type { Maintenance } from '../maintenance-service';
import type { MaintenanceAction, MaintenanceResolveFormValues } from '../useMaintenancePageController';
import { maintenanceAttentionLabels, type MaintenanceAttention } from '../maintenance-attention';
import {
  maintenancePriorityLabels,
  maintenancePriorityTone,
  maintenanceStatusLabels,
  maintenanceStatusTone,
} from './maintenance-list';

export type ChargeTarget = 'landlord' | 'tenant' | 'office';

export const chargeTargetLabels: Record<ChargeTarget, string> = {
  landlord: 'خصم استقطاع من حساب المالك (مالك العقار)',
  tenant: 'إصدار فاتورة مطالبة على المستأجر (سوء استخدام)',
  office: 'مصروف تشغيلي عام على شركة الإدارة',
};

export const chargeTargetShortLabels: Record<ChargeTarget, { title: string; desc: string }> = {
  landlord: { title: 'المالك (استقطاع)', desc: 'تحميل المالك تكلفة الصيانة من حسابه' },
  tenant: { title: 'المستأجر (مطالبة)', desc: 'إصدار فاتورة مطالبة بسبب سوء الاستخدام' },
  office: { title: 'شركة الإدارة (تشغيلي)', desc: 'مصروف تشغيلي عام على المكتب' },
};

export type MaintenanceDetailsOverlayProps = Readonly<{
  request: Maintenance | null;
  providerOptions: ServiceProviderOption[];
  providerCategories: ServiceProviderCategory[];
  /**
   * Canonical operational attention for the selected request, supplied by the
   * workspace controller. The overlay presents it — it never recomputes it.
   */
  attention?: MaintenanceAttention | null;
  /**
   * The first canonical status action this operator may run. `null` for
   * terminal states, so no invalid step can be offered from the preview.
   */
  nextAction?: MaintenanceAction | null;
  nextActionDisabled?: boolean;
  /** Routes through the same canonical workflow the register row menu uses. */
  onRunNextAction?: (action: MaintenanceAction) => void;
  onOpenChange: (open: boolean) => void;
}>;

/** Read-only details preview for a single maintenance request. */
export function MaintenanceDetailsOverlay({
  request,
  providerOptions,
  providerCategories,
  attention,
  nextAction,
  nextActionDisabled = false,
  onRunNextAction,
  onOpenChange,
}: MaintenanceDetailsOverlayProps) {
  const providerName = providerOptions.find((provider) => provider.id === request?.service_provider_id)?.name;
  const categoryName = providerCategories.find((category) => category.id === request?.service_provider_category_id)?.name;
  const assignee = request?.assigned_to || request?.technician_name || null;
  const attentionFlags = attention?.flags ?? [];
  const ageDays = attention?.ageDays ?? null;
  const hasAttention = attentionFlags.length > 0;
  return (
    <EntityPreviewDialog
      open={request != null}
      onOpenChange={(open) => { if (!open) onOpenChange(false); }}
      title="معاينة طلب الصيانة"
      description={request?.title ?? 'تفاصيل الطلب داخل مكوّن المعاينة الموحد.'}
    >
      {request ? (
        <div className="space-y-4 text-sm">
          {/*
            Operational summary first: what state this request is really in,
            how long it has been sitting, and the one action that moves it
            forward. Everything below is supporting detail.
          */}
          <section
            data-maintenance-detail-attention
            aria-label="المتابعة التشغيلية للطلب"
            className={cn(
              'rounded-xl border p-3',
              hasAttention ? 'border-warning/30 bg-warning-bg' : 'border-border/70 bg-muted/20',
            )}
          >
            <p className="text-xs font-bold text-muted-foreground">المتابعة التشغيلية</p>
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
              {hasAttention ? (
                attentionFlags.map((flag) => (
                  <StatusBadge key={flag} tone={flag === 'awaiting_closure' ? 'info' : 'warning'}>
                    {maintenanceAttentionLabels[flag]}
                  </StatusBadge>
                ))
              ) : (
                <span data-maintenance-detail-attention-clear className="text-xs font-medium text-muted-foreground">
                  لا توجد متابعة مطلوبة على هذا الطلب.
                </span>
              )}
              {ageDays !== null ? (
                <span
                  data-maintenance-detail-age
                  className={cn(
                    'text-xs font-semibold tabular-nums',
                    attention?.isStalled ? 'text-warning-text' : 'text-muted-foreground',
                  )}
                >
                  {ageDays === 0 ? 'مُبلّغ اليوم' : `منذ ${ageDays} يوم`}
                </span>
              ) : null}
            </div>
            {nextAction && onRunNextAction ? (
              <div className="mt-2.5 border-t border-border/50 pt-2.5">
                <p className="text-xs font-medium text-muted-foreground">الإجراء التالي</p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-1.5 w-full sm:w-auto"
                  disabled={nextActionDisabled}
                  data-maintenance-detail-next-action={nextAction.status}
                  onClick={() => onRunNextAction(nextAction)}
                >
                  <PlayCircle className="me-1.5 size-4" aria-hidden="true" />
                  {nextAction.label}
                </Button>
              </div>
            ) : null}
          </section>

          <dl className="grid grid-cols-1 gap-x-5 sm:grid-cols-2" data-maintenance-detail-fields>
            <div className="border-b border-border/60 py-3">
              <dt className="text-xs font-medium text-muted-foreground">الحالة</dt>
              <dd className="mt-1">
                <StatusBadge tone={maintenanceStatusTone[request.status as keyof typeof maintenanceStatusTone] ?? 'neutral'}>
                  {maintenanceStatusLabels[request.status as keyof typeof maintenanceStatusLabels] ?? request.status ?? '—'}
                </StatusBadge>
              </dd>
            </div>

            <div className="border-b border-border/60 py-3">
              <dt className="text-xs font-medium text-muted-foreground">الأولوية</dt>
              <dd className="mt-1">
                <StatusBadge tone={maintenancePriorityTone[request.priority as keyof typeof maintenancePriorityTone] ?? 'neutral'}>
                  {maintenancePriorityLabels[request.priority as keyof typeof maintenancePriorityLabels] ?? request.priority ?? '—'}
                </StatusBadge>
              </dd>
            </div>

            {/*
              One assignment answer instead of two half-answers: the contracted
              provider and the technician actually responsible read as a single
              "who owns this work" cell.
            */}
            <div className="border-b border-border/60 py-3">
              <dt className="text-xs font-medium text-muted-foreground">الجهة المنفذة</dt>
              <dd className="mt-1">
                <span className="block font-medium">{providerName || (request.service_provider_id ? 'مزود مؤرشف أو غير متاح' : 'غير معين')}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground" data-maintenance-detail-assignee>
                  الفني المسؤول: {assignee ?? 'غير محدد'}
                </span>
              </dd>
            </div>

            <div className="border-b border-border/60 py-3">
              <dt className="text-xs font-medium text-muted-foreground">نوع الخدمة</dt>
              <dd className="mt-1 font-medium">{categoryName || (request.service_provider_category_id ? 'نوع مؤرشف أو غير متاح' : '—')}</dd>
            </div>

            <div className="border-b border-border/60 py-3">
              <dt className="text-xs font-medium text-muted-foreground">تاريخ الجدولة</dt>
              <dd className="mt-1 font-medium">{request.scheduled_date || '—'}</dd>
            </div>

            <div className="border-b border-border/60 py-3 sm:col-span-2">
              <dt className="text-xs font-medium text-muted-foreground">التكلفة الفعلية</dt>
              <dd className="mt-1 font-semibold text-primary">{request.cost != null ? formatDefaultCompanyMoney(request.cost) : '—'}</dd>
            </div>
          </dl>

          <section className="border-b border-border/60 pb-4" aria-label="وصف طلب الصيانة">
            <p className="text-xs font-medium text-muted-foreground">الوصف</p>
            <p className="mt-1 whitespace-pre-wrap text-sm font-normal leading-relaxed">{request.description || 'لا يوجد وصف متاح.'}</p>
          </section>

          {request.attachment_url ? (
            <section className="border-b border-border/60 pb-4" aria-label="مرفق طلب الصيانة">
              <p className="text-xs font-medium text-muted-foreground">المرفق</p>
              <img src={request.attachment_url} alt="مرفق طلب الصيانة" loading="lazy" decoding="async" className="mt-2 max-h-60 w-full rounded-xl object-cover" />
            </section>
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
  const chargedTo = form.watch('chargedTo');

  return (
    <EntityForm.Overlay
      open={target != null}
      onOpenChange={(open) => { if (!open && !isSubmitting) onOpenChange(false); }}
      title="إغلاق الصيانة بعد التحقق"
      description="الإغلاق النهائي يتطلب التكلفة الفعلية والجهة المسؤولة وتأكيد تنفيذ العمل. أرفق الإثبات عند وجوده."
    >
      <EntityForm.Root aria-busy={isSubmitting} onSubmit={form.handleSubmit(onSubmit)}>
        <EntityForm.ErrorSummary message={firstError} />
        <EntityForm.Section title="التكلفة وتوزيع المسؤولية" description={target ? target.title : undefined}>
          <EntityForm.Field label="التكلفة الفعلية للأعمال" error={form.formState.errors.cost?.message}>
            <Input dir="ltr" type="number" min="0" step={MONEY_STEP} inputMode="decimal" {...form.register('cost')} aria-invalid={Boolean(form.formState.errors.cost)} />
          </EntityForm.Field>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-muted-foreground">توجيه التكلفة والجهة المسؤولة عن السداد</label>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(chargeTargetShortLabels) as ChargeTarget[]).map((key) => {
                const info = chargeTargetShortLabels[key];
                return (
                  <SelectionCard
                    key={key}
                    selected={chargedTo === (key === 'landlord' ? 'OWNER' : key === 'tenant' ? 'TENANT' : 'COMPANY')}
                    title={info.title}
                    description={info.desc}
                    onClick={() => form.setValue('chargedTo', key === 'landlord' ? 'OWNER' : key === 'tenant' ? 'TENANT' : 'COMPANY', { shouldDirty: true, shouldValidate: true })}
                  />
                );
              })}
            </div>
          </div>

          <EntityForm.Field label="رابط الفاتورة أو إثبات التنفيذ (اختياري)" error={form.formState.errors.evidenceUrl?.message}>
            <Input dir="ltr" type="url" placeholder="https://…" {...form.register('evidenceUrl')} />
          </EntityForm.Field>

          <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/15 p-3 text-sm font-medium">
            <input type="checkbox" className="mt-0.5 size-4" {...form.register('confirmed')} />
            <span>أؤكد أن العمل تم فعليًا وتمت مراجعته قبل الإغلاق النهائي.</span>
          </label>
          {form.formState.errors.confirmed?.message ? <p className="text-xs text-danger">{form.formState.errors.confirmed.message}</p> : null}

          <EntityForm.Field label="ملاحظات وتوجيهات التسوية (اختياري)">
            <Textarea className="min-h-20" placeholder="اكتب أي ملاحظات فنية أو سبب تحميل التكلفة..." {...form.register('notes')} />
          </EntityForm.Field>
        </EntityForm.Section>
        <EntityForm.Actions
          submitLabel={isSubmitting ? 'جارٍ إغلاق الطلب...' : 'تأكيد الإغلاق النهائي'}
          onCancel={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
        />
      </EntityForm.Root>
    </EntityForm.Overlay>
  );
}
