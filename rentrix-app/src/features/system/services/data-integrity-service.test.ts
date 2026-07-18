import { describe, expect, it } from 'vitest';
import {
  DATA_INTEGRITY_MAX_PAGES,
  DATA_INTEGRITY_PAGE_SIZE,
  buildDataIntegritySnapshot,
  fetchPaginatedRows,
} from './data-integrity-service';

function getCheck(result: ReturnType<typeof buildDataIntegritySnapshot>, id: string) {
  if (result.status !== 'available') throw new Error('expected available result');
  const check = result.snapshot.checks.find((entry) => entry.id === id);
  if (!check) throw new Error(`missing check: ${id}`);
  return check;
}

const baseInput = {
  properties: [{ id: 'prop-1', deleted_at: null }],
  units: [{ id: 'unit-1', property_id: 'prop-1', deleted_at: null }],
  people: [{ id: 'tenant-1', type: 'tenant', deleted_at: null }],
  contracts: [
    {
      id: 'contract-1',
      property_id: 'prop-1',
      unit_id: 'unit-1',
      tenant_id: 'tenant-1',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      deleted_at: null,
    },
  ],
  invoices: [{ id: 'invoice-1', contract_id: 'contract-1', amount: 100, paid_amount: 50, deleted_at: null }],
  owners: [{ id: 'owner-1', name: 'مالك', full_name: 'مالك', deleted_at: null }],
  propertyOwners: [{ property_id: 'prop-1', owner_id: 'owner-1', is_primary: true, starts_on: null, ends_on: null }],
  ownerAgreements: [{ property_id: 'prop-1', owner_id: 'owner-1', starts_on: '2026-01-01', ends_on: null }],
} as const;

describe('buildDataIntegritySnapshot', () => {
  it('reports all checks as ok for a fully consistent dataset', () => {
    const result = buildDataIntegritySnapshot(baseInput);

    expect(result.status).toBe('available');
    if (result.status !== 'available') return;

    expect(result.snapshot.checks).toHaveLength(11);
    for (const check of result.snapshot.checks) {
      expect(check.count).toBe(0);
      expect(check.severity).toBe('ok');
    }
  });

  it('flags properties that cannot create contracts because they have no owner agreement', () => {
    const result = buildDataIntegritySnapshot({ ...baseInput, ownerAgreements: [] });

    expect(getCheck(result, 'properties-without-owner-agreements').count).toBe(1);
  });

  it('flags stale owner projections and agreements not covered by ownership', () => {
    const result = buildDataIntegritySnapshot({
      ...baseInput,
      properties: [{ id: 'prop-1', owner_id: 'owner-2', deleted_at: null }],
      propertyOwners: [{ property_id: 'prop-1', owner_id: 'owner-1', is_primary: true, starts_on: '2026-06-01', ends_on: null }],
      ownerAgreements: [{ property_id: 'prop-1', owner_id: 'owner-1', starts_on: '2026-01-01', ends_on: null }],
    });

    expect(getCheck(result, 'owner-projection-mismatches').count).toBe(1);
    expect(getCheck(result, 'agreements-without-ownership').count).toBe(1);
  });

  it('flags stale compatibility names', () => {
    const result = buildDataIntegritySnapshot({
      ...baseInput,
      properties: [{ id: 'prop-1', owner_id: 'owner-1', name: 'قديم', title: 'حديث', deleted_at: null }],
      owners: [{ id: 'owner-1', name: 'قديم', full_name: 'حديث', deleted_at: null }],
    });

    expect(getCheck(result, 'owner-name-mismatches').count).toBe(1);
    expect(getCheck(result, 'property-name-mismatches').count).toBe(1);
  });

  it('flags units that reference a missing or soft-deleted property', () => {
    const result = buildDataIntegritySnapshot({
      ...baseInput,
      units: [{ id: 'unit-1', property_id: 'missing-property', deleted_at: null }],
    });

    const check = getCheck(result, 'orphan-units');
    expect(check.count).toBe(1);
    expect(check.severity).toBe('warning');
  });

  it('does not flag soft-deleted units as orphans', () => {
    const result = buildDataIntegritySnapshot({
      ...baseInput,
      units: [{ id: 'unit-1', property_id: 'missing-property', deleted_at: '2026-01-01T00:00:00Z' }],
    });

    expect(getCheck(result, 'orphan-units').count).toBe(0);
  });

  it('flags active contracts missing an active property or active tenant', () => {
    const missingProperty = buildDataIntegritySnapshot({
      ...baseInput,
      contracts: [{ ...baseInput.contracts[0], property_id: 'missing-property' }],
    });
    expect(getCheck(missingProperty, 'orphan-contracts').count).toBe(1);

    const missingTenant = buildDataIntegritySnapshot({
      ...baseInput,
      people: [{ id: 'tenant-1', type: 'owner', deleted_at: null }],
    });
    expect(getCheck(missingTenant, 'orphan-contracts').count).toBe(1);
  });

  it('flags contracts whose unit belongs to a different property', () => {
    const result = buildDataIntegritySnapshot({
      ...baseInput,
      properties: [...baseInput.properties, { id: 'prop-2', deleted_at: null }],
      units: [{ id: 'unit-1', property_id: 'prop-2', deleted_at: null }],
    });

    const check = getCheck(result, 'invalid-contract-units');
    expect(check.count).toBe(1);
    expect(check.severity).toBe('warning');
  });

  it('does not flag contracts with no unit assigned', () => {
    const result = buildDataIntegritySnapshot({
      ...baseInput,
      contracts: [{ ...baseInput.contracts[0], unit_id: null as unknown as string }],
    });

    expect(getCheck(result, 'invalid-contract-units').count).toBe(0);
  });

  it('flags contracts where the start date is after the end date', () => {
    const result = buildDataIntegritySnapshot({
      ...baseInput,
      contracts: [{ ...baseInput.contracts[0], start_date: '2026-12-31', end_date: '2026-01-01' }],
    });

    const check = getCheck(result, 'invalid-contract-dates');
    expect(check.count).toBe(1);
    expect(check.severity).toBe('warning');
  });

  it('flags invoices that reference a missing or soft-deleted contract', () => {
    const result = buildDataIntegritySnapshot({
      ...baseInput,
      invoices: [{ id: 'invoice-1', contract_id: 'missing-contract', amount: 100, paid_amount: 50, deleted_at: null }],
    });

    expect(getCheck(result, 'orphan-invoices').count).toBe(1);
  });

  it('flags invoices paid beyond their total amount', () => {
    const result = buildDataIntegritySnapshot({
      ...baseInput,
      invoices: [{ id: 'invoice-1', contract_id: 'contract-1', amount: 100, paid_amount: 150, deleted_at: null }],
    });

    const check = getCheck(result, 'overpaid-invoices');
    expect(check.count).toBe(1);
    expect(check.severity).toBe('warning');
  });

  it('ignores soft-deleted rows across all checks', () => {
    const result = buildDataIntegritySnapshot({
      properties: [{ id: 'prop-1', deleted_at: '2026-01-01T00:00:00Z' }],
      units: [{ id: 'unit-1', property_id: 'prop-1', deleted_at: '2026-01-01T00:00:00Z' }],
      people: [{ id: 'tenant-1', type: 'tenant', deleted_at: '2026-01-01T00:00:00Z' }],
      contracts: [{ ...baseInput.contracts[0], deleted_at: '2026-01-01T00:00:00Z' }],
      invoices: [{ id: 'invoice-1', contract_id: 'contract-1', amount: 100, paid_amount: 150, deleted_at: '2026-01-01T00:00:00Z' }],
    });

    if (result.status !== 'available') throw new Error('expected available result');
    for (const check of result.snapshot.checks) {
      expect(check.count).toBe(0);
    }
  });
});

