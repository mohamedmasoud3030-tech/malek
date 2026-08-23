import type { ContractListItem } from '@/features/contracts/services/contractService';
import type { Owner } from '@/features/owners/services/owner-service';
import type { CostCenterRecord } from '@/features/settings/costCenterService';
import type { ReportsFilterState } from './reports-workspace-filters';

export type SelectedFilterEntities = Readonly<{
  selectedCostCenter?: string;
  selectedOwner?: Owner;
  selectedContract?: ContractListItem;
  selectedProperty?: NonNullable<ContractListItem['properties']>;
  selectedUnit?: NonNullable<ContractListItem['units']>;
  selectedTenant?: NonNullable<ContractListItem['people']>;
}>;

/**
 * Derives selected human-readable entities from the raw report-filter ids.
 * Contract rows already carry the scoped property/unit/tenant display context,
 * so the filter UI never exposes UUIDs or creates a second directory query.
 */
export function getSelectedFilterEntities(
  filters: ReportsFilterState,
  costCenterRows: CostCenterRecord[],
  ownerRows: Owner[],
  contractRows: ContractListItem[],
): SelectedFilterEntities {
  const selectedCostCenter = costCenterRows.find((row) => row.id === filters.costCenterId)?.name;
  const selectedOwner = ownerRows.find((row) => row.id === filters.ownerId);
  const selectedContract = contractRows.find((row) => row.id === filters.contractId);
  const selectedProperty = filters.propertyId
    ? contractRows.find((row) => row.properties?.id === filters.propertyId)?.properties ?? undefined
    : undefined;
  const selectedUnit = filters.unitId
    ? contractRows.find((row) => row.units?.id === filters.unitId)?.units ?? undefined
    : undefined;
  const selectedTenant = filters.tenantId
    ? contractRows.find((row) => row.people?.id === filters.tenantId)?.people ?? undefined
    : undefined;

  return {
    selectedCostCenter,
    selectedOwner,
    selectedContract,
    selectedProperty,
    selectedUnit,
    selectedTenant,
  };
}
