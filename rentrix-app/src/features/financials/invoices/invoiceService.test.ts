import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Invoice, Payment } from '@/types/domain';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock,
}));

type TableName = 'invoices' | 'payments';
type TableResponses = Partial<Record<TableName, unknown[]>>;
type QueryLogEntry = { table: string; method: string; args: unknown[] };
type InvoiceSummaryFixture = Pick<Invoice, 'amount' | 'paid_amount'>;
type InvoiceFixture = InvoiceSummaryFixture & Pick<Invoice, 'id' | 'status'> & { contracts: null };
type PaymentFixture = Pick<Payment, 'id' | 'invoice_id' | 'amount' | 'payment_date' | 'deleted_at'>;
type ChainMethod = 'select' | 'is' | 'eq' | 'in' | 'or' | 'order';
type QueryBuilder = Record<ChainMethod | 'single' | 'returns', ReturnType<typeof vi.fn>>;

const chainMethods: ChainMethod[] = ['select', 'is', 'eq', 'in', 'or', 'order'];

function createInvoiceFixture(overrides: Partial<InvoiceFixture> = {}): InvoiceFixture {
  return {
    id: 'invoice_1',
    amount: 750,
    paid_amount: 250,
    status: 'PARTIALLY_PAID',
    contracts: null,
    ...overrides,
  };
}

function createInvoiceSummaryFixture(overrides: Partial<InvoiceSummaryFixture> = {}): InvoiceSummaryFixture {
  return { amount: 1000, paid_amount: 0, ...overrides };
}

function createPaymentFixture(overrides: Partial<PaymentFixture> = {}): PaymentFixture {
  return {
    id: 'payment_1',
    invoice_id: 'invoice_1',
    amount: 400,
    payment_date: '2026-05-01',
    deleted_at: null,
    ...overrides,
  };
}

function createChainMethod(table: string, method: ChainMethod, log: QueryLogEntry[], builder: Partial<QueryBuilder>) {
  return vi.fn((...args: unknown[]) => {
    log.push({ table, method, args });
    return builder;
  });
}

function createQueryBuilder(table: string, responses: TableResponses, log: QueryLogEntry[]) {
  const builder: Partial<QueryBuilder> = {};

  for (const method of chainMethods) {
    builder[method] = createChainMethod(table, method, log, builder);
  }

  builder.single = vi.fn(() => {
    log.push({ table, method: 'single', args: [] });
    return builder;
  });
  builder.returns = vi.fn(async () => {
    log.push({ table, method: 'returns', args: [] });
    const rows = responses[table as TableName] ?? [];
    return {
      data: table === 'invoices' && builder.single?.mock.calls.length ? rows[0] ?? null : rows,
      error: null,
    };
  });

  return builder;
}

function mockSupabaseTables(responses: TableResponses) {
  const log: QueryLogEntry[] = [];
  supabaseMock.from.mockImplementation((table: TableName) => createQueryBuilder(table, responses, log));
  return log;
}

const invoiceRows = [
  createInvoiceSummaryFixture({ amount: 1000, paid_amount: 1000 }),
  createInvoiceSummaryFixture({ amount: 750, paid_amount: 250 }),
  createInvoiceSummaryFixture({ amount: '900.5' as unknown as number, paid_amount: '100.5' as unknown as number }),
  createInvoiceSummaryFixture({ amount: 400, paid_amount: 450 }),
];

describe('invoiceService financial reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('summarizes invoice truth from canonical amount, paid, and clamped remaining values', async () => {
    const { summarizeInvoices } = await import('./invoiceService');

    expect(summarizeInvoices(invoiceRows)).toEqual({
      totalAmount: 3050.5,
      totalTax: 0,
      totalPaid: 1800.5,
      totalRemaining: 1300,
      count: 4,
    });
  });

  it('lists invoices through read-only filters without issuing payment writes or RPC calls', async () => {
    const invoice = createInvoiceFixture();
    const log = mockSupabaseTables({ invoices: [invoice] });
    const { listInvoices } = await import('./invoiceService');

    await expect(listInvoices({ status: 'partial', search: 'invoice_%' })).resolves.toEqual([invoice]);

    expect(log).toEqual(expect.arrayContaining([
      { table: 'invoices', method: 'is', args: ['deleted_at', null] },
      { table: 'invoices', method: 'in', args: ['status', ['partial', 'PARTIALLY_PAID']] },
      { table: 'invoices', method: 'or', args: ['id.ilike."%invoice\\_\\%%",status.ilike."%invoice\\_\\%%"'] },
    ]));
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
    expect(log.some((entry) => ['insert', 'update', 'delete', 'upsert'].includes(entry.method))).toBe(false);
  });

  it('reconciles invoice detail payments as read-only evidence for the selected invoice', async () => {
    const log = mockSupabaseTables({
      invoices: [createInvoiceFixture({ amount: 1200, paid_amount: 700 })],
      payments: [
        createPaymentFixture({ id: 'payment_2', amount: 300, payment_date: '2026-05-10' }),
        createPaymentFixture(),
      ],
    });
    const { getInvoiceDetail, summarizeInvoices } = await import('./invoiceService');

    const invoice = await getInvoiceDetail('invoice_1');

    expect(invoice.payments.map((payment) => payment.amount)).toEqual([300, 400]);
    expect(summarizeInvoices([invoice])).toMatchObject({ totalAmount: 1200, totalPaid: 700, totalRemaining: 500 });
    expect(log).toEqual(expect.arrayContaining([
      { table: 'invoices', method: 'eq', args: ['id', 'invoice_1'] },
      { table: 'payments', method: 'eq', args: ['invoice_id', 'invoice_1'] },
      { table: 'payments', method: 'is', args: ['deleted_at', null] },
    ]));
  });
});
