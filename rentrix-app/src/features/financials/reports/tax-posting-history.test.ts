import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { COMPANY, MAKER, OTHER, OTHER_COMPANY, createOfficeCreditorFixture } from '@/test/office-creditor-fixture';
import { createFixedFeeAgreementFixture } from '@/test/fixed-fee-fixture';
import { assumeIdentity } from '@/p1/replay-bootstrap';
import { getVatReturnReport } from './financial-statements-service';
const backend = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: backend }));
const at = (day: number) => `${new Date().toISOString().slice(0, 7)}-${String(day).padStart(2, '0')}`;
let db: PGlite;
let invoiceId: string;
let creditId: string;
async function report(from: number, to: number) { return getVatReturnReport({ dateFrom: at(from), dateTo: at(to) }); }
async function vat(day: number) {
  const { rows } = await db.query<{ source: string; control: string }>(
    "select s.balance::text as source,public.wp05_gl_balance($1::uuid,'2100',$2::date)::text as control from public.rc1_owner_agency_vat_payable_balance($1::uuid,$2::date) s", [COMPANY, at(day)],
  );
  return { source: Number(rows[0].source), control: Number(rows[0].control) };
}
beforeAll(async () => {
  ({ db, invoiceId } = await createOfficeCreditorFixture({ taxRate: 5 })); // fixture configuration, not statutory policy
  await db.exec('set role authenticated');
  backend.rpc.mockImplementation(async (name: string, args: { p_from_date: string; p_to_date: string }) => {
    if (name !== 'rpt_vat_return') throw new Error('Unexpected RPC');
    try { return { data: (await db.query<{ data: unknown }>('select public.rpt_vat_return($1::date,$2::date) as data', [args.p_from_date, args.p_to_date])).rows[0].data, error: null }; }
    catch (error) { return { data: null, error }; }
  });
}, 420000);
afterAll(async () => { await db?.close(); });
it('keeps earlier VAT unchanged when a later original-basis credit posts', async () => {
  expect(await vat(8)).toEqual({ source: 50, control: 50 });
  const { rows } = await db.query<{ data: { credit_id: string } }>('select public.create_invoice_credit_atomic($1::jsonb) as data', [JSON.stringify({
    invoice_id: invoiceId, amount: 105, credit_type: 'PARTIAL', effective_date: at(10), reason: 'Original tax basis correction', request_id: 'tax-history-credit',
  })]);
  creditId = rows[0].data.credit_id;
  expect(await vat(8)).toEqual({ source: 50, control: 50 });
  expect(await vat(10)).toEqual({ source: 45, control: 45 });
});
it('reports credit movements in their booked period and never reapplies today’s rate', async () => {
  expect(await report(1, 8)).toMatchObject({ totalSalesAmount: 1000, totalTaxAmount: 50, invoiceCount: 1 });
  expect(await report(10, 10)).toMatchObject({ totalSalesAmount: -100, totalTaxAmount: -5 });
  expect(await report(1, 28)).toMatchObject({ totalSalesAmount: 900, totalTaxAmount: 45 });
});
it('preserves compensating reversal history at its booked date', async () => {
  await db.query('select public.reverse_invoice_credit_atomic($1::jsonb)', [JSON.stringify({ credit_id: creditId, reason: 'Credit withdrawn', request_id: 'tax-history-reverse' })]);
  expect(await vat(8)).toEqual({ source: 50, control: 50 });
  expect(await vat(10)).toEqual({ source: 50, control: 50 });
  expect(await report(10, 10)).toMatchObject({ totalSalesAmount: 0, totalTaxAmount: 0 });
});
it('retains company isolation and the canonical disabled-identity permission denial', async () => {
  await assumeIdentity(db, OTHER, OTHER_COMPANY);
  expect(await report(1, 28)).toMatchObject({ totalSalesAmount: 0, totalTaxAmount: 0, invoiceCount: 0 });
  await assumeIdentity(db, MAKER, COMPANY);
  await db.exec('begin; reset role');
  try {
    await db.query('update public.users set is_active=false where id=$1::uuid', [MAKER]);
    await db.exec('set role authenticated');
    await expect(report(1, 28)).rejects.toThrow(/FINANCIAL_REPORTS_VIEW_PERMISSION_REQUIRED/);
  } finally { await db.exec('rollback'); }
});
it('keeps the private event projection read-only and subject to underlying company RLS', async () => {
  const privileges = await db.query<{ write: boolean; invoker: boolean; private_execute: boolean }>(`select
    has_table_privilege('authenticated','app_private.tax_posting_events','INSERT,UPDATE,DELETE') as write,
    (select 'security_invoker=true'=any(reloptions) from pg_class where oid='app_private.tax_posting_events'::regclass) as invoker,
    has_function_privilege('authenticated','app_private.financial_vat_return_core(date,date)','EXECUTE') as private_execute`);
  expect(privileges.rows[0]).toEqual({ write: false, invoker: true, private_execute: false });
  await assumeIdentity(db, OTHER, OTHER_COMPANY);
  expect((await db.query('select * from app_private.tax_posting_events where company_id=$1::uuid', [COMPANY])).rows).toEqual([]);
  await assumeIdentity(db, MAKER, COMPANY);
});

