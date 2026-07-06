import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { EntityForm } from '@/components/ui/entity-form';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RouteLoadingState } from '@/components/loading-state';
import { useOwners } from '@/features/owners/useOwners';
import { useCreatePropertyWithAgreement } from '@/features/owners/useOwnerAgreements';
import { propertyStatusLabels, propertyStatusValues } from './property-schema';
import { useUpdateProperty, useProperty } from './use-properties';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'التاريخ مطلوب بصيغة YYYY-MM-DD')
  .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()), 'تاريخ غير صحيح');

const optionalMoney = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
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
      (v) => (v === '' || v === null || v === undefined ? NaN : Number(v)),
      z.number({ invalid_type_error: 'قيمة العمولة مطلوبة' }).positive('قيمة العمولة يجب أن تكون أكبر من صفر'),
    ),
    agreement_starts_on: isoDate,
    agreement_ends_on: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .or(z.literal(''))
      .transform((v) => v || null),
    purchase_value: optionalMoney,
    current_value: optionalMoney,
    status: z.enum(propertyStatusValues, { required_error: 'الحالة مطلوبة' }),
    notes: z
      .string()
      .trim()
      .optional()
      .transform((v) => v || null),
  })
  .superRefine((data, ctx) => {
    if (data.commission_type === 'RATE' && data.commission_value > 100) {
      ctx.addIssue({
        code: 'custom',
        path: ['commission_value'],
        message: 'نسبة العمولة يجب أن تكون بين 0 و 100',
      });
    }
    if (
      data.agreement_ends_on &&
      data.agreement_ends_on < data.agreement_starts_on
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['agreement_ends_on'],
        message: 'تاريخ انتهاء الاتفاقية يجب أن يكون بعد تاريخ البداية',
      });
    }
  });

type PropertyWithAgreementFormValues = z.input<typeof propertyWithAgreementSchema>;
type PropertyWithAgreementPayload = z.output<typeof propertyWithAgreementSchema>;

// Edit-only schema (property fields only — agreement is immutable after creation)
const propertyEditSchema = z.object({
  title: z.string().trim().min(2, 'اسم العقار مطلوب'),
  type: z.string().trim().min(2, 'نوع العقار مطلوب'),
  address: z.string().trim().min(3, 'العنوان مطلوب'),
  purchase_value: optionalMoney,
  current_value: optionalMoney,
  status: z.enum(propertyStatusValues),
  notes: z.string().trim().optional().transform((v) => v || null),
});
type PropertyEditFormValues = z.input<typeof propertyEditSchema>;

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-xs font-bold text-destructive">{message}</p>
  ) : null;
}

interface PropertyFormModalProps {
  open: boolean;
  onClose: () => void;
  propertyId?: string;
}

export function PropertyFormModal({ open, onClose, propertyId }: PropertyFormModalProps) {
  const isEdit = Boolean(propertyId);
  return isEdit ? (
    <PropertyEditModal open={open} onClose={onClose} propertyId={propertyId!} />
  ) : (
    <PropertyCreateModal open={open} onClose={onClose} />
  );
}

