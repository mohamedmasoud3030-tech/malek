import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { archiveCommunicationRecord, createCommunicationRecord, listCommunicationRecords, updateCommunicationRecord } from './services/communication-service';
import type { CommunicationFilters, CommunicationFormValues } from './types';

const communicationKeys = { all: ['communication-records'] as const, list: (filters: CommunicationFilters) => [...communicationKeys.all, filters] as const };

export function useCommunicationRecords(filters: CommunicationFilters) {
  return useQuery({ queryKey: communicationKeys.list(filters), queryFn: () => listCommunicationRecords(filters) });
}

export function useSaveCommunicationRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: CommunicationFormValues }) => (id ? updateCommunicationRecord(id, values) : createCommunicationRecord(values)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: communicationKeys.all });
      toast.success('تم حفظ سجل التواصل');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر حفظ سجل التواصل'),
  });
}

export function useArchiveCommunicationRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveCommunicationRecord,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: communicationKeys.all });
      toast.success('تمت أرشفة سجل التواصل');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر أرشفة سجل التواصل'),
  });
}
