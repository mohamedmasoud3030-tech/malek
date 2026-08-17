import { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { RouteLoadingState } from '@/components/loading-state';
import { Button } from '@/components/ui/button';
import { EntityForm } from '@/components/ui/entity-form';
import { StatusBadge } from '@/components/ui/status-badge';
import { PersonFormModal } from '@/features/people/person-form-modal';
import { getAppLanguageState, translateSharedLabel } from '@/lib/i18n';
import type { Contract, Person } from '@/types/domain';
import { ContractAgreementMissingAlert } from './components/ContractAgreementMissingAlert';
import { ContractFormFields } from './components/ContractFormFields';
import { useContractForm } from './useContractForm';
import { normalizeContractStatus } from '@/lib/contractStatus';

interface ContractFormModalProps {
  open: boolean;
  onClose: () => void;
  contractId?: string;
  initialPropertyId?: string;
  initialUnitId?: string;
  initialTenantId?: string;
  onCreated?: (contract: Contract) => void;
}

export function ContractFormModal({
  open,
  onClose,
  contractId,
  initialPropertyId,
  initialUnitId,
  initialTenantId,
  onCreated,
}: ContractFormModalProps) {
  const [tenantFormOpen, setTenantFormOpen] = useState(false);
  const controller = useContractForm({
    contractId,
    initialPropertyId,
    initialUnitId,
    initialTenantId,
    onSuccess: (savedContract) => {
      if (!contractId && onCreated) onCreated(savedContract);
      else onClose();
    },
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
    selectedProperty,
    handleSubmit,
  } = controller;

  useEffect(() => {
    if (!open) {
      form.reset();
      setTenantFormOpen(false);
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
        // Stored rows may carry the legacy 'ACTIVE'/'ENDED' spellings the
        // contracts CHECK still permits; the form works in canonical values.
        status: normalizeContractStatus(contractQuery.data.status),
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
  const coverageMissing =
    agreementCoverageQuery.isError ||
    (hasSelectedPeriod && !agreementCoverageQuery.isLoading && !agreementCoverageQuery.data);
  const journeyUnit = initialUnitId
    ? unitsQuery.data?.find((unit) => unit.id === initialUnitId)
    : undefined;
  let dependencyError: string | null = null;
  if (propertiesQuery.isError || peopleQuery.isError) {
    dependencyError = 'تعذر تحميل بيانات العقارات أو المستأجرين. أعد تحميل الصفحة ثم حاول مرة أخرى.';
  } else if (unitsQuery.isError) {
    dependencyError = 'تعذر تحميل وحدات العقار المحدد. أعد المحاولة قبل حفظ العقد.';
  } else if (unitConflictsQuery.isError) {
    dependencyError = 'تعذر التحقق من تعارضات عقود الوحدة. أعد المحاولة قبل حفظ العقد.';
  }

  const selectCreatedTenant = (person: Person) => {
    form.setValue('tenant_id', person.id, { shouldDirty: true, shouldValidate: true });
    setTenantFormOpen(false);
    void peopleQuery.refetch();
  };

  return (
    <>
      <EntityForm.Overlay
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) onClose();
        }}
        title={isEdit ? 'تعديل عقد' : 'إنشاء عقد'}
        className="max-w-2xl"
        headerExtra={
          form.formState.isDirty && !submitting ? (
            <StatusBadge tone="warning">
              {translateSharedLabel('unsavedChanges', getAppLanguageState().language)}
            </StatusBadge>
          ) : undefined
        }
      >
        {isEdit && contractQuery.isLoading ? (
          <RouteLoadingState />
        ) : (
          <>
            {!isEdit && initialPropertyId && initialUnitId ? (
              <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 px-3 py-3 text-sm">
                <p className="font-bold">بدء التأجير من الوحدة المحددة</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  تم تجهيز العقار{selectedProperty ? ` «${selectedProperty.title}»` : ''}
                  {journeyUnit ? ` والوحدة ${journeyUnit.unit_number}` : ' والوحدة المحددة'} تلقائياً. أكمل بيانات المستأجر والمدة ثم راجع العقد.
                </p>
              </div>
            ) : null}

            {coverageMissing && (
              <div className="mb-4">
                <ContractAgreementMissingAlert
                  property={selectedProperty}
                  startDate={startDate || ''}
                  endDate={endDate || ''}
                  isLoading={agreementCoverageQuery.isLoading}
                  hasError={agreementCoverageQuery.isError}
                  hasSelectedPeriod={hasSelectedPeriod}
                  hasAgreement={Boolean(agreementCoverageQuery.data)}
                  onRetry={() => agreementCoverageQuery.refetch()}
                />
              </div>
            )}

            {!isEdit ? (
              <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold">المستأجر غير مسجل؟</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">أضفه هنا وسيتم اختياره في العقد تلقائياً دون مغادرة المهمة الحالية.</p>
                </div>
                <Button type="button" variant="secondary" className="min-h-11 shrink-0" onClick={() => setTenantFormOpen(true)}>
                  <UserPlus className="me-2 size-4" aria-hidden="true" />
                  إضافة مستأجر
                </Button>
              </div>
            ) : null}

            <ContractFormFields
              controller={controller}
              onSubmit={form.handleSubmit(handleSubmit)}
              onCancel={onClose}
              dependencyError={dependencyError}
              coverageError={coverageMissing ? 'لا توجد اتفاقية إدارة تغطي كامل فترة العقد. راجع الإشعار أعلاه.' : null}
              showAttachment
              autoFocusProperty={!initialPropertyId}
            />
          </>
        )}
      </EntityForm.Overlay>

      {!isEdit ? (
        <PersonFormModal
          open={tenantFormOpen}
          onClose={() => setTenantFormOpen(false)}
          defaultType="tenant"
          onCreated={selectCreatedTenant}
        />
      ) : null}
    </>
  );
}