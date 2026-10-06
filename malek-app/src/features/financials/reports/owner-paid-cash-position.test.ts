import { afterAll, beforeAll, expect, it } from 'vitest';
import { createOwnerOffsetFixture, offsetFixtureCommand, offsetDate } from '@/test/owner-offset-fixture';
import { COMPANY, OWNER } from '@/test/office-creditor-fixture';
import { assumeIdentity } from '@/p1/replay-bootstrap';
let f:Awaited<ReturnType<typeof createOwnerOffsetFixture>>;
const CHECKER='c2000000-0000-4000-8000-000000000099';
beforeAll(async()=>{
  f=await createOwnerOffsetFixture();
  await offsetFixtureCommand(f.db,'offset_owner_receivable_atomic',{due_from_owner_id:f.receivable,owner_settlement_id:f.settlement,amount:25,effective_date:offsetDate(2),lawful_offset_evidence:'Contract priority',request_id:'position-offset'});
  await assumeIdentity(f.db,CHECKER,COMPANY);
  await offsetFixtureCommand(f.db,'pay_owner_settlement_atomic',{settlement_id:f.settlement,method:'bank_transfer',payment_reference:'Position cash',request_id:'position-pay'});
},60_000);
afterAll(async()=>{await f?.db.close();});
async function position(from=offsetDate(1),to=offsetDate(28)){
 return (await f.db.query<{data:{lifecycle_all_time:Record<string,unknown>}}>('select public.rpt_owner_financial_position($1,$2::date,$3::date) as data',[OWNER,from,to])).rows[0].data;
}
it('separates settled entitlement from original cash using the shared source authority',async()=>{
 expect((await position()).lifecycle_all_time).toMatchObject({paid_net:1000,paid_cash:975,paid_cash_proven_total:975,paid_cash_evidence_missing_count:0,remaining_payable:0});
});
it('keeps lifecycle cash explicitly all-time rather than subtracting it from one period',async()=>{
 expect((await position('2025-01-01','2025-01-31')).lifecycle_all_time).toMatchObject({paid_cash:975,paid_cash_evidence_missing_count:0});
});
it('marks the total unknown when any imported paid history is unproven, retaining the proven subtotal',async()=>{
 await f.db.exec('begin;reset role');
 try{
  // Explicit historical-import fixture without a journal or cached payment ACK.
  await f.db.query("insert into public.owner_settlements(id,company_id,owner_id,status,gross_collected,net_payable,method,approved_at,approved_by,paid_at,paid_by) values('position-legacy-unknown',$1,$2,'PAID',100,100,'bank_transfer',now(),$3,now(),$3)",[COMPANY,OWNER,CHECKER]);
  await f.db.exec('set local role authenticated');
  expect((await position()).lifecycle_all_time).toMatchObject({paid_net:1100,paid_cash:null,paid_cash_proven_total:975,paid_cash_evidence_missing_count:1});
 }finally{await f.db.exec('rollback');}
});
