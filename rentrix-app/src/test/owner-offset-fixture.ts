import { strict as assert } from 'node:assert';
import type { PGlite } from '@electric-sql/pglite';
import { COMPANY, MAKER, OWNER, PROPERTY, createOfficeCreditorFixture } from './office-creditor-fixture';
import { createFixedFeeAgreementFixture } from './fixed-fee-fixture';
import { assumeIdentity } from '../p1/replay-bootstrap';
const CHECKER = 'c2000000-0000-4000-8000-000000000099';
export const OTHER_OFFSET_OWNER = 'c2000000-0000-4000-8000-000000000098';
export const offsetDate = (day: number) => `${new Date().toISOString().slice(0,7)}-${String(day).padStart(2,'0')}`;
export async function offsetFixtureCommand(db: PGlite, name: string, payload: Record<string, unknown>) {
  if (!/^[a-z_]+$/.test(name)) throw new Error('Invalid test RPC');
  return (await db.query<{ data: Record<string, unknown> }>(`select public.${name}($1::jsonb) as data`,[JSON.stringify(payload)])).rows[0].data;
}
/** Governed collection -> maker/checker-approved settlement -> scoped receivable.
 * Only identity/ownership/tax prerequisites are seeded, never financial rows. */
export async function createOwnerOffsetFixture(throughMigration?: string) {

  const fixture = await createOfficeCreditorFixture({ throughMigration }); const db=fixture.db;
  const command = (name: string, payload: Record<string, unknown>) => offsetFixtureCommand(db,name,payload);
  await db.exec(`insert into auth.users(id,email) values ('${CHECKER}','offset-checker@test.local');
    insert into public.users(id,email,name,role,status,is_active) values ('${CHECKER}','offset-checker@test.local','Checker','ADMIN','ACTIVE',true);
    insert into public.company_members(company_id,user_id,role) values ('${COMPANY}','${CHECKER}','ADMIN');
    insert into public.owners(id,name,full_name,company_id) values ('${OTHER_OFFSET_OWNER}','Other owner','Other owner','${COMPANY}');`);
  const agreement=await createFixedFeeAgreementFixture(db,offsetDate(1),0,7,true);
  const property=(await db.query<{ property_id: string }>('select property_id from public.owner_agreements where id=$1::uuid',[agreement])).rows[0].property_id;
  await command('record_invoice_payment_atomic',{invoice_id:fixture.invoiceId,amount:1000,method:'cash',date:offsetDate(1),request_id:'offset-funds'});
  const draft=await command('create_owner_settlement_draft_atomic',{owner_id:OWNER,property_id:PROPERTY,period_start:offsetDate(1),period_end:offsetDate(28),request_id:crypto.randomUUID()});
  const settlement=String(draft.settlement_id ?? draft.id);
  assert.equal(Number(draft.net_payable),1000);
  await assumeIdentity(db,CHECKER,COMPANY);
  await command('approve_owner_settlement_atomic',{settlement_id:settlement,request_id:crypto.randomUUID()});
  await assumeIdentity(db,MAKER,COMPANY);
  const created=await command('create_owner_receivable_atomic',{owner_id:OWNER,owner_agreement_id:agreement,property_id:property,amount:200,effective_date:offsetDate(1),request_id:'offset-due'});
  const receivable=String(created.due_from_owner_id);
  return { db, agreement, property, settlement, receivable };
}
