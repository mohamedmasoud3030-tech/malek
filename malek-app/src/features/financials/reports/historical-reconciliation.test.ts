import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { COMPANY, CONTRACT, MAKER, OTHER, OTHER_COMPANY, createOfficeCreditorFixture } from '@/test/office-creditor-fixture';
import { assumeIdentity } from '@/p1/replay-bootstrap';
import { getReconciliationReport } from '@/features/accounting/reports/accountingReportsFacade';
const backend = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: backend }));
const at = (day: number) => `${new Date().toISOString().slice(0, 7)}-${String(day).padStart(2, '0')}`;
let db: PGlite;
let invoiceId: string;
let depositId: string;
let creditId: string;
let claimId: string;
let refundId: string;
const CHECKER = 'c2000000-0000-4000-8000-000000000099';
async function command(name: string, payload: Record<string, unknown>) {
  if (!/^[a-z_]+$/.test(name)) throw new Error('Invalid test command');
  return (await db.query<{ result: Record<string, string> }>(`select public.${name}($1::jsonb) as result`, [JSON.stringify({ request_id: crypto.randomUUID(), ...payload })])).rows[0].result;
}
async function balances(date: string) {
  const report = await getReconciliationReport(date);
  const ar = report.find(row => row.account_no === '1201')!;
  const deposit = report.find(row => row.account_no === '2200')!;
  return { ar: ar.subledger_balance, arGl: ar.gl_balance, deposit: deposit.subledger_balance, depositGl: deposit.gl_balance };
}
beforeAll(async () => {
  ({ db, invoiceId } = await createOfficeCreditorFixture());
  await db.exec(`insert into auth.users(id,email) values ('${CHECKER}','checker@history.test');
    insert into public.users(id,email,name,role,status,is_active) values ('${CHECKER}','checker@history.test','Checker','ADMIN','ACTIVE',true);
    insert into public.company_members(company_id,user_id,role) values ('${COMPANY}','${CHECKER}','ADMIN');`);
  await assumeIdentity(db, MAKER, COMPANY);
  await db.exec('set role authenticated');
  backend.rpc.mockImplementation(async (name: string, args: { p_as_of: string }) => {
    if (name !== 'wp05_reconcile_all') throw new Error('Unexpected RPC');
    try { return { data: (await db.query<{ row: unknown }>('select to_jsonb(r) as row from public.wp05_reconcile_all(public.current_company_id(),$1::date) r', [args.p_as_of])).rows.map(r => r.row), error: null }; }
    catch (error) { return { data: null, error }; }
  });
}, 420000);
afterAll(async () => { await db?.close(); });

it('keeps the earlier AR=1000 and deposits=0 after later cash and deposit receipts', async () => {
  expect(await balances(at(8))).toEqual({ ar: 1000, arGl: 1000, deposit: 0, depositGl: 0 });
  await command('record_invoice_payment_atomic', { invoice_id: invoiceId, amount: 123.456, method: 'cash', date: at(9) });
  depositId = (await command('create_deposit_atomic', { contract_id: CONTRACT, amount: 500, received_date: at(11) })).deposit_id;
  expect(await balances(at(8))).toEqual({ ar: 1000, arGl: 1000, deposit: 0, depositGl: 0 });
  expect(await balances(at(9))).toEqual({ ar: 876.544, arGl: 876.544, deposit: 0, depositGl: 0 });
  expect(await balances(at(11))).toEqual({ ar: 876.544, arGl: 876.544, deposit: 500, depositGl: 500 });
});

it('dates credit, applied allocation and refund independently of current balances', async () => {
  creditId = (await command('create_invoice_credit_atomic', { invoice_id: invoiceId, amount: 100, credit_type: 'PARTIAL', reason: 'Historical credit', effective_date: at(10) })).credit_id;
  claimId = (await command('create_deposit_application_claim_with_inspection_atomic', { deposit_id: depositId, invoice_id: invoiceId, claim_kind: 'INVOICE_ARREARS', allocation_amount: 200, evidence_uri: 'evidence://history' })).claim_id;
  await assumeIdentity(db, CHECKER, COMPANY);
  await command('approve_deposit_application_claim_atomic', { claim_id: claimId });
  await command('apply_deposit_claim_atomic', { claim_id: claimId, effective_date: at(12) });
  refundId = (await command('refund_deposit_governed_atomic', { deposit_id: depositId, amount: 100.125, payment_method: 'cash', refund_date: at(13) })).refund_event_id;
  expect(await balances(at(9))).toEqual({ ar: 876.544, arGl: 876.544, deposit: 0, depositGl: 0 });
  expect(await balances(at(10))).toEqual({ ar: 776.544, arGl: 776.544, deposit: 0, depositGl: 0 });
  expect(await balances(at(12))).toEqual({ ar: 576.544, arGl: 576.544, deposit: 300, depositGl: 300 });
  expect(await balances(at(13))).toEqual({ ar: 576.544, arGl: 576.544, deposit: 199.875, depositGl: 199.875 });
});

