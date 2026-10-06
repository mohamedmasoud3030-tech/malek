import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { COMPANY, CONTRACT, PROPERTY, TENANT, MAKER, OTHER, OTHER_COMPANY, createOfficeCreditorFixture } from '../../../test/office-creditor-fixture';
import { assumeIdentity } from '../../../p1/replay-bootstrap';
import { loadPayments } from './financial-reporting/report-loaders';
import { getTenantStatementReport } from './statements-reports-service';
import { recordInvoicePaymentAtomic, type PaymentPayload } from '../payments/paymentService';
import { RetryableCommandStore } from '@/lib/retryable-command';
import { createSqlReadBridge } from '@/test/sql-read-bridge';
import { getContractPaymentsSnapshot } from '@/features/contracts/services/contractPaymentService';

const backend = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: backend }));
let db: PGlite;
let invoiceId: string;
let losePaymentResponse = false;

beforeAll(async () => {
  ({ db, invoiceId } = await createOfficeCreditorFixture());
  backend.from.mockImplementation(createSqlReadBridge(db));
  backend.rpc.mockImplementation(async (name: string, args: { p_contract_id: string; payload: PaymentPayload }) => {
    try {
      if (name === 'record_invoice_payment_atomic') {
        const { rows } = await db.query<{ result: unknown }>('select public.record_invoice_payment_atomic($1::jsonb) as result', [JSON.stringify(args.payload)]);
        if (losePaymentResponse) { losePaymentResponse = false; throw new Error('response lost after payment committed'); }
        return { data: rows[0].result, error: null };
      }
      if (name !== 'rpt_tenant_statement') throw new Error('Unexpected RPC');
      const { rows } = await db.query<{ result: unknown }>('select public.rpt_tenant_statement($1::uuid) as result', [args.p_contract_id]);
      return { data: rows[0].result, error: null };
    } catch (error) { return { data: null, error }; }
  });
}, 420_000);
beforeEach(async () => {
  await db.exec('reset role');
  await assumeIdentity(db, MAKER, COMPANY);
  await db.exec('set role authenticated');
});
afterAll(async () => { await db?.close(); });

it('reports credit and compensating reversal as distinct non-cash movements', async () => {
  expect((await getTenantStatementReport(CONTRACT)).finalBalance).toBe(1000);
  const { rows } = await db.query<{ result: { credit_id: string } }>(
    `select public.create_invoice_credit_atomic($1::jsonb) as result`,
    [JSON.stringify({ invoice_id: invoiceId, amount: 250.125, credit_type: 'PARTIAL', reason: 'Statement correction', request_id: 'statement-credit' })],
  );
  const credited = await getTenantStatementReport(CONTRACT);
  expect(credited.finalBalance).toBe(749.875);
  expect(credited.lines).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'invoice_credit', debit: 0, credit: 250.125 })]));
  await db.query('select public.reverse_invoice_credit_atomic($1::jsonb)', [JSON.stringify({ credit_id: rows[0].result.credit_id, reason: 'Correction reversed', request_id: 'statement-credit-reverse' })]);
  const reversed = await getTenantStatementReport(CONTRACT);
  expect(reversed.finalBalance).toBe(1000);
  expect(reversed.lines).toHaveLength(3);
  expect(reversed.lines).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'invoice_credit_reversal', debit: 250.125, credit: 0 })]));
  let running = 0;
  for (const line of reversed.lines) {
    running = Math.round((running + line.debit - line.credit) * 1000) / 1000;
    expect(line.balance).toBe(running);
  }
  expect(await getTenantStatementReport(CONTRACT)).toEqual(reversed);
});

it('does not expose a foreign contract through SECURITY DEFINER', async () => {
  await assumeIdentity(db, OTHER, OTHER_COMPANY);
  const result = await getTenantStatementReport(CONTRACT);
  expect(result.error).toBe('contract not found');
  expect(result.lines).toEqual([]);
});

