import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createOwnerAgreement,
  createPropertyWithAgreement,
  getAgreementCoveringRange,
  listOwnerAgreementsForProperty,
  updateOwnerAgreement,
  type CreatePropertyWithAgreementPayload,
  type OwnerAgreementFormPayload,
} from './ownerAgreementService';

export function useOwnerAgreements(propertyId: string) {
  return useQuery({ queryKey: ['owner_agreements', propertyId], queryFn: () => listOwnerAgreementsForProperty(propertyId), enabled: Boolean(propertyId) });
}

export function useAgreementCoverage(propertyId: string, startDate: string, endDate: string) {
  return useQuery({ queryKey: ['owner_agreements', 'coverage', propertyId, startDate, endDate], queryFn: () => getAgreementCoveringRange(propertyId, startDate, endDate), enabled: Boolean(propertyId) && Boolean(startDate) && Boolean(endDate), staleTime: 10_000 });
}

export function useCreatePropertyWithAgreement() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (payload: CreatePropertyWithAgreementPayload) => createPropertyWithAgreement(payload), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['properties'] }); void qc.invalidateQueries({ queryKey: ['owner_agreements'] }); } });
}

export function useCreateOwnerAgreement(propertyId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (payload: OwnerAgreementFormPayload) => createOwnerAgreement(payload), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['owner_agreements', propertyId] }); void qc.invalidateQueries({ queryKey: ['owner_agreements', 'coverage'] }); } });
}

export function useUpdateOwnerAgreement(propertyId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ agreementId, payload }: { agreementId: string; payload: OwnerAgreementFormPayload }) => updateOwnerAgreement(agreementId, payload), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['owner_agreements', propertyId] }); void qc.invalidateQueries({ queryKey: ['owner_agreements', 'coverage'] }); } });
}
