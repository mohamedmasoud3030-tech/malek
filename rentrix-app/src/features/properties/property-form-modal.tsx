import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { RouteLoadingState } from '@/components/loading-state';
import { Button } from '@/components/ui/button';
import { EntityForm } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { useCreatePropertyWithAgreement } from '@/features/owners/useOwnerAgreements';
import { useOperationalOwners } from '@/features/owners/useOwners';
import { getAppLanguageState, translateSharedLabel } from '@/lib/i18n';
import { propertyStatusLabels, propertyStatusValues } from './property-schema';
import { useProperty, useUpdateProperty } from './use-properties';
import { PropertyFormCoreFields } from './components/property-form-core-fields';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'التاريخ مطلوب بصيغة YYYY-MM-DD')
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()), 'تاريخ غير صحيح');

const optionalMoney = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? null : Number(value)),
  z.number().min(0, 'القيمة لا يمكن أن تكون سالبة').nullable(),
);

const propertyWithAgreementSchema = z
  .object({
    title: z.string().trim().min(2, 'اسم العقار مطلوب'),
    type: z.string().trim().min(2, 'نوع العقار مطلوب'),
    address: z.string().trim().min(3, 'العنوان مطلوب'),
    owner_id: z.string().uuid('اختر المالك'),
    agreement_type: z.enum(['property_management', 'master_lease'], {
      required_error: 'نوع الاتفاقية مطلوب',
    }),
    commission_type: z.enum(['FIXED_MONTHLY', 'RATE'], { required_error: 'نوع العمولة مطلوب' }),
    commission_value: z.preprocess(
      (value) => (value === '' || value === null || value === undefined ? Number.NaN : Number(value)),
      z.number({ invalid_type_error: 'قيمة العمولة مطلوبة' }).positive('قيمة العمولة يجب أن تكون أكبر من صفر'),
    ),
    agreement_starts_on: isoDate,
    agreement_ends_on: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .or(z.literal(''))
      .transform((value) => value || null),
    purchase_value: optionalMoney,
    current_value: optionalMoney,
    status: z.enum(propertyStatusValues, { required_error: 'الحالة مطلوبة' }),
    notes: z.string().trim().optional().transform((value) => value || null),
  })
  .superRefine((data, context) => {
    if (data.commission_type === 'RATE' && data.commission_value > 100) {
      context.addIssue({
        code: 'custom',
        path: ['commission_value'],
        message: 'نسبة العمولة يجب أن تكون بين 0 و 100',
      });
    }
    if (data.agreement_ends_on && data.agreement_ends_on < data.agreement_starts_on) {
      context.addIssue({
        code: 'custom',
        path: ['agreement_ends_on'],
        message: 'تاريخ انتهاء الاتفاقية يجب أن يكون بعد تاريخ البداية',
      });
    }
  });

type PropertyWithAgreementFormValues = z.input<typeof propertyWithAgreementSchema>;
type PropertyWithAgreementPayload = z.output<typeof propertyWithAgreementSchema>;

const propertyEditSchema = z.object({
  title: z.string().trim().min(2, 'اسم العقار مطلوب'),
  type: z.string().trim().min(2, 'نوع العقار مطلوب'),
  address: z.string().trim().min(3, 'العنوان مطلوب'),
  purchase_value: optionalMoney,
  current_value: optionalMoney,
  status: z.enum(propertyStatusValues),
  notes: z.string().trim().optional().transform((value) => value || null),
});
type PropertyEditFormValues = z.input<typeof propertyEditSchema>;

// ─── Public entry point ───────────────────────────────────────────────────────

interface PropertyFormModalProps {
  open: boolean;
  onClose: () => void;
  propertyId?: string;
}

export function PropertyFormModal({ open, onClose, propertyId }: PropertyFormModalProps) {
  return propertyId ? (
    <PropertyEditModal open={open} onClose={onClose} propertyId={propertyId} />
  ) : (
    <PropertyCreateModal open={open} onClose={onClose} />
  );
}

// ─── Create modal ─────────────────────────────────────────────────────────────

function PropertyCreateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ownersQuery = useOperationalOwners();
  const createMutation = useCreatePropertyWithAgreement();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<PropertyWithAgreementFormValues>({
    resolver: zodResolver(propertyWithAgreementSchema, undefined, { raw: true }),
    defaultValues: {
      title: '',
      type: '',
      address: '',
      owner_id: '',
      agreement_type: 'property_management',
      commission_type: 'FIXED_MONTHLY',
      commission_value: undefined,
      agreement_starts_on: '',
      agreement_ends_on: '',
      purchase_value: null,
      current_value: null,
      status: 'active',
      notes: '',
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset();
      setSubmitError(null);
    }
  }, [open, form]);

  const commissionType = form.watch('commission_type');
  const isSubmitting = createMutation.isPending;
  const operationalOwners = useMemo(() => ownersQuery.data ?? [], [ownersQuery.data]);
  const canCreateProperty = !ownersQuery.isLoading && !ownersQuery.isError && operationalOwners.length > 0;

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const payload: PropertyWithAgreementPayload = propertyWithAgreementSchema.parse(values);
      await createMutation.mutateAsync({
        title: payload.title,
        type: payload.type,
        address: payload.address,
        owner_id: payload.owner_id,
        agreement_type: payload.agreement_type,
        commission_type: payload.commission_type,
        commission_value: payload.commission_value,
        agreement_starts_on: payload.agreement_starts_on,
        agreement_ends_on: payload.agreement_ends_on,
        purchase_value: payload.purchase_value,
        current_value: payload.current_value,
        status: payload.status,
        notes: payload.notes,
      });
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'تعذر حفظ العقار. حاول مرة أخرى.');
    }
  });

  return (
    <EntityForm.Overlay
      open={open}
      onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}
      title="إضافة عقار جديد"
      description="أنشئ العقار واربطه بمالكه واتفاقية التشغيل في خطوة واحدة متكاملة."
      className="max-w-2xl"
      headerExtra={form.formState.isDirty && !isSubmitting ? <StatusBadge tone="warning">{translateSharedLabel('unsavedChanges', getAppLanguageState().language)}</StatusBadge> : undefined}
    >
      <EntityForm.Root className="md:grid-cols-2" onSubmit={handleSubmit} aria-busy={isSubmitting}>
        <EntityForm.ErrorSummary className="md:col-span-2" message={submitError} />

        <EntityForm.Section
          className="md:col-span-2"
          title="1. بيانات العقار"
          description="أدخل بيانات الأصل نفسه أولاً، ثم اربطه بالمالك واتفاقية تشغيل المكتب."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <PropertyFormCoreFields register={form.register} errors={form.formState.errors} />
          </div>
        </EntityForm.Section>

        <EntityForm.Section
          className="md:col-span-2"
          title="2. المالك"
          description="لا يمكن إنشاء عقار تشغيلي بلا مالك نشط. الملكية واتفاقية المكتب تُحفظان مع العقار في عملية ذرية واحدة."
        >
          {ownersQuery.isError ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3" role="alert">
              <p className="text-sm font-bold text-destructive">تعذر تحميل الملاك؛ لن يتم حفظ العقار قبل التحقق منهم.</p>
              <Button type="button" variant="secondary" onClick={() => { void ownersQuery.refetch(); }}>إعادة المحاولة</Button>
            </div>
          ) : null}
          {!ownersQuery.isLoading && !ownersQuery.isError && operationalOwners.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3" role="status">
              <div>
                <p className="text-sm font-bold text-warning">أضف مالكاً نشطاً أولاً</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">الترتيب الصحيح هو: مالك ← عقار ← وحدة ← عقد.</p>
              </div>
              <Button type="button" variant="secondary" asChild>
                <Link to="/owners">الانتقال لإدارة الملاك</Link>
              </Button>
            </div>
          ) : null}
          <EntityForm.Field label="المالك" error={form.formState.errors.owner_id?.message}>
            <Select {...form.register('owner_id')} disabled={ownersQuery.isLoading || ownersQuery.isError || operationalOwners.length === 0}>
              <option value="">{ownersQuery.isLoading ? 'جار تحميل الملاك...' : 'اختر المالك'}</option>
              {operationalOwners.map((owner) => (
                <option key={owner.id} value={owner.id}>{owner.display_name ?? owner.full_name ?? owner.name}</option>
              ))}
            </Select>
          </EntityForm.Field>
          {operationalOwners.length > 0 ? (
            <Button type="button" variant="ghost" className="w-fit" asChild>
              <Link to="/owners">إدارة الملاك وعلاقات الملكية</Link>
            </Button>
          ) : null}
        </EntityForm.Section>

        <EntityForm.Section
          className="md:col-span-2"
          title="3. اتفاقية تشغيل المكتب"
          description="تحدد الاتفاقية كيف يدير المكتب هذا العقار، وهي شرط قبل إنشاء أي عقد إيجار."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <EntityForm.Field label="نوع الاتفاقية" error={form.formState.errors.agreement_type?.message}>
              <Select {...form.register('agreement_type')}>
                <option value="property_management">إدارة عقارية</option>
                <option value="master_lease">إيجار رئيسي</option>
              </Select>
            </EntityForm.Field>
            <EntityForm.Field label="نوع العمولة" error={form.formState.errors.commission_type?.message}>
              <Select {...form.register('commission_type')}>
                <option value="FIXED_MONTHLY">مبلغ ثابت شهري</option>
                <option value="RATE">نسبة مئوية %</option>
              </Select>
            </EntityForm.Field>
            <EntityForm.Field label={`قيمة العمولة ${commissionType === 'RATE' ? '(%)' : '(ريال)'}`} error={form.formState.errors.commission_value?.message}>
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                min="0.01"
                max={commissionType === 'RATE' ? 100 : undefined}
                {...form.register('commission_value')}
                placeholder={commissionType === 'RATE' ? '0 – 100' : '0.00'}
              />
            </EntityForm.Field>
            <EntityForm.Field label="بداية الاتفاقية" error={form.formState.errors.agreement_starts_on?.message}>
              <Input type="date" {...form.register('agreement_starts_on')} />
            </EntityForm.Field>
            <EntityForm.Field
              label="نهاية الاتفاقية (اختياري)"
              description="اتركه فارغاً للاتفاقيات مفتوحة الأجل"
              error={form.formState.errors.agreement_ends_on?.message}
            >
              <Input type="date" {...form.register('agreement_ends_on')} />
            </EntityForm.Field>
          </div>
        </EntityForm.Section>

        <EntityForm.Actions
          className="md:col-span-2"
          onCancel={onClose}
          isSubmitting={isSubmitting}
          submitDisabled={!canCreateProperty}
          submitLabel={isSubmitting ? 'جار الحفظ...' : 'حفظ العقار والملكية والاتفاقية'}
        />
      </EntityForm.Root>
    </EntityForm.Overlay>
  );
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