it('denies disabled identities even with a still-valid company claim', async () => {
  await db.exec('reset role');
  await db.query('update public.users set is_active=false where id=$1::uuid', [MAKER]);
  await db.exec('set role authenticated');
  try { await expect(getTenantStatementReport(CONTRACT)).rejects.toThrow(/PERMISSION_REQUIRED/); }
  finally {
    await db.exec('reset role');
    await db.query('update public.users set is_active=true where id=$1::uuid', [MAKER]);
  }
});


it('retries one persisted cash payment and reports cash separately from non-cash corrections', async () => {
  const commands = new RetryableCommandStore();
  const payload = { invoice_id: invoiceId, amount: 123.456, method: 'cash' as const, date: '2026-09-09', reference: null };
  const send = () => commands.run('invoice-payment', payload, request_id => recordInvoicePaymentAtomic({ ...payload, request_id }));
  losePaymentResponse = true;
  await expect(send()).rejects.toThrow();
  const ack = await send();
  expect(ack.status).toBe('recorded');
  const { rows } = await db.query<{ count: number; paid: string }>('select count(*)::integer as count, sum(amount) as paid from public.payments where receipt_id=$1::uuid', [ack.receipt_id]);
  expect(rows[0].count).toBe(1);
  expect(Number(rows[0].paid)).toBe(123.456);
  const report = await getTenantStatementReport(CONTRACT);
  expect(report.finalBalance).toBe(876.544);
  expect(report.lines.filter(line => line.type === 'receipt')).toEqual([
    expect.objectContaining({ debit: 0, credit: 123.456 }),
  ]);
  const ledger = await db.query<{ balance: string }>(`select sum(l.debit-l.credit) as balance from public.journal_lines l join public.accounts a on a.id=l.account_id where a.no='1201'`);
  expect(Number(ledger.rows[0].balance)).toBe(report.finalBalance);
});


it('shows allocation-backed cash in the contract payment history', async () => {
  const snapshot = await getContractPaymentsSnapshot(CONTRACT);
  expect(snapshot.summary).toMatchObject({ paymentCount: 1, totalPaid: 123.456, totalRemaining: 876.544 });
  expect(snapshot.invoices[0].payments).toHaveLength(1);
  expect(snapshot.payments[0]).toMatchObject({ invoice_id: invoiceId, amount: 123.456 });
  const receipt = await db.query<{ reference: string }>('select reference from public.receipts where id=$1::uuid', [snapshot.payments[0].id]);
  expect(snapshot.payments[0].receipt_reference).toBe(receipt.rows[0].reference);
  expect(receipt.rows[0].reference).toBeTruthy();
});

it('cannot truncate another company’s posted payment history despite an authenticated SQL role', async () => {
  await assumeIdentity(db, OTHER, OTHER_COMPANY);
  expect((await db.query('select id from public.payments')).rows).toEqual([]);
  // Disposable replay only. Roll back even if the regression reproduces so no
  // fixture history is destroyed. TRUNCATE itself does not honor row policies.
  await db.exec('begin');
  try { await expect(db.exec('truncate public.payments cascade')).rejects.toThrow(/permission denied/); }
  finally { await db.exec('rollback'); }
  await assumeIdentity(db, MAKER, COMPANY);
  expect((await db.query('select id from public.payments')).rows).toHaveLength(1);
});

it('does not grant browser roles table-wide truncation on any replayed public table', async () => {
  const { rows } = await db.query<{ role: string; table_name: string }>(`select role, c.relname as table_name
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    cross join (values ('authenticated'), ('anon')) roles(role)
    where n.nspname='public' and c.relkind in ('r','p') and has_table_privilege(role,c.oid,'TRUNCATE')
    order by role,c.relname`);
  expect(rows).toEqual([]);
});


it('retains actual cash in property, tenant and contract filtered reports', async () => {
  const rows = await loadPayments({ dateFrom: '2026-09-01', dateTo: '2026-09-30', propertyId: PROPERTY, tenantId: TENANT, contractId: CONTRACT });
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ amount: 123.456, contract: { id: CONTRACT, property_id: PROPERTY, tenant_id: TENANT }, invoice: { id: invoiceId } });
});
