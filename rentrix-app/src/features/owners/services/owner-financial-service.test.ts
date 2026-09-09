import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: rpcMock },
}));

import { getOwnerFinancialAuthority } from './owner-financial-service';

const OWNER = 'owner-0001';

/**
 * Mirrors the REAL `rpt_owner_financial_position` envelope.
 *
 * The canonical function returns the owner identity and derivation authority
 * under `meta` — never as root-level `owner_id`/`basis` keys. An earlier
 * fixture asserted the root-level shape, which let a client parser that read
 * `root.owner_id` pass unit tests while failing against every real response.
 * The fixture now matches the server so the contract cannot drift silently
 * again.
 */
function position(overrides: Record<string, unknown> = {}) {
  return {
    meta: {
      owner_id: OWNER,
      from: '2026-07-01',
      to: '2026-07-31',
      source: 'rpt_owner_financial_position',
      derivation_authority: 'calculate_owner_net_payout (ADR 0001)',
    },
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
      paid_cash: 2000,
      paid_cash_proven_total: 2000,
      paid_cash_evidence_missing_count: 0,
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
      .mockResolvedValueOnce({
        data: position({ meta: { ...position().meta, owner_id: 'other-owner' } }),
        error: null,
      })
      .mockResolvedValueOnce({ data: statement(), error: null });

    await expect(getOwnerFinancialAuthority(OWNER, '2026-07-01', '2026-07-31')).rejects.toThrow(
      'لا يخص المالك المطلوب',
    );
  });

  it('reads the owner identity from the canonical meta envelope the server emits', async () => {
    rpcMock
      .mockResolvedValueOnce({ data: position(), error: null })
      .mockResolvedValueOnce({ data: statement(), error: null });

    const authority = await getOwnerFinancialAuthority(OWNER, '2026-07-01', '2026-07-31');
    expect(authority.position.owner_id).toBe(OWNER);
    // The server states its derivation authority under meta; surface it rather
    // than inventing a basis label the server never sent.
    expect(authority.position.basis).toBe('calculate_owner_net_payout (ADR 0001)');
    expect(authority.position.operating_model).toBeNull();
  });

  it('fails closed when NO owner identity is provable anywhere in the response', async () => {
    const { meta: _meta, ...withoutMeta } = position();
    rpcMock
      .mockResolvedValueOnce({ data: withoutMeta, error: null })
      .mockResolvedValueOnce({ data: statement(), error: null });

    await expect(getOwnerFinancialAuthority(OWNER, '2026-07-01', '2026-07-31')).rejects.toThrow(
      'ناقصة المعرّف',
    );
  });

  it('still accepts a root-level owner identity for forward compatibility', async () => {
    const { meta: _meta, ...withoutMeta } = position();
    rpcMock
      .mockResolvedValueOnce({ data: { ...withoutMeta, owner_id: OWNER }, error: null })
      .mockResolvedValueOnce({ data: statement(), error: null });

    const authority = await getOwnerFinancialAuthority(OWNER, '2026-07-01', '2026-07-31');
    expect(authority.position.owner_id).toBe(OWNER);
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

describe('owner cash evidence parsing',()=>{
  beforeEach(()=>rpcMock.mockReset());
  it('preserves an unknown total and its separately identified proven subtotal',async()=>{
    const data=position();
    rpcMock.mockResolvedValueOnce({data:{...data,lifecycle_all_time:{...data.lifecycle_all_time,paid_cash:null,paid_cash_proven_total:1975,paid_cash_evidence_missing_count:1}},error:null}).mockResolvedValueOnce({data:statement(),error:null});
    expect((await getOwnerFinancialAuthority(OWNER,'2026-07-01','2026-07-31')).position.lifecycle_all_time).toMatchObject({paid_cash:null,paid_cash_proven_total:1975,paid_cash_evidence_missing_count:1});
  });
  it.each([null,'',false,[],{}])('does not coerce a missing/malformed required financial value (%j) to zero',async(value)=>{
    rpcMock.mockResolvedValueOnce({data:position({period:{...position().period,net_payable:value}}),error:null}).mockResolvedValueOnce({data:statement(),error:null});
    await expect(getOwnerFinancialAuthority(OWNER,'2026-07-01','2026-07-31')).rejects.toThrow('صافي مستحق الفترة');
  });
  it.each([
    {paid_cash:null,paid_cash_evidence_missing_count:0},
    {paid_cash:2000,paid_cash_evidence_missing_count:1},
    {paid_cash:1975,paid_cash_evidence_missing_count:0},
    {paid_cash:null,paid_cash_evidence_missing_count:4},
  ])('rejects contradictory cash completeness %j',async(override)=>{
    const data=position();
    rpcMock.mockResolvedValueOnce({data:{...data,lifecycle_all_time:{...data.lifecycle_all_time,...override}},error:null}).mockResolvedValueOnce({data:statement(),error:null});
    await expect(getOwnerFinancialAuthority(OWNER,'2026-07-01','2026-07-31')).rejects.toThrow('إثبات الصرف النقدي غير متسقة');
  });
});
