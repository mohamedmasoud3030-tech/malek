import { expect, test } from '@playwright/test';
import { COMPANY } from '../src/test/office-creditor-fixture';
import { createOwnerOffsetFixture, offsetFixtureCommand, offsetDate } from '../src/test/owner-offset-fixture';
import { assumeIdentity } from '../src/p1/replay-bootstrap';
import { installAcceptanceBrowser } from './support/document-acceptance-session';
import { installFakeSupabaseBackend } from './support/fake-supabase-backend';

test('bank suggestions and confirmation use posted owner cash, and expose failed source reads', async ({page}) => {
  test.setTimeout(120_000);
  const f=await createOwnerOffsetFixture();const db=f.db;
  const run=(name:string,payload:Record<string,unknown>)=>offsetFixtureCommand(db,name,payload);
  try {
    await run('offset_owner_receivable_atomic',{due_from_owner_id:f.receivable,owner_settlement_id:f.settlement,amount:20.125,effective_date:offsetDate(2),lawful_offset_evidence:'Saved agreement priority',request_id:'bank-offset'});
    await assumeIdentity(db,'c2000000-0000-4000-8000-000000000099',COMPANY);
    const paid=await run('pay_owner_settlement_atomic',{settlement_id:f.settlement,method:'bank_transfer',payment_reference:'Bank evidence',request_id:'bank-payout'});
    expect(paid.effective_payable).toBe(979.875);
    await db.exec('reset role');
    const bank=(await db.query<{id:string}>('insert into public.bank_accounts(company_id,account_name) values($1,$2) returning id',[COMPANY,'Payout evidence bank'])).rows[0].id;
    await db.exec('set role authenticated');
    // The bank day must be the COMPANY calendar day, not the UTC day. The
    // settlement's paid_at is now(), and bankReconciliationService compares it
    // via toCompanyDateKey(..., 'Asia/Muscat'). Using the UTC date made this
    // spec fail every day between 20:00 and 24:00 UTC, when Muscat has already
    // rolled over: datedSettlements came back empty, the cash-evidence RPC was
    // never called, and the 503 error state under test could not appear.
    const bankDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Muscat',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const line=await run('create_bank_statement_line_governed',{bank_account_id:bank,transaction_date:bankDay,amount:-979.875,description:'Residual owner payout',reference:'bank-source-proof'});
    const batches=(await db.query('select id from public.journal_batches order by id')).rows;
    await installAcceptanceBrowser(page);
    const seed=await installFakeSupabaseBackend(page);
    for(const table of ['bank_accounts','owner_settlements']) {
      seed.tables[table]=(await db.query<Record<string,unknown>>(`select * from public.${table} where company_id=$1`,[COMPANY])).rows;
    }
    // No unrelated synthetic cash candidates in this SQL-backed source case.
    for(const table of ['expenses','deposit_refund_events','commissions','receipts','tenant_deposits','journal_batches','journal_lines'])seed.tables[table]=[];
    await page.route(/\/rest\/v1\/bank_statement_lines(?:\?|$)/,async route=>{
      const rows=(await db.query<{row:unknown}>('select to_jsonb(l) as row from public.bank_statement_lines l where company_id=$1 order by transaction_date desc,id desc',[COMPANY])).rows.map(result=>result.row);
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rows)});
    });
    let unavailable=true;
    await page.route('**/rest/v1/rpc/get_owner_settlement_cash_payments',async route=>{
      if(unavailable){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Cash evidence temporarily unavailable'})});return;}
      const {p_settlement_ids}=route.request().postDataJSON();
      const data=(await db.query('select public.get_owner_settlement_cash_payments($1::text[]) as data',[p_settlement_ids])).rows[0].data;
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
    });
    await page.route('**/rest/v1/rpc/process_bank_reconciliation_match_atomic',async route=>{
      const {payload}=route.request().postDataJSON();
      const data=(await db.query('select to_jsonb(public.process_bank_reconciliation_match_atomic($1::jsonb)) as data',[JSON.stringify(payload)])).rows[0].data;
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
    });
    await page.goto('/financials?section=banking&view=bank_reconciliation');
    if((page.viewportSize()?.width??1440)<640) await page.getByRole('button',{name:'إجراءات إضافية',exact:true}).click();
    await page.getByRole('button',{name:'مطابقة حركة',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'مطابقة حركة بنكية'});
    await expect(dialog.getByText('تعذر تحميل اقتراحات المطابقة',{exact:true})).toBeVisible();
    await expect(dialog.getByText('لا توجد اقتراحات تلقائية بنفس التاريخ والمبلغ.',{exact:true})).toBeHidden();
    unavailable=false;
    await dialog.getByRole('button',{name:/إعادة المحاولة/}).click();
    const candidate=dialog.getByRole('button',{name:/صرف تسوية مالك/});
    await expect(candidate).toContainText(/979[.,]875|٩٧٩٫٨٧٥/);
    await candidate.click();
    await expect(dialog.getByPlaceholder('معرف السجل')).toHaveValue(f.settlement);
    await expect(dialog.getByPlaceholder('مبلغ المطابقة')).toHaveValue('-979.875');
    await dialog.getByRole('button',{name:'تأكيد المطابقة',exact:true}).click();
    await expect(dialog).toBeHidden();
    expect((await db.query('select matched_entity_id,matched_amount::text from public.bank_reconciliation_matches where statement_line_id=$1',[line.id])).rows).toEqual([{matched_entity_id:f.settlement,matched_amount:'-979.875'}]);
    expect((await db.query('select status from public.bank_statement_lines where id=$1',[line.id])).rows).toEqual([{status:'matched'}]);
    expect((await db.query('select id from public.journal_batches order by id')).rows).toEqual(batches);
  } finally {await db.close();}
});
