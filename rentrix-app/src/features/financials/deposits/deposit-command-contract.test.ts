import { beforeEach, expect, it, vi } from 'vitest';
import { createTenantDeposit, refundDepositGoverned } from './deposit-service';
const backend = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(() => { throw new Error('read transport unavailable after commit'); }) }));
vi.mock('@/lib/supabase', () => ({ supabase: backend }));
beforeEach(() => vi.clearAllMocks());
const request_id = 'a1000000-0000-4000-8000-000000000001';

it('treats the committed RPC acknowledgement as success without a second fallible read', async () => {
  backend.rpc.mockResolvedValue({ data: { success: true, deposit_id: 'deposit', request_id }, error: null });
  expect(await createTenantDeposit({ contract_id: request_id, amount: 100, request_id })).toMatchObject({ deposit_id: 'deposit' });
  expect(backend.from).not.toHaveBeenCalled();
});

it('does not invent zero balances when a replay acknowledgement omits totals', async () => {
  backend.rpc.mockResolvedValue({ data: { success: true, idempotent: true, refund_event_id: 'refund', status: 'POSTED' }, error: null });
  const result = await refundDepositGoverned({ deposit_id: request_id, refund_amount: 25, payment_method: 'cash', refund_date: '2026-09-09', request_id });
  expect(result).toMatchObject({ refund_event_id: 'refund' });
  expect(result).not.toHaveProperty('remaining');
  expect(result).not.toHaveProperty('refunded');
});

it('rejects incomplete refund acknowledgements instead of reporting success', async () => {
  backend.rpc.mockResolvedValue({ data: {}, error: null });
  await expect(refundDepositGoverned({ deposit_id: request_id, refund_amount: 25, payment_method: 'cash', refund_date: '2026-09-09', request_id })).rejects.toThrow();
});
