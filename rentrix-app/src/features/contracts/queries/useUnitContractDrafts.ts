import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listUnitDraftContracts } from '../services/unitAvailabilityService';

export const unitContractDraftKeys = {
  all: ['contracts', 'unit-drafts'] as const,
  list: (propertyId: string, excludedContractId?: string | null) =>
    [...unitContractDraftKeys.all, { propertyId, excludedContractId: excludedContractId ?? null }] as const,
};

export function useUnitContractDrafts({
  propertyId,
  unitIds,
  excludedContractId,
}: Readonly<{
  propertyId: string;
  unitIds: readonly string[];
  excludedContractId?: string | null;
}>) {
  const uniqueUnitIds = useMemo(
    () => [...new Set(unitIds.filter(Boolean))].sort((left, right) => left.localeCompare(right)),
    [unitIds],
  );
  return useQuery({
    queryKey: unitContractDraftKeys.list(propertyId, excludedContractId),
    queryFn: () => listUnitDraftContracts({ unitIds: uniqueUnitIds, excludedContractId }),
    enabled: Boolean(propertyId) && uniqueUnitIds.length > 0,
    staleTime: 10_000,
  });
}
