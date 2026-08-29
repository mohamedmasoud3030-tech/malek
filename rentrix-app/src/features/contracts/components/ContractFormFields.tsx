import { MONEY_STEP } from '@/lib/money';
import { useEffect, useMemo, useState, type FormEventHandler } from 'react';
import { Controller } from 'react-hook-form';
import { EntityForm } from '@/components/ui/entity-form';
import { FileAttachmentField } from '@/components/ui/file-attachment-field';
import { MobileFormStepperFooter, MobileFormStepperHeader } from '@/components/ui/mobile-form-stepper';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatDefaultCompanyMoney } from '@/lib/companyFormatters';
import { calculateContractSchedulePreview } from '../contract-schedule-preview';
import { getContractUnitDailyReferenceRate, getContractUnitDefaultRent } from '../contract-unit-options';
import { ContractAgreementMissingAlert } from './ContractAgreementMissingAlert';
import {
  buildContractUnitOptionLabel,
  contractSchemaBase,
  isUnitSelectableForContract,
  leaseModeLabels,
  leaseModeValues,
  paymentCycleLabels,
  paymentCycleValues,
  useContractForm,
} from '../useContractForm';

type ContractFormController = ReturnType<typeof useContractForm>;

type ContractFormFieldsProps = Readonly<{
  controller: ContractFormController;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onCancel: () => void;
  dependencyError?: string | null;
  coverageError?: string | null;
  showAttachment?: boolean;
  autoFocusProperty?: boolean;
}>;

/**
 * Keep the daily contract path short. The status and cancellation lifecycle
 * stay owned by their dedicated actions, while billing policy remains
 * explicitly editable under a secondary disclosure instead of becoming a
 * hidden default.
 */
const contractFormSteps = [
  { id: 'parties', label: 'العقار والمستأجر' },
  { id: 'terms', label: 'المدة والإيجار' },
  { id: 'review', label: 'التأكيد' },
] as const;

const stepFieldGroups: readonly (readonly string[])[] = [
  ['property_id', 'unit_id', 'tenant_id'],
  ['start_date', 'end_date', 'rent_amount', 'payment_cycle', 'billing_day', 'grace_days', 'payment_terms_id', 'lease_mode', 'daily_reference_rate'],
  [],
];

const contractStepValidators = [
  contractSchemaBase.pick({ property_id: true, unit_id: true, tenant_id: true }),
  contractSchemaBase.pick({
    start_date: true,
    end_date: true,
    rent_amount: true,
    payment_cycle: true,
    billing_day: true,
    grace_days: true,
    payment_terms_id: true,
    lease_mode: true,
    daily_reference_rate: true,
  }),
  null,
] as const;

const billingPolicyFields = new Set(['billing_day', 'grace_days', 'payment_terms_id']);

