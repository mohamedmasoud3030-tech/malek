import { useEffect } from 'react';
import { RouteLoadingState } from '@/components/loading-state';
import { EntityForm } from '@/components/ui/entity-form';
import { StatusBadge } from '@/components/ui/status-badge';
import { getAppLanguageState, translateSharedLabel } from '@/lib/i18n';
import { ContractFormFields } from './components/ContractFormFields';
import { useContractForm } from './useContractForm';

interface ContractFormModalProps {
  open: boolean;
  onClose: () => void;
  contractId?: string;
}

export function ContractFormModal({ open, onClose, contractId }: ContractFormModalProps) {
  const controller = useContractForm({
    contractId,
    onClose,
    onSuccess: onClose,
  });
  const {
    form,
    isEdit,
    submitting,
    contractQuery,
    propertiesQuery,
    peopleQuery,
    unitsQuery,
    unitConflictsQuery,
    agreementCoverageQuery,
    handleSubmit,
  } = controller;

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
        <ContractFormFields
          controller={controller}
          onSubmit={form.handleSubmit(handleSubmit)}
          onCancel={onClose}
          dependencyError={dependencyError}
          coverageError={coverageError}
          showAttachment
          autoFocusProperty
        />
      )}
    </EntityForm.Overlay>
  );
}