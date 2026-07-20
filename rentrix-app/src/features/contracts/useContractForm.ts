import { useEffect } from 'react';
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
import {
  contractSchema,
  contractStatusLabels,
  contractStatusValues,
  paymentCycleLabels,
  paymentCycleValues,
  type ContractFormValues,
} from './contractSchema';
import {
  buildContractUnitOptionLabel,
  getContractUnitSelectionIssue,
  isUnitSelectableForContract,
} from './contract-unit-options';
import type { Property } from '@/types/domain';
import type { Person } from '@/types/domain';
import type { PaginatedResult } from '@/features/properties/property-service';
import type { PaginatedPeople } from '@/features/people/people-service';

interface UseContractFormOptions {
  contractId?: string;
  onClose?: () => void;
  onSuccess?: () => void;
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
}: UseContractFormOptions = {}): UseContractFormReturn {
  const isEdit = Boolean(contractId);
  const contractQuery = useContract(contractId ?? '');
  const createMutation = useCreateContract();
  const updateMutation = useUpdateContract(contractId ?? '');

  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractSchema, undefined, { raw: true }),
    defaultValues: {
      property_id: '',
      unit_id: '',
      tenant_id: '',
      start_date: '',
      end_date: '',
      rent_amount: 0,
      payment_cycle: 'monthly',
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
    queryKey: ['contracts', 'properties-options'],
    queryFn: () => listProperties({ search: '', status: 'all', page: 1, pageSize: 200 }),
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
      payment_terms_id: contractQuery.data.payment_terms_id ?? '',
      status: contractQuery.data.status,
      cancellation_reason: contractQuery.data.cancellation_reason ?? '',
      notes: contractQuery.data.notes ?? '',
      attachment_url: contractQuery.data.attachment_url ?? null,
    });
  }, [contractQuery.data, form]);

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
      const agreementId = agreementCoverageQuery.data?.id ?? null;
      const finalPayload = { ...payload, agreement_id: agreementId };
      if (isEdit && contractId) {
        await updateMutation.mutateAsync(finalPayload);
      } else {
        await createMutation.mutateAsync(finalPayload);
      }
      onSuccess?.();
      onClose?.();
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
    agreementCoverageQuery,
    selectedProperty,
    currentLinkedUnitId,
    handleSubmit,
  };
}

// Re-export types and constants for consumers
export {
  contractSchema,
  contractStatusLabels,
  contractStatusValues,
  paymentCycleLabels,
  paymentCycleValues,
  type ContractFormValues,
} from './contractSchema';

export {
  buildContractUnitOptionLabel,
  getContractUnitSelectionIssue,
  isUnitSelectableForContract,
} from './contract-unit-options';
