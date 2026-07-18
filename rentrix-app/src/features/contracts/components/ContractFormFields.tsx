import type { FormEventHandler } from 'react';
import { Controller } from 'react-hook-form';
import { EntityForm } from '@/components/ui/entity-form';
import { FileAttachmentField } from '@/components/ui/file-attachment-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getContractUnitDefaultRent } from '../contract-unit-options';
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
  const propertyId = form.watch('property_id');
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

  return (
    <EntityForm.Root className="gap-5 md:grid-cols-2" onSubmit={onSubmit} aria-busy={submitting}>
      <EntityForm.ErrorSummary className="md:col-span-2" message={dependencyError} />
      <EntityForm.ErrorSummary className="md:col-span-2" message={coverageError} />
      <EntityForm.ErrorSummary className="md:col-span-2" message={form.formState.errors.root?.message} />

      <EntityForm.Section
        title="أطراف العقد والوحدة العقارية"
        description="اختر العقار المستهدف، ورقم العين الإيجارية المحددة، وهوية المستأجر."
        className="md:col-span-2"
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
      </EntityForm.Section>

      <EntityForm.Section
        title="المدد المالية ودورات السداد"
        description="تحديد تاريخ سريان العقد ونهايته، قيمة الدفعة المالية المعتمدة وقالب السداد."
        className="md:col-span-2"
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
        title="المرفقات والتوضيحات الإضافية"
        description="إضافة المستندات الرسمية، مبررات الإلغاء، أو أي مذكرات عامة للعقد."
        className="md:col-span-2"
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

      <EntityForm.Actions
        className="md:col-span-2"
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
