import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const builders = new Map<string, Record<string, ReturnType<typeof vi.fn>>>();
  const from = vi.fn((table: string) => {
    const existing = builders.get(table);
    if (existing) return existing;
    const query: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const name of ['select', 'is', 'eq', 'in', 'not', 'lte', 'gte', 'order', 'limit', 'returns', 'range']) {
      query[name] = vi.fn();
    }
    builders.set(table, query);
    return query;
  });
  return { builders, from };
});

vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }));

function resetBuilders() {
  mocks.builders.clear();
  mocks.from.mockClear();
}

function wireQuery(table: string, rows: unknown[]) {
  const query = mocks.from(table);
  for (const name of ['select', 'is', 'eq', 'in', 'not', 'lte', 'gte', 'order', 'limit', 'returns']) {
    query[name].mockReturnValue(query);
  }
  query.range.mockResolvedValue({ data: rows, error: null });
  query.returns.mockResolvedValue({ data: rows, error: null });
  return query;
}

describe('buildAiAssistantContext cost', () => {
  beforeEach(() => {
    resetBuilders();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T12:00:00.000Z'));
  });

  it('loads invoices once and expenses once, then sends only aggregates plus a top-25 list', async () => {
    wireQuery('invoices', [
      { id: 'inv-paid-shape', contract_id: 'c1', due_date: '2026-07-01', amount: 100, paid_amount: 0, status: 'UNPAID', deleted_at: null },
      { id: 'inv-recent', contract_id: 'c1', due_date: '2026-08-10', amount: 50, paid_amount: 10, status: 'PARTIALLY_PAID', deleted_at: null },
    ]);
    wireQuery('contracts', []);
    wireQuery('properties', [{ id: 'p1', status: 'active', deleted_at: null }]);
    wireQuery('units', [{ id: 'u1', status: 'occupied', deleted_at: null }]);
    wireQuery('payments', [{ id: 'pay1', amount: 10, payment_date: '2026-08-10', status: 'POSTED', deleted_at: null }]);
    wireQuery('expenses', [
      { id: 'exp90', amount: 20, expense_date: '2026-06-01', deleted_at: null },
      { id: 'exp30', amount: 5, expense_date: '2026-08-01', deleted_at: null },
    ]);
    mocks.from.mockClear();

    const { buildAiAssistantContext } = await import('./ai-assistant-service');
    const context = await buildAiAssistantContext();

    const invoiceFromCalls = mocks.from.mock.calls.filter(([table]) => table === 'invoices');
    const expenseFromCalls = mocks.from.mock.calls.filter(([table]) => table === 'expenses');
    expect(invoiceFromCalls).toHaveLength(1);
    expect(expenseFromCalls).toHaveLength(1);

    const invoicesQuery = mocks.builders.get('invoices');
    expect(invoicesQuery?.not).toHaveBeenCalledWith(
      'status',
      'in',
      expect.arrayContaining(['paid', 'PAID', 'void', 'VOID', 'draft', 'DRAFT']),
    );

    expect(context.overdueInvoices.invoiceCount).toBe(2);
    expect(context.overdueInvoices.totalOutstanding).toBe(140);
    expect(context.propertyFinancialSnapshot.outstandingInvoiceAmount).toBe(140);
    expect(context.propertyFinancialSnapshot.expensesLast90Days).toBe(25);
    expect(context.reportSummary.expenseAmountLast30Days).toBe(5);
    expect(context.overdueInvoices.topInvoices).toHaveLength(2);

    const serialized = JSON.stringify(context);
    expect(serialized.length).toBeLessThan(4_000);
    expect(serialized).not.toContain('notes');
    expect(context.overdueInvoices.topInvoices[0]).toEqual(expect.objectContaining({
      invoiceId: 'inv-paid-shape',
      remainingAmount: 100,
    }));
  });
});
