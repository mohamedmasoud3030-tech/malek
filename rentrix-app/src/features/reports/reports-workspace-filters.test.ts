import { afterEach, describe, expect, it, vi } from 'vitest';
import { getInitialReportsFilters } from './reports-workspace-filters';

describe('reports contextual deep-link filters', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('hydrates entity and period scope from a contextual report link', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T08:00:00.000Z'));

    expect(getInitialReportsFilters({
      from: '2026-07-01',
      to: '2026-07-31',
      asOf: '2026-07-31',
      propertyId: 'property-1',
      unitId: 'unit-2',
      tenantId: 'tenant-3',
      ownerId: 'owner-4',
      contractId: 'contract-5',
      costCenterId: 'cost-center-6',
      section: 'analytics',
      view: 'overdue',
    })).toMatchObject({
      from: '2026-07-01',
      to: '2026-07-31',
      asOf: '2026-07-31',
      propertyId: 'property-1',
      unitId: 'unit-2',
      tenantId: 'tenant-3',
      ownerId: 'owner-4',
      contractId: 'contract-5',
      costCenterId: 'cost-center-6',
      status: 'all',
    });
  });

  it('rejects malformed or reversed date ranges while preserving contextual entity scope', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T08:00:00.000Z'));

    const filters = getInitialReportsFilters({
      from: '2026-09-30',
      to: '2026-09-01',
      asOf: 'not-a-date',
      tenantId: 'tenant-7',
    });

    expect(filters.from).toBe('2026-08-01');
    expect(filters.to).toBe('2026-08-24');
    expect(filters.asOf).toBe('2026-08-24');
    expect(filters.tenantId).toBe('tenant-7');
  });
});
