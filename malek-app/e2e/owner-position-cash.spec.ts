import { expect,test } from '@playwright/test';
import { COMPANY,OWNER } from '../src/test/office-creditor-fixture';
import { createOwnerOffsetFixture,offsetFixtureCommand,offsetDate } from '../src/test/owner-offset-fixture';
import { assumeIdentity } from '../src/p1/replay-bootstrap';
import { installAcceptanceBrowser } from './support/document-acceptance-session';
import { installFakeSupabaseBackend } from './support/fake-supabase-backend';

test('owner position distinguishes settled entitlement, proven cash and incomplete historical evidence',async({page})=>{
 test.setTimeout(120_000);
 const f=await createOwnerOffsetFixture();const db=f.db;
 const checker='c2000000-0000-4000-8000-000000000099';
 try{
  await offsetFixtureCommand(db,'offset_owner_receivable_atomic',{due_from_owner_id:f.receivable,owner_settlement_id:f.settlement,amount:25,effective_date:offsetDate(2),lawful_offset_evidence:'Contractual offset',request_id:'position-offset'});
  await assumeIdentity(db,checker,COMPANY);
  await offsetFixtureCommand(db,'pay_owner_settlement_atomic',{settlement_id:f.settlement,method:'bank_transfer',payment_reference:'Cash evidence',request_id:'position-pay'});
  const journals=(await db.query('select id from public.journal_batches order by id')).rows;
  await installAcceptanceBrowser(page);
  const seed=await installFakeSupabaseBackend(page);
  seed.tables.owners=(await db.query<{row:Record<string,unknown>}>('select to_jsonb(o) as row from public.owners o where company_id=$1',[COMPANY])).rows.map(r=>r.row);
  // Match the real PostgREST nested relation consumed by the owner dossier.
  seed.tables.properties=(await db.query<{row:Record<string,unknown>}>(
    "select to_jsonb(p)||jsonb_build_object('property_owners',jsonb_agg(to_jsonb(po))) as row from public.properties p join public.property_owners po on po.property_id=p.id where po.owner_id=$1 and p.company_id=$2 group by p.id",[OWNER,COMPANY])).rows.map(r=>r.row);
  for(const table of ['units','contracts','invoices']) {
    seed.tables[table]=(await db.query<{row:Record<string,unknown>}>(`select to_jsonb(t) as row from public.${table} t where company_id=$1`,[COMPANY])).rows.map(r=>r.row);
  }
  for(const rpc of ['rpt_owner_financial_position','rpt_owner_statement']){
   await page.route(`**/rest/v1/rpc/${rpc}`,async route=>{
    const {p_owner_id,p_from,p_to}=route.request().postDataJSON();
    const data=(await db.query(`select public.${rpc}($1,$2::date,$3::date) as data`,[p_owner_id,p_from,p_to])).rows[0].data;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
   });
  }
  await page.goto(`/owners/${OWNER}`);
  await page.getByRole('tab',{name:'الموقف المالي',exact:true}).click();
  const section=page.locator('[data-owner-financial-authority]');
  await section.getByText('دورة التسويات عبر كل الفترات',{exact:true}).click();
  const cash=section.getByText('النقد المصروف المثبت — كل الفترات',{exact:true}).locator('..');
  await expect(cash).toContainText(/975[.,]000|٩٧٥٫٠٠٠/);
  await expect(section.getByText('استحقاقات التسويات المسوّاة',{exact:true}).locator('..')).toContainText(/1,000[.,]000|١٬٠٠٠٫٠٠٠/);
  // Explicit malformed historical-import fixture only; never a modern payout.
  await db.exec('reset role');
  await db.query("insert into public.owner_settlements(id,company_id,owner_id,status,gross_collected,net_payable,method,approved_at,approved_by,paid_at,paid_by) values('ui-legacy-unknown',$1,$2,'PAID',100,100,'bank_transfer',now(),$3,now(),$3)",[COMPANY,OWNER,checker]);
  await db.exec('set role authenticated');
  await section.getByRole('button',{name:'تحديث',exact:true}).click();
  await expect(cash).toContainText('غير مكتمل الإثبات');
  await expect(section.getByRole('alert')).toContainText('ليس إجمالي الصرف الكامل');
  await expect(section.getByRole('alert')).toContainText(/975[.,]000|٩٧٥٫٠٠٠/);
  expect((await db.query('select id from public.journal_batches order by id')).rows).toEqual(journals);
 }finally{await db.close();}
});
