import { describe, expect, it } from 'vitest';
import {
  buildPropertyHealthRows,
  classifyPropertyHealth,
  PROPERTY_HEALTH_THRESHOLDS,
} from './property-health-signal';
import type { Unit } from '@/types/domain';
import type { Maintenance } from '@/features/maintenance/maintenance-service';
import type { VacantUnitAnalyticsRow } from '@/features/units/vacancy-analytics';

function makeUnit(id: string, propertyId: string, status: string): Unit {
  return {
    id,
    property_id: propertyId,
    unit_number: id,
    status,
    created_at: '2025-01-01T00:00:00Z',
    rent_amount: 100,
  } as unknown as Unit;
}

function makeMaintenance(id: string, propertyId: string, status: string, priority = 'medium'): Maintenance {
  return { id, property_id: propertyId, status, priority } as unknown as Maintenance;
}

function makeVacantRow(propertyId: string, daysVacant: number): VacantUnitAnalyticsRow {
  return {
    unitId: `unit-${propertyId}-${daysVacant}`,
    propertyId,
    unitNumber: '1',
    propertyTitle: 'عقار',
    referenceRent: null,
    lastContractEndDate: null,
    vacancySince: '2026-01-01',
    vacancySinceSource: 'unit_created',
    daysVacant,
  };
}

const titles = new Map([
  ['property-a', 'برج النور'],
  ['property-b', 'الخوير 18'],
  ['property-c', 'الغبرة 4'],
]);

describe('classifyPropertyHealth', () => {
  it('is fully explained by the documented thresholds', () => {
    const base = {
      propertyId: 'p', title: 'عقار', totalUnits: 10, occupiedUnits: 10, vacantUnits: 0,
      occupancyRate: 100, longestVacancyDays: 0, openMaintenance: 0, urgentMaintenance: 0,
    };
    expect(classifyPropertyHealth(base)).toBe('good');
    expect(classifyPropertyHealth({ ...base, occupancyRate: 95, vacantUnits: 1 })).toBe('watch');
    expect(classifyPropertyHealth({ ...base, occupancyRate: PROPERTY_HEALTH_THRESHOLDS.criticalOccupancyBelow - 1 })).toBe('critical');
    expect(classifyPropertyHealth({ ...base, longestVacancyDays: PROPERTY_HEALTH_THRESHOLDS.criticalVacancyDays })).toBe('critical');
    expect(classifyPropertyHealth({ ...base, urgentMaintenance: 1, openMaintenance: 1 })).toBe('critical');
    expect(classifyPropertyHealth({ ...base, openMaintenance: 2 })).toBe('watch');
  });
});

describe('buildPropertyHealthRows', () => {
  it('returns no health rows without units — nothing to classify', () => {
    expect(buildPropertyHealthRows({ units: undefined, vacantRows: [], maintenance: [], propertyTitles: titles })).toEqual([]);
  });

  it('classifies each property from occupancy, vacancy aging and maintenance pressure', () => {
    const rows = buildPropertyHealthRows({
      units: [
        makeUnit('u1', 'property-a', 'occupied'),
        makeUnit('u2', 'property-a', 'occupied'),
        makeUnit('u3', 'property-b', 'occupied'),
        makeUnit('u4', 'property-b', 'occupied'),
        makeUnit('u9', 'property-b', 'occupied'),
        makeUnit('u10', 'property-b', 'occupied'),
        makeUnit('u5', 'property-b', 'available'),
        makeUnit('u6', 'property-c', 'occupied'),
        makeUnit('u7', 'property-c', 'available'),
        makeUnit('u8', 'property-c', 'available'),
      ],
      vacantRows: [
        makeVacantRow('property-b', 20),
        makeVacantRow('property-c', 75),
        makeVacantRow('property-c', 10),
      ],
      maintenance: [
        makeMaintenance('m1', 'property-c', 'open', 'urgent'),
        makeMaintenance('m2', 'property-c', 'in_progress'),
        makeMaintenance('m3', 'property-a', 'resolved'),
      ],
      propertyTitles: titles,
    });

    expect(rows.map((row) => row.propertyId)).toEqual(['property-c', 'property-b', 'property-a']);

    const [worst, mid, best] = rows;
    expect(worst.status).toBe('critical'); // 38% occupancy + 75-day vacancy + urgent maintenance
    expect(worst.occupancyRate).toBe(33);
    expect(worst.longestVacancyDays).toBe(75);
    expect(worst.openMaintenance).toBe(2);
    expect(mid.status).toBe('watch'); // 80% occupancy with one 20-day vacancy
    expect(mid.vacantUnits).toBe(1);
    expect(mid.occupancyRate).toBe(80);
    expect(best.status).toBe('good'); // full occupancy, resolved maintenance does not count
    expect(best.openMaintenance).toBe(0);
  });

  it('keeps maintenance-status units out of both occupied and vacant counts', () => {
    const rows = buildPropertyHealthRows({
      units: [
        makeUnit('u1', 'property-a', 'occupied'),
        makeUnit('u2', 'property-a', 'maintenance'),
      ],
      vacantRows: [],
      maintenance: [],
      propertyTitles: titles,
    });
    expect(rows[0].occupiedUnits).toBe(1);
    expect(rows[0].vacantUnits).toBe(0);
    expect(rows[0].occupancyRate).toBe(50);
    expect(rows[0].status).toBe('critical'); // below the intervention occupancy threshold
  });
});
