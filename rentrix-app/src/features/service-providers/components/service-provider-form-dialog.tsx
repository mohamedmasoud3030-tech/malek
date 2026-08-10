import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { EntityForm } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AsyncContentState } from '@/components/async-content-state';
import {
  emptyServiceProviderFormValues,
  serviceProviderFormSchema,
  type ServiceProviderFormValues,
} from '../service-provider-schema';
import type { ServiceProviderListItem } from '../service-provider-service';
import { useSaveServiceProvider, useServiceProviderCategories } from '../use-service-providers';

function providerToFormValues(provider: ServiceProviderListItem | null): ServiceProviderFormValues {
  if (!provider) return emptyServiceProviderFormValues;
  return {
    name: provider.name,
    legal_name: provider.legal_name ?? '',
    registration_number: provider.registration_number ?? '',
    tax_number: provider.tax_number ?? '',
    contact_name: provider.contact_name ?? '',
    phone: provider.phone ?? '',
    alternate_phone: provider.alternate_phone ?? '',
    email: provider.email ?? '',
    website: provider.website ?? '',
    address: provider.address ?? '',
    service_area: provider.service_area ?? '',
    availability_notes: provider.availability_notes ?? '',
    notes: provider.notes ?? '',
    is_active: provider.is_active,
    category_ids: provider.categories.map((category) => category.id),
  };
}

