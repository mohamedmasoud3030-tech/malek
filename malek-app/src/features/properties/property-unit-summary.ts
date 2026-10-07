import type { Unit } from '@/types/domain';

export type PropertyUnitSummaryInput = Pick<Unit, 'rent_amount' | 'status'>;

type PropertyUnitSummary = {
  totalUnits: number;
  availableUnits: number;
  occupiedUnits: number;
  maintenanceUnits: number;
  reservedUnits: number;
  expectedRentTotal: number;
};

export function summarizePropertyUnits(units: readonly PropertyUnitSummaryInput[]): PropertyUnitSummary {
  return units.reduce<PropertyUnitSummary>(
    (summary, unit) => {
      summary.totalUnits += 1;
      summary.expectedRentTotal += unit.rent_amount ?? 0;

      if (unit.status === 'available') {
        summary.availableUnits += 1;
      } else if (unit.status === 'occupied') {
        summary.occupiedUnits += 1;
      } else if (unit.status === 'maintenance') {
        summary.maintenanceUnits += 1;
      } else if (unit.status === 'reserved') {
        summary.reservedUnits += 1;
      }

      return summary;
    },
    {
      totalUnits: 0,
      availableUnits: 0,
      occupiedUnits: 0,
      maintenanceUnits: 0,
      reservedUnits: 0,
      expectedRentTotal: 0,
    },
  );
}
