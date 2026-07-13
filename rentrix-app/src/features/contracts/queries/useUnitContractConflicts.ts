import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listUnitContractConflicts } from '../services/unitAvailabilityService';

export const unitContractConflictKeys = {
  all: ['contracts', 'unit-conflicts'] as const,
  period: (propertyId: string, startDate: string, endDate: string, excludedContractId?: string | null) =>
    [...unitContractConflictKeys.all, { propertyId, startDate, endDate, excludedContractId: excludedContractId ?? null }] as const,
};

export function useUnitContractConflicts({
  propertyId,
  unitIds,
  startDate,
  endDate,
  excludedContractId,
}: Readonly<{
  propertyId: string;
  unitIds: readonly string[];
  startDate: string;
  endDate: string;
  excludedContractId?: string | null;
}>) {
  const uniqueUnitIds = useMemo(() => [...new Set(unitIds.filter(Boolean))].sort(), [unitIds]);
  return useQuery({
    queryKey: unitContractConflictKeys.period(propertyId, startDate, endDate, excludedContractId),
    queryFn: () => listUnitContractConflicts({ unitIds: uniqueUnitIds, startDate, endDate, excludedContractId }),
    enabled: Boolean(propertyId) && Boolean(startDate) && Boolean(endDate) && uniqueUnitIds.length > 0,
    staleTime: 10_000,
  });
}
