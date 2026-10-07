import { afterAll, beforeAll, expect, it } from 'vitest';
import { createOwnerOffsetFixture, offsetFixtureCommand, offsetDate } from '@/test/owner-offset-fixture';
import { COMPANY, MAKER, OTHER, OTHER_COMPANY, OWNER } from '@/test/office-creditor-fixture';
import { readFileSync } from 'node:fs';
import { assumeIdentity, repoRoot } from '@/p1/replay-bootstrap';

let f: Awaited<ReturnType<typeof createOwnerOffsetFixture>>;
const CHECKER = 'c2000000-0000-4000-8000-000000000099';
const BANK = 'c2000000-0000-4000-8000-000000000097';
const today = () => new Date().toISOString().slice(0,10);
const command = (name: string, payload: Record<string, unknown>) => offsetFixtureCommand(f.db, name, payload);
beforeAll(async () => {
  f = await createOwnerOffsetFixture();
  await command('offset_owner_receivable_atomic', {due_from_owner_id:f.receivable, owner_settlement_id:f.settlement, amount:25,
    effective_date:offsetDate(2), lawful_offset_evidence:'Saved contractual priority', request_id:'cash-offset'});
  await assumeIdentity(f.db, CHECKER, COMPANY);
  const paid = await command('pay_owner_settlement_atomic', {settlement_id:f.settlement,method:'bank_transfer',payment_reference:'cash-proof',request_id:'cash-pay'});
  expect(paid.effective_payable).toBe(975);
  await f.db.exec('reset role');
  await f.db.query('insert into public.bank_accounts(id,company_id,account_name) values($1,$2,$3)', [BANK, COMPANY, 'Cash authority bank']);
  await assumeIdentity(f.db, CHECKER, COMPANY);
  await f.db.exec('set role authenticated');
},60_000);
afterAll(async () => { await f?.db.close(); });

async function match(amount:number) {
  const line = await command('create_bank_statement_line_governed', {bank_account_id:BANK, transaction_date:today(), amount, description:'Payout bank evidence', reference:crypto.randomUUID()});
  return (await f.db.query<{data: Record<string, unknown>}>('select to_jsonb(public.process_bank_reconciliation_match_atomic($1::jsonb)) as data', [JSON.stringify({statement_line_id:line.id, matched_entity_type:'owner_payout', matched_entity_id:f.settlement, matched_amount:amount})])).rows[0].data;
}
it('rejects matching the original entitlement instead of the posted residual cash', async () => {
  await f.db.exec('begin');
  try { await expect(match(-1000)).rejects.toThrow(/amount does not match/); }
  finally { await f.db.exec('rollback'); }
});
it('matches the actual residual cash without another financial posting', async () => {
  await f.db.exec('begin');
  try {
    const before = await f.db.query('select count(*) from public.journal_batches');
    await expect(match(-975)).resolves.toMatchObject({matched_entity_type:'owner_payout',matched_amount:-975});
    expect((await f.db.query('select count(*) from public.journal_batches')).rows).toEqual(before.rows);
  } finally { await f.db.exec('rollback'); }
});

const cashRead = async (db = f.db, ids = [f.settlement]) =>
  (await db.query<{data:{settlement_id:string;cash_paid:number|null}[]}>('select public.get_owner_settlement_cash_payments($1::text[]) as data',[ids])).rows[0].data;
