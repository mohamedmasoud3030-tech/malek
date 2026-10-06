import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createOwnerSettlementDraft,
  previewOwnerSettlement,
} from './owner-settlements-service';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }));

describe('P1 — owner settlement client contract (server-derived, no client amounts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preview reads from calculate_owner_net_payout with the canonical argument names', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [{
        gross_collected: '1500.000',
        office_fee: '150.000',
        owner_expenses: '120.000',
        tax_amount: '0',
        net_payable: '1230.000',
        breakdown: { source: 'rpt_owner_statement parity', payments_count: 2 },
      }],
      error: null,
    });

    const preview = await previewOwnerSettlement({
      owner_id: 'owner-1',
      property_id: 'property-1',
      period_start: '2026-07-01',
      period_end: '2026-07-31',
    });

    expect(mocks.rpc).toHaveBeenCalledWith('calculate_owner_net_payout', {
      p_owner_id: 'owner-1',
      p_period_start: '2026-07-01',
      p_period_end: '2026-07-31',
      p_property_id: 'property-1',
    });
    expect(preview.net_payable).toBe(1230);
    expect(preview.gross_collected).toBe(1500);
    expect(preview.breakdown?.payments_count).toBe(2);
  });

  it('preview defaults property_id to null (owner-level scope) and surfaces server errors', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [{ gross_collected: 0, office_fee: 200, owner_expenses: 0, tax_amount: 0, net_payable: 0, breakdown: null }],
      error: null,
    });
    await previewOwnerSettlement({ owner_id: 'owner-2', period_start: '2026-07-01', period_end: '2026-07-31' });
    expect(mocks.rpc).toHaveBeenCalledWith('calculate_owner_net_payout', expect.objectContaining({ p_property_id: null }));

    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Authenticated app user is required.' } });
    await expect(
      previewOwnerSettlement({ owner_id: 'owner-2', period_start: '2026-07-01', period_end: '2026-07-31' }),
    ).rejects.toThrow(/Authenticated app user is required/);
  });

  it('create sends ONLY scope + the attempt request_id (+notes) — never any amount keys', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { settlement_id: 'settlement-9', net_payable: 1230 }, error: null });

    await createOwnerSettlementDraft({
      owner_id: 'owner-1',
      property_id: 'property-1',
      period_start: '2026-07-01',
      period_end: '2026-07-31',
      request_id: 'req-attempt-1',
      notes: 'تسوية يوليو',
    });

    expect(mocks.rpc).toHaveBeenCalledWith('create_owner_settlement_draft_atomic', {
      p_payload: {
        owner_id: 'owner-1',
        property_id: 'property-1',
        period_start: '2026-07-01',
        period_end: '2026-07-31',
        request_id: 'req-attempt-1',
        notes: 'تسوية يوليو',
      },
    });
    const sentPayload = mocks.rpc.mock.calls[0][1].p_payload as Record<string, unknown>;
    for (const banned of ['gross_collected', 'office_fee', 'owner_expenses', 'tax_amount', 'net_payable', 'vat']) {
      expect(sentPayload, `client must never send ${banned}`).not.toHaveProperty(banned);
    }
  });

  it('request_id is passed through verbatim so retries of the same attempt replay server-side', async () => {
    mocks.rpc.mockResolvedValue({ data: { settlement_id: 'settlement-9', idempotent: true }, error: null });
    const attempt = {
      owner_id: 'owner-1',
      property_id: 'property-1',
      period_start: '2026-07-01',
      period_end: '2026-07-31',
      request_id: 'req-stable-42',
    };
    await createOwnerSettlementDraft(attempt);
    await createOwnerSettlementDraft(attempt); // double-click / retry

    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc.mock.calls[0][1].p_payload.request_id).toBe('req-stable-42');
    expect(mocks.rpc.mock.calls[1][1].p_payload.request_id).toBe('req-stable-42');
  });
});
