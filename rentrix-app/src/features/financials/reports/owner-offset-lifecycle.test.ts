import { afterAll, beforeAll, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { COMPANY, MAKER, OWNER, PROPERTY, OTHER, OTHER_COMPANY } from '@/test/office-creditor-fixture';
import { createOwnerOffsetFixture, offsetFixtureCommand, OTHER_OFFSET_OWNER as OTHER_OWNER } from '@/test/owner-offset-fixture';
import { readFileSync } from 'node:fs';
import { repoRoot } from '@/p1/replay-bootstrap';
import { assumeIdentity } from '@/p1/replay-bootstrap';
const at = (day: number) => `${new Date().toISOString().slice(0,7)}-${String(day).padStart(2,'0')}`;
let db: PGlite; let agreement: string; let property: string; let receivable: string; let settlement: string;
async function command(name: string, payload: Record<string, unknown>) {
  if (!/^[a-z_]+$/.test(name)) throw new Error('Invalid test RPC');
  return (await db.query<{ data: Record<string, unknown> }>(`select public.${name}($1::jsonb) as data`,[JSON.stringify(payload)])).rows[0].data;
}
async function offset(amount: number, request: string) {
  return command('offset_owner_receivable_atomic',{ due_from_owner_id: receivable, owner_settlement_id: settlement, amount, effective_date: at(10), lawful_offset_evidence: 'Approved contractual offset ordering', request_id: request });
}
async function balances(day: number) {
  return (await db.query<{ account_no: string; source: string; control: string; reconciliation_status: string }>("select account_no,subledger_balance::text as source,gl_balance::text as control,reconciliation_status from public.wp05_reconcile_all($1::uuid,$2::date) where account_no in ('1300','2000') order by account_no",[COMPANY,at(day)])).rows;
}
beforeAll(async () => { ({db,agreement,property,settlement,receivable}=await createOwnerOffsetFixture()); },60_000);
afterAll(async()=>{ await db?.close(); });
it('posts separate lawful offsets, retries once, and preserves both historical control accounts',async()=>{
  await db.exec('begin');
  try {
    await offset(25,'offset-first'); await offset(25,'offset-first');
    await offset(5,'offset-second'); await offset(5,'offset-third');
    expect(await balances(8)).toEqual([
      {account_no:'1300',source:'200.000',control:'200.000',reconciliation_status:'PASS'},
      {account_no:'2000',source:'1000.000',control:'1000.000',reconciliation_status:'PASS'},
    ]);
    expect(await balances(10)).toEqual([
      {account_no:'1300',source:'165.000',control:'165.000',reconciliation_status:'PASS'},
      {account_no:'2000',source:'965.000',control:'965.000',reconciliation_status:'PASS'},
    ]);
    expect((await db.query('select id from public.due_from_owner_offsets')).rows).toHaveLength(3);
  } finally { await db.exec('rollback'); }
});
it.each(['owner','property'])('rejects agreement %s mismatch',async label=>{
  const owner=label==='owner'?OTHER_OWNER:OWNER;
  const scope=label==='owner'?property:PROPERTY;
  await db.exec('begin');
  try {
    await expect(command('create_owner_receivable_atomic',{owner_id:owner,owner_agreement_id:agreement,property_id:scope,amount:10,effective_date:at(1),request_id:`invalid-offset-${label}`})).rejects.toThrow(/AGREEMENT.*FORBIDDEN/);
  } finally { await db.exec('rollback'); }
});
it('restores the receivable, payable, and settlement through an explicit idempotent reversal',async()=>{
  await db.exec('begin');
  try {
    await offset(25,'offset-reverse-source');
    const id=(await db.query<{id:string}>('select id from public.due_from_owner_offsets')).rows[0].id;
    const payload={offset_event_id:id,request_id:'offset-reverse',reason:'Offset source correction'};
    await command('reverse_owner_receivable_offset_atomic',payload);
    await command('reverse_owner_receivable_offset_atomic',payload);
    expect((await balances(10)).map(row=>[row.source,row.control])).toEqual([['200.000','200.000'],['1000.000','1000.000']]);
    expect((await db.query<{offset_applied:string}>('select offset_applied::text from public.owner_settlements where id=$1',[settlement])).rows[0].offset_applied).toBe('0.000');
  } finally { await db.exec('rollback'); }
});
it('rejects an over-offset and foreign-company command without changing sources',async()=>{
  await expect(offset(201,'offset-over')).rejects.toThrow(/EXCEEDS_OUTSTANDING/);
  await assumeIdentity(db,OTHER,OTHER_COMPANY);
  try { await expect(offset(10,'offset-foreign')).rejects.toThrow(/NOT_FOUND_OR_FORBIDDEN/); }
  finally { await assumeIdentity(db,MAKER,COMPANY); }
  expect((await db.query('select id from public.due_from_owner_offsets')).rows).toHaveLength(0);
});

it('requires a saved lawful right, not merely caller evidence',async()=>{
  await db.exec('begin');
  try {
    const created=await command('create_owner_receivable_atomic',{owner_id:OWNER,amount:10,effective_date:at(1),request_id:'offset-no-right'});
    await expect(command('offset_owner_receivable_atomic',{due_from_owner_id:created.due_from_owner_id,owner_settlement_id:settlement,amount:5,effective_date:at(10),lawful_offset_evidence:'Caller text is not authority',request_id:'offset-no-right-attempt'})).rejects.toThrow(/OFFSET_RIGHT_MISSING/);
  } finally { await db.exec('rollback'); }
});
it('cannot debit more than the approved owner payable',async()=>{
  await db.exec('begin');
  try {
    const created=await command('create_owner_receivable_atomic',{owner_id:OWNER,owner_agreement_id:agreement,property_id:property,amount:1500,effective_date:at(1),request_id:'offset-large-due'});
    await expect(command('offset_owner_receivable_atomic',{due_from_owner_id:created.due_from_owner_id,owner_settlement_id:settlement,amount:1001,effective_date:at(10),lawful_offset_evidence:'Approved contractual offset ordering',request_id:'offset-negative-payable'})).rejects.toThrow(/EXCEEDS_PAYABLE/);
  } finally { await db.exec('rollback'); }
});
it('does not authorize a disabled identity',async()=>{
  await db.exec('begin');
  try {
    await db.exec('reset role');
    await db.query('update public.users set is_active=false where id=$1::uuid',[MAKER]);
    await db.exec('set role authenticated');
    await expect(offset(5,'offset-disabled')).rejects.toThrow(/ROLE_REQUIRED/);
  } finally { await db.exec('rollback'); }
});
it('retains a pre-migration offset and its retry identity while allowing another operation',async()=>{
  const f=await createOwnerOffsetFixture('20260909000007');
  const run=(name:string,payload:Record<string,unknown>)=>offsetFixtureCommand(f.db,name,payload);
  try {
    const payload={due_from_owner_id:f.receivable,owner_settlement_id:f.settlement,amount:25,effective_date:at(10),lawful_offset_evidence:'Original approved ordering',request_id:'legacy-offset'};
    const first=await run('offset_owner_receivable_atomic',payload);
    const before=(await f.db.query('select id,event_id,effective_date from public.journal_batches order by id')).rows;
    await f.db.exec('reset role');
    await f.db.exec(readFileSync(`${repoRoot}/supabase/migrations/20260909000008_lawful_offset_identity_and_scope.sql`,'utf8'));
    await f.db.exec('set role authenticated');
    expect((await f.db.query('select id,event_id,effective_date from public.journal_batches order by id')).rows).toEqual(before);
    expect(await run('offset_owner_receivable_atomic',payload)).toEqual(first);
    await expect(run('offset_owner_receivable_atomic',{...payload,amount:5})).rejects.toThrow(/IDEMPOTENCY_KEY_REUSED/);
    await run('offset_owner_receivable_atomic',{...payload,amount:5,request_id:'new-offset'});
    const result=await f.db.query("select account_no,subledger_balance::text as source,gl_balance::text as control from public.wp05_reconcile_all($1::uuid,$2::date) where account_no in ('1300','2000') order by account_no",[COMPANY,at(10)]);
    expect(result.rows).toEqual([{account_no:'1300',source:'170.000',control:'170.000'},{account_no:'2000',source:'970.000',control:'970.000'}]);
  } finally { await f.db.close(); }
},60_000);
it('requires an approved unpaid settlement even when owner funds exist',async()=>{
  await db.exec('begin');
  try {
    await command('cancel_owner_settlement_atomic',{settlement_id:settlement,request_id:crypto.randomUUID(),reason:'Settlement order withdrawn'});
    await expect(offset(5,'offset-cancelled-settlement')).rejects.toThrow(/SETTLEMENT_NOT_APPROVED/);
  } finally { await db.exec('rollback'); }
});