function PropertyEditModal({
  open,
  onClose,
  propertyId,
}: {
  open: boolean;
  onClose: () => void;
  propertyId: string;
}) {
  const propertyQuery = useProperty(propertyId);
  const updateMutation = useUpdateProperty(propertyId);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<PropertyEditFormValues>({
    resolver: zodResolver(propertyEditSchema),
    defaultValues: { title: '', type: '', address: '', status: 'active', notes: '' },
  });

  useEffect(() => {
    if (!open) {
      form.reset();
      setSubmitError(null);
      return;
    }
    if (propertyQuery.data) {
      const property = propertyQuery.data;
      form.reset({
        title: property.title ?? '',
        type: property.type ?? '',
        address: property.address ?? '',
        purchase_value: property.purchase_value,
        current_value: property.current_value,
        status: (property.status as typeof propertyStatusValues[number]) ?? 'active',
        notes: property.notes ?? '',
      });
    }
  }, [form, propertyQuery.data, open]);

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await updateMutation.mutateAsync(values as Parameters<typeof updateMutation.mutateAsync>[0]);
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'تعذر تحديث العقار. حاول مرة أخرى.');
    }
  });

  return (
    <EntityForm.Overlay
      open={open}
      onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}
      title="تعديل عقار"
      description="عدّل بيانات العقار الأساسية، مع بقاء الملكية واتفاقيات التشغيل في سجل العلاقات المخصص."
      className="max-w-2xl"
      headerExtra={form.formState.isDirty && !updateMutation.isPending ? <StatusBadge tone="warning">{translateSharedLabel('unsavedChanges', getAppLanguageState().language)}</StatusBadge> : undefined}
    >
      {propertyQuery.isLoading ? (
        <RouteLoadingState />
      ) : (
        <EntityForm.Root className="md:grid-cols-2" onSubmit={handleSubmit} aria-busy={updateMutation.isPending}>
          <EntityForm.ErrorSummary className="md:col-span-2" message={submitError} />
          <PropertyFormCoreFields register={form.register} errors={form.formState.errors} />
          <EntityForm.Actions className="md:col-span-2" onCancel={onClose} isSubmitting={updateMutation.isPending} submitLabel={updateMutation.isPending ? 'جار الحفظ...' : 'حفظ'} />
        </EntityForm.Root>
      )}
    </EntityForm.Overlay>
  );
}
