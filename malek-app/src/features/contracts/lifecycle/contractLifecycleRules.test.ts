import { describe, expect, it } from 'vitest';
import {
  canActivateContract,
  canApproveContract,
  canRejectContract,
  canRenewContract,
  canSubmitContractForApproval,
  canTerminateContract,
  contractNextActionLabels,
  contractNextActionShortLabels,
  getContractNextAction,
  isContractApproved,
  isContractApprovalPending,
  isContractRejected,
} from './contractLifecycleRules';
import type { ContractDetail } from '../services/contractService';
import { contractRowFixtureDefaults } from '@/test/contractRowFixture';

function createContract(status: ContractDetail['status']): ContractDetail {
  return {
    ...contractRowFixtureDefaults,
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

describe('contract approval sub-state rules (S04-T03)', () => {
  const withApproval = (status: ContractDetail['status'], approvalStatus: string | null): ContractDetail => ({
    ...createContract(status),
    approval_status: approvalStatus,
    maker_signature: approvalStatus ? 'المُرسل' : null,
    submitted_at: approvalStatus ? '2026-01-10T09:00:00Z' : null,
    checker_signature: approvalStatus === 'APPROVED' || approvalStatus === 'REJECTED' ? 'المُعتمِد' : null,
    approved_at: approvalStatus === 'APPROVED' ? '2026-01-11T09:00:00Z' : null,
    rejected_at: approvalStatus === 'REJECTED' ? '2026-01-11T09:00:00Z' : null,
    rejection_reason: approvalStatus === 'REJECTED' ? 'بيانات ناقصة' : null,
  });

  it('submits a fresh draft but never an already-pending or approved one', () => {
    expect(canSubmitContractForApproval(withApproval('draft', null))).toBe(true);
    expect(canSubmitContractForApproval(withApproval('draft', 'PENDING'))).toBe(false);
    expect(canSubmitContractForApproval(withApproval('draft', 'APPROVED'))).toBe(false);
  });

  it('allows re-submitting a rejected draft for correction', () => {
    const rejected = withApproval('draft', 'REJECTED');
    expect(isContractRejected(rejected)).toBe(true);
    expect(canSubmitContractForApproval(rejected)).toBe(true);
  });

  it('approves/rejects only a pending draft', () => {
    const pending = withApproval('draft', 'PENDING');
    expect(isContractApprovalPending(pending)).toBe(true);
    expect(canApproveContract(pending)).toBe(true);
    expect(canRejectContract(pending)).toBe(true);

    const fresh = withApproval('draft', null);
    expect(canApproveContract(fresh)).toBe(false);
    expect(canRejectContract(fresh)).toBe(false);
  });

  it('activates only an approved draft and never a non-draft status', () => {
    const approved = withApproval('draft', 'APPROVED');
    expect(isContractApproved(approved)).toBe(true);
    expect(canActivateContract(approved)).toBe(true);

    expect(canActivateContract(withApproval('draft', 'PENDING'))).toBe(false);
    expect(canActivateContract(withApproval('active', 'APPROVED'))).toBe(false);
  });

  it('never offers approval actions on active/expired/terminated contracts', () => {
    for (const status of ['active', 'expired', 'terminated'] as const) {
      const contract = withApproval(status, null);
      expect(canSubmitContractForApproval(contract)).toBe(false);
      expect(canApproveContract(contract)).toBe(false);
      expect(canRejectContract(contract)).toBe(false);
      expect(canActivateContract(contract)).toBe(false);
    }
  });
});

describe('getContractNextAction (register next-step projection)', () => {
  // Pinned reference date so the expiry branch is exact, not clock-dependent.
  const today = new Date('2026-08-27T00:00:00');
  const withTerm = (overrides: Partial<ContractDetail>): ContractDetail => ({
    ...createContract('active'),
    end_date: '2027-12-31',
    ...overrides,
  });

  it('walks the approval chain one canonical step at a time', () => {
    const fresh = withTerm({ status: 'draft', approval_status: null });
    expect(getContractNextAction(fresh, today)).toBe('submit_for_approval');

    const pending = withTerm({ status: 'draft', approval_status: 'PENDING' });
    expect(getContractNextAction(pending, today)).toBe('approve_or_reject');

    const approved = withTerm({ status: 'draft', approval_status: 'APPROVED' });
    expect(getContractNextAction(approved, today)).toBe('activate');

    const rejected = withTerm({ status: 'draft', approval_status: 'REJECTED' });
    expect(getContractNextAction(rejected, today)).toBe('submit_for_approval');
  });

  it('recommends renewal only when the term is actually ending', () => {
    expect(getContractNextAction(withTerm({}), today)).toBeNull();
    expect(getContractNextAction(withTerm({ end_date: '2026-09-10' }), today)).toBe('renew');
    expect(getContractNextAction(withTerm({ status: 'expired', end_date: '2026-06-30' }), today)).toBe('renew');
  });

  it('prefers the short-stay extension over renewal while the stay is still running', () => {
    const shortStay = withTerm({ lease_mode: 'short_stay', end_date: '2026-09-10' });
    expect(getContractNextAction(shortStay, today)).toBe('extend_short_stay');

    // Once the stay has passed its end date the extension is no longer legal.
    const lapsed = withTerm({ lease_mode: 'short_stay', end_date: '2026-08-20' });
    expect(getContractNextAction(lapsed, today)).toBeNull();
  });

  it('never recommends termination and reports nothing for terminal contracts', () => {
    // Termination stays a discretionary menu action, never a suggested step.
    expect(getContractNextAction(withTerm({}), today)).toBeNull();
    expect(canTerminateContract(withTerm({}))).toBe(true);
    expect(getContractNextAction(withTerm({ status: 'terminated' }), today)).toBeNull();
  });

  it('keeps one label set for every canonical action', () => {
    const actions = Object.keys(contractNextActionLabels);
    expect(actions).toEqual(Object.keys(contractNextActionShortLabels));
    for (const action of actions) {
      expect(contractNextActionLabels[action as keyof typeof contractNextActionLabels].length).toBeGreaterThan(0);
    }
  });
});
