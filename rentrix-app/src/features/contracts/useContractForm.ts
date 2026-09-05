import { useEffect, useRef } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { listPeople } from '@/features/people/people-service';
import { listProperties } from '@/features/properties/property-service';
import { usePaymentTerms } from '@/features/settings/usePaymentTerms';
import { useUnits } from '@/features/units/use-units';
import { useAgreementCoverage } from '@/features/owners/useOwnerAgreements';
import { useContract, useCreateContract, useUpdateContract } from './useContracts';
import { useUnitContractConflicts } from './queries/useUnitContractConflicts';
import { useUnitContractDrafts } from './queries/useUnitContractDrafts';
import {
  contractSchema,
  leaseModeValues,
  type ContractFormValues,
} from './contractSchema';
import {
  getContractUnitDefaultRent,
  getContractUnitSelectionIssue,
} from './contract-unit-options';
import type { Contract, Property } from '@/types/domain';
import type { PaginatedResult } from '@/features/properties/property-service';
import type { PaginatedPeople } from '@/features/people/people-service';
import { normalizeContractStatus } from '@/lib/contractStatus';

interface UseContractFormOptions {
  contractId?: string;
  onClose?: () => void;
  onSuccess?: (contract: Contract) => void;
  initialPropertyId?: string;
  initialUnitId?: string;
  initialTenantId?: string;
}

interface UseContractFormReturn {
  form: UseFormReturn<ContractFormValues>;
  isEdit: boolean;
  submitting: boolean;
  contractQuery: ReturnType<typeof useContract>;
  propertiesQuery: UseQueryResult<PaginatedResult<Property>, Error>;
  peopleQuery: UseQueryResult<PaginatedPeople, Error>;
  paymentTermsQuery: ReturnType<typeof usePaymentTerms>;
  unitsQuery: ReturnType<typeof useUnits>;
  unitConflictsQuery: ReturnType<typeof useUnitContractConflicts>;
  unitConflictsByUnitId: ReadonlyMap<string, import('./domain/unitAvailability').ContractUnitConflict>;
  unitDraftsQuery: ReturnType<typeof useUnitContractDrafts>;
  unitDraftsByUnitId: ReadonlyMap<string, readonly import('./services/unitAvailabilityService').UnitDraftContract[]>;
  agreementCoverageQuery: ReturnType<typeof useAgreementCoverage>;
  selectedProperty: Pick<Property, 'id' | 'title' | 'address'> | undefined;
  currentLinkedUnitId: string | null;
  handleSubmit: (values: ContractFormValues) => Promise<void>;
}

/**
 * Shared contract form logic for both page and modal variants.
 * Encapsulates all form setup, queries, validation, and submission.
 */
