import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import {
  checkPropertyTabPermissions,
  fetchPropertyActivity,
  fetchPropertyContracts,
  fetchPropertyInvoices,
  fetchPropertyMaintenance,
  type PropertyActivityRecord,
} from '@/services/property-workspace-service';

export type { PropertyActivityRecord };

export function usePropertyTabPermissions() {
  const { authorization } = useAuth();
  return checkPropertyTabPermissions(authorization);
}

export function usePropertyContractsTab(propertyId: string) {
  return useQuery({
    queryKey: ['contracts', 'property-tab', propertyId],
    queryFn: () => fetchPropertyContracts(propertyId),
  });
}

export function usePropertyInvoicesTab(propertyId: string) {
  return useQuery({
    queryKey: ['invoices', 'property-tab', propertyId],
    queryFn: () => fetchPropertyInvoices(propertyId),
  });
}

export function usePropertyMaintenanceTab(propertyId: string) {
  return useQuery({
    queryKey: ['maintenance', 'property-tab', propertyId],
    queryFn: () => fetchPropertyMaintenance(propertyId),
  });
}

export function usePropertyActivityTab(propertyId: string) {
  return useQuery({
    queryKey: ['audit-log', 'property-tab', propertyId],
    queryFn: () => fetchPropertyActivity(propertyId),
  });
}
