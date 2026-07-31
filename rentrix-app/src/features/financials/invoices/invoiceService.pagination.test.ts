import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock,
}));

type Responses = { invoices?: unknown[] };
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
    const data = responses.invoices ?? [];
    return { data, error: null, count: data.length };
  });
  return builder;
}

const invoiceRow = (id: string) => ({ id, contracts: { id: 'c1', property_id: 'p1', tenant_id: 't1' } });

describe('listInvoicesPaginated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters tenant/property through one server-side inner join and preserves exact pagination', async () => {
    const log: Call[] = [];
    const invoices = [invoiceRow('inv_1'), invoiceRow('inv_2')];
    supabaseMock.from.mockImplementation((table: string) => makeBuilder(table, { invoices }, log));

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

    expect(result).toEqual({ rows: invoices, total: 2, page: 2, pageSize: 10 });
    expect(supabaseMock.from).toHaveBeenCalledTimes(1);
    expect(supabaseMock.from).toHaveBeenCalledWith('invoices');
    expect(log).toEqual(expect.arrayContaining([
      {
        table: 'invoices',
        method: 'select',
        args: ['*, contracts:contract_id!inner(id,property_id,tenant_id)', { count: 'exact' }],
      },
      { table: 'invoices', method: 'is', args: ['deleted_at', null] },
      { table: 'invoices', method: 'is', args: ['contracts.deleted_at', null] },
      { table: 'invoices', method: 'in', args: ['status', ['unpaid', 'UNPAID', 'issued']] },
      { table: 'invoices', method: 'gte', args: ['issue_date', '2026-01-01'] },
      { table: 'invoices', method: 'lte', args: ['issue_date', '2026-12-31'] },
      { table: 'invoices', method: 'eq', args: ['contracts.tenant_id', 't1'] },
      { table: 'invoices', method: 'eq', args: ['contracts.property_id', 'p1'] },
      { table: 'invoices', method: 'order', args: ['due_date', { ascending: false }] },
      { table: 'invoices', method: 'order', args: ['id', { ascending: false }] },
      { table: 'invoices', method: 'range', args: [10, 19] },
    ]));
    expect(log.some((entry) => entry.method === 'in' && entry.args[0] === 'contract_id')).toBe(false);
  });

  it('uses the normal relationship select when no tenant/property filter is set', async () => {
    const log: Call[] = [];
    const invoices = [invoiceRow('inv_1')];
    supabaseMock.from.mockImplementation((table: string) => makeBuilder(table, { invoices }, log));

    const { listInvoicesPaginated } = await import('./invoiceService');
    const result = await listInvoicesPaginated({ status: 'all', page: 1, pageSize: 10 });

    expect(result.total).toBe(1);
    expect(supabaseMock.from).toHaveBeenCalledTimes(1);
    expect(log).toEqual(expect.arrayContaining([
      {
        table: 'invoices',
        method: 'select',
        args: ['*, contracts:contract_id(id,property_id,tenant_id)', { count: 'exact' }],
      },
      { table: 'invoices', method: 'range', args: [0, 9] },
    ]));
    expect(log.some((entry) => entry.args[0] === 'contracts.deleted_at')).toBe(false);
    expect(log.some((entry) => entry.args[0] === 'contracts.tenant_id')).toBe(false);
    expect(log.some((entry) => entry.args[0] === 'contracts.property_id')).toBe(false);
  });

  it('returns the server-filtered empty page without a client-side sentinel query', async () => {
    const log: Call[] = [];
    supabaseMock.from.mockImplementation((table: string) => makeBuilder(table, { invoices: [] }, log));

    const { listInvoicesPaginated } = await import('./invoiceService');
    const result = await listInvoicesPaginated({ status: 'all', tenantId: 't_missing', page: 1, pageSize: 10 });

    expect(result).toEqual({ rows: [], total: 0, page: 1, pageSize: 10 });
    expect(supabaseMock.from).toHaveBeenCalledTimes(1);
    expect(log).toEqual(expect.arrayContaining([
      { table: 'invoices', method: 'eq', args: ['contracts.tenant_id', 't_missing'] },
      { table: 'invoices', method: 'range', args: [0, 9] },
    ]));
    expect(log.some((entry) => entry.method === 'in' && entry.args[0] === 'contract_id')).toBe(false);
    expect(JSON.stringify(log)).not.toContain('__no_matching_contract__');
  });
});