export function useContractForm({
  contractId,
  onClose,
  onSuccess,
  initialPropertyId = '',
  initialUnitId = '',
  initialTenantId = '',
}: UseContractFormOptions = {}): UseContractFormReturn {
  const isEdit = Boolean(contractId);
  const contractQuery = useContract(contractId ?? '');
  const createMutation = useCreateContract();
  const updateMutation = useUpdateContract(contractId ?? '');
  const initialUnitRentApplied = useRef(false);

  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractSchema, undefined, { raw: true }),
    defaultValues: {
      property_id: isEdit ? '' : initialPropertyId,
      unit_id: isEdit ? '' : initialUnitId,
      tenant_id: isEdit ? '' : initialTenantId,
      start_date: '',
      end_date: '',
      rent_amount: 0,
      payment_cycle: 'monthly',
      // R4: explicit billing policy defaults, visible and editable in the form
      // (no hidden server default decides them anymore).
      billing_day: 1,
      grace_days: 0,
      // Short Stay mode defaults to long-term leasing; the negotiated stay
      // total is the rent_amount and the reference daily price is optional.
      lease_mode: 'long_term',
      daily_reference_rate: '' as string | number | null,
      payment_terms_id: '',
      status: 'draft',
      cancellation_reason: '',
      notes: '',
      attachment_url: null,
    },
  });

  const propertyId = useWatch({ control: form.control, name: 'property_id' });
  const startDate = useWatch({ control: form.control, name: 'start_date' });
  const endDate = useWatch({ control: form.control, name: 'end_date' });

  const propertiesQuery = useQuery({
    queryKey: ['contracts', 'properties-options', isEdit ? 'all' : 'active'],
    queryFn: () => listProperties({ search: '', status: isEdit ? 'all' : 'active', page: 1, pageSize: 200 }),
  });
  const peopleQuery = useQuery({
    queryKey: ['contracts', 'tenant-options'],
    queryFn: () => listPeople({ search: '', type: 'tenant', page: 1, pageSize: 200 }),
  });
  const paymentTermsQuery = usePaymentTerms();
  const unitsQuery = useUnits(propertyId || '');
  const unitIds = unitsQuery.data?.map((unit) => unit.id) ?? [];
  const unitConflictsQuery = useUnitContractConflicts({
    propertyId: propertyId || '',
    unitIds,
    startDate: startDate || '',
    endDate: endDate || '',
    excludedContractId: contractId ?? null,
  });
  const unitConflictsByUnitId = new Map((unitConflictsQuery.data ?? []).flatMap((conflict) => conflict.unit_id ? [[conflict.unit_id, conflict] as const] : []));
  const unitDraftsQuery = useUnitContractDrafts({
    propertyId: propertyId || '',
    unitIds,
    excludedContractId: contractId ?? null,
  });
  const unitDraftsByUnitId = new Map<string, import('./services/unitAvailabilityService').UnitDraftContract[]>();
  for (const draft of unitDraftsQuery.data ?? []) {
    if (!draft.unit_id) continue;
    const drafts = unitDraftsByUnitId.get(draft.unit_id) ?? [];
    drafts.push(draft);
    unitDraftsByUnitId.set(draft.unit_id, drafts);
  }
  const agreementCoverageQuery = useAgreementCoverage(propertyId, startDate, endDate);
  const selectedProperty = propertiesQuery.data?.rows.find((property) => property.id === propertyId);
  const currentLinkedUnitId = isEdit ? contractQuery.data?.unit_id ?? null : null;

  useEffect(() => {
    if (!contractQuery.data) return;
    form.reset({
      property_id: contractQuery.data.property_id,
      unit_id: contractQuery.data.unit_id ?? '',
      tenant_id: contractQuery.data.tenant_id,
      start_date: contractQuery.data.start_date,
      end_date: contractQuery.data.end_date,
      rent_amount: contractQuery.data.rent_amount,
      payment_cycle: contractQuery.data.payment_cycle,
      billing_day: contractQuery.data.billing_day ?? 1,
      grace_days: contractQuery.data.grace_days ?? 0,
      lease_mode: leaseModeValues.includes(contractQuery.data.lease_mode as (typeof leaseModeValues)[number])
        ? (contractQuery.data.lease_mode as (typeof leaseModeValues)[number])
        : 'long_term',
      daily_reference_rate: contractQuery.data.daily_reference_rate ?? '',
      payment_terms_id: contractQuery.data.payment_terms_id ?? '',
      // Stored rows may carry the legacy 'ACTIVE'/'ENDED' spellings the
      // contracts CHECK still permits; the form works in canonical values.
      status: normalizeContractStatus(contractQuery.data.status),
      cancellation_reason: contractQuery.data.cancellation_reason ?? '',
      notes: contractQuery.data.notes ?? '',
      attachment_url: contractQuery.data.attachment_url ?? null,
    });
  }, [contractQuery.data, form]);

  // When contract creation starts from an available unit, preserve that context
  // and hydrate the recorded unit rent once the unit options arrive. This runs
  // only once and never overwrites a user's later unit/rent edits.
  useEffect(() => {
    if (isEdit || initialUnitRentApplied.current || !initialPropertyId || !initialUnitId || !unitsQuery.data) return;
    if (form.getValues('property_id') !== initialPropertyId || form.getValues('unit_id') !== initialUnitId) return;
    const selectedInitialUnit = unitsQuery.data.find((unit) => unit.id === initialUnitId);
    if (!selectedInitialUnit) return;
    if (Number(form.getValues('rent_amount') || 0) === 0) {
      form.setValue(
        'rent_amount',
        getContractUnitDefaultRent(unitsQuery.data, initialUnitId),
        { shouldDirty: false, shouldValidate: true },
      );
    }
    initialUnitRentApplied.current = true;
  }, [form, initialPropertyId, initialUnitId, isEdit, unitsQuery.data]);

  const submitting = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (values: ContractFormValues) => {
    try {
      const payload = contractSchema.parse(values);
      const unitIssue = getContractUnitSelectionIssue({
        units: unitsQuery.data ?? [],
        propertyId: payload.property_id,
        unitId: payload.unit_id,
        currentLinkedUnitId,
        conflictsByUnitId: unitConflictsByUnitId,
      });
      if (unitIssue) {
        form.setError('unit_id', { type: 'validate', message: unitIssue });
        return;
      }
      const matchingDraft = payload.status === 'draft'
        ? unitDraftsByUnitId.get(payload.unit_id)?.find((draft) => draft.tenant_id === payload.tenant_id)
        : undefined;
      if (matchingDraft) {
        form.setError('unit_id', {
          type: 'validate',
          message: 'توجد بالفعل مسودة عقد لهذه الوحدة والمستأجر. افتح المسودة الحالية وعدّلها بدلاً من إنشاء مسودة أخرى.',
        });
        return;
      }
      const agreementId = agreementCoverageQuery.data?.id ?? null;
      const finalPayload = { ...payload, agreement_id: agreementId };
      const savedContract = isEdit && contractId
        ? await updateMutation.mutateAsync(finalPayload)
        : await createMutation.mutateAsync(finalPayload);
      if (onSuccess) onSuccess(savedContract);
      else onClose?.();
    } catch (err) {
      form.setError('root', { type: 'server', message: err instanceof Error ? err.message : 'تعذر حفظ العقد، حاول مرة أخرى.' });
    }
  };

  return {
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
    unitDraftsQuery,
    unitDraftsByUnitId,
    agreementCoverageQuery,
    selectedProperty,
    currentLinkedUnitId,
    handleSubmit,
  };
}

// Re-export types and constants for consumers
export {
  contractSchema,
  contractSchemaBase,
  contractStatusLabels,
  contractStatusValues,
  leaseModeLabels,
  leaseModeValues,
  paymentCycleLabels,
  paymentCycleValues,
  type ContractFormValues,
} from './contractSchema';

export {
  buildContractUnitOptionLabel,
  getContractUnitSelectionIssue,
  isUnitSelectableForContract,
} from './contract-unit-options';