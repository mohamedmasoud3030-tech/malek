import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  archiveServiceProvider,
  archiveServiceProviderCategory,
  createServiceProviderCategory,
  getServiceProvider,
  getServiceProviderDossier,
  getServiceProviderSummary,
  listActiveServiceProviderOptions,
  listServiceProviderCategories,
  listServiceProviders,
  saveServiceProvider,
  updateServiceProviderCategory,
  type ServiceProviderListParams,
} from './service-provider-service';
import type { ServiceProviderCategoryValues, ServiceProviderFormValues } from './service-provider-schema';

export const serviceProviderKeys = {
  all: ['service-providers'] as const,
  lists: () => [...serviceProviderKeys.all, 'list'] as const,
  list: (params: ServiceProviderListParams) => [...serviceProviderKeys.lists(), params] as const,
  summary: () => [...serviceProviderKeys.all, 'summary'] as const,
  details: () => [...serviceProviderKeys.all, 'detail'] as const,
  detail: (providerId: string) => [...serviceProviderKeys.details(), providerId] as const,
  dossier: (providerId: string) => [...serviceProviderKeys.detail(providerId), 'dossier'] as const,
  categories: () => [...serviceProviderKeys.all, 'categories'] as const,
  options: () => [...serviceProviderKeys.all, 'options'] as const,
};

async function invalidateServiceProviderData(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: serviceProviderKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['maintenance'] }),
  ]);
}

export function useServiceProviders(params: ServiceProviderListParams) {
  return useQuery({ queryKey: serviceProviderKeys.list(params), queryFn: () => listServiceProviders(params) });
}

export function useServiceProviderSummary() {
  return useQuery({ queryKey: serviceProviderKeys.summary(), queryFn: getServiceProviderSummary });
}

export function useServiceProvider(providerId: string) {
  return useQuery({ queryKey: serviceProviderKeys.detail(providerId), queryFn: () => getServiceProvider(providerId), enabled: Boolean(providerId) });
}

export function useServiceProviderDossier(providerId: string) {
  return useQuery({ queryKey: serviceProviderKeys.dossier(providerId), queryFn: () => getServiceProviderDossier(providerId), enabled: Boolean(providerId) });
}

export function useServiceProviderCategories() {
  return useQuery({ queryKey: serviceProviderKeys.categories(), queryFn: () => listServiceProviderCategories() });
}

export function useActiveServiceProviderOptions(options: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: serviceProviderKeys.options(), queryFn: listActiveServiceProviderOptions, enabled: options.enabled ?? true });
}

export function useSaveServiceProvider(providerId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: ServiceProviderFormValues) => saveServiceProvider(providerId, values),
    onSuccess: async () => {
      await invalidateServiceProviderData(queryClient);
      toast.success(providerId ? 'تم تحديث مزود الخدمة' : 'تم إنشاء مزود الخدمة');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر حفظ مزود الخدمة'),
  });
}

export function useArchiveServiceProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveServiceProvider,
    onSuccess: async () => {
      await invalidateServiceProviderData(queryClient);
      toast.success('تمت أرشفة مزود الخدمة مع الاحتفاظ بسجل الصيانة');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر أرشفة مزود الخدمة'),
  });
}

export function useCreateServiceProviderCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: ServiceProviderCategoryValues) => createServiceProviderCategory(values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: serviceProviderKeys.all });
      toast.success('تم إنشاء نوع الخدمة');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر إنشاء نوع الخدمة'),
  });
}

export function useUpdateServiceProviderCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, values }: { categoryId: string; values: ServiceProviderCategoryValues }) => updateServiceProviderCategory(categoryId, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: serviceProviderKeys.all });
      toast.success('تم تحديث نوع الخدمة');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر تحديث نوع الخدمة'),
  });
}

export function useArchiveServiceProviderCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveServiceProviderCategory,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: serviceProviderKeys.all });
      toast.success('تمت أرشفة نوع الخدمة');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر أرشفة نوع الخدمة'),
  });
}
