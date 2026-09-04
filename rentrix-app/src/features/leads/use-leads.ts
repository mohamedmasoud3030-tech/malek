import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { defineEntityKeys } from '@/lib/query-keys';
import { archiveLead, createLead, listLeads, updateLead } from './services/leads-service';
import type { LeadFilters, LeadFormValues } from './types';

const leadKeyBase = defineEntityKeys('leads');
export const leadKeys = { ...leadKeyBase } as const;

export function useLeads(filters: LeadFilters) {
  return useQuery({ queryKey: leadKeys.list(filters), queryFn: () => listLeads(filters) });
}

export function useSaveLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: LeadFormValues }) => (id ? updateLead(id, values) : createLead(values)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: leadKeys.all });
      toast.success('تم حفظ العميل المحتمل');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر حفظ العميل المحتمل'),
  });
}

export function useArchiveLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveLead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: leadKeys.all });
      toast.success('تمت أرشفة العميل المحتمل');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر أرشفة العميل المحتمل'),
  });
}
