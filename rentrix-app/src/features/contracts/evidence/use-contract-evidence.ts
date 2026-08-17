import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  completeContractInspection,
  decideContractRegistration,
  getContractEvidenceState,
  listContractEvidenceDocuments,
  reviewContractInspection,
  saveContractInspectionDraft,
  submitContractRegistration,
} from './contract-evidence-service';

export const contractEvidenceKeys = {
  state: (contractId: string) => ['contracts', contractId, 'evidence-state'] as const,
  documents: (contractId: string) => ['contracts', contractId, 'evidence-documents'] as const,
};

export function useContractEvidenceState(contractId: string) {
  return useQuery({ queryKey: contractEvidenceKeys.state(contractId), queryFn: () => getContractEvidenceState(contractId), enabled: Boolean(contractId), retry: false });
}

export function useContractEvidenceDocuments(contractId: string) {
  return useQuery({ queryKey: contractEvidenceKeys.documents(contractId), queryFn: () => listContractEvidenceDocuments(contractId), enabled: Boolean(contractId) });
}

export function useContractEvidenceMutations(contractId: string) {
  const client = useQueryClient();
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: contractEvidenceKeys.state(contractId) });
    await client.invalidateQueries({ queryKey: contractEvidenceKeys.documents(contractId) });
  };
  return {
    submitRegistration: useMutation({ mutationFn: submitContractRegistration, onSuccess: refresh }),
    decideRegistration: useMutation({ mutationFn: decideContractRegistration, onSuccess: refresh }),
    saveInspection: useMutation({ mutationFn: saveContractInspectionDraft, onSuccess: refresh }),
    completeInspection: useMutation({ mutationFn: completeContractInspection, onSuccess: refresh }),
    reviewInspection: useMutation({ mutationFn: reviewContractInspection, onSuccess: refresh }),
  };
}
