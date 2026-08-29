import { Controller, type UseFormReturn } from 'react-hook-form';
import { EntityForm } from '@/components/ui/entity-form';
import { FileAttachmentField } from '@/components/ui/file-attachment-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SelectionCard } from '@/components/ui/selection-card';
import { Textarea } from '@/components/ui/textarea';
import type { Property, Unit } from '@/types/domain';
import type { ServiceProviderCategory, ServiceProviderOption } from '@/features/service-providers/service-provider-service';
import type { MaintenanceFormValues } from '../useMaintenancePageController';

export type MaintenanceRequestFormProps = Readonly<{
  open: boolean;
  isEditing: boolean;
  isEditingResolvedRequest: boolean;
  isSubmitting: boolean;
  isLoadingUnits: boolean;
  form: UseFormReturn<MaintenanceFormValues>;
  formPropertyId: string;
  properties: Property[];
  units: Unit[];
  providerCategories: ServiceProviderCategory[];
  providerOptions: ServiceProviderOption[];
  firstError: string | undefined;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: MaintenanceFormValues) => void;
}>;

const priorityOptions: Array<{ value: 'low' | 'medium' | 'high' | 'urgent'; label: string; desc: string }> = [
  { value: 'low', label: 'منخفضة', desc: 'أعمال اعتيادية غير طارئة' },
  { value: 'medium', label: 'متوسطة', desc: 'صيانة تشغيلية خلال أيام' },
  { value: 'high', label: 'عالية', desc: 'تتطلب معالجة سريعة' },
  { value: 'urgent', label: 'عاجلة', desc: 'أعطال حرجة تؤثر على السلامة' },
];

