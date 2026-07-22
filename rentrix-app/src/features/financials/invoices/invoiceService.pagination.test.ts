import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock,
}));

type Responses = { invoices?: unknown[]; contracts?: unknown[] };
type Call = { table: string; method: string; args: unknown[] };

function makeBuilder(table: string, responses: Responses, log: Call[]) {
  const builder: Record<string, unknown> = {};
  const record = (method: string) => (...args: unknown[]) => {
    log.push({ table, method, args });
    return builder;
  };
  for (const method of ['select', 'is', 'eq', 'gte', 'lte', 'in', 'or', 'order', 'range', 'single']) {
    builder[method] = record(method);
  }
  builder.returns = vi.fn(async () => {
    const data = responses[table as keyof Responses] ?? [];
    const count = table === 'invoices' ? (responses.invoices?.length ?? 0) : (responses.contracts?.length ?? 0);
    return { data, error: null, count: table === 'invoices' ? count : undefined };
  });
  return builder;
}

const invoiceRow = (id: string) => ({ id, contracts: { id: 'c1', property_id: 'p1', tenant_id: 't1' } });

describe('listInvoicesPaginated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies range, date, status, and tenant/property filters and returns the filtered total', async () => {
    const log: Call[] = [];
    const invoices = [invoiceRow('inv_1'), invoiceRow('inv_2')];
    const contracts = [{ id: 'c1' }];
    supabaseMock.from.mockImplementation((table: string) =>
      table === 'contracts' ? makeBuilder('contracts', { contracts }, log) : makeBuilder('invoices', { invoices }, log),
    );

    const { listInvoicesPaginated } = await import('./invoiceService');
    const result = await listInvoicesPaginated({
      status: 'unpaid',
      dateFrom: '2026-01-01',
      dateTo: '2026-12-31',
      tenantId: 't1',
      propertyId: 'p1',
      page: 2,
      pageSize: 10,
    });

    expect(result.rows).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
    expect(log).toEqual(expect.arrayContaining([
      { table: 'invoices', method: 'is', args: ['deleted_at', null] },
      { table: 'invoices', method: 'in', args: ['status', ['unpaid', 'UNPAID', 'issued']] },
      { table: 'invoices', method: 'gte', args: ['issue_date', '2026-01-01'] },
      { table: 'invoices', method: 'lte', args: ['issue_date', '2026-12-31'] },
      { table: 'invoices', method: 'in', args: ['contract_id', ['c1']] },
      { table: 'invoices', method: 'range', args: [10, 19] },
    ]));
    expect(log).toEqual(expect.arrayContaining([
      { table: 'contracts', method: 'eq', args: ['tenant_id', 't1'] },
      { table: 'contracts', method: 'eq', args: ['property_id', 'p1'] },
    ]));
  });

  it('skips contract resolution and the in() filter when no tenant/property filter is set', async () => {
    const log: Call[] = [];
    const invoices = [invoiceRow('inv_1')];
    supabaseMock.from.mockImplementation((table: string) => makeBuilder(table, { invoices }, log));

    const { listInvoicesPaginated } = await import('./invoiceService');
    const result = await listInvoicesPaginated({ status: 'all', page: 1, pageSize: 10 });

    expect(result.total).toBe(1);
    expect(log.some((entry) => entry.table === 'contracts')).toBe(false);
    expect(log.some((entry) => entry.method === 'in')).toBe(false);
  });

  it('uses a non-matching sentinel when tenant/property filters match no contract', async () => {
    const log: Call[] = [];
    const invoices: unknown[] = [];
    supabaseMock.from.mockImplementation((table: string) =>
      table === 'contracts' ? makeBuilder('contracts', { contracts: [] }, log) : makeBuilder('invoices', { invoices }, log),
    );

    const { listInvoicesPaginated } = await import('./invoiceService');
    const result = await listInvoicesPaginated({ status: 'all', tenantId: 't_missing', page: 1, pageSize: 10 });

    expect(result.rows).toHaveLength(0);
    expect(log).toEqual(expect.arrayContaining([
      { table: 'invoices', method: 'in', args: ['contract_id', ['__no_matching_contract__']] },
    ]));
  });
});
