import type { Contract, Unit } from '@/types/domain';

export type ContractUnitOptionUnit = Pick<Unit, 'id' | 'property_id' | 'unit_number' | 'status' | 'rent_amount'>;
export type ContractUnitConflict = Readonly<{
  id: string;
  unit_id: string | null;
  start_date: string;
  end_date: string;
  status: Contract['status'];
}>;

export type UnitAvailabilityConflictMap = ReadonlyMap<string, ContractUnitConflict>;

export const operationallyBlockedUnitStatuses = new Set(['maintenance', 'reserved']);

export function getUnitTemporalConflict(
  conflictsByUnitId: UnitAvailabilityConflictMap | undefined,
  unitId: string,
): ContractUnitConflict | null {
  return conflictsByUnitId?.get(unitId) ?? null;
}

export function isUnitSelectableForContractPeriod({
  unit,
  currentLinkedUnitId,
  conflictsByUnitId,
}: Readonly<{
  unit: ContractUnitOptionUnit;
  currentLinkedUnitId?: string | null;
  conflictsByUnitId?: UnitAvailabilityConflictMap;
}>): boolean {
  if (operationallyBlockedUnitStatuses.has(unit.status) && unit.id !== currentLinkedUnitId) return false;
  return !getUnitTemporalConflict(conflictsByUnitId, unit.id);
}

export function getUnitSelectionIssueForContractPeriod({
  units,
  propertyId,
  unitId,
  currentLinkedUnitId,
  conflictsByUnitId,
}: Readonly<{
  units: readonly ContractUnitOptionUnit[];
  propertyId: string;
  unitId: string;
  currentLinkedUnitId?: string | null;
  conflictsByUnitId?: UnitAvailabilityConflictMap;
}>): string | null {
  const unit = units.find((candidate) => candidate.id === unitId);
  if (!unit) return 'اختر وحدة من قائمة العقار المحدد';
  if (unit.property_id !== propertyId) return 'الوحدة المختارة لا تتبع العقار المحدد';
  if (operationallyBlockedUnitStatuses.has(unit.status) && unit.id !== currentLinkedUnitId) {
    return unit.status === 'maintenance'
      ? 'لا يمكن التعاقد على وحدة تحت الصيانة حالياً.'
      : 'لا يمكن التعاقد على وحدة محجوزة تشغيلياً حالياً.';
  }
  const conflict = getUnitTemporalConflict(conflictsByUnitId, unit.id);
  if (conflict) return `لا يمكن اختيار هذه الوحدة لوجود عقد ${conflict.status === 'draft' ? 'مسودة' : 'نشط'} متداخل من ${conflict.start_date} إلى ${conflict.end_date}.`;
  return null;
}