export function MaintenanceRequestForm({
  open,
  isEditing,
  isEditingResolvedRequest,
  isSubmitting,
  isLoadingUnits,
  form,
  formPropertyId,
  properties,
  units,
  providerCategories,
  providerOptions,
  firstError,
  onOpenChange,
  onSubmit,
}: MaintenanceRequestFormProps) {
  const currentPriority = form.watch('priority') || 'medium';
  const currentTitle = form.watch('title');
  const currentScheduledDate = form.watch('scheduled_date');
  const currentAssignedTo = form.watch('assigned_to');
  const currentUnitId = form.watch('unit_id');
  const currentProviderCategoryId = form.watch('service_provider_category_id');
  const currentProviderId = form.watch('service_provider_id');

  const selectedProp = properties.find((p) => p.id === formPropertyId);
  const selectedUnit = units.find((u) => u.id === currentUnitId);
  const selectedProviderCategory = providerCategories.find((category) => category.id === currentProviderCategoryId);
  const selectedProvider = providerOptions.find((provider) => provider.id === currentProviderId);

  return (
    <EntityForm.Overlay
      open={open}
      onOpenChange={(nextOpen) => { if (!isSubmitting) onOpenChange(nextOpen); }}
      title={isEditing ? 'تعديل طلب صيانة' : 'طلب صيانة جديد'}
      description="حدد الموقع والأولوية والمسؤول والموعد المجدول إن وجد."
      visualVariant="operational"
    >
      <EntityForm.Root aria-busy={isSubmitting} onSubmit={form.handleSubmit(onSubmit)}>
        <EntityForm.ErrorSummary message={firstError} />

        <EntityForm.Section title="الموقع" description="اختر العقار، ويمكن ربط الطلب بوحدة محددة.">
          <div className="grid gap-4 sm:grid-cols-2">
            <EntityForm.Field label="العقار *" error={form.formState.errors.property_id?.message}>
              <Select required aria-label="العقار" {...form.register('property_id')} disabled={isEditingResolvedRequest} aria-invalid={Boolean(form.formState.errors.property_id)}>
                <option value="">اختر العقار</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>{property.title}</option>
                ))}
              </Select>
            </EntityForm.Field>

            <EntityForm.Field label="الوحدة">
              <Select aria-label="الوحدة" {...form.register('unit_id')} disabled={isEditingResolvedRequest || !formPropertyId || isLoadingUnits}>
                <option value="">بدون وحدة</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>{unit.unit_number}</option>
                ))}
              </Select>
            </EntityForm.Field>
          </div>
        </EntityForm.Section>

        {isEditingResolvedRequest ? (
          <p className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs font-medium text-warning">
            لا يمكن تغيير موقع طلب تم حله أو إغلاقه حتى يبقى مرتبطاً بالمصروف المسجل.
          </p>
        ) : null}

        <EntityForm.Section title="نوع الخدمة ومزود التنفيذ" description="اختر نوع الخدمة أولاً لتظهر الجهات التي تدعم هذا النوع. يمكن حفظ الطلب بلا مزود لحين التعيين.">
          <div className="grid gap-4 sm:grid-cols-2">
            <EntityForm.Field label="نوع الخدمة" error={form.formState.errors.service_provider_category_id?.message}>
              <Select aria-label="نوع خدمة الصيانة" {...form.register('service_provider_category_id')} disabled={isEditingResolvedRequest}>
                <option value="">غير محدد</option>
                {providerCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </Select>
            </EntityForm.Field>
            <EntityForm.Field label="مزود الخدمة" error={form.formState.errors.service_provider_id?.message}>
              <Select aria-label="مزود خدمة الصيانة" {...form.register('service_provider_id')} disabled={isEditingResolvedRequest || providerOptions.length === 0}>
                <option value="">غير معين</option>
                {providerOptions.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}{provider.phone ? ` · ${provider.phone}` : ''}</option>)}
              </Select>
            </EntityForm.Field>
          </div>
          {currentProviderCategoryId && providerOptions.length === 0 ? (
            <p className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs font-medium text-warning">لا يوجد مزود نشط يدعم نوع الخدمة المختار. اترك التعيين فارغًا أو أضف التخصص إلى ملف مزود.</p>
          ) : null}
        </EntityForm.Section>

        <EntityForm.Section title="تفاصيل الطلب والأولوية" description="اكتب عنواناً قصيراً ثم حدد مستوى الأولوية.">
          <EntityForm.Field label="عنوان الطلب *" error={form.formState.errors.title?.message}>
            <Input required aria-label="عنوان الطلب" placeholder="مثال: تسريب مياه في المطبخ" {...form.register('title')} aria-invalid={Boolean(form.formState.errors.title)} />
          </EntityForm.Field>

          <EntityForm.Field label="الوصف">
            <Textarea aria-label="وصف الطلب" placeholder="الوصف (اختياري)" className="min-h-24" {...form.register('description')} />
          </EntityForm.Field>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-muted-foreground">درجة الأولوية *</label>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {priorityOptions.map((opt) => (
                <SelectionCard
                  key={opt.value}
                  selected={currentPriority === opt.value}
                  title={opt.label}
                  description={opt.desc}
                  onClick={() => form.setValue('priority', opt.value, { shouldDirty: true, shouldValidate: true })}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 mt-3">
            <EntityForm.Field label="المسؤول/الفني">
              <Input aria-label="المسؤول/الفني" placeholder="اسم الفني أو المسؤول" {...form.register('assigned_to')} />
            </EntityForm.Field>

            <EntityForm.Field label="تاريخ الجدولة">
              <Input aria-label="تاريخ الجدولة" type="date" {...form.register('scheduled_date')} />
            </EntityForm.Field>
          </div>

          <Controller
            control={form.control}
            name="attachment_url"
            render={({ field }) => (
              <FileAttachmentField label="صورة مرفقة (اختياري)" value={field.value ?? null} onChange={field.onChange} />
            )}
          />
        </EntityForm.Section>

        {currentTitle || selectedProp ? (
          <EntityForm.Section title="معاينة الطلب قبل الاعتماد" description="مراجعة ملخص البيانات المدخلة قبل الحفظ النهائي.">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs space-y-2">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div>
                  <span className="text-muted-foreground">الموقع:</span>
                  <p className="font-semibold text-foreground">{selectedProp?.title || '—'}{selectedUnit ? ` (${selectedUnit.unit_number})` : ''}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">الأولوية:</span>
                  <p className="font-semibold text-foreground">{priorityOptions.find((p) => p.value === currentPriority)?.label}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">المسؤول/الفني:</span>
                  <p className="font-semibold text-foreground">{currentAssignedTo || 'غير محدد'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">الموعد:</span>
                  <p className="font-semibold text-foreground">{currentScheduledDate || 'غير مجدول'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">نوع الخدمة:</span>
                  <p className="font-semibold text-foreground">{selectedProviderCategory?.name || 'غير محدد'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">مزود التنفيذ:</span>
                  <p className="font-semibold text-foreground">{selectedProvider?.name || 'غير معين'}</p>
                </div>
              </div>
            </div>
          </EntityForm.Section>
        ) : null}

        <EntityForm.Actions
          submitLabel={isSubmitting ? 'جارٍ الحفظ...' : isEditing ? 'حفظ التعديل' : 'حفظ الطلب'}
          onCancel={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
          submitDisabled={properties.length === 0}
        />
      </EntityForm.Root>
    </EntityForm.Overlay>
  );
}
