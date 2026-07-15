import type { ContractListItem } from '@/features/contracts/services/contractService';
import type { Owner } from '@/features/owners/services/owner-service';
import type { CostCenterRecord } from '@/features/settings/costCenterService';
import type { FilterState } from './reports-page.helpers';

export type SelectedFilterEntities = Readonly<{
  selectedCostCenter?: string;
  selectedOwner?: Owner;
  selectedContract?: ContractListItem;
}>;

/**
 * Derives the currently-selected filter entities from the raw filter ids and the
 * available rows. Centralised here so the desktop filter panel and the mobile
 * filter surface never duplicate the same `.find()` lookups (PR #1163 cleanup).
 */
export function getSelectedFilterEntities(
  filters: FilterState,
  costCenterRows: CostCenterRecord[],
  ownerRows: Owner[],
  contractRows: ContractListItem[],
): SelectedFilterEntities {
  const selectedCostCenter = costCenterRows.find((row) => row.id === filters.costCenterId)?.name;
  const selectedOwner = ownerRows.find((row) => row.id === filters.ownerId);
  const selectedContract = contractRows.find((row) => row.id === filters.contractId);
  return { selectedCostCenter, selectedOwner, selectedContract };
}
