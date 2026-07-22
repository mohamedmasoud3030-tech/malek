import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { propertyKeys } from '@/features/properties/use-properties';
import {
  createOwner,
  fetchOwnerDetailSnapshot,
  fetchOwnerHubSnapshot,
  getOwner,
  linkOwnerToProperty,
  listActiveContractsForProperties,
  listOwners,
  listPropertiesWithOwners,
  listPropertyOwners,
  unlinkOwnerFromProperty,
  updateOwner,
  updatePropertyOwnerLink,
  type OwnerPayload,
  type OwnerUpdatePayload,
  type PropertyOwnerPayload,
  type PropertyOwnerUpdatePayload,
} from './services/owner-service';

export const ownerKeys = {
  all: ['owners'] as const,
  lists: () => [...ownerKeys.all, 'list'] as const,
  hub: () => [...ownerKeys.all, 'hub'] as const,
  detail: (ownerId: string) => [...ownerKeys.all, 'detail', ownerId] as const,
  detailSnapshot: (ownerId: string) => [...ownerKeys.all, 'detail-snapshot', ownerId] as const,
  propertyOwners: (propertyId: string) => [...ownerKeys.all, 'property-owners', propertyId] as const,
  propertiesWithOwners: () => [...ownerKeys.all, 'properties-with-owners'] as const,
  activeContracts: (propertyIdsKey: string) => [...ownerKeys.all, 'active-contracts', propertyIdsKey] as const,
};

async function invalidateOwnerAndPropertyQueries(queryClient: ReturnType<typeof useQueryClient>, propertyId?: string, ownerId?: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ownerKeys.all }),
    queryClient.invalidateQueries({ queryKey: propertyKeys.all }),
    propertyId ? queryClient.invalidateQueries({ queryKey: ownerKeys.propertyOwners(propertyId) }) : Promise.resolve(),
    ownerId ? queryClient.invalidateQueries({ queryKey: ownerKeys.detail(ownerId) }) : Promise.resolve(),
  ]);
}

export function useOwners(options?: Readonly<{ enabled?: boolean }>) {
  return useQuery({ queryKey: ownerKeys.lists(), queryFn: listOwners, enabled: options?.enabled ?? true });
}

export function useOwner(ownerId: string) {
  return useQuery({
    queryKey: ownerKeys.detail(ownerId),
    queryFn: () => getOwner(ownerId),
    enabled: Boolean(ownerId),
  });
}

export function usePropertyOwners(propertyId: string) {
  return useQuery({
    queryKey: ownerKeys.propertyOwners(propertyId),
    queryFn: () => listPropertyOwners(propertyId),
    enabled: Boolean(propertyId),
  });
}

export function usePropertiesWithOwners() {
  return useQuery({ queryKey: ownerKeys.propertiesWithOwners(), queryFn: listPropertiesWithOwners });
}

export function useOwnerActiveContracts(propertyIds: string[]) {
  const sortedPropertyIds = useMemo(() => [...new Set(propertyIds)].sort((left, right) => left.localeCompare(right)), [propertyIds]);
  const propertyIdsKey = sortedPropertyIds.join('|');
  return useQuery({
    queryKey: ownerKeys.activeContracts(propertyIdsKey),
    queryFn: () => listActiveContractsForProperties(sortedPropertyIds),
    enabled: sortedPropertyIds.length > 0,
  });
}

export function useOwnerHubSnapshot() {
  return useQuery({ queryKey: ownerKeys.hub(), queryFn: fetchOwnerHubSnapshot });
}

export function useOwnerDetailSnapshot(ownerId: string) {
  return useQuery({
    queryKey: ownerKeys.detailSnapshot(ownerId),
    queryFn: () => fetchOwnerDetailSnapshot(ownerId),
    enabled: Boolean(ownerId),
  });
}

export function useCreateOwner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: OwnerPayload) => createOwner(payload),
    onSuccess: async () => {
      await invalidateOwnerAndPropertyQueries(queryClient);
      toast.success('تم إنشاء المالك بنجاح');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر إنشاء المالك'),
  });
}

export function useUpdateOwner(ownerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: OwnerUpdatePayload) => updateOwner(ownerId, payload),
    onSuccess: async () => {
      await invalidateOwnerAndPropertyQueries(queryClient, undefined, ownerId);
      toast.success('تم تحديث بيانات المالك بنجاح');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر تحديث بيانات المالك'),
  });
}

export function useLinkOwnerToProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PropertyOwnerPayload) => linkOwnerToProperty(payload),
    onSuccess: async (link) => {
      await invalidateOwnerAndPropertyQueries(queryClient, link.property_id, link.owner_id);
      toast.success('تم ربط المالك بالعقار بنجاح');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر ربط المالك بالعقار'),
  });
}

export function useUpdatePropertyOwnerLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ linkId, payload }: { linkId: string; payload: PropertyOwnerUpdatePayload }) => updatePropertyOwnerLink(linkId, payload),
    onSuccess: async (link) => {
      await invalidateOwnerAndPropertyQueries(queryClient, link.property_id, link.owner_id);
      toast.success('تم تحديث علاقة الملكية بنجاح');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر تحديث علاقة الملكية'),
  });
}

export function useUnlinkOwnerFromProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ linkId }: { linkId: string; propertyId?: string; ownerId?: string }) => unlinkOwnerFromProperty(linkId),
    onSuccess: async (link, variables) => {
      await invalidateOwnerAndPropertyQueries(queryClient, link.property_id || variables.propertyId, link.owner_id || variables.ownerId);
      toast.success('تم إنهاء علاقة الملكية بنجاح');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر إنهاء علاقة الملكية'),
  });
}
