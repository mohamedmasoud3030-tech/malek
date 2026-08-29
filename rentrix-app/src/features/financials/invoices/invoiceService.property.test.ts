import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock,
}));

type Call = { table: string; method: string; args: unknown[] };

function makePagedBuilder(table: string, rows: unknown[], log: Call[]) {
  const builder: Record<string, unknown> = {};
  const record = (method: string) => (...args: unknown[]) => {
    log.push({ table, method, args });
    return builder;
  };
  for (const method of ['select', 'is', 'eq', 'gte', 'lte', 'in', 'or', 'order', 'single']) {
    builder[method] = record(method);
  }
  builder.range = vi.fn(async (from: number, to: number) => {
    log.push({ table, method: 'range', args: [from, to] });
    return { data: rows.slice(from, to + 1), error: null };
  });
  return builder;
}

describe('listInvoicesForProperty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters invoices through the contract inner join instead of downloading the company table', async () => {
    const log: Call[] = [];
    const invoices = [{ id: 'inv_1', contracts: { id: 'c1', property_id: 'p1', tenant_id: 't1' } }];
    supabaseMock.from.mockImplementation((table: string) => makePagedBuilder(table, invoices, log));

    const { listInvoicesForProperty } = await import('./invoiceService');
    await expect(listInvoicesForProperty('p1')).resolves.toEqual(invoices);

    expect(supabaseMock.from).toHaveBeenCalledTimes(1);
    expect(log).toEqual(expect.arrayContaining([
      {
        table: 'invoices',
        method: 'select',
        args: ['*, contracts:contract_id!inner(id,property_id,tenant_id,properties:properties!contracts_property_id_fkey(id,title),units:units!contracts_unit_id_fkey(id,unit_number),people:people!contracts_tenant_id_fkey(id,full_name,phone))'],
      },
      { table: 'invoices', method: 'is', args: ['deleted_at', null] },
      { table: 'invoices', method: 'is', args: ['contracts.deleted_at', null] },
      { table: 'invoices', method: 'eq', args: ['contracts.property_id', 'p1'] },
      { table: 'invoices', method: 'range', args: [0, 999] },
    ]));
    expect(log.some((entry) => entry.method === 'in' && entry.args[0] === 'contract_id')).toBe(false);
  });
});