describe('fetchPaginatedRows', () => {
  it('returns all rows across multiple pages when the final page is short', () => {
    const fullPage = Array.from({ length: DATA_INTEGRITY_PAGE_SIZE }, (_, index) => ({ id: `a-${index}` }));
    const lastPage = [{ id: 'final-row' }];
    const pages = [fullPage, lastPage];
    let call = 0;

    const result = async () =>
      fetchPaginatedRows(() => ({
        range: async () => {
          const page = pages[call] ?? [];
          call += 1;
          return { data: page, error: null };
        },
      }));

    return result().then((value) => {
      expect(value.status).toBe('available');
      if (value.status !== 'available') return;
      expect(value.rows).toHaveLength(DATA_INTEGRITY_PAGE_SIZE + 1);
      expect(value.rows.at(-1)).toEqual({ id: 'final-row' });
    });
  });

  it('returns unavailable when a page request errors', async () => {
    const result = await fetchPaginatedRows(() => ({
      range: async () => ({ data: null, error: new Error('boom') }),
    }));

    expect(result.status).toBe('unavailable');
  });

  it('returns unavailable when the dataset exceeds the safe browser page limit', async () => {
    const result = await fetchPaginatedRows(() => ({
      range: async () => ({
        data: Array.from({ length: DATA_INTEGRITY_PAGE_SIZE }, (_, index) => ({ id: `row-${index}` })),
        error: null,
      }),
    }));

    expect(result.status).toBe('unavailable');
  });

  it('respects the configured max page count', () => {
    expect(DATA_INTEGRITY_MAX_PAGES).toBeGreaterThan(0);
    expect(DATA_INTEGRITY_PAGE_SIZE).toBeGreaterThan(0);
  });
});
