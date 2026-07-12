import { useEffect } from 'react';
import { Controller } from 'react-hook-form';
import { RouteLoadingState } from '@/components/loading-state';
import { FileAttachmentField } from '@/components/ui/file-attachment-field';
import { Input } from '@/components/ui/input';
import { EntityForm } from '@/components/ui/entity-form';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { getAppLanguageState, translateSharedLabel } from '@/lib/i18n';
import { useContractForm, contractStatusLabels, contractStatusValues, paymentCycleLabels, paymentCycleValues, buildContractUnitOptionLabel, isUnitSelectableForContract, getContractUnitSelectionIssue, type ContractFormValues } from './useContractForm';

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
    agreementCoverageQuery,
    selectedProperty,
    currentLinkedUnitId,
    handleSubmit,
  } = useContractForm({
    contractId,
    onClose,
    onSuccess: onClose,
  });

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  // The shared hook handles loading contract data via its own useEffect
  // We need to also reset when open changes to true for edit mode
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

  // Override handleSubmit to include agreement_id from coverage query
  const handleModalSubmit = form.handleSubmit(async (values: ContractFormValues) => {
    const payload = values; // Already validated by zodResolver in hook
    const unitIssue = getContractUnitSelectionIssue({
      units: unitsQuery.data ?? [],
      propertyId: payload.property_id,
      unitId: payload.unit_id,
      currentLinkedUnitId,
    });
    if (unitIssue) {
      form.setError('unit_id', { type: 'validate', message: unitIssue });
      return;
    }
    const agreementId = agreementCoverageQuery.data?.id ?? null;
    const finalPayload = { ...payload, agreement_id: agreementId };
    try {
      await handleSubmit(finalPayload);
    } catch (err) {
      form.setError('root', { type: 'server', message: err instanceof Error ? err.message : 'تعذر حفظ العقد، حاول مرة أخرى.' });
    }
  });

  return (
    <EntityForm.Overlay
      open={open}
      onOpenChange={(v) => { if (!v) onClose(); }}
      title={isEdit ? 'تعديل عقد' : 'إنشاء عقد'}
      className="max-w-2xl"
      headerExtra={form.formState.isDirty && !submitting ? <StatusBadge tone="gold">{translateSharedLabel('unsavedChanges', getAppLanguageState().language)}</StatusBadge> : undefined}
    >
        {isEdit && contractQuery.isLoading ? (
          <RouteLoadingState />
        ) : (
          <EntityForm.Root className="md:grid-cols-2" onSubmit={handleModalSubmit}>
            <label className="grid gap-2 text-sm font-bold">
              العقار
              <Select {...form.register('property_id')} autoFocus>
                <option value="">اختر العقار</option>
                {propertiesQuery.data?.rows.map((property) => (
                  <option key={property.id} value={property.id}>{property.title}</option>
                ))}
              </Select>
              {fieldError(form.formState.errors.property_id?.message)}
            </label>
            <label className="grid gap-2 text-sm font-bold">
              الوحدة
              <Select {...form.register('unit_id')} disabled={!form.watch('property_id')}>
                <option value="">اختر الوحدة</option>
                {unitsQuery.data?.map((unit) => (
                  <option
                    key={unit.id}
                    value={unit.id}
                    disabled={!isUnitSelectableForContract({ unit, currentLinkedUnitId })}
                  >
                    {buildContractUnitOptionLabel({ unit, property: selectedProperty })}
                  </option>
                ))}
              </Select>
              {fieldError(form.formState.errors.unit_id?.message)}
            </label>
            <label className="grid gap-2 text-sm font-bold">
              المستأجر
              <Select {...form.register('tenant_id')}>
                <option value="">اختر المستأجر</option>
                {peopleQuery.data?.rows.map((person) => (
                  <option key={person.id} value={person.id}>{person.full_name}</option>
                ))}
              </Select>
              {fieldError(form.formState.errors.tenant_id?.message)}
            </label>
            <label className="grid gap-2 text-sm font-bold">
              الحالة
              <Select {...form.register('status')}>
                {contractStatusValues.map((status) => (
                  <option key={status} value={status}>{contractStatusLabels[status]}</option>
                ))}
              </Select>
              {fieldError(form.formState.errors.status?.message)}
            </label>
            <label className="grid gap-2 text-sm font-bold">
              تاريخ البداية
              <Input type="date" {...form.register('start_date')} />
              {fieldError(form.formState.errors.start_date?.message)}
            </label>
            <label className="grid gap-2 text-sm font-bold">
              تاريخ النهاية
              <Input type="date" {...form.register('end_date')} />
              {fieldError(form.formState.errors.end_date?.message)}
            </label>
            <label className="grid gap-2 text-sm font-bold">
              قيمة الإيجار
              <Input type="number" step="0.01" inputMode="decimal" min="0.01" {...form.register('rent_amount')} />
              {fieldError(form.formState.errors.rent_amount?.message)}
            </label>
            <label className="grid gap-2 text-sm font-bold">
              دورة السداد
              <Select {...form.register('payment_cycle')}>
                {paymentCycleValues.map((cycle) => (
                  <option key={cycle} value={cycle}>{paymentCycleLabels[cycle]}</option>
                ))}
              </Select>
              {fieldError(form.formState.errors.payment_cycle?.message)}
            </label>
            <label className="grid gap-2 text-sm font-bold">
              شرط السداد
              <Select {...form.register('payment_terms_id')}>
                <option value="">بدون قالب شروط</option>
                {(paymentTermsQuery.data ?? []).filter((term) => term.is_active !== false).map((term) => (
                  <option key={term.id} value={term.id}>{term.name}</option>
                ))}
              </Select>
              {fieldError(form.formState.errors.payment_terms_id?.message)}
            </label>
            <label className="grid gap-2 text-sm font-bold md:col-span-2">
              سبب الإلغاء
              <Textarea {...form.register('cancellation_reason')} placeholder="يظهر عند إلغاء العقد" />
            </label>
            <label className="grid gap-2 text-sm font-bold md:col-span-2">
              ملاحظات
              <Textarea {...form.register('notes')} placeholder="ملاحظات العقد" />
            </label>
            <div className="md:col-span-2">
              <Controller
                control={form.control}
                name="attachment_url"
                render={({ field }) => (
                  <FileAttachmentField label="نسخة العقد الموقعة (PDF أو صورة)" value={field.value ?? null} onChange={field.onChange} />
                )}
              />
            </div>
            <EntityForm.Actions className="md:col-span-2" onCancel={onClose} isSubmitting={submitting} submitLabel={submitting ? 'جار الحفظ...' : 'حفظ العقد'} />
          </EntityForm.Root>
        )}
    </EntityForm.Overlay>
  );
}
