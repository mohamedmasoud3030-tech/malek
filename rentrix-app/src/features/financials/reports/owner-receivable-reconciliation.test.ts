import { readFileSync } from 'node:fs';
import { repoRoot } from '@/p1/replay-bootstrap';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { COMPANY, OWNER, OTHER_COMPANY, createOfficeCreditorFixture } from '@/test/office-creditor-fixture';
const at = (day: number) => `${new Date().toISOString().slice(0,7)}-${String(day).padStart(2,'0')}`;
let db: PGlite;
let id: string;
async function balances(day: number) {
  const { rows } = await db.query<{ source: string; control: string }>("select s.balance::text as source,public.wp05_gl_balance($1::uuid,'1300',$2::date)::text as control from public.wp05_subledger_due_from_owner($1::uuid,$2::date) s", [COMPANY,at(day)]);
  return { source: Number(rows[0].source), control: Number(rows[0].control) };
}
async function recovery(amount: number, day: number, request: string) {
  return db.query('select public.recover_owner_receivable_atomic($1::jsonb)', [JSON.stringify({ due_from_owner_id: id, amount, effective_date: at(day), request_id: request })]);
}
beforeAll(async () => {
  ({ db } = await createOfficeCreditorFixture());
  const { rows } = await db.query<{ data: { due_from_owner_id: string } }>('select public.create_owner_receivable_atomic($1::jsonb) as data', [JSON.stringify({ owner_id: OWNER, amount: 125.555, effective_date: at(1), request_id: 'owner-history-create' })]);
  id = rows[0].data.due_from_owner_id;
  await recovery(25,10,'owner-history-recovery');
},60_000);
afterAll(async () => { await db?.close(); });
it('includes governed owner receivables independently at earlier and later cutoffs', async () => {
  expect(await balances(8)).toEqual({ source: 125.555, control: 125.555 });
  expect(await balances(10)).toEqual({ source: 100.555, control: 100.555 });
});
it('allows separate partial recoveries and keeps retry idempotency per request', async () => {
  await db.exec('begin');
  try {
    await recovery(5,11,'owner-history-second');
    await recovery(5,11,'owner-history-second');
    await recovery(5,11,'owner-history-third');
    expect(await balances(11)).toEqual({ source: 90.555, control: 90.555 });
    expect(await balances(8)).toEqual({ source: 125.555, control: 125.555 });
    expect((await db.query('select id from public.due_from_owner_recoveries where due_from_owner_id=$1::uuid',[id])).rows).toHaveLength(3);
  } finally { await db.exec('rollback'); }
});
it('reverses recovery then original source without deleting original economic amounts', async () => {
  await db.exec('begin');
  try {
    const event = (await db.query<{ id: string }>('select id from public.due_from_owner_recoveries where due_from_owner_id=$1::uuid',[id])).rows[0].id;
    await db.query('select public.reverse_owner_receivable_recovery_atomic($1::jsonb)', [JSON.stringify({ recovery_event_id: event, request_id: 'owner-history-unrecover', reason: 'Recovery correction' })]);
    expect(await balances(10)).toEqual({ source: 125.555, control: 125.555 });
    await db.query('select public.reverse_owner_receivable_atomic($1::jsonb)', [JSON.stringify({ due_from_owner_id: id, request_id: 'owner-history-reverse', reason: 'Source correction' })]);
    expect(await balances(10)).toEqual({ source: 0, control: 0 });
    const row = (await db.query('select amount::text,outstanding::text,status from public.due_from_owners where id=$1::uuid',[id])).rows[0];
    expect(row).toEqual({ amount: '125.555', outstanding: '0.000', status: 'REVERSED' });
  } finally { await db.exec('rollback'); }
});
it('does not expose another company source balance', async () => {
  expect((await db.query<{ balance: string }>('select balance::text from public.wp05_subledger_due_from_owner($1::uuid,$2::date)',[OTHER_COMPANY,at(10)])).rows[0].balance).toBe('0.000');
});
it('rejects counter evidence with no corresponding recovery lineage', async () => {
  await db.exec('begin');
  try {
    await db.exec('reset role');
    await db.query('update public.due_from_owners set recovered_amount=30,outstanding=95.555 where id=$1::uuid',[id]);
    await db.exec('set role authenticated');
    await expect(balances(10)).rejects.toThrow(/OWNER_RECEIVABLE_HISTORY/);
  } finally { await db.exec('rollback'); }
});
it('keeps an independent GL-only discrepancy visible', async () => {
  await db.exec('begin');
  try {
    await db.exec('reset role');
    await db.query(`select public.post_journal_event(jsonb_build_object(
      'company_id',$1::uuid,'source_type','owner_history_probe','source_id','variance','event_id','variance',
      'effective_date',$2::date,'description','Independent control discrepancy',
      'lines',jsonb_build_array(
        jsonb_build_object('account_id',(select id from public.accounts where company_id=$1::uuid and no='1300'),'debit',1,'credit',0),
        jsonb_build_object('account_id',(select id from public.accounts where company_id=$1::uuid and no='1120'),'debit',0,'credit',1))))`, [COMPANY,at(10)]);
    await db.exec('set role authenticated');
    expect(await balances(10)).toEqual({ source: 100.555, control: 101.555 });
    const report = await db.query<{ reconciliation_status: string }>("select reconciliation_status from public.wp05_reconcile_all($1::uuid,$2::date) where account_no='1300'", [COMPANY,at(10)]);
    expect(report.rows[0].reconciliation_status).toBe('FAIL');
  } finally { await db.exec('rollback'); }
});
it('does not invent dates for a missing original posting link', async () => {
  await db.exec('begin');
  try {
    await db.exec('reset role');
    await db.query('update public.due_from_owners set journal_batch_id=null where id=$1::uuid',[id]);
    await db.exec('set role authenticated');
    await expect(balances(28)).rejects.toThrow(/OWNER_RECEIVABLE_HISTORY_EVENT_GAP/);
  } finally { await db.exec('rollback'); }
});

