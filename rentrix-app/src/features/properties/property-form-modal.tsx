import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from '@tanstack/react-router';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
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
  const [step, setStep] = useState<1 | 2 | 3>(1);
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

  const commissionType = form.watch('commission_type');
  const selectedOwnerId = form.watch('owner_id');
  const title = form.watch('title');
  const type = form.watch('type');
  const address = form.watch('address');
  const agreementType = form.watch('agreement_type');
  const commissionValue = form.watch('commission_value');
  const agreementStartsOn = form.watch('agreement_starts_on');

  const [primaryPercentage, setPrimaryPercentage] = useState<number>(100);
  const [extraOwners, setExtraOwners] = useState<Array<{ owner_id: string; percentage: number }>>([]);

  useEffect(() => {
    if (!open) {
      form.reset();
      setSubmitError(null);
      setStep(1);
      setPrimaryPercentage(100);
      setExtraOwners([]);
    }
  }, [open, form]);

  const isSubmitting = createMutation.isPending;
  const operationalOwners = useMemo(() => ownersQuery.data ?? [], [ownersQuery.data]);
  const canCreateProperty = !ownersQuery.isLoading && !ownersQuery.isError && operationalOwners.length > 0;

  const totalPercentage = useMemo(() => {
    return Number(primaryPercentage || 0) + extraOwners.reduce((sum, o) => sum + Number(o.percentage || 0), 0);
  }, [primaryPercentage, extraOwners]);

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    if (totalPercentage !== 100) {
      setSubmitError(`مجموع نسب الملكية يجب أن يساوي 100% (المجموع الحالي: ${totalPercentage}%)`);
      return;
    }
    try {
      const parsed = propertyWithAgreementSchema.parse(values);
      const payload: PropertyWithAgreementPayload = {
        title: parsed.title.trim(),
        type: parsed.type.trim(),
        address: parsed.address.trim(),
        owner_id: parsed.owner_id,
        agreement_type: parsed.agreement_type,
        commission_type: parsed.commission_type,
        commission_value: Number(parsed.commission_value),
        agreement_starts_on: parsed.agreement_starts_on,
        agreement_ends_on: parsed.agreement_ends_on ? parsed.agreement_ends_on : null,
        purchase_value: (parsed.purchase_value as number | null) ?? null,
        current_value: (parsed.current_value as number | null) ?? null,
        status: parsed.status,
        notes: parsed.notes ? parsed.notes.trim() : null,
      };

      const created = await createMutation.mutateAsync(payload);
      const propertyId = created?.property_id;
      if (propertyId) {
        if (primaryPercentage !== 100) {
          await supabase.from('property_owners').update({ ownership_percentage: primaryPercentage }).eq('property_id', propertyId).eq('is_primary', true);
        }
        for (const co of extraOwners) {
          if (co.owner_id && Number(co.percentage) > 0) {
            await supabase.from('property_owners').insert({
              property_id: propertyId,
              owner_id: co.owner_id,
              ownership_percentage: Number(co.percentage),
              is_primary: false,
              starts_on: values.agreement_starts_on,
            });
          }
        }
      }
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'تعذر حفظ العقار واتفاقية التشغيل. حاول مرة أخرى.');
    }
  });

  const canAdvanceToStep2 = () => {
    return Boolean(title?.trim()) && Boolean(type?.trim()) && Boolean(address?.trim());
  };

  const canAdvanceToStep3 = () => {
    return canAdvanceToStep2() && Boolean(selectedOwnerId) && Number(commissionValue || 0) > 0 && totalPercentage === 100;
  };

  const selectedOwnerName = useMemo(() => {
    const found = operationalOwners.find((o) => o.id === selectedOwnerId);
    return found ? found.display_name ?? found.full_name ?? found.name : 'لم يتم الاختيار';
  }, [operationalOwners, selectedOwnerId]);

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

        {/* Guided 3-step Wizard Tracker */}
        <div className="md:col-span-2 flex flex-wrap gap-2 border-b border-border pb-3 text-xs font-semibold" role="tablist" aria-label="خطوات إنشاء العقار">
          <button
            type="button"
            role="tab"
            aria-selected={step === 1}
            onClick={() => setStep(1)}
            className={`px-3 py-1.5 rounded-lg border ${step === 1 ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
          >
            الخطوة 1: بيانات العقار
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={step === 2}
            onClick={() => { if (canAdvanceToStep2()) setStep(2); else setSubmitError('يرجى إكمال الحقول الإلزامية في الخطوة 1 (اسم العقار، النوع، العنوان) قبل الانتقال.'); }}
            className={`px-3 py-1.5 rounded-lg border ${step === 2 ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
          >
            الخطوة 2: المالك، نوع الاتفاقية، قيمة العمولة
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={step === 3}
            onClick={() => { if (canAdvanceToStep3()) setStep(3); else setSubmitError('يرجى اختيار المالك وتحديد قيمة العمولة قبل الانتقال للمراجعة.'); }}
            className={`px-3 py-1.5 rounded-lg border ${step === 3 ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
          >
            الخطوة 3: المراجعة والانتقال للوحدات
          </button>
        </div>

        {step === 1 && (
          <>
            <EntityForm.Section
              className="md:col-span-2"
              title="1. بيانات العقار الأساسية"
              description="أدخل بيانات الأصل نفسه أولاً (الاسم، النوع، العنوان، والتقييم)."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <PropertyFormCoreFields register={form.register} errors={form.formState.errors} />
              </div>
            </EntityForm.Section>
            <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
              <Button type="button" onClick={() => { if (canAdvanceToStep2()) setStep(2); else setSubmitError('يرجى إكمال الحقول الإلزامية في الخطوة 1 (اسم العقار، النوع، العنوان) قبل الانتقال.'); }}>التالي: الملكية والاتفاقية</Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
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
              <div className="grid gap-4 md:grid-cols-3">
                <EntityForm.Field label="المالك الأساسي" className="md:col-span-2" error={form.formState.errors.owner_id?.message}>
                  <Select {...form.register('owner_id')} disabled={ownersQuery.isLoading || ownersQuery.isError || operationalOwners.length === 0}>
                    <option value="">{ownersQuery.isLoading ? 'جار تحميل الملاك...' : 'اختر المالك'}</option>
                    {operationalOwners.map((owner) => (
                      <option key={owner.id} value={owner.id}>{owner.display_name ?? owner.full_name ?? owner.name}</option>
                    ))}
                  </Select>
                </EntityForm.Field>
                <EntityForm.Field label="نسبة الملكية %">
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={primaryPercentage}
                    onChange={(e) => setPrimaryPercentage(Number(e.target.value))}
                  />
                </EntityForm.Field>
              </div>

              {/* Multi-owner co-owners list */}
              <div className="space-y-3 pt-2 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">الشركاء في الملكية (اختياري)</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setExtraOwners([...extraOwners, { owner_id: '', percentage: 0 }])}
                  >
                    <Plus className="me-1 size-3.5" /> إضافة شريك في الملكية
                  </Button>
                </div>
                {extraOwners.map((co, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-7">
                      <Select
                        value={co.owner_id}
                        onChange={(e) => {
                          const updated = [...extraOwners];
                          updated[index].owner_id = e.target.value;
                          setExtraOwners(updated);
                        }}
                      >
                        <option value="">اختر الشريك</option>
                        {operationalOwners.map((owner) => (
                          <option key={owner.id} value={owner.id}>{owner.display_name ?? owner.full_name ?? owner.name}</option>
                        ))}
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        placeholder="%"
                        value={co.percentage || ''}
                        onChange={(e) => {
                          const updated = [...extraOwners];
                          updated[index].percentage = Number(e.target.value);
                          setExtraOwners(updated);
                        }}
                      />
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setExtraOwners(extraOwners.filter((_, idx) => idx !== index))}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                {totalPercentage !== 100 ? (
                  <p className="text-xs text-destructive font-bold">
                    مجموع نسب الملكية يجب أن يساوي 100% (المجموع الحالي: {totalPercentage}%)
                  </p>
                ) : null}
              </div>

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
            <div className="md:col-span-2 flex justify-between gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>السابق: بيانات العقار</Button>
              <Button type="button" onClick={() => { if (canAdvanceToStep3()) setStep(3); else setSubmitError('يرجى اختيار المالك وتحديد قيمة العمولة قبل الانتقال للمراجعة.'); }}>التالي: المراجعة والانتقال للوحدات</Button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <EntityForm.Section
              className="md:col-span-2"
              title="4. المراجعة الختامية للبيانات"
              description="تأكد من صحة بيانات العقار والملكية قبل اعتماد الحفظ."
            >
              <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-muted-foreground text-xs">اسم العقار:</span>
                    <p className="font-semibold">{title || 'غير محدد'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">النوع والعنوان:</span>
                    <p className="font-semibold">{type || '—'} - {address || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">المالك:</span>
                    <p className="font-semibold">{selectedOwnerName}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">نوع الاتفاقية والعمولة:</span>
                    <p className="font-semibold">
                      {agreementType === 'property_management' ? 'إدارة عقارية' : 'إيجار رئيسي'} ({String(commissionValue ?? 0)} {commissionType === 'RATE' ? '%' : 'ريال'})
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground text-xs">تاريخ سريان الاتفاقية:</span>
                    <p className="font-semibold">{agreementStartsOn || '—'}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-primary">
                  <p className="font-bold">إضافة وحدات العقار:</p>
                  <p className="mt-1">المراجعة الختامية، مع التوضيح أن إضافة الوحدات تتم فور حفظ العقار من تبويب الوحدات العقارية، وليست جزءاً من عملية حفظ العقار والملكية.</p>
                </div>
              </div>
            </EntityForm.Section>
            <div className="md:col-span-2 flex justify-between items-center pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setStep(2)}>السابق: الملكية والاتفاقية</Button>
              <EntityForm.Actions
                className="!mt-0"
                onCancel={onClose}
                isSubmitting={isSubmitting}
                submitDisabled={!canCreateProperty}
                submitLabel={isSubmitting ? 'جار الحفظ...' : 'حفظ العقار والملكية والاتفاقية'}
              />
            </div>
          </>
        )}
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
