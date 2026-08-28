import { describe, expect, it } from 'vitest';
import type { ContractListItem } from '@/features/contracts/services/contractService';
import { contractRowFixtureDefaults } from '@/test/contractRowFixture';
import type { Unit } from '@/types/domain';
import { buildVacancyAnalytics } from './vacancy-analytics';

function unit(overrides: Partial<Unit> & { id: string }): Unit {
  return {
    property_id: 'property-1',
    unit_number: '1',
    floor: null,
    status: 'available',
    rent_amount: 250,
    notes: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Unit;
}

function contract(overrides: Partial<ContractListItem> & { id: string; unit_id: string }): ContractListItem {
  return {
    ...contractRowFixtureDefaults,
    id: overrides.id,
    property_id: 'property-1',
    unit_id: overrides.unit_id,
    tenant_id: 'tenant-1',
    start_date: '2026-01-01',
    end_date: '2026-08-01',
    rent_amount: 250,
    payment_cycle: 'monthly',
    status: 'expired',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    properties: { id: 'property-1', title: 'برج الخليج', address: null },
    units: { id: overrides.unit_id, unit_number: overrides.unit_id, floor: null, status: 'available', rent_amount: 250 },
    people: { id: 'tenant-1', full_name: 'سالم', phone: null, email: null, national_id: null },
    ...overrides,
    agreement_id: overrides.agreement_id ?? null,
  } as ContractListItem;
}

const titles = new Map([['property-1', 'برج الخليج']]);

describe('vacancy analytics', () => {
  it('counts only available units as vacant and measures vacancy from the latest lease end', () => {
    const analytics = buildVacancyAnalytics(
      [
        unit({ id: 'unit-a', unit_number: '101' }),
        unit({ id: 'unit-b', unit_number: '102', created_at: '2026-08-18T00:00:00.000Z', rent_amount: 300 }),
        unit({ id: 'unit-c', status: 'maintenance' }),
        unit({ id: 'unit-d', status: 'reserved' }),
      ],
      [contract({ id: 'ended-a', unit_id: 'unit-a', end_date: '2026-08-08', updated_at: '2026-08-08T00:00:00.000Z' })],
      titles,
      '2026-08-28',
    );

    expect(analytics.availableUnits).toBe(2);
    expect(analytics.nonRentableUnits).toBe(2);
    expect(analytics.vacantRows.map((row) => row.unitId)).toEqual(['unit-a', 'unit-b']);
    expect(analytics.vacantRows[0]).toMatchObject({ unitId: 'unit-a', daysVacant: 20, lastContractEndDate: '2026-08-08', vacancySinceSource: 'contract_end' });
    expect(analytics.vacantRows[1]).toMatchObject({ unitId: 'unit-b', daysVacant: 10, lastContractEndDate: null, vacancySinceSource: 'unit_created' });
    expect(analytics.averageVacancyDays).toBe(15);
    expect(analytics.referenceVacantRent).toBe(550);
  });

  it('uses the termination timestamp as the effective vacancy start when a lease ended early', () => {
    const analytics = buildVacancyAnalytics(
      [unit({ id: 'unit-a' })],
      [contract({ id: 'terminated-a', unit_id: 'unit-a', status: 'terminated', end_date: '2026-12-31', updated_at: '2026-08-20T12:00:00.000Z' })],
      titles,
      '2026-08-28',
    );

    expect(analytics.vacantRows[0]).toMatchObject({ lastContractEndDate: '2026-08-20', daysVacant: 8 });
  });

  it('compares current occupancy with contract coverage at the previous month end', () => {
    const analytics = buildVacancyAnalytics(
      [
        unit({ id: 'unit-a', status: 'occupied' }),
        unit({ id: 'unit-b', status: 'available' }),
        unit({ id: 'unit-c', status: 'maintenance' }),
      ],
      [
        contract({ id: 'history-a', unit_id: 'unit-a', start_date: '2026-01-01', end_date: '2026-12-31', status: 'active' }),
        contract({ id: 'history-b', unit_id: 'unit-b', start_date: '2026-02-01', end_date: '2026-08-10', updated_at: '2026-08-10T00:00:00.000Z' }),
      ],
      titles,
      '2026-08-28',
    );

    expect(analytics.previousMonthEnd).toBe('2026-07-31');
    expect(analytics.occupancyRate).toBeCloseTo(33.333, 2);
    expect(analytics.previousMonthOccupancyRate).toBeCloseTo(66.666, 2);
    expect(analytics.occupancyChangePoints).toBeCloseTo(-33.333, 2);
  });

  it('flags near-expiry contracts only when no committed successor or renewal exists', () => {
    const analytics = buildVacancyAnalytics(
      [unit({ id: 'unit-a', status: 'occupied' }), unit({ id: 'unit-b', status: 'occupied' })],
      [
        contract({ id: 'risk-a', unit_id: 'unit-a', status: 'active', end_date: '2026-09-10' }),
        contract({ id: 'renewed-b', unit_id: 'unit-b', status: 'active', end_date: '2026-09-15' }),
        contract({ id: 'successor-b', unit_id: 'unit-b', status: 'active', start_date: '2026-09-16', end_date: '2027-09-15', renewed_from_id: 'renewed-b' }),
      ],
      titles,
      '2026-08-28',
    );

    expect(analytics.vacancyRiskRows).toHaveLength(1);
    expect(analytics.vacancyRiskRows[0]).toMatchObject({ contractId: 'risk-a', unitId: 'unit-a', endDate: '2026-09-10', daysRemaining: 13 });
  });
});
