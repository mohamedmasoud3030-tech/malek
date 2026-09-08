import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getInvoiceGrossAmount, getInvoiceRemainingAmount, summarizeInvoices } from './invoice-amounts';
import { summarizeInvoiceTotals } from '../reports/financial-reporting/report-calculations';

const backend = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: backend }));
import { listDossierInvoicesForContracts } from './invoiceService';
import { getContractPaymentsSnapshot } from '@/features/contracts/services/contractPaymentService';

// Query-aware fake: filters, projections and ranges matter, unlike a canned row mock.
function install(rows: Record<string, Array<Record<string, unknown>>>, failAt?: number) {
  const reads: Array<{ table: string; columns: string; ids: unknown[]; from: number }> = [];
  backend.from.mockImplementation((table: string) => {
    let filtered = rows[table] ?? [];
    let columns = '*';
    let ids: unknown[] = [];
    const q = {
      select: (value: string) => { columns = value; return q; },
      eq: (key: string, value: unknown) => { filtered = filtered.filter((r) => r[key] === value); return q; },
      in: (key: string, values: unknown[]) => { ids = values; filtered = filtered.filter((r) => values.includes(r[key])); return q; },
      is: (key: string, value: unknown) => { filtered = filtered.filter((r) => (r[key] ?? null) === value); return q; },
      order: () => q,
      range: async (from: number, to: number) => {
        reads.push({ table, columns, ids, from });
        if (failAt === reads.length) return { data: null, error: new Error('read unavailable') };
        const data = filtered.slice(from, to + 1).map((r) => columns === '*' ? r : Object.fromEntries(columns.split(',').map((c) => [c.trim(), r[c.trim()]])));
        return { data, error: null };
      },
    };
    return q;
  });
  return reads;
}

beforeEach(() => vi.clearAllMocks());

describe('one invoice amount authority across collection, reports and dossiers', () => {
  it.each([
    [{ amount: 100, tax_amount: 5, paid_amount: 100 }, 105, 5],
    [{ amount: 100, tax_amount: null, paid_amount: 25 }, 100, 75],
    [{ amount: 100, tax_amount: 5, paid_amount: 120 }, 105, 0],
    [{ amount: 1.234, tax_amount: 0.061, paid_amount: 1 }, 1.295, 0.295],
  ])('keeps gross and outstanding semantics aligned for %j', (invoice, gross, remaining) => {
    expect(getInvoiceGrossAmount(invoice)).toBeCloseTo(gross, 8);
    expect(getInvoiceRemainingAmount(invoice)).toBeCloseTo(remaining, 8);
    expect(summarizeInvoices([invoice]).totalRemaining).toBeCloseTo(remaining, 8);
    expect(summarizeInvoiceTotals([invoice]).totalOutstanding).toBeCloseTo(remaining, 8);
  });

  it('loads all dossier rows, includes VAT, batches IDs once and never drops a response-cap suffix', async () => {
    const invoices = Array.from({ length: 1001 }, (_, i) => ({ id: `i${i}`, contract_id: 'c0', amount: 100, tax_amount: 5, paid_amount: 100 }));
    const reads = install({ invoices });
    const ids = Array.from({ length: 600 }, (_, i) => `c${i}`);
    const result = await listDossierInvoicesForContracts([...ids, 'c0']);
    expect(result).toHaveLength(1001);
    expect(summarizeInvoices(result).totalRemaining).toBe(5005);
    expect(reads.map((r) => [r.ids.length, r.from])).toEqual([[250, 0], [250, 1000], [250, 0], [100, 0]]);
    expect(reads.every((r) => r.columns.includes('tax_amount'))).toBe(true);
  });

  it('rejects an incomplete dossier read rather than showing partial arrears', async () => {
    install({ invoices: Array.from({ length: 1001 }, () => ({ contract_id: 'c' })) }, 2);
    await expect(listDossierInvoicesForContracts(['c'])).rejects.toThrow('read unavailable');
  });

  it('contract payment snapshot agrees with invoice gross totals and retains real receipt identity', async () => {
    const reads = install({
      invoices: [{ id: 'i', contract_id: 'c', amount: 100, tax_amount: 5, paid_amount: 100 }],
      payments: [{ id: 'p', invoice_id: 'i', amount: 100, receipt_id: 'r', payment_date: '2026-09-09' }],
      receipts: [{ id: 'r', reference: 'REC-0009' }],
    });
    const snapshot = await getContractPaymentsSnapshot('c');
    expect(snapshot.summary).toEqual({ invoiceCount: 1, paymentCount: 1, totalInvoiced: 105, totalPaid: 100, totalRemaining: 5 });
    expect(snapshot.payments[0].receipt_reference).toBe('REC-0009');
    expect(reads.map((r) => r.table)).toEqual(['invoices', 'receipt_allocations', 'payments', 'receipts']);
  });
});

it('posted credits reduce collectible debt without being mislabeled as collected cash', () => {
  const invoice = { amount: 100, tax_amount: 5, paid_amount: 40, credited_amount: 65 };
  expect(getInvoiceRemainingAmount(invoice)).toBe(0);
  expect(summarizeInvoices([invoice])).toMatchObject({ totalAmount: 105, totalPaid: 40, totalRemaining: 0 });
  expect(getInvoiceRemainingAmount({ amount: 0.1, tax_amount: 0.2, paid_amount: 0.3 })).toBe(0);
});


it('allocates one receipt across invoices without duplicating cash or losing legacy links', async () => {
  install({
    invoices: [
      { id: 'i1', contract_id: 'c', amount: 40, paid_amount: 40 },
      { id: 'i2', contract_id: 'c', amount: 60, paid_amount: 60 },
      { id: 'i3', contract_id: 'c', amount: 25, paid_amount: 25 },
    ],
    payments: [
      { id: 'p1', invoice_id: 'i1', receipt_id: 'r1', amount: 100 },
      { id: 'legacy', invoice_id: 'i3', receipt_id: null, amount: 25 },
    ],
    receipt_allocations: [
      { id: 'a1', receipt_id: 'r1', invoice_id: 'i1', amount: 15 },
      { id: 'a2', receipt_id: 'r1', invoice_id: 'i1', amount: 25 },
      { id: 'a3', receipt_id: 'r1', invoice_id: 'i2', amount: 60 },
    ],
    receipts: [{ id: 'r1', reference: 'RCT-100' }],
  });
  const snapshot = await getContractPaymentsSnapshot('c');
  expect(snapshot.summary).toMatchObject({ paymentCount: 2, totalPaid: 125, totalRemaining: 0 });
  expect(snapshot.payments.map(row => [row.id, row.invoice_id, row.amount])).toEqual([
    ['p1', 'i1', 40], ['p1', 'i2', 60], ['legacy', 'i3', 25],
  ]);
  expect(snapshot.invoices.map(row => row.payments.length)).toEqual([1, 1, 1]);
});
