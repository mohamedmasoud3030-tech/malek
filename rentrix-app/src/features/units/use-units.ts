import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Unit } from '@/types/domain';
import type { UnitPayload } from './unit-schema';
import { createUnit, listUnits, listUnitsByProperty, softDeleteUnit, updateUnit } from './unit-service';

export const unitKeys = {
  all: ['units'] as const,
  list: () => [...unitKeys.all, 'list'] as const,
  property: (propertyId: string) => [...unitKeys.all, 'property', propertyId] as const,
};

const contractQueries = ['contracts'] as const;

export function useAllUnits() {
  return useQuery({
    queryKey: unitKeys.list(),
    queryFn: listUnits,
  });
}

export function useUnits(propertyId: string) {
  return useQuery({
    queryKey: unitKeys.property(propertyId),
    queryFn: () => listUnitsByProperty(propertyId),
    enabled: Boolean(propertyId),
  });
}

export function useCreateUnit(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UnitPayload) => createUnit(propertyId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: unitKeys.list() }),
        queryClient.invalidateQueries({ queryKey: unitKeys.property(propertyId) }),
      ]);
      toast.success('تم إنشاء الوحدة بنجاح');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر إنشاء الوحدة'),
  });
}

export function useUpdateUnit(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, payload }: { unitId: string; payload: UnitPayload }) => updateUnit(unitId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: unitKeys.list() }),
        queryClient.invalidateQueries({ queryKey: unitKeys.property(propertyId) }),
        queryClient.invalidateQueries({ queryKey: contractQueries }),
      ]);
      toast.success('تم تحديث الوحدة بنجاح');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر تحديث الوحدة'),
  });
}

export function useSoftDeleteUnit(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (unitId: string) => softDeleteUnit(unitId),
    onMutate: async (unitId) => {
      await queryClient.cancelQueries({ queryKey: unitKeys.property(propertyId) });
      const previousUnits = queryClient.getQueryData<Unit[]>(unitKeys.property(propertyId));
      queryClient.setQueryData<Unit[]>(unitKeys.property(propertyId), (units) => units?.filter((unit) => unit.id !== unitId) ?? []);
      return { previousUnits };
    },
    onError: (error, _unitId, context) => {
      if (context?.previousUnits) queryClient.setQueryData(unitKeys.property(propertyId), context.previousUnits);
      toast.error(error instanceof Error ? error.message : 'تعذر أرشفة الوحدة');
    },
    onSuccess: () => toast.success('تمت أرشفة الوحدة بنجاح'),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: unitKeys.all }),
        queryClient.invalidateQueries({ queryKey: contractQueries }),
      ]);
    },
  });
}