it('retains compensating reversals at their booked effective dates', async () => {
  await command('reverse_invoice_credit_atomic', { credit_id: creditId, reason: 'Correct credit' });
  await command('reverse_deposit_claim_atomic', { claim_id: claimId, reason: 'Correct application' });
  await command('reverse_deposit_refund_atomic', { refund_event_id: refundId, reason: 'Correct refund' });
  expect(await balances(at(8))).toEqual({ ar: 1000, arGl: 1000, deposit: 0, depositGl: 0 });
  expect(await balances(at(13))).toEqual({ ar: 876.544, arGl: 876.544, deposit: 500, depositGl: 500 });
});

it('cannot read another company’s historical balances under authenticated RLS', async () => {
  await assumeIdentity(db, OTHER, OTHER_COMPANY);
  const rows = await db.query<{ balance: string }>('select balance::text from public.wp05_subledger_tenant_receivables($1::uuid,$2::date)', [COMPANY, at(8)]);
  expect(Number(rows.rows[0].balance)).toBe(0);
  await assumeIdentity(db, MAKER, COMPANY);
});

it('rewinds fully settled invoices and fully refunded deposits, not only current open rows', async () => {
  const payment = await command('record_invoice_payment_atomic', { invoice_id: invoiceId, amount: 876.544, method: 'bank_transfer', date: at(20) });
  await command('refund_deposit_governed_atomic', { deposit_id: depositId, amount: 500, payment_method: 'cash', refund_date: at(21) });
  expect(await balances(at(19))).toEqual({ ar: 876.544, arGl: 876.544, deposit: 500, depositGl: 500 });
  expect(await balances(at(20))).toEqual({ ar: 0, arGl: 0, deposit: 500, depositGl: 500 });
  expect(await balances(at(21))).toEqual({ ar: 0, arGl: 0, deposit: 0, depositGl: 0 });
  const request = await command('request_receipt_void_atomic', { receipt_id: payment.receipt_id, reason: 'Wrong collection' });
  await assumeIdentity(db, CHECKER, COMPANY);
  await command('approve_receipt_void_atomic', { void_request_id: request.void_request_id });
  expect(await balances(at(19))).toEqual({ ar: 876.544, arGl: 876.544, deposit: 500, depositGl: 500 });
  expect(await balances(at(20))).toEqual({ ar: 876.544, arGl: 876.544, deposit: 500, depositGl: 500 });
  const allocations = await db.query('select id from public.receipt_allocations where receipt_id=$1::uuid', [payment.receipt_id]);
  expect(allocations.rows).toHaveLength(1); // governed VOID retains the original allocation
  await assumeIdentity(db, MAKER, COMPANY);
});

it.each([7, 25])('rejects undated counter gaps for cutoff day %s, including future cutoffs', async day => {
  // Fault injection representing an imported/unclassified historical counter.
  // Always rolled back; no posted journal/history rows are rewritten.
  await db.exec('begin; reset role');
  try {
    await db.query('update public.invoices set paid_amount=paid_amount+1 where id=$1::uuid', [invoiceId]);
    await db.exec('set role authenticated');
    await expect(getReconciliationReport(at(day))).rejects.toThrow(/AR_AS_OF_HISTORY_INCOMPLETE/);
  } finally { await db.exec('rollback'); }
});

it('does not conceal an independent GL-only adjustment by calling it a subledger event', async () => {
  await db.exec('reset role');
  try {
    const accounts = await db.query<{ id: string; no: string }>("select id,no from public.accounts where company_id=$1::uuid and no in ('1201','2000')", [COMPANY]);
    const id = (no: string) => accounts.rows.find(row => row.no === no)!.id;
    // Trusted-server diagnostic adjustment, through the canonical posting engine.
    await db.query('select public.post_journal_event($1::jsonb)', [JSON.stringify({
      company_id: COMPANY, source_type: 'manual_adjustment', source_id: 'history-variance', event_id: 'history-variance', effective_date: at(22),
      lines: [{ account_id: id('1201'), debit: 1, credit: 0 }, { account_id: id('2000'), debit: 0, credit: 1 }],
    })]);
  } finally { await db.exec('set role authenticated'); }
  const report = await getReconciliationReport(at(22));
  expect(report.find(row => row.account_no==='1201')).toMatchObject({ subledger_balance: 876.544, gl_balance: 877.544, variance: -1, reconciliation_status: 'FAIL' });
  expect(await balances(at(8))).toEqual({ ar: 1000, arGl: 1000, deposit: 0, depositGl: 0 });
});
