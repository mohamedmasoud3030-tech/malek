import { useQuery } from '@tanstack/react-query';
import { getTenantDossier, listTenantWorkspace, type TenantWorkspaceParams } from './tenantWorkspaceService';

export const tenantWorkspaceKeys = {
  all: ['tenant-workspace'] as const,
  lists: () => [...tenantWorkspaceKeys.all, 'list'] as const,
  list: (params: TenantWorkspaceParams) => [...tenantWorkspaceKeys.lists(), params] as const,
  dossier: (tenantId: string, includeFinancial: boolean, includeActivity: boolean) => [...tenantWorkspaceKeys.all, 'dossier', tenantId, includeFinancial, includeActivity] as const,
};

export function useTenantWorkspace(params: TenantWorkspaceParams) {
  return useQuery({ queryKey: tenantWorkspaceKeys.list(params), queryFn: () => listTenantWorkspace(params) });
}

export function useTenantDossier(tenantId: string, includeFinancial: boolean, includeActivity: boolean) {
  return useQuery({
    queryKey: tenantWorkspaceKeys.dossier(tenantId, includeFinancial, includeActivity),
    queryFn: () => getTenantDossier(tenantId, { includeFinancial, includeActivity }),
    enabled: Boolean(tenantId),
  });
}
