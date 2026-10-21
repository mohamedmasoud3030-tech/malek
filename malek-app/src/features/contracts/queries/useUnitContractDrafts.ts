import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { normalizeUnitIds } from './unit-ids';
import { listUnitDraftContracts } from '../services/unitAvailabilityService';

const unitContractDraftKeys = {
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
  const uniqueUnitIds = useMemo(() => normalizeUnitIds(unitIds), [unitIds]);
  return useQuery({
    queryKey: unitContractDraftKeys.list(propertyId, excludedContractId),
    queryFn: () => listUnitDraftContracts({ unitIds: uniqueUnitIds, excludedContractId }),
    enabled: Boolean(propertyId) && uniqueUnitIds.length > 0,
    staleTime: 10_000,
  });
}
