import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock,
}));

type QueryLogEntry = { table: string; method: string; args: unknown[] };
type TableResponses = Partial<Record<'invoices' | 'contracts' | 'properties' | 'people' | 'units', unknown[]>>;

function createQueryBuilder(table: string, responses: TableResponses, log: QueryLogEntry[]) {
  const builder = {
    select: vi.fn(() => builder),
    is: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn((...args: unknown[]) => {
      log.push({ table, method: 'in', args });
      return builder;
    }),
    order: vi.fn(() => builder),
    returns: vi.fn(() => {
      const rows = responses[table as keyof TableResponses] ?? [];
      const payload = { data: rows, error: null };
      return {
        range: vi.fn(async (from: number, to: number) => ({
          data: rows.slice(from, to + 1),
          error: null,
        })),
        then: (onFulfilled?: (value: typeof payload) => unknown, onRejected?: (reason: unknown) => unknown) =>
          Promise.resolve(payload).then(onFulfilled, onRejected),
      };
    }),
  };
  return builder;
}

function mockSupabaseTables(responses: TableResponses) {
  const log: QueryLogEntry[] = [];
  supabaseMock.from.mockImplementation((table: keyof TableResponses) => createQueryBuilder(table, responses, log));
  return log;
}

function invoiceFixture(overrides: Record<string, unknown>) {
  return {
    id: 'inv_x',
    contract_id: 'contract_1',
    issue_date: '2026-03-01',
    due_date: '2026-04-01',
    amount: 100,
    paid_amount: 0,
    status: 'UNPAID',
    deleted_at: null,
    contracts: { id: 'contract_1', property_id: 'property_1', tenant_id: 'tenant_1', unit_id: 'unit_1' },
    ...overrides,
  };
}

describe('arrears reports — invoice status casing visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('regression: modern UPPERCASE-status receivable invoices are NOT hidden from arrears', async () => {
    const invoices = [
      invoiceFixture({ id: 'inv_unpaid', status: 'UNPAID' }),
      invoiceFixture({ id: 'inv_partial', status: 'PARTIALLY_PAID', paid_amount: 40 }),
      invoiceFixture({ id: 'inv_legacy', status: 'issued', due_date: '2026-04-05' }),
      invoiceFixture({ id: 'inv_paid', status: 'PAID', paid_amount: 100 }),
    ];
    mockSupabaseTables({ invoices, people: [], properties: [], units: [] });
    const { getOverdueInvoicesReport } = await import('./arrears-reports-service');

    const report = await getOverdueInvoicesReport({ asOf: '2026-05-14' });

    expect(report.rows.map((row) => row.invoiceId)).toEqual(['inv_unpaid', 'inv_partial', 'inv_legacy']);
    expect(report.invoiceCount).toBe(3);
  });

  it('queries every live casing of receivable statuses so no row is filtered server-side', async () => {
    const log = mockSupabaseTables({ invoices: [], people: [], properties: [], units: [] });
    const { getOverdueInvoicesReport } = await import('./arrears-reports-service');

    await getOverdueInvoicesReport({ asOf: '2026-05-14' });

    const statusFilter = log.find((entry) => entry.table === 'invoices' && entry.method === 'in' && entry.args[0] === 'status');
    expect(statusFilter?.args[1]).toEqual(expect.arrayContaining(['issued', 'unpaid', 'UNPAID', 'partial', 'PARTIALLY_PAID', 'overdue', 'OVERDUE']));
  });
});
