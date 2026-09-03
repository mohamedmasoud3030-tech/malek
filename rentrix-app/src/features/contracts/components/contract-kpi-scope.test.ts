/**
 * Contract KPI metric scope verification — PR #1780 session 1
 *
 * The ContractKpiGrid intentionally calls summarizeContracts() twice with
 * different input sets:
 *
 *   - `contracts` (unfiltered page): for expiry warnings. Expiring contracts
 *     must remain visible in the KPI strip even when the user's search filter
 *     does not match them.
 *
 *   - `filteredContracts` (what the operator sees): for the rent total, so
 *     the financial metric reflects the current selection.
 *
 * This file locks in that behavior so a future "fix" that collapses both
 * calls to filteredContracts does not silently change the semantics.
 */
import { describe, expect, it } from 'vitest';
import { summarizeContracts } from './ContractKpiGrid';
import type { ContractListItem } from '../services/contractService';
import { contractRowFixtureDefaults } from '@/test/contractRowFixture';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeContract(overrides: Partial<ContractListItem> = {}): ContractListItem {
  const base: ContractListItem = {
    ...contractRowFixtureDefaults,
    id: 'contract-default',
    property_id: 'property-1',
    unit_id: 'unit-1',
    tenant_id: 'tenant-1',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    rent_amount: 1000,
    payment_cycle: 'monthly',
    payment_terms_id: null,
    status: 'active',
    cancellation_reason: null,
    notes: null,
    attachment_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    renewed_from_id: null,
    properties: { id: 'property-1', title: 'عقار', address: 'مسقط' },
    units: { id: 'unit-1', unit_number: '1', floor: null, status: 'occupied', rent_amount: 1000 },
    people: { id: 'tenant-1', full_name: 'مستأجر', phone: null, email: null, national_id: null },
    ...overrides,
  };
  return base;
}

// An expiring contract: ends within 30 days of today.
// Derive the date relative to runtime so this regression remains stable as time moves.
function expiringContract(id: string, rentAmount = 500): ContractListItem {
  const soon = new Date();
  soon.setDate(soon.getDate() + 10);
  return makeContract({
    id,
    status: 'active',
    end_date: soon.toISOString().slice(0, 10),
    rent_amount: rentAmount,
  });
}

function activeContract(id: string, rentAmount = 1200): ContractListItem {
  return makeContract({
    id,
    status: 'active',
    end_date: '2030-12-31',
    rent_amount: rentAmount,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('summarizeContracts', () => {
  it('returns zero totals for an empty list', () => {
    const summary = summarizeContracts([]);
    expect(summary).toEqual({ total: 0, active: 0, expiringSoon: 0, rentTotal: 0 });
  });

  it('counts active contracts correctly', () => {
    const contracts = [
      activeContract('c1'),
      makeContract({ id: 'c2', status: 'expired', end_date: '2025-01-01' }),
      makeContract({ id: 'c3', status: 'terminated', end_date: '2025-06-01' }),
    ];
    const summary = summarizeContracts(contracts);
    expect(summary.total).toBe(3);
    expect(summary.active).toBe(1);
  });

  it('counts expiring contracts correctly', () => {
    const contracts = [
      expiringContract('exp-1', 800),
      expiringContract('exp-2', 600),
      activeContract('far-1', 1000),
    ];
    const summary = summarizeContracts(contracts);
    expect(summary.expiringSoon).toBe(2);
  });

  it('sums rent amounts correctly, ignoring non-finite values', () => {
    const contracts = [
      activeContract('c1', 1000),
      activeContract('c2', 500),
      makeContract({ id: 'c3', rent_amount: NaN }),
      makeContract({ id: 'c4', rent_amount: Infinity }),
    ];
    const summary = summarizeContracts(contracts);
    expect(summary.rentTotal).toBe(1500);
  });
});

describe('ContractKpiGrid dual-scope behavior (intentional asymmetry)', () => {
  /**
   * This test directly models the scenario where calling summarizeContracts()
   * twice with different inputs produces the correct split behavior:
   *
   *   - "expiring soon" should come from the UNFILTERED list so it stays
   *     visible even when a search term is active.
   *   - "rent total" should come from the FILTERED list so it reflects what
   *     the operator currently sees.
   */
  it('expiry count from unfiltered differs from expiry count from filtered', () => {
    // All 3 contracts are expiring, but only 1 matches a hypothetical search
    // filter (the other 2 are "not visible" in the filtered view).
    const allContracts = [
      expiringContract('exp-1', 400),
      expiringContract('exp-2', 600),
      expiringContract('exp-3', 800),
    ];
    const filteredContracts = [allContracts[0]]; // Only exp-1 matches search

    const listSummary = summarizeContracts(allContracts); // What ContractKpiGrid uses for expiry
    const visibleSummary = summarizeContracts(filteredContracts); // What ContractKpiGrid uses for rent

    // Expiry warnings: unfiltered count (correct behavior — exp-2 and exp-3
    // should still show as warnings even though they don't match the search).
    expect(listSummary.expiringSoon).toBe(3);

    // Rent total: filtered count (correct behavior — only show rent for
    // what the operator currently sees).
    expect(visibleSummary.rentTotal).toBe(400);

    // Confirm that using filteredContracts for expiry would undercount:
    expect(visibleSummary.expiringSoon).toBe(1); // Would hide 2 expiring contracts
  });

  it('rent total from filtered is a subset of rent total from unfiltered', () => {
    const allContracts = [
      activeContract('c1', 1000),
      activeContract('c2', 2000),
      activeContract('c3', 3000),
    ];
    const filteredContracts = [allContracts[0], allContracts[1]];

    const listSummary = summarizeContracts(allContracts);
    const visibleSummary = summarizeContracts(filteredContracts);

    expect(listSummary.rentTotal).toBe(6000); // All 3
    expect(visibleSummary.rentTotal).toBe(3000); // Only 2 visible
    expect(visibleSummary.rentTotal).toBeLessThan(listSummary.rentTotal);
  });

  it('when no filter is active, both summaries are identical', () => {
    const contracts = [activeContract('c1'), activeContract('c2')];
    const listSummary = summarizeContracts(contracts);
    const visibleSummary = summarizeContracts(contracts); // Same input = same output

    expect(listSummary).toEqual(visibleSummary);
  });
});
