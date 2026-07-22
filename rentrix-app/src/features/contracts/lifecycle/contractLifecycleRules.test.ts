import { describe, expect, it } from 'vitest';
import { canRenewContract, canTerminateContract } from './contractLifecycleRules';
import type { ContractDetail } from '../services/contractService';

function createContract(status: ContractDetail['status']): ContractDetail {
  return {
    id: 'contract-1',
    property_id: 'property-1',
    unit_id: 'unit-1',
    tenant_id: 'tenant-1',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    rent_amount: 1200,
    payment_cycle: 'monthly',
    payment_terms_id: null,
    status,
    cancellation_reason: null,
    renewed_from_id: null,
    notes: null,
    attachment_url: null,
    agreement_id: null,
    deleted_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    properties: null,
    units: null,
    people: null,
    renewed_from: null,
  };
}

describe('contract lifecycle rules with stored status casings', () => {
  it('offers renew/terminate for modern active contracts', () => {
    const contract = createContract('active');
    expect(canRenewContract(contract)).toBe(true);
    expect(canTerminateContract(contract)).toBe(true);
  });

  it('keeps renew/terminate available for legacy ACTIVE rows', () => {
    // Live rows may hold 'ACTIVE' (allowed by the contracts CHECK constraint).
    const contract = createContract('ACTIVE' as ContractDetail['status']);
    expect(canRenewContract(contract)).toBe(true);
    expect(canTerminateContract(contract)).toBe(true);
  });

  it('allows renewing legacy ENDED rows (canonical expired) but not terminating them', () => {
    const contract = createContract('ENDED' as ContractDetail['status']);
    expect(canRenewContract(contract)).toBe(true);
    expect(canTerminateContract(contract)).toBe(false);
  });

  it('allows terminating drafts and blocks lifecycle actions on terminated contracts', () => {
    const draft = createContract('draft');
    expect(canRenewContract(draft)).toBe(false);
    expect(canTerminateContract(draft)).toBe(true);

    const terminated = createContract('terminated');
    expect(canRenewContract(terminated)).toBe(false);
    expect(canTerminateContract(terminated)).toBe(false);
  });
});
