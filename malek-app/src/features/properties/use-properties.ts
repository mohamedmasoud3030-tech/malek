import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { PropertyPayload } from './property-schema';
import { getProperty, listProperties, softDeleteProperty, updateProperty, type PropertyListParams } from './property-service';

export const propertyKeys = {
  all: ['properties'] as const,
  lists: () => [...propertyKeys.all, 'list'] as const,
  list: (params: PropertyListParams) => [...propertyKeys.lists(), params] as const,
  detail: (propertyId: string) => [...propertyKeys.all, 'detail', propertyId] as const,
};

export function useProperties(params: PropertyListParams) {
  return useQuery({
    queryKey: propertyKeys.list(params),
    queryFn: () => listProperties(params),
  });
}

export function useProperty(propertyId: string) {
  return useQuery({
    queryKey: propertyKeys.detail(propertyId),
    queryFn: () => getProperty(propertyId),
    enabled: Boolean(propertyId),
  });
}

export function useUpdateProperty(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PropertyPayload) => updateProperty(propertyId, payload),
    onSuccess: async (property) => {
      queryClient.setQueryData(propertyKeys.detail(propertyId), property);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: propertyKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: propertyKeys.detail(propertyId) }),
      ]);
      toast.success('تم تحديث العقار بنجاح');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر تحديث العقار'),
  });
}

export function useSoftDeleteProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (propertyId: string) => softDeleteProperty(propertyId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: propertyKeys.all });
      toast.success('تم حذف العقار أرشيفياً');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر حذف العقار'),
  });
}
