import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createEntityQueryKeys } from '@/lib/data/query-keys';
import { archiveLand, createLand, listLands, updateLand } from './services/lands-service';
import type { LandFilters, LandFormValues } from './types';

export const landKeys = createEntityQueryKeys<LandFilters>('lands');

export function useLands(filters: LandFilters) {
  return useQuery({ queryKey: landKeys.list(filters), queryFn: () => listLands(filters) });
}

export function useSaveLand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: LandFormValues }) => (id ? updateLand(id, values) : createLand(values)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: landKeys.all });
      toast.success('تم حفظ بيانات الأرض');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر حفظ بيانات الأرض'),
  });
}

export function useArchiveLand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveLand,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: landKeys.all });
      toast.success('تمت أرشفة الأرض');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر أرشفة الأرض'),
  });
}
