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

/** Human-readable label for each active filter dimension, or `undefined` when unset. */
export type ReportFilterLabels = Readonly<{
  property?: string;
  unit?: string;
  tenant?: string;
  costCenter?: string;
  owner?: string;
  contract?: string;
}>;

/**
 * WP-C — the single place report filter dimensions are turned into Arabic
 * labels.
 *
 * The filter summary bar and the in-sheet filter panel previously formatted
 * owner/contract/unit labels independently, so the same selection could read
 * differently in the two surfaces. Both now consume these labels.
 */
export function describeReportFilterSelections(entities: SelectedFilterEntities): ReportFilterLabels {
  const { selectedCostCenter, selectedOwner, selectedContract, selectedProperty, selectedUnit, selectedTenant } = entities;

  return {
    property: selectedProperty?.title,
    unit: selectedUnit?.unit_number ? `وحدة ${selectedUnit.unit_number}` : undefined,
    tenant: selectedTenant?.full_name,
    costCenter: selectedCostCenter,
    owner: selectedOwner?.display_name ?? selectedOwner?.full_name,
    contract: selectedContract
      ? selectedContract.reference
        || `${selectedContract.people?.full_name ?? 'مستأجر'} — ${selectedContract.properties?.title ?? 'عقار'}`
      : undefined,
  };
}
