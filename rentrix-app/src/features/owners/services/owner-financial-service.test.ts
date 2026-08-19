import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: rpcMock },
}));

import { getOwnerFinancialAuthority } from './owner-financial-service';

const OWNER = 'owner-0001';

function position(overrides: Record<string, unknown> = {}) {
  return {
    owner_id: OWNER,
    basis: 'OWNER_AGENCY',
    operating_model: 'OWNER_AGENCY',
    period: {
      tenant_collections: 1000,
      management_fees: { amount: 100, breakdown: { rate: 0.1 } },
      owner_expenses: 50,
      fee_vat: 5,
      authorized_adjustments: 0,
      adjustments_note: null,
      net_payable: 845,
    },
    lifecycle_all_time: {
      settled_pending_net: 0,
      paid_net: 2000,
      remaining_payable: 845,
      draft_count: 1,
      approved_count: 0,
      paid_count: 3,
      cancelled_count: 1,
    },
    owner_funds: { held: 900 },
    ...overrides,
  };
}

function statement(overrides: Record<string, unknown> = {}) {
  return { total_gross: 12000, total_deductions: 3000, total_net: 9000, ...overrides };
}

describe('getOwnerFinancialAuthority', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('parses a valid server response and passes the requested owner id', async () => {
    rpcMock
      .mockResolvedValueOnce({ data: position(), error: null })
      .mockResolvedValueOnce({ data: statement(), error: null });

    const authority = await getOwnerFinancialAuthority(OWNER, '2026-07-01', '2026-07-31');

    expect(rpcMock).toHaveBeenNthCalledWith(1, 'rpt_owner_financial_position', {
      p_owner_id: OWNER,
      p_from: '2026-07-01',
      p_to: '2026-07-31',
    });
    expect(rpcMock).toHaveBeenNthCalledWith(2, 'rpt_owner_statement', {
      p_owner_id: OWNER,
      p_from: '2026-07-01',
      p_to: '2026-07-31',
    });
    expect(authority.position.owner_id).toBe(OWNER);
    expect(authority.position.period.net_payable).toBe(845);
    expect(authority.position.period.management_fees.breakdown).toEqual({ rate: 0.1 });
    expect(authority.statement.total_net).toBe(9000);
  });

  it('rejects a position that belongs to a different owner (cross-owner guard)', async () => {
    rpcMock
      .mockResolvedValueOnce({ data: position({ owner_id: 'other-owner' }), error: null })
      .mockResolvedValueOnce({ data: statement(), error: null });

    await expect(getOwnerFinancialAuthority(OWNER, '2026-07-01', '2026-07-31')).rejects.toThrow(
      'لا يخص المالك المطلوب',
    );
  });

  it('fails closed when a financial value is not a finite number', async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: position({ period: { ...position().period, net_payable: 'not-a-number' } }),
        error: null,
      })
      .mockResolvedValueOnce({ data: statement(), error: null });

    await expect(getOwnerFinancialAuthority(OWNER, '2026-07-01', '2026-07-31')).rejects.toThrow(
      'صافي مستحق الفترة',
    );
  });

  it('never derives the statement net client-side when the server omits it', async () => {
    rpcMock
      .mockResolvedValueOnce({ data: position(), error: null })
      .mockResolvedValueOnce({ data: { total_gross: 12000, total_deductions: 3000 }, error: null });

    const authority = await getOwnerFinancialAuthority(OWNER, '2026-07-01', '2026-07-31');
    expect(authority.statement.total_net).toBeNull();
  });

  it('surfaces the server error without rewriting it', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'RLS denied' } });

    await expect(getOwnerFinancialAuthority(OWNER, '2026-07-01', '2026-07-31')).rejects.toEqual({
      message: 'RLS denied',
    });
  });
});
