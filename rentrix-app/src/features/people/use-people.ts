import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { tenantWorkspaceKeys } from '@/features/tenants/useTenantWorkspace';
import type { PersonFormValues, PersonPayload } from './person-schema';
import { createPerson, getPerson, listPeople, softDeletePerson, updatePerson, type PeopleListParams } from './people-service';

export const peopleKeys = {
  all: ['people'] as const,
  lists: () => [...peopleKeys.all, 'list'] as const,
  list: (params: PeopleListParams) => [...peopleKeys.lists(), params] as const,
  detail: (personId: string) => [...peopleKeys.all, 'detail', personId] as const,
};

export function usePeople(params: PeopleListParams) {
  return useQuery({
    queryKey: peopleKeys.list(params),
    queryFn: () => listPeople(params),
  });
}

export function usePerson(personId: string) {
  return useQuery({
    queryKey: peopleKeys.detail(personId),
    queryFn: () => getPerson(personId),
    enabled: Boolean(personId),
  });
}

async function invalidatePeopleWorkflows(queryClient: ReturnType<typeof useQueryClient>, personId?: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: peopleKeys.all }),
    queryClient.invalidateQueries({ queryKey: tenantWorkspaceKeys.all }),
    personId ? queryClient.invalidateQueries({ queryKey: peopleKeys.detail(personId) }) : Promise.resolve(),
  ]);
}

export function useCreatePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PersonFormValues | PersonPayload) => createPerson(payload),
    onSuccess: async (person) => {
      await invalidatePeopleWorkflows(queryClient, person.id);
      toast.success('تم إنشاء الشخص بنجاح');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر إنشاء الشخص'),
  });
}

export function useUpdatePerson(personId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PersonFormValues | PersonPayload) => updatePerson(personId, payload),
    onSuccess: async () => {
      await invalidatePeopleWorkflows(queryClient, personId);
      toast.success('تم تحديث الشخص بنجاح');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر تحديث الشخص'),
  });
}

export function useSoftDeletePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (personId: string) => softDeletePerson(personId),
    onSuccess: async (_data, personId) => {
      await invalidatePeopleWorkflows(queryClient, personId);
      toast.success('تم حذف الشخص أرشيفياً');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر حذف الشخص'),
  });
}