// ─── CREATE: requires owner + agreement ────────────────────────────────────
function PropertyCreateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ownersQuery = useOwners();
  const createMutation = useCreatePropertyWithAgreement();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<PropertyWithAgreementFormValues>({
    resolver: zodResolver(propertyWithAgreementSchema),
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

  const handleSubmit = form.handleSubmit(async (values) => {
    const payload: PropertyWithAgreementPayload = propertyWithAgreementSchema.parse(values);
    setSubmitError(null);
    try {
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
      setSubmitError(
        error instanceof Error ? error.message : 'تعذر حفظ العقار. حاول مرة أخرى.',
      );
    }
  });

  return (
    <EntityForm.Overlay
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title="إضافة عقار جديد"
      className="max-w-2xl"
    >
      <EntityForm.Root className="md:grid-cols-2" onSubmit={handleSubmit}>
        <EntityForm.ErrorSummary className="md:col-span-2" message={submitError} />

        {/* Property fields */}
        <label className="grid gap-2 text-sm font-bold">
          اسم العقار
          <Input {...form.register('title')} placeholder="مثال: عمارة الندى" autoFocus />
          <FieldError message={form.formState.errors.title?.message} />
        </label>
        <label className="grid gap-2 text-sm font-bold">
          نوع العقار
          <Input {...form.register('type')} placeholder="سكني، تجاري، أرض..." />
          <FieldError message={form.formState.errors.type?.message} />
        </label>
        <label className="grid gap-2 text-sm font-bold md:col-span-2">
          العنوان
          <Input {...form.register('address')} placeholder="المدينة، الحي، الشارع" />
          <FieldError message={form.formState.errors.address?.message} />
        </label>

        {/* Owner selection — required */}
        <label className="grid gap-2 text-sm font-bold md:col-span-2">
          المالك
          <Select {...form.register('owner_id')} disabled={ownersQuery.isLoading}>
            <option value="">اختر المالك</option>
            {(ownersQuery.data ?? []).map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.display_name ?? owner.full_name ?? '—'}
              </option>
            ))}
          </Select>
          <FieldError message={form.formState.errors.owner_id?.message} />
        </label>

        {/* Agreement section */}
        <label className="grid gap-2 text-sm font-bold">
          نوع الاتفاقية
          <Select {...form.register('agreement_type')}>
            <option value="property_management">إدارة عقارية</option>
            <option value="master_lease">إيجار رئيسي</option>
          </Select>
          <FieldError message={form.formState.errors.agreement_type?.message} />
        </label>
        <label className="grid gap-2 text-sm font-bold">
          نوع العمولة
          <Select {...form.register('commission_type')}>
            <option value="FIXED_MONTHLY">مبلغ ثابت شهري</option>
            <option value="RATE">نسبة مئوية %</option>
          </Select>
          <FieldError message={form.formState.errors.commission_type?.message} />
        </label>
        <label className="grid gap-2 text-sm font-bold">
          قيمة العمولة {commissionType === 'RATE' ? '(%)' : '(ريال)'}
          <Input
            type="number"
            step="0.01"
            min="0.01"
            max={commissionType === 'RATE' ? 100 : undefined}
            {...form.register('commission_value')}
            placeholder={commissionType === 'RATE' ? '0 – 100' : '0.00'}
          />
          <FieldError message={form.formState.errors.commission_value?.message} />
        </label>
        <label className="grid gap-2 text-sm font-bold">
          الحالة
          <Select {...form.register('status')}>
            {propertyStatusValues.map((s) => (
              <option key={s} value={s}>
                {propertyStatusLabels[s]}
              </option>
            ))}
          </Select>
          <FieldError message={form.formState.errors.status?.message} />
        </label>
        <label className="grid gap-2 text-sm font-bold">
          بداية الاتفاقية
          <Input type="date" {...form.register('agreement_starts_on')} />
          <FieldError message={form.formState.errors.agreement_starts_on?.message} />
        </label>
        <label className="grid gap-2 text-sm font-bold">
          نهاية الاتفاقية (اختياري)
          <Input type="date" {...form.register('agreement_ends_on')} />
          <FieldError message={form.formState.errors.agreement_ends_on?.message} />
          <p className="text-xs text-muted-foreground">اتركه فارغاً للاتفاقيات مفتوحة الأجل</p>
        </label>

        {/* Optional valuation */}
        <label className="grid gap-2 text-sm font-bold">
          قيمة الشراء
          <Input type="number" step="0.01" min="0" {...form.register('purchase_value')} />
          <FieldError message={form.formState.errors.purchase_value?.message} />
        </label>
        <label className="grid gap-2 text-sm font-bold">
          القيمة الحالية
          <Input type="number" step="0.01" min="0" {...form.register('current_value')} />
          <FieldError message={form.formState.errors.current_value?.message} />
        </label>
        <label className="grid gap-2 text-sm font-bold md:col-span-2">
          ملاحظات
          <Textarea {...form.register('notes')} placeholder="أي تفاصيل إضافية" />
        </label>

        <EntityForm.Actions className="md:col-span-2" onCancel={onClose} isSubmitting={isSubmitting} submitLabel={isSubmitting ? 'جار الحفظ...' : 'حفظ العقار'} />
      </EntityForm.Root>
    </EntityForm.Overlay>
  );
}

// ─── EDIT: property fields only (agreement immutable after creation) ────────
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
      const p = propertyQuery.data;
      form.reset({
        title: p.title ?? '',
        type: p.type ?? '',
        address: p.address ?? '',
        purchase_value: p.purchase_value,
        current_value: p.current_value,
        status: (p.status as typeof propertyStatusValues[number]) ?? 'active',
        notes: p.notes ?? '',
      });
    }
  }, [form, propertyQuery.data, open]);

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await updateMutation.mutateAsync(values as Parameters<typeof updateMutation.mutateAsync>[0]);
      onClose();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'تعذر تحديث العقار. حاول مرة أخرى.',
      );
    }
  });

  return (
    <EntityForm.Overlay
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title="تعديل عقار"
      className="max-w-2xl"
    >
      {propertyQuery.isLoading ? (
        <RouteLoadingState />
      ) : (
        <EntityForm.Root className="md:grid-cols-2" onSubmit={handleSubmit}>
        <EntityForm.ErrorSummary className="md:col-span-2" message={submitError} />
          <label className="grid gap-2 text-sm font-bold">
            اسم العقار
            <Input {...form.register('title')} autoFocus />
            <FieldError message={form.formState.errors.title?.message} />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            نوع العقار
            <Input {...form.register('type')} />
            <FieldError message={form.formState.errors.type?.message} />
          </label>
          <label className="grid gap-2 text-sm font-bold md:col-span-2">
            العنوان
            <Input {...form.register('address')} />
            <FieldError message={form.formState.errors.address?.message} />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            الحالة
            <Select {...form.register('status')}>
              {propertyStatusValues.map((s) => (
                <option key={s} value={s}>
                  {propertyStatusLabels[s]}
                </option>
              ))}
            </Select>
            <FieldError message={form.formState.errors.status?.message} />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            قيمة الشراء
            <Input type="number" step="0.01" min="0" {...form.register('purchase_value')} />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            القيمة الحالية
            <Input type="number" step="0.01" min="0" {...form.register('current_value')} />
          </label>
          <label className="grid gap-2 text-sm font-bold md:col-span-2">
            ملاحظات
            <Textarea {...form.register('notes')} />
          </label>
          <EntityForm.Actions className="md:col-span-2" onCancel={onClose} isSubmitting={updateMutation.isPending} submitLabel={updateMutation.isPending ? 'جار الحفظ...' : 'حفظ'} />
        </EntityForm.Root>
      )}
    </EntityForm.Overlay>
  );
}
