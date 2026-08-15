// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContractDetail } from '../services/contractService';
import { ContractApprovalSection } from './contract-approval-workflow';
import { contractRowFixtureDefaults } from '@/test/contractRowFixture';

afterEach(() => cleanup());

vi.mock('../useContracts', () => ({
  useSubmitContractForApproval: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useApproveContract: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useRejectContract: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useActivateContract: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

function makeContract(overrides: Partial<ContractDetail>): ContractDetail {
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
    status: 'draft',
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
    ...overrides,
  };
}

describe('ContractApprovalSection', () => {
  it('offers submission for a fresh draft', () => {
    render(<ContractApprovalSection contract={makeContract({})} />);
    expect(screen.getByRole('button', { name: /إرسال للاعتماد/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /تفعيل العقد/ })).toBeNull();
  });

  it('shows approve/reject for a pending draft and the maker evidence', () => {
    render(
      <ContractApprovalSection
        contract={makeContract({ approval_status: 'PENDING', maker_signature: 'محمد', submitted_at: '2026-01-10T09:00:00Z' })}
      />,
    );
    expect(screen.getByRole('button', { name: /اعتماد$/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /رفض/ })).toBeTruthy();
    expect(screen.getByText(/محمد/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /إرسال للاعتماد/ })).toBeNull();
  });

  it('offers activation for an approved draft with checker evidence', () => {
    render(
      <ContractApprovalSection
        contract={makeContract({
          approval_status: 'APPROVED',
          maker_signature: 'محمد',
          checker_signature: 'خالد',
          submitted_at: '2026-01-10T09:00:00Z',
          approved_at: '2026-01-11T09:00:00Z',
        })}
      />,
    );
    expect(screen.getByRole('button', { name: /تفعيل العقد/ })).toBeTruthy();
    expect(screen.getByText(/خالد/)).toBeTruthy();
  });

  it('surfaces the rejection reason and allows re-submission', () => {
    render(
      <ContractApprovalSection
        contract={makeContract({ approval_status: 'REJECTED', maker_signature: 'محمد', checker_signature: 'خالد', rejection_reason: 'بيانات ناقصة' })}
      />,
    );
    expect(screen.getByText(/بيانات ناقصة/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /إرسال للاعتماد/ })).toBeTruthy();
  });

  it('shows the frozen agreement snapshot on an active contract and hides approval actions', () => {
    render(
      <ContractApprovalSection
        contract={makeContract({
          status: 'active',
          approval_status: 'APPROVED',
          collection_role_snapshot: 'OWNER_IS_CREDITOR',
          operating_model_snapshot: 'OWNER_AGENCY',
        })}
      />,
    );
    expect(screen.getByText(/تجميد لقطة الاتفاقية/)).toBeTruthy();
    expect(screen.getByText(/OWNER_IS_CREDITOR/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /اعتماد|إرسال|تفعيل|رفض/ })).toBeNull();
  });

  it('renders nothing for expired/terminated contracts', () => {
    const { container } = render(<ContractApprovalSection contract={makeContract({ status: 'expired' })} />);
    expect(container.firstChild).toBeNull();
  });
});
