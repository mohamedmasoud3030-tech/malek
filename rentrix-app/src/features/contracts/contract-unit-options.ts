import type { Property, Unit } from '@/types/domain';
import { formatDefaultCompanyMoney } from '@/lib/companyFormatters';
import { unitStatusLabels } from '@/features/units/unit-schema';
import { getUnitSelectionIssueForContractPeriod, isUnitSelectableForContractPeriod, type UnitAvailabilityConflictMap } from './domain/unitAvailability';

export type ContractUnitOptionUnit = Pick<Unit, 'id' | 'property_id' | 'unit_number' | 'status' | 'rent_amount'>;
export type ContractUnitOptionProperty = Pick<Property, 'title' | 'address'> | null | undefined;

type ContractUnitOptionLabelParams = Readonly<{
  unit: ContractUnitOptionUnit;
  property?: ContractUnitOptionProperty;
  formatRent?: (amount: number | null | undefined) => string;
}>;

type ContractUnitSelectableParams = Readonly<{
  unit: ContractUnitOptionUnit;
  currentLinkedUnitId?: string | null;
  conflictsByUnitId?: UnitAvailabilityConflictMap;
}>;

type ContractUnitSelectionParams = Readonly<{
  units: readonly ContractUnitOptionUnit[];
  propertyId: string;
  unitId: string;
  currentLinkedUnitId?: string | null;
  conflictsByUnitId?: UnitAvailabilityConflictMap;
}>;

export function buildContractUnitOptionLabel({ unit, property, formatRent = formatDefaultCompanyMoney }: ContractUnitOptionLabelParams): string {
  const propertyLabel = property?.title?.trim() || property?.address?.trim() || null;
  const unitLabel = unit.unit_number?.trim() || null;
  const statusLabel = unitStatusLabels[unit.status] ?? null;
  const rentLabel = unit.rent_amount === null || unit.rent_amount === undefined ? null : formatRent(unit.rent_amount);
  const parts = [propertyLabel, unitLabel, statusLabel, rentLabel];

  return parts.filter((part): part is string => Boolean(part)).join(' — ');
}

export function getContractUnitDefaultRent(units: readonly ContractUnitOptionUnit[], unitId: string): number {
  return units.find((unit) => unit.id === unitId)?.rent_amount ?? 0;
}

export function isUnitSelectableForContract({ unit, currentLinkedUnitId, conflictsByUnitId }: ContractUnitSelectableParams): boolean {
  return isUnitSelectableForContractPeriod({ unit, currentLinkedUnitId, conflictsByUnitId });
}

export function getContractUnitSelectionIssue({ units, propertyId, unitId, currentLinkedUnitId, conflictsByUnitId }: ContractUnitSelectionParams): string | null {
  return getUnitSelectionIssueForContractPeriod({ units, propertyId, unitId, currentLinkedUnitId, conflictsByUnitId });
}
