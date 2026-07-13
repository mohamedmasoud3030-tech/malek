import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listUnitContractConflicts } from './unitAvailabilityService';

const query = { select: vi.fn(), is: vi.fn(), in: vi.fn(), lte: vi.fn(), gte: vi.fn(), neq: vi.fn(), returns: vi.fn() };
vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn(() => query) } }));

beforeEach(() => {
  for (const fn of Object.values(query)) fn.mockReset();
  query.select.mockReturnValue(query); query.is.mockReturnValue(query); query.in.mockReturnValue(query); query.lte.mockReturnValue(query); query.gte.mockReturnValue(query); query.neq.mockReturnValue(query); query.returns.mockResolvedValue({ data: [], error: null });
});

describe('listUnitContractConflicts', () => {
  it('fetches overlapping draft and active contracts in one batched query', async () => {
    await listUnitContractConflicts({ unitIds: ['unit-1', 'unit-2', 'unit-1'], startDate: '2026-09-01', endDate: '2027-08-31' });
    expect(query.in).toHaveBeenCalledWith('unit_id', ['unit-1', 'unit-2']);
    expect(query.in).toHaveBeenCalledWith('status', ['draft', 'active']);
    expect(query.lte).toHaveBeenCalledWith('start_date', '2027-08-31');
    expect(query.gte).toHaveBeenCalledWith('end_date', '2026-09-01');
  });

  it('excludes the current contract when editing', async () => {
    await listUnitContractConflicts({ unitIds: ['unit-1'], startDate: '2026-09-01', endDate: '2027-08-31', excludedContractId: 'contract-1' });
    expect(query.neq).toHaveBeenCalledWith('id', 'contract-1');
  });
});