export function ContractFormFields({
  controller,
  onSubmit,
  onCancel,
  dependencyError,
  coverageError,
  showAttachment = false,
  autoFocusProperty = false,
}: ContractFormFieldsProps) {
  const {
    form,
    submitting,
    propertiesQuery,
    peopleQuery,
    paymentTermsQuery,
    unitsQuery,
    unitConflictsQuery,
    unitConflictsByUnitId,
    unitDraftsQuery,
    unitDraftsByUnitId,
    agreementCoverageQuery,
    selectedProperty,
    currentLinkedUnitId,
  } = controller;
  const [step, setStep] = useState(0);
  const [billingOptionsOpen, setBillingOptionsOpen] = useState(false);
  const [optionalDetailsOpen, setOptionalDetailsOpen] = useState(false);
  const propertyId = form.watch('property_id');
  const unitId = form.watch('unit_id');
  const tenantId = form.watch('tenant_id');
  const startDate = form.watch('start_date');
  const endDate = form.watch('end_date');
  const rentAmount = Number(form.watch('rent_amount') || 0);
  const paymentCycle = form.watch('payment_cycle');
  const leaseMode = form.watch('lease_mode');
  const dailyReferenceRateValue = form.watch('daily_reference_rate');
  const dailyReferenceRate = dailyReferenceRateValue === null || dailyReferenceRateValue === undefined || dailyReferenceRateValue === ''
    ? null
    : Number(dailyReferenceRateValue);
  const isShortStay = leaseMode === 'short_stay';
  const stayNights = useMemo(() => {
    if (!startDate || !endDate) return null;
    const from = new Date(`${startDate}T00:00:00`);
    const to = new Date(`${endDate}T00:00:00`);
    const nights = Math.round((to.getTime() - from.getTime()) / 86_400_000);
    return Number.isFinite(nights) && nights > 0 ? nights : null;
  }, [startDate, endDate]);
  const referenceStayTotal = isShortStay && dailyReferenceRate !== null && stayNights !== null
    ? dailyReferenceRate * stayNights
    : null;
  // z.preprocess keeps the watched form input type `unknown`; coerce for the read-only summary label.
  const billingDay = Number(form.watch('billing_day') ?? 1) || 1;
  const graceDays = Number(form.watch('grace_days') ?? 0) || 0;

  const fieldErrorKeys = Object.keys(form.formState.errors);
  useEffect(() => {
    if (fieldErrorKeys.length === 0) return;
    const errorStep = stepFieldGroups.findIndex((group) => group.some((field) => fieldErrorKeys.includes(field)));
    if (errorStep >= 0 && errorStep !== step) setStep(errorStep);
    if (fieldErrorKeys.some((field) => billingPolicyFields.has(field))) setBillingOptionsOpen(true);
  }, [fieldErrorKeys.join('|'), step]);

  const goNext = async () => {
    const fields = stepFieldGroups[step];
    if (fields.length === 0) {
      setStep((current) => Math.min(current + 1, contractFormSteps.length - 1));
      return;
    }
    const validator = contractStepValidators[step];
    const result = validator ? await validator.safeParseAsync(form.getValues()) : { success: true as const };
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string') {
          form.setError(field as never, { type: 'validate', message: issue.message });
          if (billingPolicyFields.has(field)) setBillingOptionsOpen(true);
        }
      }
      return;
    }
    if (step === 1) {
      const values = form.getValues();
      if (values.end_date && values.end_date <= values.start_date) {
        form.setError('end_date', { type: 'validate', message: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية' });
        return;
      }
    }
    setStep((current) => Math.min(current + 1, contractFormSteps.length - 1));
  };

  const selectedUnit = useMemo(
    () => unitsQuery.data?.find((unit) => unit.id === unitId),
    [unitsQuery.data, unitId],
  );
  const selectedUnitDrafts = selectedUnit ? unitDraftsByUnitId.get(selectedUnit.id) ?? [] : [];
  const selectedTenantHasDraft = selectedUnitDrafts.some((draft) => draft.tenant_id === tenantId);
  const selectedTenant = useMemo(
    () => peopleQuery.data?.rows.find((person) => person.id === tenantId),
    [peopleQuery.data, tenantId],
  );
  const schedulePreview = useMemo(
    () => calculateContractSchedulePreview(startDate, endDate, paymentCycle, rentAmount),
    [startDate, endDate, paymentCycle, rentAmount],
  );

  const prerequisitesLoading =
    propertiesQuery.isLoading ||
    peopleQuery.isLoading ||
    unitsQuery.isLoading ||
    unitConflictsQuery.isLoading ||
    unitDraftsQuery.isLoading ||
    agreementCoverageQuery.isLoading;
  let submitLabel = 'حفظ العقد';
  if (prerequisitesLoading) submitLabel = 'جار تجهيز بيانات العقد...';
  else if (submitting) submitLabel = 'جار الحفظ...';

  const stepVisibility = (stepIndex: number) => (step === stepIndex ? '' : 'max-md:hidden');

  return (
    <EntityForm.Root className="gap-5 md:grid-cols-2" onSubmit={onSubmit} aria-busy={submitting}>
      <EntityForm.ErrorSummary className="md:col-span-2" message={dependencyError} />
      <EntityForm.ErrorSummary className="md:col-span-2" message={coverageError} />
      <EntityForm.ErrorSummary className="md:col-span-2" message={form.formState.errors.root?.message} />

      <input type="hidden" {...form.register('status')} />
      <input type="hidden" {...form.register('cancellation_reason')} />
      <input type="hidden" {...form.register('daily_reference_rate')} />

      <div className="md:col-span-2">
        <MobileFormStepperHeader steps={contractFormSteps} current={step} />
      </div>

      <EntityForm.Section
        title="العقار والمستأجر"
        description="حدد الوحدة والمستأجر لهذا العقد."
        className={cn('md:col-span-2', stepVisibility(0))}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <EntityForm.Field label="العقار" error={form.formState.errors.property_id?.message}>
            <Select
              {...form.register('property_id', {
                onChange: () => {
                  form.setValue('unit_id', '', { shouldDirty: true, shouldValidate: false });
                  form.setValue('rent_amount', 0, { shouldDirty: true, shouldValidate: false });
                  form.setValue('daily_reference_rate', null, { shouldDirty: true, shouldValidate: false });
                  form.clearErrors('unit_id');
                },
              })}
              autoFocus={autoFocusProperty}
            >
              <option value="">اختر العقار</option>
              {propertiesQuery.data?.rows.map((property) => (
                <option key={property.id} value={property.id}>{property.title}</option>
              ))}
            </Select>
          </EntityForm.Field>

          <EntityForm.Field label="الوحدة" error={form.formState.errors.unit_id?.message}>
            <Select
              {...form.register('unit_id', {
                onChange: (event) => {
                  const nextUnitId = String(event.target.value ?? '');
                  if (isShortStay) {
                    form.setValue(
                      'daily_reference_rate',
                      getContractUnitDailyReferenceRate(unitsQuery.data ?? [], nextUnitId),
                      { shouldDirty: true, shouldValidate: true },
                    );
                    form.setValue('rent_amount', 0, { shouldDirty: true, shouldValidate: false });
                  } else {
                    form.setValue(
                      'rent_amount',
                      getContractUnitDefaultRent(unitsQuery.data ?? [], nextUnitId),
                      { shouldDirty: true, shouldValidate: true },
                    );
                    form.setValue('daily_reference_rate', null, { shouldDirty: true, shouldValidate: false });
                  }
                },
              })}
              disabled={!propertyId || unitsQuery.isLoading}
            >
              <option value="">اختر الوحدة</option>
              {unitsQuery.data?.map((unit) => (
                <option
                  key={unit.id}
                  value={unit.id}
                  disabled={!isUnitSelectableForContract({
                    unit,
                    currentLinkedUnitId,
                    conflictsByUnitId: unitConflictsByUnitId,
                  })}
                >
                  {buildContractUnitOptionLabel({ unit, property: selectedProperty })}
                </option>
              ))}
            </Select>
          </EntityForm.Field>

          <EntityForm.Field label="المستأجر" error={form.formState.errors.tenant_id?.message}>
            <Select {...form.register('tenant_id')}>
              <option value="">اختر المستأجر</option>
              {peopleQuery.data?.rows.map((person) => (
                <option key={person.id} value={person.id}>{person.full_name}</option>
              ))}
            </Select>
          </EntityForm.Field>
        </div>

        {selectedUnitDrafts.length > 0 ? (
          <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-foreground" role="status">
            <span className="font-bold">توجد مسودة لهذه الوحدة.</span>{' '}
            {selectedTenantHasDraft
              ? 'للمستأجر نفسه مسودة موجودة؛ افتحها وعدّلها بدل إنشاء نسخة أخرى.'
              : 'راجع المسودة الحالية قبل بدء عقد جديد.'}
          </div>
        ) : null}
      </EntityForm.Section>

      <EntityForm.Section
        title="المدة والإيجار"
        description="أدخل مدة العقد وقيمة الإيجار وطريقة السداد."
        className={cn('md:col-span-2', stepVisibility(1))}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <EntityForm.Field label="نوع التعاقد" error={form.formState.errors.lease_mode?.message}>
            <Select
              {...form.register('lease_mode', {
                onChange: (event) => {
                  const nextMode = String(event.target.value ?? 'long_term');
                  if (nextMode === 'short_stay') {
                    form.setValue(
                      'daily_reference_rate',
                      getContractUnitDailyReferenceRate(unitsQuery.data ?? [], unitId),
                      { shouldDirty: true, shouldValidate: true },
                    );
                    form.setValue('rent_amount', 0, { shouldDirty: true, shouldValidate: false });
                  } else {
                    form.setValue('daily_reference_rate', null, { shouldDirty: true, shouldValidate: false });
                    form.setValue(
                      'rent_amount',
                      getContractUnitDefaultRent(unitsQuery.data ?? [], unitId),
                      { shouldDirty: true, shouldValidate: true },
                    );
                  }
                },
              })}
              data-lease-mode-select
            >
              {leaseModeValues.map((mode) => (
                <option key={mode} value={mode}>{leaseModeLabels[mode]}</option>
              ))}
            </Select>
          </EntityForm.Field>

          <EntityForm.Field label="تاريخ البداية" error={form.formState.errors.start_date?.message}>
            <Input type="date" {...form.register('start_date')} />
          </EntityForm.Field>

          <EntityForm.Field label="تاريخ النهاية" error={form.formState.errors.end_date?.message}>
            <Input type="date" {...form.register('end_date')} />
          </EntityForm.Field>

          {isShortStay ? (
            <EntityForm.Field
              label="إجمالي الإقامة المتفق عليه"
              error={form.formState.errors.rent_amount?.message}
            >
              <Input type="number" step={MONEY_STEP} inputMode="decimal" min="0.01" {...form.register('rent_amount')} />
            </EntityForm.Field>
          ) : (
            <EntityForm.Field label="الإيجار لكل دفعة" error={form.formState.errors.rent_amount?.message}>
              <Input type="number" step={MONEY_STEP} inputMode="decimal" min="0.01" {...form.register('rent_amount')} />
            </EntityForm.Field>
          )}

          {isShortStay ? (
            <EntityForm.Field label="سعر اليوم المرجعي للوحدة">
              <div className="min-h-11 rounded-lg border border-border bg-muted/25 px-3 py-2 text-sm">
                <p className="font-bold">
                  {dailyReferenceRate === null ? 'غير محدد' : formatDefaultCompanyMoney(dailyReferenceRate)}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  اقتراح من الوحدة فقط، وليس قيدًا على السعر المتفق عليه.
                  {referenceStayTotal !== null ? ` مرجع المدة الحالية: ${formatDefaultCompanyMoney(referenceStayTotal)}.` : ''}
                </p>
              </div>
            </EntityForm.Field>
          ) : (
            <EntityForm.Field label="دورة السداد" error={form.formState.errors.payment_cycle?.message}>
              <Select {...form.register('payment_cycle')}>
                {paymentCycleValues.map((cycle) => (
                  <option key={cycle} value={cycle}>{paymentCycleLabels[cycle]}</option>
                ))}
              </Select>
            </EntityForm.Field>
          )}
        </div>

        {isShortStay ? (
          <p className="mt-4 rounded-xl border border-info/30 bg-info/10 p-3 text-sm" role="status">
            عقد إقامة قصيرة على الوحدة نفسها: تُصدر فاتورة واحدة بإجمالي الإقامة عند تاريخ الوصول،
            وسعر اليوم المرجعي للعلم فقط — الإجمالي المتفق عليه هو المعتمد.
            {stayNights !== null ? ` (${stayNights} ليلة)` : ''}
          </p>
        ) : null}

        <details
          className="mt-4 rounded-xl border border-border/70 bg-muted/15"
          open={billingOptionsOpen}
          onToggle={(event) => setBillingOptionsOpen(event.currentTarget.open)}
        >
          <summary className="min-h-11 cursor-pointer list-none px-4 py-3 text-sm font-semibold text-foreground">
            {isShortStay ? 'خيارات التحصيل' : 'خيارات الفوترة'}
            <span className="ms-2 text-xs font-normal text-muted-foreground">
              سماح {graceDays} يوم
            </span>
          </summary>
          <div className="grid gap-4 border-t border-border/60 p-4 md:grid-cols-3">
            {isShortStay ? null : (
              <EntityForm.Field label="يوم الفوترة" error={form.formState.errors.billing_day?.message}>
                <Input type="number" min="1" max="28" step="1" inputMode="numeric" {...form.register('billing_day')} />
              </EntityForm.Field>
            )}

            <EntityForm.Field label="أيام السماح" error={form.formState.errors.grace_days?.message}>
              <Input type="number" min="0" max="90" step="1" inputMode="numeric" {...form.register('grace_days')} />
            </EntityForm.Field>

            {isShortStay ? null : (
              <EntityForm.Field label="قالب شروط السداد" error={form.formState.errors.payment_terms_id?.message}>
                <Select {...form.register('payment_terms_id')}>
                  <option value="">بدون قالب</option>
                  {(paymentTermsQuery.data ?? [])
                    .filter((term) => term.is_active !== false)
                    .map((term) => (
                      <option key={term.id} value={term.id}>{term.name}</option>
                    ))}
                </Select>
              </EntityForm.Field>
            )}
          </div>
        </details>
      </EntityForm.Section>

      <EntityForm.Section
        title="راجع واحفظ"
        description="تأكد من بيانات العقد قبل الحفظ."
        className={cn('md:col-span-2', stepVisibility(2))}
      >
        <div className="grid gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="text-xs text-muted-foreground">الوحدة</span>
            <p className="font-semibold">{selectedProperty?.title ?? '—'}{selectedUnit ? ` • ${selectedUnit.unit_number}` : ''}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">المستأجر</span>
            <p className="font-semibold">{selectedTenant?.full_name ?? '—'}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">المدة</span>
            <p className="font-semibold">{startDate || '—'} إلى {endDate || '—'}</p>
          </div>
          {isShortStay ? (
            <div>
              <span className="text-xs text-muted-foreground">السداد</span>
              <p className="font-semibold">
                فاتورة واحدة عند الوصول
                {stayNights !== null ? ` • ${stayNights} ليلة` : ''}
              </p>
            </div>
          ) : (
            <div>
              <span className="text-xs text-muted-foreground">السداد</span>
              <p className="font-semibold">
                {formatDefaultCompanyMoney(schedulePreview.amountPerInstallment)} • {paymentCycleLabels[paymentCycle]}
              </p>
            </div>
          )}
        </div>

        <div className="mt-4">
          <ContractAgreementMissingAlert
            property={selectedProperty}
            startDate={startDate || ''}
            endDate={endDate || ''}
            isLoading={agreementCoverageQuery.isLoading}
            hasError={agreementCoverageQuery.isError}
            hasSelectedPeriod={Boolean(propertyId && startDate && endDate)}
            hasAgreement={Boolean(agreementCoverageQuery.data)}
            onRetry={() => agreementCoverageQuery.refetch()}
          />
        </div>

        <div className="mt-4">
          {isShortStay ? (
            <div className="rounded-xl border border-border/70 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">فاتورة الإقامة</span>
                <span className="text-muted-foreground">{formatDefaultCompanyMoney(rentAmount)}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                تُصدر فاتورة واحدة بإجمالي الإقامة عند تاريخ الوصول وتُستحق بعد أيام السماح، وتُحمّل على نفس
                دورة التحصيل والتحاسب المعتمدة في العقد.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/70 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">جدول السداد المتوقع</span>
                <span className="text-muted-foreground">{schedulePreview.installmentCount} دفعة</span>
              </div>
              {schedulePreview.sampleDates.length > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  تبدأ الدفعات تقريبًا في: {schedulePreview.sampleDates.slice(0, 4).join(' • ')}
                  {schedulePreview.sampleDates.length > 4 ? ' • …' : ''}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">سيتم إصدار الفواتير وفق إعدادات العقد بعد اعتماده.</p>
            </div>
          )}
        </div>

        <details
          className="mt-4 rounded-xl border border-border/70 bg-muted/10"
          open={optionalDetailsOpen}
          onToggle={(event) => setOptionalDetailsOpen(event.currentTarget.open)}
        >
          <summary className="min-h-11 cursor-pointer list-none px-4 py-3 text-sm font-semibold text-foreground">
            ملاحظات ومرفقات اختيارية
          </summary>
          <div className="grid gap-4 border-t border-border/60 p-4 sm:grid-cols-2">
            <EntityForm.Field label="ملاحظات العقد" className={showAttachment ? '' : 'sm:col-span-2'}>
              <Textarea {...form.register('notes')} placeholder="أي ملاحظة مهمة على هذا العقد" />
            </EntityForm.Field>

            {showAttachment ? (
              <Controller
                control={form.control}
                name="attachment_url"
                render={({ field }) => (
                  <FileAttachmentField
                    label="نسخة العقد"
                    value={field.value ?? null}
                    onChange={field.onChange}
                  />
                )}
              />
            ) : null}
          </div>
        </details>
      </EntityForm.Section>

      <MobileFormStepperFooter
        current={step}
        steps={contractFormSteps}
        onBack={() => setStep((current) => Math.max(0, current - 1))}
        onNext={() => void goNext()}
        onCancel={onCancel}
        isSubmitting={submitting}
        submitDisabled={submitting || prerequisitesLoading || Boolean(coverageError) || Boolean(dependencyError)}
        submitLabel={submitLabel}
      />

      <EntityForm.Actions
        className="max-md:hidden md:col-span-2"
        onCancel={onCancel}
        isSubmitting={submitting}
        submitDisabled={submitting || prerequisitesLoading || Boolean(coverageError) || Boolean(dependencyError)}
        submitLabel={submitLabel}
      />
    </EntityForm.Root>
  );
}