it('reads cash under actual authenticated privileges and deduplicates a bounded request', async () => {
  expect(await cashRead(f.db,[f.settlement,f.settlement])).toEqual([{settlement_id:f.settlement,cash_paid:975}]);
  expect(await cashRead(f.db,[])).toEqual([]);
  await expect(cashRead(f.db,Array(201).fill(f.settlement))).rejects.toThrow(/BATCH_INVALID/);
  await expect(f.db.query('select app_private.owner_settlement_paid_cash($1,$2)',[COMPANY,f.settlement])).rejects.toThrow(/permission denied/);
});
it('does not disclose cash for a settlement in another company', async () => {
  await assumeIdentity(f.db,OTHER,OTHER_COMPANY);
  try { await expect(cashRead()).rejects.toThrow(/NOT_FOUND_OR_FORBIDDEN/); }
  finally { await assumeIdentity(f.db,CHECKER,COMPANY); }
});
it('fails closed for a disabled identity', async () => {
  await f.db.exec('begin; reset role');
  try {
    await f.db.query('update public.users set is_active=false where id=$1',[CHECKER]);
    await f.db.exec('set local role authenticated');
    await expect(cashRead()).rejects.toThrow(/PERMISSION_REQUIRED/);
  } finally { await f.db.exec('rollback'); }
});
it('does not mistake missing imported historical evidence for zero cash', async () => {
  // Explicit malformed legacy-import fixture, not a governed payout simulation.
  await f.db.exec('begin; reset role');
  try {
    await f.db.query("insert into public.owner_settlements(id,company_id,owner_id,status,gross_collected,net_payable,method,approved_at,approved_by,paid_at,paid_by) values('legacy-unproven-cash',$1,$2,'PAID',100,100,'bank_transfer',now(),$3,now(),$3)",[COMPANY,OWNER,CHECKER]);
    await f.db.exec('set local role authenticated');
    expect(await cashRead(f.db,['legacy-unproven-cash'])).toEqual([{settlement_id:'legacy-unproven-cash',cash_paid:null}]);
    const line=await command('create_bank_statement_line_governed',{bank_account_id:BANK,transaction_date:today(),amount:-100,description:'Legacy evidence missing',reference:crypto.randomUUID()});
    await expect(command('process_bank_reconciliation_match_atomic',{statement_line_id:line.id,matched_entity_type:'owner_payout',matched_entity_id:'legacy-unproven-cash',matched_amount:-100})).rejects.toThrow(/CASH_EVIDENCE_REQUIRED/);
  } finally { await f.db.exec('rollback'); }
});
it('proves a fully-offset closure from its original acknowledgement, without a cash journal', async () => {
  const zero=await createOwnerOffsetFixture();
  const run=(name:string,payload:Record<string,unknown>)=>offsetFixtureCommand(zero.db,name,payload);
  try {
    const extra=await run('create_owner_receivable_atomic',{owner_id:OWNER,owner_agreement_id:zero.agreement,property_id:zero.property,amount:800,effective_date:offsetDate(1),request_id:'zero-extra'});
    for (const [id,amount] of [[zero.receivable,200],[extra.due_from_owner_id,800]] as const) {
      await run('offset_owner_receivable_atomic',{due_from_owner_id:id,owner_settlement_id:zero.settlement,amount,effective_date:offsetDate(2),lawful_offset_evidence:'Contractually authorized',request_id:crypto.randomUUID()});
    }
    await assumeIdentity(zero.db,CHECKER,COMPANY);
    const paid=await run('pay_owner_settlement_atomic',{settlement_id:zero.settlement,method:'bank_transfer',payment_reference:'offset only',request_id:'zero-payout'});
    expect(paid).toMatchObject({effective_payable:0,journal_batch_id:null});
    expect(await cashRead(zero.db,[zero.settlement])).toEqual([{settlement_id:zero.settlement,cash_paid:0}]);
  } finally { await zero.db.close(); }
},60_000);
it('reads original cash after an old post-payout offset reversal without rewriting the old source discrepancy', async () => {
  const old=await createOwnerOffsetFixture('20260909000011_expense_correction_review_source.sql');
  const run=(name:string,payload:Record<string,unknown>)=>offsetFixtureCommand(old.db,name,payload);
  try {
    await run('offset_owner_receivable_atomic',{due_from_owner_id:old.receivable,owner_settlement_id:old.settlement,amount:25,effective_date:offsetDate(2),lawful_offset_evidence:'Saved contractual authority',request_id:'historical-offset'});
    await assumeIdentity(old.db,CHECKER,COMPANY);
    const paid=await run('pay_owner_settlement_atomic',{settlement_id:old.settlement,method:'bank_transfer',payment_reference:'historical cash',request_id:'historical-pay'});
    expect(paid.effective_payable).toBe(975);
    await assumeIdentity(old.db,MAKER,COMPANY);
    await run('reverse_owner_receivable_offset_atomic',{offset_event_id:(await old.db.query<{id:string}>('select id from public.due_from_owner_offsets where owner_settlement_id=$1',[old.settlement])).rows[0].id,reason:'Historically allowed reversal',request_id:'historical-reverse'});
    const snapshot=async()=> (await old.db.query('select to_jsonb(e) as row from public.owner_funds_events e order by id')).rows;
    const before=await snapshot();
    expect(before.some((r:any)=>r.row.source_type==='OWNER_SETTLEMENT_PAYOUT' && Number(r.row.amount_delta)===-1000)).toBe(true);
    await old.db.exec('reset role');
    for (const migration of ['20260909000012_owner_expense_allocation_source.sql','20260909000013_owner_offset_settlement_finality.sql','20260909000014_owner_settlement_payment_quote.sql','20260909000015_owner_payout_cash_authority.sql']) {
      await old.db.exec(readFileSync(`${repoRoot}/supabase/migrations/${migration}`,'utf8'));
    }
    await old.db.exec('set role authenticated');
    expect(Number((await old.db.query<{offset_applied:string}>('select offset_applied from public.owner_settlements where id=$1',[old.settlement])).rows[0].offset_applied)).toBe(0);
    expect(await cashRead(old.db,[old.settlement])).toEqual([{settlement_id:old.settlement,cash_paid:975}]);
    expect(await snapshot()).toEqual(before);
    await assumeIdentity(old.db,CHECKER,COMPANY);
    expect(await run('pay_owner_settlement_atomic',{settlement_id:old.settlement,method:'bank_transfer',payment_reference:'historical cash',request_id:'historical-pay'})).toMatchObject({effective_payable:975,idempotent:true});
  } finally { await old.db.close(); }
},60_000);
