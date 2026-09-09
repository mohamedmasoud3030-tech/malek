import type { PGlite } from '@electric-sql/pglite';
import { COMPANY, MAKER, OTHER, OWNER } from './office-creditor-fixture';

/** Prerequisite property/tax configuration, followed by the governed agreement
 * creation RPC. No accrual, balance or journal rows are fabricated here. */
export async function createFixedFeeAgreementFixture(db: PGlite, from: string, monthlyAmount: number, taxRate = 7) {
  const property = crypto.randomUUID();
  await db.exec('reset role');
  try {
    await db.query("insert into public.properties(id,title,name,type,address,company_id) values($1,'Fixed fee','Fixed fee','residential','Muscat',$2)", [property, COMPANY]);
    await db.query('insert into public.property_owners(property_id,owner_id,ownership_percentage,is_primary,starts_on,company_id) values($1,$2,100,true,$3::date,$4)', [property, OWNER, from, COMPANY]);
    await db.query(`insert into public.company_fee_tax_treatments(id,company_id,fee_kind,version_no,tax_code,tax_rate,effective_from,status,created_by,approved_by,approved_at)
      values(gen_random_uuid(),$1,'FIXED_MONTHLY',1,'VAT',$2,$3::date,'ACTIVE',$4,$5,now())`, [COMPANY, taxRate, from, MAKER, OTHER]);
  } finally { await db.exec('set role authenticated'); }
  const created = await db.query<{ data: { id: string } }>('select public.create_owner_agreement_with_version_atomic($1::jsonb) as data', [JSON.stringify({
    owner_id: OWNER, property_id: property, agreement_type: 'property_management', operating_model: 'OWNER_AGENCY',
    collection_role: 'OWNER_IS_CREDITOR', commission_type: 'FIXED_MONTHLY', commission_value: monthlyAmount,
    starts_on: from, deposit_beneficiary: 'OWNER', deposit_custodian: 'OFFICE',
  })]);
  return created.rows[0].data.id;
}