it('rejects an unclassified 2100 posting rather than fabricating a taxable base', async () => {
  await db.exec('begin; reset role');
  try {
    const accounts = await db.query<{ id: string; no: string }>("select id,no from public.accounts where company_id=$1::uuid and no in ('1111','2100')", [COMPANY]);
    const id = (no: string) => accounts.rows.find(row => row.no===no)!.id;
    await db.query('select public.post_journal_event($1::jsonb)', [JSON.stringify({
      company_id: COMPANY, source_type: 'manual_adjustment', source_id: 'tax-control-probe', event_id: 'tax-control-probe', effective_date: at(23),
      lines: [{ account_id: id('1111'), debit: 1, credit: 0 }, { account_id: id('2100'), debit: 0, credit: 1 }],
    })]);
    await db.exec('set role authenticated');
    expect(await vat(23)).toEqual({ source: 50, control: 51 });
    await expect(report(23, 23)).rejects.toThrow(/VAT_REPORT_UNCLASSIFIED_POSTING/);
  } finally { await db.exec('rollback'); }
});

it('includes independently configured daily fixed-fee tax and its compensating reversal', async () => {
  const days = new Date(new Date().getUTCFullYear(), new Date().getUTCMonth()+1, 0).getDate();
  const agreement = await createFixedFeeAgreementFixture(db, at(1), days*10);
  const before = await report(1, 1);
  const empty = await db.query<{ data: { tax_authority_status: string } }>('select public.list_fixed_monthly_accruals($1::jsonb) as data', [JSON.stringify({ date_from: at(1), date_to: at(1) })]);
  expect(empty.rows[0].data.tax_authority_status).toBe('NO_ACCRUALS');
  const payload = JSON.stringify({ request_id: 'tax-fixed-daily', date_from: at(1), date_to: at(1) });
  const first = await db.query<{ data: Record<string, unknown> }>('select public.execute_fixed_monthly_accruals_atomic($1::jsonb) as data', [payload]);
  const replay = await db.query<{ data: Record<string, unknown> }>('select public.execute_fixed_monthly_accruals_atomic($1::jsonb) as data', [payload]);
  expect(first.rows[0].data).toMatchObject({ created_days: 1, net_amount: 10, tax_amount: 0.7, tax_authority_status: 'VERSIONED_FEE_TREATMENT' });
  expect(replay.rows).toEqual(first.rows);
  const register = await db.query<{ data: { tax_authority_status: string } }>('select public.list_fixed_monthly_accruals($1::jsonb) as data', [JSON.stringify({ date_from: at(1), date_to: at(1) })]);
  expect(register.rows[0].data.tax_authority_status).toBe('VERSIONED_FEE_TREATMENT');
  for (const [company, date] of [[OTHER_COMPANY, at(1)], [COMPANY, at(2)]]) {
    const scoped = await db.query<{ status: string }>('select app_private.fixed_fee_tax_history_status($1::uuid,$2::date,$2::date) as status', [company,date]);
    expect(scoped.rows[0].status).toBe('NO_ACCRUALS');
  }
  const after = await report(1, 1);
  expect(after.totalSalesAmount-before.totalSalesAmount).toBe(10);
  expect(after.totalTaxAmount-before.totalTaxAmount).toBeCloseTo(0.7, 3);
  expect(await vat(1)).toEqual({ source: 50.7, control: 50.7 });
  const accruals = await db.query<{ id: string }>('select id from public.fixed_monthly_daily_accruals where owner_agreement_id=$1::uuid', [agreement]);
  expect(accruals.rows).toHaveLength(1);
  await db.query('select public.reverse_fixed_monthly_accrual_atomic($1::jsonb)', [JSON.stringify({ request_id: 'tax-fixed-reverse', accrual_id: accruals.rows[0].id, reason: 'Service accrual correction' })]);
  expect(await report(1, 1)).toEqual(before);
  expect(await vat(1)).toEqual({ source: 50, control: 50 });
  const retained = await db.query<{ net: string; tax: string }>('select net_amount::text as net,tax_amount::text as tax from public.fixed_monthly_daily_accruals where id=$1::uuid', [accruals.rows[0].id]);
  expect(retained.rows[0]).toEqual({ net: '10.000', tax: '0.700' });
  const reversedHistory = await db.query<{ data: { tax_authority_status: string } }>('select public.list_fixed_monthly_accruals($1::jsonb) as data', [JSON.stringify({ date_from: at(1), date_to: at(1) })]);
  expect(reversedHistory.rows[0].data.tax_authority_status).toBe('VERSIONED_FEE_TREATMENT');
});

it.each([['NON_TAXABLE', 0, 0], ['VAT_ZERO', 1000, 1]] as const)('preserves configured %s treatment without inventing a positive rate', async (taxCode, base, count) => {
  const fixture = await createOfficeCreditorFixture({ taxCode });
  try {
    await fixture.db.exec('set role authenticated');
    const { rows } = await fixture.db.query<{ data: Record<string, unknown> }>('select public.rpt_vat_return($1::date,$2::date) as data', [at(1), at(28)]);
    expect(rows[0].data).toMatchObject({ total_sales_amount: base, total_tax_amount: 0, invoice_count: count });
  } finally { await fixture.db.close(); }
});
