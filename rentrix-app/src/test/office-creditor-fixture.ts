import { strict as assert } from 'node:assert';
import { assumeIdentity, createFullReplayedDatabase } from '../p1/replay-bootstrap';

export const COMPANY = 'c2000000-0000-4000-8000-000000000001';
export const MAKER = 'c2000000-0000-4000-8000-000000000011';
export const OTHER = 'c2000000-0000-4000-8000-000000000012';
export const OTHER_COMPANY = 'c2000000-0000-4000-8000-000000000002';
export const OWNER = 'c2000000-0000-4000-8000-000000000021';
export const PROPERTY = 'c2000000-0000-4000-8000-000000000031';
export const UNIT = 'c2000000-0000-4000-8000-000000000041';
export const TENANT = 'c2000000-0000-4000-8000-000000000051';
export const CONTRACT = 'c2000000-0000-4000-8000-000000000061';
export const AGREEMENT = 'c2000000-0000-4000-8000-000000000071';

export const RENT = 1000;


/** Disposable, fully replayed OFFICE_IS_CREDITOR context. Transactions under test
 * must go through governed RPCs; these rows are prerequisite fixture state only. */
export async function createOfficeCreditorFixture() {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  assert.deepEqual(replay.failed, []);
  const db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug) values
      ('${COMPANY}', 'Phase3 Co', 'phase3-co'),
      ('${OTHER_COMPANY}', 'Other Co', 'phase3-other');

    insert into auth.users (id, email, raw_app_meta_data) values
      ('${MAKER}', 'maker@phase3.test', '{"company_id":"${COMPANY}"}'::jsonb),
      ('${OTHER}', 'other@phase3.test', '{"company_id":"${OTHER_COMPANY}"}'::jsonb);

    insert into public.users (id, email, name, role, status, is_active) values
      ('${MAKER}', 'maker@phase3.test', 'Maker', 'ADMIN', 'ACTIVE', true),
      ('${OTHER}', 'other@phase3.test', 'Other', 'ADMIN', 'ACTIVE', true);

    insert into public.company_members (company_id, user_id, role) values
      ('${COMPANY}', '${MAKER}', 'ADMIN'),
      ('${OTHER_COMPANY}', '${OTHER}', 'ADMIN');

    -- vat_rate 0 keeps the credit split exact (rent only).
    insert into public.company_settings
      (id, singleton_key, company_name, currency, default_vat_rate, vat_enabled, vat_rate, company_id)
    values (gen_random_uuid(), true, 'Phase3 Co', 'OMR', 0, false, 0, '${COMPANY}');
    insert into public.company_tax_profiles
      (id, company_id, version_no, tax_code, tax_rate, effective_from, status, created_by, approved_by, approved_at)
    values
      ('c2000000-0000-4000-8000-000000000082', '${COMPANY}', 1, 'NON_TAXABLE', 0, date '2020-01-01', 'ACTIVE', '${MAKER}', '${OTHER}', now());

    insert into public.owners (id, full_name, name, company_id)
    values ('${OWNER}', 'P3 Owner', 'P3 Owner', '${COMPANY}');
    insert into public.properties (id, title, name, type, address, company_id)
    values ('${PROPERTY}', 'P3 Property', 'P3 Property', 'residential', 'Muscat', '${COMPANY}');
    insert into public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
    values ('${PROPERTY}', '${OWNER}', 100, true, date '2026-01-01', '${COMPANY}');
    insert into public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id)
    values ('${AGREEMENT}', '${OWNER}', '${PROPERTY}', 'property_management', 'RATE', 0, date '2026-01-01', '${COMPANY}');
    -- This credit/reversal suite is the OFFICE_IS_CREDITOR AR model; create a
    -- successor version before the contract freezes its source terms.
    update public.owner_agreement_versions
       set effective_to = date '2025-12-31', superseded_at = now()
     where owner_agreement_id = '${AGREEMENT}'::uuid and superseded_at is null;
    insert into public.owner_agreement_versions
      (id, owner_agreement_id, company_id, version_no, operating_model, collection_role,
       commission_type, commission_value, commission_recognition_basis, offset_allowed,
       reserve_amount, effective_from, created_by)
    values
      ('c2000000-0000-4000-8000-000000000081', '${AGREEMENT}', '${COMPANY}', 2,
       'OWNER_AGENCY', 'OFFICE_IS_CREDITOR', 'RATE', 0, 'ON_COLLECTION', false, 0,
       date '2026-01-01', '${MAKER}');
    update public.owner_agreements
       set current_version_id = 'c2000000-0000-4000-8000-000000000081'::uuid
     where id = '${AGREEMENT}'::uuid;
    insert into public.units (id, property_id, name, unit_number, company_id)
    values ('${UNIT}', '${PROPERTY}', 'P3 Unit', 'P3-1', '${COMPANY}');
    insert into public.people (id, full_name, type, company_id)
    values ('${TENANT}', 'P3 Tenant', 'tenant', '${COMPANY}');
    insert into public.contracts (id, property_id, unit_id, tenant_id, agreement_id, start_date, end_date, rent_amount, status, company_id)
    values ('${CONTRACT}', '${PROPERTY}', '${UNIT}', '${TENANT}', '${AGREEMENT}',
            date '2026-01-01', date '2026-12-31', ${RENT}, 'active', '${COMPANY}');
  `);

  await assumeIdentity(db, MAKER, COMPANY);
  await db.query('select public.provision_company_chart_of_accounts($1::uuid)', [COMPANY]);
  const gen = await db.query<{ count: string }>('select public.generate_invoices_from_active_contracts()::text as count');
  assert.equal(Number(gen.rows[0].count), 1);
  const { rows } = await db.query<{ id: string }>(
    `select id from public.invoices where contract_id::text = $1 and deleted_at is null limit 1`, [CONTRACT],
  );
  const invoiceId = rows[0].id;
  return { db, invoiceId };
}
