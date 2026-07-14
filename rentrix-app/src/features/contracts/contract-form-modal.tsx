import { useEffect } from 'react';
import { Controller } from 'react-hook-form';
import { RouteLoadingState } from '@/components/loading-state';
import { EntityForm } from '@/components/ui/entity-form';
import { FileAttachmentField } from '@/components/ui/file-attachment-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { getAppLanguageState, translateSharedLabel } from '@/lib/i18n';
import {
  buildContractUnitOptionLabel,
  contractStatusLabels,
  contractStatusValues,
  getContractUnitSelectionIssue,
  isUnitSelectableForContract,
  paymentCycleLabels,
  paymentCycleValues,
  type ContractFormValues,
  useContractForm,
} from './useContractForm';

function fieldError(message?: string) {
  return message ? <span className="text-xs font-bold text-destructive">{message}</span> : null;
}

interface ContractFormModalProps {
  open: boolean;
  onClose: () => void;
  contractId?: string;
}

export function ContractFormModal({ open, onClose, contractId }: ContractFormModalProps) {
  const {
    form,
    isEdit,
    submitting,
    contractQuery,
    propertiesQuery,
    peopleQuery,
    paymentTermsQuery,
    unitsQuery,
    unitConflictsQuery,
    unitConflictsByUnitId,
    agreementCoverageQuery,
    selectedProperty,
    currentLinkedUnitId,
    handleSubmit,
  } = useContractForm({
    contractId,
    onClose,
    onSuccess: onClose,
  });

  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  useEffect(() => {
    if (open && isEdit && contractQuery.data) {
      form.reset({
        property_id: contractQuery.data.property_id,
        unit_id: contractQuery.data.unit_id ?? '',
        tenant_id: contractQuery.data.tenant_id,
        start_date: contractQuery.data.start_date,
        end_date: contractQuery.data.end_date,
        rent_amount: contractQuery.data.rent_amount,
        payment_cycle: contractQuery.data.payment_cycle,
        payment_terms_id: contractQuery.data.payment_terms_id ?? '',
        status: contractQuery.data.status,
        cancellation_reason: contractQuery.data.cancellation_reason ?? '',
        notes: contractQuery.data.notes ?? '',
        attachment_url: contractQuery.data.attachment_url ?? null,
      });
    }
  }, [open, isEdit, contractQuery.data, form]);

  const propertyId = form.watch('property_id');
  const startDate = form.watch('start_date');
  const endDate = form.watch('end_date');
  const prerequisitesLoading =
    propertiesQuery.isLoading ||
    peopleQuery.isLoading ||
    unitsQuery.isLoading ||
    unitConflictsQuery.isLoading ||
    agreementCoverageQuery.isLoading;
  const hasSelectedPeriod = Boolean(propertyId && startDate && endDate);
  const coverageError = agreementCoverageQuery.isError
    ? 'تعذر التحقق من اتفاقية المالك. أعد المحاولة قبل حفظ العقد.'
    : hasSelectedPeriod && !agreementCoverageQuery.isLoading && !agreementCoverageQuery.data
      ? 'لا توجد اتفاقية إدارة تغطي كامل فترة العقد. انتقل إلى صفحة العقار لإنشاء أو تحديث اتفاقية الإدارة أولاً.'
      : null;
  let dependencyError: string | null = null;
  if (propertiesQuery.isError || peopleQuery.isError) {
    dependencyError = 'تعذر تحميل بيانات العقارات أو المستأجرين. أعد تحميل الصفحة ثم حاول مرة أخرى.';
  } else if (unitsQuery.isError) {
    dependencyError = 'تعذر تحميل وحدات العقار المحدد. أعد المحاولة قبل حفظ العقد.';
  } else if (unitConflictsQuery.isError) {
    dependencyError = 'تعذر التحقق من تعارضات عقود الوحدة. أعد المحاولة قبل حفظ العقد.';
  }

  const handleModalSubmit = form.handleSubmit(async (values: ContractFormValues) => {
    const unitIssue = getContractUnitSelectionIssue({
      units: unitsQuery.data ?? [],
      propertyId: values.property_id,
      unitId: values.unit_id,
      currentLinkedUnitId,
      conflictsByUnitId: unitConflictsByUnitId,
    });
    if (unitIssue) {
      form.setError('unit_id', { type: 'validate', message: unitIssue });
      return;
    }

    try {
      await handleSubmit({
        ...values,
        agreement_id: agreementCoverageQuery.data?.id ?? null,
      });
    } catch (error) {
      form.setError('root', {
        type: 'server',
        message: error instanceof Error ? error.message : 'تعذر حفظ العقد، حاول مرة أخرى.',
      });
    }
  });

  return (
    <EntityForm.Overlay
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title={isEdit ? 'تعديل عقد' : 'إنشاء عقد'}
      className="max-w-2xl"
      headerExtra={
        form.formState.isDirty && !submitting ? (
          <StatusBadge tone="gold">
            {translateSharedLabel('unsavedChanges', getAppLanguageState().language)}
          </StatusBadge>
        ) : undefined
      }
    >
      {isEdit && contractQuery.isLoading ? (
        <RouteLoadingState />
      ) : (
        <EntityForm.Root className="md:grid-cols-2" onSubmit={handleModalSubmit}>
          <EntityForm.ErrorSummary className="md:col-span-2" message={dependencyError} />
          <EntityForm.ErrorSummary className="md:col-span-2" message={coverageError} />
          <EntityForm.ErrorSummary
            className="md:col-span-2"
            message={form.formState.errors.root?.message}
          />

          <EntityForm.Field label="العقار">
            <Select {...form.register('property_id')} autoFocus>
              <option value="">اختر العقار</option>
              {propertiesQuery.data?.rows.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.title}
                </option>
              ))}
            </Select>
            {fieldError(form.formState.errors.property_id?.message)}
          </EntityForm.Field>

          <EntityForm.Field label="الوحدة">
            <Select {...form.register('unit_id')} disabled={!propertyId}>
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
            {fieldError(form.formState.errors.unit_id?.message)}
          </EntityForm.Field>

          <EntityForm.Field label="المستأجر">
            <Select {...form.register('tenant_id')}>
              <option value="">اختر المستأجر</option>
              {peopleQuery.data?.rows.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.full_name}
                </option>
              ))}
            </Select>
            {fieldError(form.formState.errors.tenant_id?.message)}
          </EntityForm.Field>

          <EntityForm.Field label="الحالة">
            <Select {...form.register('status')}>
              {contractStatusValues.map((status) => (
                <option key={status} value={status}>
                  {contractStatusLabels[status]}
                </option>
              ))}
            </Select>
            {fieldError(form.formState.errors.status?.message)}
          </EntityForm.Field>

          <EntityForm.Field label="تاريخ البداية">
            <Input type="date" {...form.register('start_date')} />
            {fieldError(form.formState.errors.start_date?.message)}
          </EntityForm.Field>

          <EntityForm.Field label="تاريخ النهاية">
            <Input type="date" {...form.register('end_date')} />
            {fieldError(form.formState.errors.end_date?.message)}
          </EntityForm.Field>

          <EntityForm.Field label="قيمة الإيجار">
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              min="0.01"
              {...form.register('rent_amount')}
            />
            {fieldError(form.formState.errors.rent_amount?.message)}
          </EntityForm.Field>

          <EntityForm.Field label="دورة السداد">
            <Select {...form.register('payment_cycle')}>
              {paymentCycleValues.map((cycle) => (
                <option key={cycle} value={cycle}>
                  {paymentCycleLabels[cycle]}
                </option>
              ))}
            </Select>
            {fieldError(form.formState.errors.payment_cycle?.message)}
          </EntityForm.Field>

          <EntityForm.Field label="شرط السداد">
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
            {fieldError(form.formState.errors.payment_terms_id?.message)}
          </EntityForm.Field>

          <EntityForm.Field label="سبب الإلغاء" className="md:col-span-2">
            <Textarea
              {...form.register('cancellation_reason')}
              placeholder="يظهر عند إلغاء العقد"
            />
          </EntityForm.Field>

          <EntityForm.Field label="ملاحظات" className="md:col-span-2">
            <Textarea {...form.register('notes')} placeholder="ملاحظات العقد" />
          </EntityForm.Field>

          <div className="md:col-span-2">
            <Controller
              control={form.control}
              name="attachment_url"
              render={({ field }) => (
                <FileAttachmentField
                  label="نسخة العقد الموقعة (PDF أو صورة)"
                  value={field.value ?? null}
                  onChange={field.onChange}
                />
              )}
            />
          </div>

          <EntityForm.Actions
            className="md:col-span-2"
            onCancel={onClose}
            isSubmitting={submitting}
            submitDisabled={
              submitting ||
              prerequisitesLoading ||
              Boolean(coverageError) ||
              Boolean(dependencyError)
            }
            submitLabel={
              prerequisitesLoading
                ? 'جار تجهيز بيانات العقد...'
                : submitting
                  ? 'جار الحفظ...'
                  : 'حفظ العقد'
            }
          />
        </EntityForm.Root>
      )}
    </EntityForm.Overlay>
  );
}
