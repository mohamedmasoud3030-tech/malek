import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listOwnerSettlements } from './services/owner-settlements-service';
import { PAGED_READ_PAGE_SIZE } from '@/lib/paginatedRead';

const mocks = vi.hoisted(() => {
  const settlementsQuery: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of ['select', 'order', 'range']) settlementsQuery[name] = vi.fn();

  const lookupQuery: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of ['select', 'in']) lookupQuery[name] = vi.fn();

  const from = vi.fn((table: string) => (table === 'owner_settlements' ? settlementsQuery : lookupQuery));
  return { settlementsQuery, lookupQuery, from };
});

vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }));

const settlementRow = (index: number) => ({
  id: `settlement-${index}`,
  no: `S-${index}`,
  owner_id: 'owner-1',
  property_id: 'property-1',
  date: '2026-07-01',
  gross_collected: 100,
  office_fee: 10,
  owner_expenses: 0,
  tax_amount: 0,
  net_payable: 90,
  status: 'pending',
  created_at: '2026-07-01T00:00:00Z',
});

describe('listOwnerSettlements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.settlementsQuery.select.mockReturnValue(mocks.settlementsQuery);
    mocks.settlementsQuery.order.mockReturnValue(mocks.settlementsQuery);
    mocks.lookupQuery.select.mockReturnValue(mocks.lookupQuery);
    mocks.lookupQuery.in.mockResolvedValue({ data: [], error: null });
  });

  it('walks every page and applies a stable id tie-break after created_at', async () => {
    const fullPage = Array.from({ length: PAGED_READ_PAGE_SIZE }, (_, index) => settlementRow(index));
    mocks.settlementsQuery.range
      .mockResolvedValueOnce({ data: fullPage, error: null })
      .mockResolvedValueOnce({ data: [settlementRow(1000)], error: null });

    const result = await listOwnerSettlements();

    expect(result).toHaveLength(PAGED_READ_PAGE_SIZE + 1);
    // created_at ties are common (settlements batch-created together) —
    // pagination must not rely on created_at alone.
    expect(mocks.settlementsQuery.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(mocks.settlementsQuery.order).toHaveBeenCalledWith('id', { ascending: false });
    expect(mocks.settlementsQuery.range).toHaveBeenNthCalledWith(2, PAGED_READ_PAGE_SIZE, PAGED_READ_PAGE_SIZE * 2 - 1);
  });

  it('propagates query errors so partial settlements never reach owner statements or payout KPIs', async () => {
    mocks.settlementsQuery.range.mockResolvedValueOnce({ data: null, error: new Error('read failed') });

    await expect(listOwnerSettlements()).rejects.toThrow('read failed');
  });
});