export function ServiceProviderFormDialog({
  open,
  provider,
  isProviderLoading = false,
  onOpenChange,
}: Readonly<{
  open: boolean;
  provider: ServiceProviderListItem | null;
  isProviderLoading?: boolean;
  onOpenChange: (open: boolean) => void;
}>) {
  const categoriesQuery = useServiceProviderCategories();
  const saveMutation = useSaveServiceProvider(provider?.id ?? null);
  const form = useForm<ServiceProviderFormValues>({
    resolver: zodResolver(serviceProviderFormSchema),
    defaultValues: emptyServiceProviderFormValues,
  });

  useEffect(() => {
    if (open && !isProviderLoading) form.reset(providerToFormValues(provider));
  }, [form, isProviderLoading, open, provider]);

  const submit = async (values: ServiceProviderFormValues) => {
    try {
      await saveMutation.mutateAsync(values);
      onOpenChange(false);
    } catch {
      // Mutation feedback is presented by EntityForm.ErrorSummary and toast.
    }
  };
  const submitError = saveMutation.error instanceof Error ? saveMutation.error.message : undefined;

  return (
    <EntityForm.Overlay
      open={open}
      onOpenChange={(next) => { if (!saveMutation.isPending) onOpenChange(next); }}
      title={provider ? 'تعديل مزود الخدمة' : 'إضافة مزود خدمة'}
      description="بيانات الشركة والتواصل ونطاق التشغيل وأنواع الخدمات المدعومة."
      className="max-w-4xl"
      visualVariant="operational"
    >
      {isProviderLoading ? (
        <AsyncContentState status="loading">{null}</AsyncContentState>
      ) : (
        <EntityForm.Root onSubmit={form.handleSubmit(submit)} aria-busy={saveMutation.isPending}>
          <EntityForm.ErrorSummary message={submitError} />

          <EntityForm.Section title="بيانات المنشأة" description="الاسم التشغيلي مطلوب؛ أما بيانات التسجيل والضريبة فتسجل عند توفرها.">
            <div className="grid gap-4 sm:grid-cols-2">
              <EntityForm.Field label="اسم مزود الخدمة *" error={form.formState.errors.name?.message}>
                <Input required aria-label="اسم مزود الخدمة" {...form.register('name')} aria-invalid={Boolean(form.formState.errors.name)} />
              </EntityForm.Field>
              <EntityForm.Field label="الاسم القانوني" error={form.formState.errors.legal_name?.message}>
                <Input aria-label="الاسم القانوني" {...form.register('legal_name')} />
              </EntityForm.Field>
              <EntityForm.Field label="رقم السجل التجاري" error={form.formState.errors.registration_number?.message}>
                <Input dir="ltr" aria-label="رقم السجل التجاري" {...form.register('registration_number')} />
              </EntityForm.Field>
              <EntityForm.Field label="الرقم الضريبي" error={form.formState.errors.tax_number?.message}>
                <Input dir="ltr" aria-label="الرقم الضريبي" {...form.register('tax_number')} />
              </EntityForm.Field>
            </div>
          </EntityForm.Section>

          <EntityForm.Section title="بيانات التواصل" description="جهة الاتصال والقنوات التي يستخدمها فريق التشغيل للتنسيق.">
            <div className="grid gap-4 sm:grid-cols-2">
              <EntityForm.Field label="اسم جهة الاتصال" error={form.formState.errors.contact_name?.message}>
                <Input aria-label="اسم جهة الاتصال" {...form.register('contact_name')} />
              </EntityForm.Field>
              <EntityForm.Field label="الهاتف" error={form.formState.errors.phone?.message}>
                <Input dir="ltr" inputMode="tel" aria-label="هاتف مزود الخدمة" {...form.register('phone')} />
              </EntityForm.Field>
              <EntityForm.Field label="هاتف بديل" error={form.formState.errors.alternate_phone?.message}>
                <Input dir="ltr" inputMode="tel" aria-label="هاتف بديل" {...form.register('alternate_phone')} />
              </EntityForm.Field>
              <EntityForm.Field label="البريد الإلكتروني" error={form.formState.errors.email?.message}>
                <Input dir="ltr" type="email" aria-label="البريد الإلكتروني" {...form.register('email')} aria-invalid={Boolean(form.formState.errors.email)} />
              </EntityForm.Field>
              <EntityForm.Field label="الموقع الإلكتروني" error={form.formState.errors.website?.message}>
                <Input dir="ltr" type="url" placeholder="https://" aria-label="الموقع الإلكتروني" {...form.register('website')} aria-invalid={Boolean(form.formState.errors.website)} />
              </EntityForm.Field>
            </div>
            <EntityForm.Field label="العنوان" error={form.formState.errors.address?.message}>
              <Textarea aria-label="عنوان مزود الخدمة" {...form.register('address')} />
            </EntityForm.Field>
          </EntityForm.Section>

          <EntityForm.Section title="المعلومات التشغيلية" description="نطاق التغطية وملاحظات التوفر بدون افتراض أسعار أو شروط دفع.">
            <div className="grid gap-4 sm:grid-cols-2">
              <EntityForm.Field label="نطاق الخدمة" error={form.formState.errors.service_area?.message}>
                <Textarea aria-label="نطاق الخدمة" placeholder="مثال: مسقط والمناطق القريبة" {...form.register('service_area')} />
              </EntityForm.Field>
              <EntityForm.Field label="ملاحظات التوفر" error={form.formState.errors.availability_notes?.message}>
                <Textarea aria-label="ملاحظات التوفر" placeholder="أوقات التواصل أو تغطية الطوارئ الموثقة" {...form.register('availability_notes')} />
              </EntityForm.Field>
            </div>
            <EntityForm.Field label="ملاحظات عامة" error={form.formState.errors.notes?.message}>
              <Textarea aria-label="ملاحظات مزود الخدمة" className="min-h-24" {...form.register('notes')} />
            </EntityForm.Field>
          </EntityForm.Section>

          <EntityForm.Section title="أنواع الخدمات المدعومة" description="اختر الأنواع المعرفة في سجل مزودي الخدمات؛ يمكن تعديلها من إدارة أنواع الخدمات.">
            {categoriesQuery.isLoading ? <p role="status" className="text-sm text-muted-foreground">جارٍ تحميل أنواع الخدمات...</p> : null}
            {categoriesQuery.isError ? (
              <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                تعذر تحميل أنواع الخدمات. أعد المحاولة قبل الحفظ.
              </div>
            ) : null}
            {!categoriesQuery.isLoading && !categoriesQuery.isError && (categoriesQuery.data ?? []).length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">لا توجد أنواع خدمات معرفة بعد. يمكن حفظ المزود ثم تعريف الأنواع وربطها لاحقًا.</p>
            ) : null}
            <Controller
              control={form.control}
              name="category_ids"
              render={({ field }) => (
                <div className="grid gap-2 sm:grid-cols-2" aria-label="أنواع الخدمات المدعومة">
                  {(categoriesQuery.data ?? []).map((category) => {
                    const checked = field.value.includes(category.id);
                    return (
                      <label key={category.id} className="flex min-h-11 items-start gap-3 rounded-xl border border-border bg-muted/20 p-3 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => field.onChange(event.currentTarget.checked
                            ? [...field.value, category.id]
                            : field.value.filter((id) => id !== category.id))}
                        />
                        <span><span className="block font-bold">{category.name}</span>{category.description ? <span className="mt-0.5 block text-xs text-muted-foreground">{category.description}</span> : null}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            />
          </EntityForm.Section>

          <Controller
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-muted/20 p-3 text-sm font-bold">
                <input type="checkbox" checked={field.value} onChange={(event) => field.onChange(event.currentTarget.checked)} />
                مزود نشط ومتاح للاختيار في طلبات الصيانة الجديدة
              </label>
            )}
          />

          <EntityForm.Actions
            onCancel={() => onOpenChange(false)}
            isSubmitting={saveMutation.isPending}
            submitLabel={provider ? 'حفظ التعديلات' : 'إنشاء مزود الخدمة'}
            submitDisabled={categoriesQuery.isError}
          />
        </EntityForm.Root>
      )}
    </EntityForm.Overlay>
  );
}