it('upgrades existing recoveries without changing booked history or old retry identity', async () => {
  const { db: legacy } = await createOfficeCreditorFixture({ throughMigration: '20260909000006' });
  try {
    const created = await legacy.query<{ data: { due_from_owner_id: string } }>('select public.create_owner_receivable_atomic($1::jsonb) as data', [JSON.stringify({ owner_id: OWNER, amount: 125.555, effective_date: at(1), request_id: 'pre-upgrade-owner' })]);
    const legacyId = created.rows[0].data.due_from_owner_id;
    const payload = { due_from_owner_id: legacyId, amount: 25, effective_date: at(10), request_id: 'pre-upgrade-recovery' };
    const first = await legacy.query('select public.recover_owner_receivable_atomic($1::jsonb) as data', [JSON.stringify(payload)]);
    const booked = (await legacy.query<{ id: string; event_id: string; effective_date: string }>('select id,event_id,effective_date from public.journal_batches order by id')).rows;
    expect(booked.some(row => row.event_id === 'recover')).toBe(true);
    await legacy.exec('reset role');
    await legacy.exec(readFileSync(`${repoRoot}/supabase/migrations/20260909000007_owner_receivable_history_and_recovery.sql`, 'utf8'));
    await legacy.exec('set role authenticated');
    expect((await legacy.query<{ id: string; event_id: string; effective_date: string }>('select id,event_id,effective_date from public.journal_batches order by id')).rows).toEqual(booked);
    expect((await legacy.query('select public.recover_owner_receivable_atomic($1::jsonb) as data', [JSON.stringify(payload)])).rows).toEqual(first.rows);
    await expect(legacy.query('select public.recover_owner_receivable_atomic($1::jsonb)', [JSON.stringify({ ...payload, amount: 5 })])).rejects.toThrow(/IDEMPOTENCY_KEY_REUSED/);
    await legacy.query('select public.recover_owner_receivable_atomic($1::jsonb)', [JSON.stringify({ ...payload, amount: 5, request_id: 'post-upgrade-recovery' })]);
    const result = await legacy.query("select s.balance::text as source,public.wp05_gl_balance($1::uuid,'1300',$2::date)::text as control from public.wp05_subledger_due_from_owner($1::uuid,$2::date) s", [COMPANY,at(10)]);
    expect(result.rows[0]).toEqual({ source: '95.555', control: '95.555' });
  } finally { await legacy.close(); }
},60_000);
