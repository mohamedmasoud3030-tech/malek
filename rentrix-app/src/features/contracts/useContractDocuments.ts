import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { deleteContractDocument, listContractDocuments, uploadContractDocument } from './contractDocumentsService';

export const contractDocumentKeys = {
  all: ['contract-documents'] as const,
  list: (contractId: string) => [...contractDocumentKeys.all, contractId] as const,
};

export function useContractDocuments(contractId: string) {
  return useQuery({
    queryKey: contractDocumentKeys.list(contractId),
    queryFn: () => listContractDocuments(contractId),
    enabled: Boolean(contractId),
  });
}

export function useUploadContractDocument(contractId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadContractDocument(contractId, file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: contractDocumentKeys.list(contractId) });
      toast.success('تم رفع المستند بنجاح');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر رفع المستند'),
  });
}

export function useDeleteContractDocument(contractId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => deleteContractDocument(documentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: contractDocumentKeys.list(contractId) });
      toast.success('تم حذف المستند');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر حذف المستند'),
  });
}
