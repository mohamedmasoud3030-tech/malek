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
import { getContractUnitDefaultRent } from '../contract-unit-options';
import { ContractAgreementMissingAlert } from './ContractAgreementMissingAlert';
import {
  buildContractUnitOptionLabel,
  contractStatusLabels,
  contractStatusValues,
  isUnitSelectableForContract,
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
 * Mobile stepper steps for the long contract create/edit form. The actual
 * fields are grouped exactly as the existing sections: parties & asset,
 * period & financial terms, additional details + agreement coverage, and a
 * final review before submission. Desktop keeps the single-scroll form.
 */
const contractFormSteps = [
  { id: 'parties', label: 'الأطراف والعقار' },
  { id: 'period', label: 'المدة والمالية' },
  { id: 'details', label: 'التفاصيل والاتفاقية' },
  { id: 'review', label: 'المراجعة والتأكيد' },
] as const;

const stepFieldGroups: readonly (readonly string[])[] = [
  ['property_id', 'unit_id', 'tenant_id', 'status'],
  ['start_date', 'end_date', 'rent_amount', 'payment_cycle', 'payment_terms_id'],
  ['cancellation_reason', 'notes', 'attachment_url'],
  [],
];

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
    agreementCoverageQuery,
    selectedProperty,
    currentLinkedUnitId,
  } = controller;
  const [step, setStep] = useState(0);
  const propertyId = form.watch('property_id');
  const unitId = form.watch('unit_id');
  const tenantId = form.watch('tenant_id');
  const startDate = form.watch('start_date');
  const endDate = form.watch('end_date');
  const rentAmount = Number(form.watch('rent_amount') || 0);
  const paymentCycle = form.watch('payment_cycle');

  // Auto-return to the step that owns the first validation error (e.g. after a
  // failed final submission) so mobile users never see a hidden failed field.
  const fieldErrorKeys = Object.keys(form.formState.errors);
  useEffect(() => {
    if (fieldErrorKeys.length === 0) return;
    const errorStep = stepFieldGroups.findIndex((group) => group.some((field) => fieldErrorKeys.includes(field)));
    if (errorStep >= 0 && errorStep !== step) setStep(errorStep);
  }, [fieldErrorKeys.join('|'), step]);

  const goNext = async () => {
    const fields = stepFieldGroups[step];
    const valid = fields.length === 0 ? true : await form.trigger(fields as never);
    if (valid) setStep((current) => Math.min(current + 1, contractFormSteps.length - 1));
  };

  const selectedUnit = useMemo(
    () => unitsQuery.data?.find((u) => u.id === unitId),
    [unitsQuery.data, unitId],
  );

  const selectedTenant = useMemo(
    () => peopleQuery.data?.rows.find((p) => p.id === tenantId),
    [peopleQuery.data, tenantId],
  );

  const schedulePreview = useMemo(
    () => calculateContractSchedulePreview(startDate, endDate, paymentCycle, rentAmount),
    [startDate, endDate, paymentCycle, rentAmount],
  );
  const estimatedInstallments = schedulePreview.installmentCount;

  const prerequisitesLoading =
    propertiesQuery.isLoading ||
    peopleQuery.isLoading ||
    unitsQuery.isLoading ||
    unitConflictsQuery.isLoading ||
    agreementCoverageQuery.isLoading;
  let submitLabel = 'حفظ العقد';
  if (prerequisitesLoading) {
    submitLabel = 'جار تجهيز بيانات العقد...';
  } else if (submitting) {
    submitLabel = 'جار الحفظ...';
  }

  // Section visibility: sections stay mounted (state preserved); on mobile only
  // the current step's sections render, on md+ every section renders.
  const stepVisibility = (stepIndex: number) => (step === stepIndex ? '' : 'max-md:hidden');

  return (
    <EntityForm.Root className="gap-5 md:grid-cols-2" onSubmit={onSubmit} aria-busy={submitting}>
      <EntityForm.ErrorSummary className="md:col-span-2" message={dependencyError} />
      <EntityForm.ErrorSummary className="md:col-span-2" message={coverageError} />
      <EntityForm.ErrorSummary className="md:col-span-2" message={form.formState.errors.root?.message} />

      <div className="md:col-span-2">
        <MobileFormStepperHeader steps={contractFormSteps} current={step} />
      </div>

      <EntityForm.Section
        title="أطراف العقد والوحدة العقارية"
        description="اختر العقار المستهدف، ورقم العين الإيجارية المحددة، وهوية المستأجر."
        className={cn('md:col-span-2', stepVisibility(0))}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <EntityForm.Field label="العقار" error={form.formState.errors.property_id?.message}>
            <Select
              {...form.register('property_id', {
                onChange: () => {
                  form.setValue('unit_id', '', { shouldDirty: true, shouldValidate: false });
                  form.setValue('rent_amount', 0, { shouldDirty: true, shouldValidate: false });
                  form.clearErrors('unit_id');
                },
              })}
              autoFocus={autoFocusProperty}
            >
              <option value="">اختر العقار</option>
              {propertiesQuery.data?.rows.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.title}
                </option>
              ))}
            </Select>
          </EntityForm.Field>

          <EntityForm.Field label="الوحدة" error={form.formState.errors.unit_id?.message}>
            <Select
              {...form.register('unit_id', {
                onChange: (event) => {
                  const unitId = String(event.target.value ?? '');
                  form.setValue(
                    'rent_amount',
                    getContractUnitDefaultRent(unitsQuery.data ?? [], unitId),
                    { shouldDirty: true, shouldValidate: true },
                  );
                },
              })}
              disabled={!propertyId || unitsQuery.isLoading}
            >
              <option value="">اختر الوحدة</option>
              {unitsQuery.data?.map((unit) => (
                <option
                  key={unit.id}
                  value={unit.id}
                  disabled={
                    !isUnitSelectableForContract({
                      unit,
                      currentLinkedUnitId,
                      conflictsByUnitId: unitConflictsByUnitId,
                    })
                  }
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
                <option key={person.id} value={person.id}>
                  {person.full_name}
                </option>
              ))}
            </Select>
          </EntityForm.Field>

          <EntityForm.Field label="الحالة" error={form.formState.errors.status?.message}>
            <Select {...form.register('status')}>
              {contractStatusValues.map((status) => (
                <option key={status} value={status}>
                  {contractStatusLabels[status]}
                </option>
              ))}
            </Select>
          </EntityForm.Field>
        </div>

        {selectedProperty ? (
          <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 p-3 text-xs space-y-1">
            <span className="font-bold text-foreground">ملخص العقار المحدد: </span>
            <span className="text-muted-foreground">{selectedProperty.title}</span>
            {selectedUnit ? (
              <span className="text-muted-foreground"> • الوحدة {selectedUnit.unit_number}</span>
            ) : null}
            {selectedTenant ? (
              <span className="text-muted-foreground"> • المستأجر: {selectedTenant.full_name}</span>
            ) : null}
          </div>
        ) : null}
      </EntityForm.Section>

      <EntityForm.Section
        title="المدد المالية ودورات السداد"
        description="تحديد تاريخ سريان العقد ونهايته، قيمة الدفعة المالية المعتمدة وقالب السداد."
        className={cn('md:col-span-2', stepVisibility(1))}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <EntityForm.Field label="تاريخ البداية" error={form.formState.errors.start_date?.message}>
            <Input type="date" {...form.register('start_date')} />
          </EntityForm.Field>

          <EntityForm.Field label="تاريخ النهاية" error={form.formState.errors.end_date?.message}>
            <Input type="date" {...form.register('end_date')} />
          </EntityForm.Field>

          <EntityForm.Field label="قيمة الإيجار" error={form.formState.errors.rent_amount?.message}>
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              min="0.01"
              {...form.register('rent_amount')}
            />
            <p className="mt-1 text-xs text-muted-foreground">تُملأ تلقائياً من الإيجار الافتراضي للوحدة ويمكن تعديلها حسب الاتفاق.</p>
          </EntityForm.Field>

          <EntityForm.Field label="دورة السداد" error={form.formState.errors.payment_cycle?.message}>
            <Select {...form.register('payment_cycle')}>
              {paymentCycleValues.map((cycle) => (
                <option key={cycle} value={cycle}>
                  {paymentCycleLabels[cycle]}
                </option>
              ))}
            </Select>
          </EntityForm.Field>

          <EntityForm.Field label="شرط السداد" className="sm:col-span-2 lg:col-span-1" error={form.formState.errors.payment_terms_id?.message}>
            <Select {...form.register('payment_terms_id')}>
              <option value="">بدون قالب شروط</option>
              {(paymentTermsQuery.data ?? [])
                .filter((term) => term.is_active !== false)
                .map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name}
                  </option>
                ))}
            </Select>
          </EntityForm.Field>
        </div>
      </EntityForm.Section>

      <EntityForm.Section
        title="اتفاقية تشغيل المالك المغطية"
        description="التحقق الآلي من وجود اتفاقية إدارة فعالة للمالك تغطي فترة العقد قبل اعتماده."
        className={cn('md:col-span-2', stepVisibility(2))}
      >
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
      </EntityForm.Section>

      <EntityForm.Section
        title="المرفقات والتوضيحات الإضافية"
        description="إضافة المستندات الرسمية، مبررات الإلغاء، أو أي مذكرات عامة للعقد."
        className={cn('md:col-span-2', stepVisibility(2))}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <EntityForm.Field label="سبب الإلغاء">
            <Textarea {...form.register('cancellation_reason')} placeholder="يظهر عند إلغاء أو إنهاء العقد الإيجاري" />
          </EntityForm.Field>

          <EntityForm.Field label="ملاحظات العقد">
            <Textarea {...form.register('notes')} placeholder="إضافة أي ملاحظات أو شروط تشغيلية استثنائية للعقد" />
          </EntityForm.Field>

          {showAttachment ? (
            <div className="sm:col-span-2">
              <Controller
                control={form.control}
                name="attachment_url"
                render={({ field }) => (
                  <FileAttachmentField
                    label="نسخة العقد الموقعة ورسمية (PDF أو صور)"
                    value={field.value ?? null}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
          ) : null}
        </div>
      </EntityForm.Section>

      <EntityForm.Section
        title="مراجعة جدول الفواتير والدفعات المتوقعة"
        description="خطوة المراجعة قبل تأكيد العقد: جدولة الفواتير والدفعات المالية المعتمدة."
        className={cn('md:col-span-2', stepVisibility(3))}
      >
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-muted-foreground text-xs">دورة السداد المحددة:</span>
              <p className="font-semibold">{paymentCycleLabels[paymentCycle]}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">قيمة الدفعة المقدرة:</span>
              <p className="font-semibold">{formatDefaultCompanyMoney(schedulePreview.amountPerInstallment)}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">عدد الدفعات المتوقع:</span>
              <p className="font-semibold">{estimatedInstallments} فواتير</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">تاريخ سريان العقد:</span>
              <p className="font-semibold">{startDate || '—'} إلى {endDate || '—'}</p>
            </div>
          </div>
          {schedulePreview.sampleDates.length > 0 && (
            <div className="text-xs text-muted-foreground pt-1">
              <span className="font-bold text-foreground">تواريخ استحقاق الدفعات المقدرة: </span>
              {schedulePreview.sampleDates.slice(0, 6).join(' • ')}
              {schedulePreview.sampleDates.length > 6 ? ` • وأخرى (${schedulePreview.sampleDates.length})` : ''}
            </div>
          )}
          <p className="text-xs text-muted-foreground pt-1 border-t border-primary/10">
            يتم إنشاء الفواتير وجدولة دفعاتها آلياً على الخادم وفقاً للعقد المعتمد لحماية سلامة الأرصدة المحاسبية.
          </p>
        </div>
      </EntityForm.Section>

      <MobileFormStepperFooter
        current={step}
        steps={contractFormSteps}
        onBack={() => setStep((current) => Math.max(0, current - 1))}
        onNext={() => void goNext()}
        onCancel={onCancel}
        isSubmitting={submitting}
        submitDisabled={
          submitting ||
          prerequisitesLoading ||
          Boolean(coverageError) ||
          Boolean(dependencyError)
        }
        submitLabel={submitLabel}
      />

      <EntityForm.Actions
        className="max-md:hidden md:col-span-2"
        onCancel={onCancel}
        isSubmitting={submitting}
        submitDisabled={
          submitting ||
          prerequisitesLoading ||
          Boolean(coverageError) ||
          Boolean(dependencyError)
        }
        submitLabel={submitLabel}
      />
    </EntityForm.Root>
  );
}
