import { Controller, type UseFormReturn } from 'react-hook-form';
import { EntityForm } from '@/components/ui/entity-form';
import { FileAttachmentField } from '@/components/ui/file-attachment-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Property, Unit } from '@/types/domain';
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
  firstError: string | undefined;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: MaintenanceFormValues) => void;
}>;

/** Create/edit overlay form for a single maintenance request (location, details, attachment). */
export function MaintenanceRequestForm({ open, isEditing, isEditingResolvedRequest, isSubmitting, isLoadingUnits, form, formPropertyId, properties, units, firstError, onOpenChange, onSubmit }: MaintenanceRequestFormProps) {
  return (
    <EntityForm.Overlay
      open={open}
      onOpenChange={(nextOpen) => { if (!isSubmitting) onOpenChange(nextOpen); }}
      title={isEditing ? 'تعديل طلب صيانة' : 'طلب صيانة جديد'}
      description="حدد الموقع والأولوية والمسؤول والموعد المجدول إن وجد."
    >
      <EntityForm.Root aria-busy={isSubmitting} onSubmit={form.handleSubmit(onSubmit)}>
        <EntityForm.ErrorSummary message={firstError} />

        <EntityForm.Section title="الموقع" description="اختر العقار، ويمكن ربط الطلب بوحدة محددة.">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-bold">
              <span>العقار</span>
              <Select aria-label="العقار" {...form.register('property_id')} disabled={isEditingResolvedRequest} aria-invalid={Boolean(form.formState.errors.property_id)}>
                <option value="">اختر العقار</option>
                {properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}
              </Select>
              {form.formState.errors.property_id?.message ? <span className="text-xs text-destructive">{form.formState.errors.property_id.message}</span> : null}
            </label>

            <label className="space-y-1.5 text-sm font-bold">
              <span>الوحدة</span>
              <Select aria-label="الوحدة" {...form.register('unit_id')} disabled={isEditingResolvedRequest || !formPropertyId || isLoadingUnits}>
                <option value="">بدون وحدة</option>
                {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.unit_number}</option>)}
              </Select>
            </label>
          </div>
        </EntityForm.Section>
        {isEditingResolvedRequest ? <p className="rounded-xl border border-amber-300/70 bg-amber-50/70 p-3 text-xs font-medium text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">لا يمكن تغيير موقع طلب تم حله أو إغلاقه حتى يبقى مرتبطاً بالمصروف المسجل.</p> : null}

        <EntityForm.Section title="تفاصيل الطلب" description="اكتب عنواناً قصيراً ثم أضف الوصف والأولوية.">
          <label className="space-y-1.5 text-sm font-bold">
            <span>عنوان الطلب</span>
            <Input aria-label="عنوان الطلب" placeholder="مثال: تسريب مياه في المطبخ" {...form.register('title')} aria-invalid={Boolean(form.formState.errors.title)} />
            {form.formState.errors.title?.message ? <span className="text-xs text-destructive">{form.formState.errors.title.message}</span> : null}
          </label>

          <label className="space-y-1.5 text-sm font-bold">
            <span>الوصف</span>
            <Textarea aria-label="وصف الطلب" placeholder="الوصف (اختياري)" className="min-h-24" {...form.register('description')} />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-bold">
              <span>الأولوية</span>
              <Select aria-label="الأولوية" {...form.register('priority')}>
                <option value="low">منخفضة</option>
                <option value="medium">متوسطة</option>
                <option value="high">عالية</option>
                <option value="urgent">عاجلة</option>
              </Select>
            </label>
            <label className="space-y-1.5 text-sm font-bold"><span>المسؤول/الفني</span><Input placeholder="اسم الفني أو المسؤول" {...form.register('assigned_to')} /></label>
            <label className="space-y-1.5 text-sm font-bold sm:col-span-2"><span>تاريخ الجدولة</span><Input type="date" {...form.register('scheduled_date')} /></label>
          </div>

          <Controller
            control={form.control}
            name="attachment_url"
            render={({ field }) => (
              <FileAttachmentField label="صورة مرفقة (اختياري)" value={field.value ?? null} onChange={field.onChange} />
            )}
          />
        </EntityForm.Section>

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
