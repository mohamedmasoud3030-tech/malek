import { afterAll, beforeAll, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createOwnerOffsetFixture, offsetFixtureCommand, offsetDate as at } from '@/test/owner-offset-fixture';
import { COMPANY, MAKER, OTHER, OTHER_COMPANY } from '@/test/office-creditor-fixture';
import { assumeIdentity } from '@/p1/replay-bootstrap';
let db:PGlite;
type Row={account_no:string; account_name:string; gl_balance:string; subledger_balance:string; mismatch:string; is_reconciled:boolean; details:unknown};
async function legacy(day:number){ return (await db.query<Row>('select * from public.gl_reconcile_subledgers($1::date) order by account_no',[at(day)])).rows; }
async function canonical(day:number){ return (await db.query<Row>(`select account_no,account_name,gl_balance,subledger_balance,gl_balance-subledger_balance as mismatch,reconciliation_status='PASS' as is_reconciled,
 jsonb_build_object('account',account_no,'type',case when account_no in ('1201','1300') then 'asset' else 'liability' end) as details
 from public.wp05_reconcile_all($1::uuid,$2::date) where account_no<>'2100' order by account_no`,[COMPANY,at(day)])).rows; }
beforeAll(async()=>{
  const f=await createOwnerOffsetFixture(); db=f.db;
  await offsetFixtureCommand(db,'offset_owner_receivable_atomic',{due_from_owner_id:f.receivable,owner_settlement_id:f.settlement,amount:25,effective_date:at(10),lawful_offset_evidence:'Approved offset order',request_id:'entry-offset'});
},60_000);
afterAll(async()=>{await db?.close();});
it.each([8,10,28])('legacy output is only a shape adapter over canonical history at day %s',async day=>{
  const rows=await legacy(day);
  expect(rows).toHaveLength(5);
  expect(rows).toEqual(await canonical(day));
});
for(const [name,read] of [['legacy',legacy],['canonical',canonical]] as const){
  it(`${name} rejects disabled identities instead of exposing or fabricating balances`,async()=>{
    await db.exec('begin');
    try{
      await db.exec('reset role'); await db.query('update public.users set is_active=false where id=$1::uuid',[MAKER]); await db.exec('set role authenticated');
      await expect(read(10)).rejects.toThrow(/PERMISSION_REQUIRED|AUTH_REQUIRED/);
    }finally{await db.exec('rollback');}
  });
  it(`${name} rejects stale company claims without active membership`,async()=>{
    await assumeIdentity(db,OTHER,COMPANY);
    try{await expect(read(10)).rejects.toThrow(/PERMISSION_REQUIRED|AUTH_REQUIRED/);}
    finally{await assumeIdentity(db,MAKER,COMPANY);}
  });
}
it.each(['ACCOUNTANT','VIEWER'])('authorizes the existing %s report permission without losing ledger rows to leaf RLS',async role=>{
  await db.exec('begin');
  try{
    const expected=await canonical(10);
    await db.exec('reset role');await db.query("update public.company_members set role=$3 where company_id=$1::uuid and user_id=$2::uuid",[COMPANY,MAKER,role]);await db.exec('set role authenticated');
    expect(await canonical(10)).toEqual(expected);
    expect(await legacy(10)).toEqual(expected);
  }finally{await db.exec('rollback');}
});
it('rejects explicit foreign-company report requests',async()=>{
  await expect(db.query('select * from public.wp05_reconcile_all($1::uuid,$2::date)',[OTHER_COMPANY,at(10)])).rejects.toThrow(/COMPANY_ISOLATION/);
});

it('includes the original and compensating reversal in both report contracts',async()=>{
  await db.exec('begin');
  try{
    const event=(await db.query<{id:string}>('select id from public.due_from_owner_offsets')).rows[0].id;
    await offsetFixtureCommand(db,'reverse_owner_receivable_offset_atomic',{offset_event_id:event,request_id:'entry-reverse',reason:'Report reversal parity'});
    const rows=await legacy(10);
    expect(rows).toEqual(await canonical(10));
    expect(rows.find(row=>row.account_no==='1300')).toMatchObject({gl_balance:'200.000',subledger_balance:'200.000'});
  }finally{await db.exec('rollback');}
});
it('keeps the canonical implementation private and denies roles without report permission',async()=>{
  const acl=await db.query<{allowed:boolean}>("select has_function_privilege('authenticated','app_private.financial_reconciliation_core(uuid,date)','execute') as allowed");
  expect(acl.rows[0].allowed).toBe(false);
  await db.exec('begin');
  try{
    await db.exec('reset role');await db.query("update public.company_members set role='OPERATIONS' where company_id=$1::uuid and user_id=$2::uuid",[COMPANY,MAKER]);await db.exec('set role authenticated');
    // Each expected denial aborts only its own implicit transaction outside a
    // savepoint, so use one explicit savepoint per attempted public contract.
    for(const read of [legacy,canonical]){
      await db.exec('savepoint denied_report');
      await expect(read(10)).rejects.toThrow(/PERMISSION_REQUIRED/);
      await db.exec('rollback to savepoint denied_report');
    }
  }finally{await db.exec('rollback');}
});
