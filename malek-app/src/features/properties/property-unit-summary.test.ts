import { describe, expect, it } from 'vitest';
import { summarizePropertyUnits, type PropertyUnitSummaryInput } from './property-unit-summary';

describe('summarizePropertyUnits', () => {
  it('counts units by status and totals expected rent from unit rent amounts', () => {
    const units: PropertyUnitSummaryInput[] = [
      { status: 'available', rent_amount: 1200 },
      { status: 'occupied', rent_amount: 1500 },
      { status: 'maintenance', rent_amount: null },
      { status: 'reserved', rent_amount: 900 },
      { status: 'occupied', rent_amount: 1100 },
    ];

    expect(summarizePropertyUnits(units)).toEqual({
      totalUnits: 5,
      availableUnits: 1,
      occupiedUnits: 2,
      maintenanceUnits: 1,
      reservedUnits: 1,
      expectedRentTotal: 4700,
    });
  });

  it('returns zero totals when a property has no units', () => {
    expect(summarizePropertyUnits([])).toEqual({
      totalUnits: 0,
      availableUnits: 0,
      occupiedUnits: 0,
      maintenanceUnits: 0,
      reservedUnits: 0,
      expectedRentTotal: 0,
    });
  });
});
