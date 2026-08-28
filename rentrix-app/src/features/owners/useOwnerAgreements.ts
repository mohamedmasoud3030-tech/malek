import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createOwnerAgreement,
  createOwnerAgreementVersion,
  createPropertyWithAgreement,
  getAgreementCoveringRange,
  listOwnerAgreementsForOwner,
  listOwnerAgreementsForProperty,
  listOwnerAgreementVersions,
  type CreatePropertyWithAgreementPayload,
  type OwnerAgreementFormPayload,
  type OwnerAgreementVersionTerms,
} from './ownerAgreementService';

export function useOwnerAgreements(propertyId: string) {
  return useQuery({ queryKey: ['owner_agreements', propertyId], queryFn: () => listOwnerAgreementsForProperty(propertyId), enabled: Boolean(propertyId) });
}

export function useOwnerAgreementsForOwner(ownerId: string) {
  return useQuery({ queryKey: ['owner_agreements', 'owner', ownerId], queryFn: () => listOwnerAgreementsForOwner(ownerId), enabled: Boolean(ownerId) });
}

export function useAgreementCoverage(propertyId: string, startDate: string, endDate: string) {
  return useQuery({ queryKey: ['owner_agreements', 'coverage', propertyId, startDate, endDate], queryFn: () => getAgreementCoveringRange(propertyId, startDate, endDate), enabled: Boolean(propertyId) && Boolean(startDate) && Boolean(endDate), staleTime: 10_000 });
}

export function useOwnerAgreementVersions(agreementIds: readonly string[]) {
  const stableIds = [...agreementIds].sort();
  return useQuery({
    queryKey: ['owner_agreement_versions', stableIds],
    queryFn: () => listOwnerAgreementVersions(stableIds),
    enabled: stableIds.length > 0,
  });
}

export function useCreatePropertyWithAgreement() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (payload: CreatePropertyWithAgreementPayload) => createPropertyWithAgreement(payload), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['properties'] }); void qc.invalidateQueries({ queryKey: ['owner_agreements'] }); } });
}

export function useCreateOwnerAgreement(propertyId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (payload: OwnerAgreementFormPayload) => createOwnerAgreement(payload), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['owner_agreements', propertyId] }); void qc.invalidateQueries({ queryKey: ['owner_agreement_versions'] }); void qc.invalidateQueries({ queryKey: ['owner_agreements', 'coverage'] }); } });
}

export function useCreateOwnerAgreementVersion(propertyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agreementId, terms }: { agreementId: string; terms: OwnerAgreementVersionTerms }) => createOwnerAgreementVersion(agreementId, terms),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['owner_agreement_versions'] });
      void qc.invalidateQueries({ queryKey: ['owner_agreements', propertyId] });
      void qc.invalidateQueries({ queryKey: ['owner_agreements', 'coverage'] });
    },
  });
}
