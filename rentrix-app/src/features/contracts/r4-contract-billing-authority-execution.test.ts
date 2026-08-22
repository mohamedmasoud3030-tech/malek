/**
 * R4 — Contract → Billing Authority: end-to-end journey proof.
 *
 * Proves against a FULL migration replay that:
 *   1. create_contract_atomic accepts the EXPLICIT billing policy
 *      (billing_day/grace_days), validates it, and persists it — no hidden
 *      billing_day=1 default decides financial dates anymore,
 *   2. the policy is DRAFT-only editable
 *      (update_contract_billing_policy_atomic fails closed on active),
 *   3. Contract activation → billing obligation → invoice generation runs as
 *      ONE journey: submit → approve (maker/checker) → activate (agreement
 *      snapshot) → generate_invoices_from_active_contracts, and the produced
 *      invoice's issue/due dates derive from the CONTRACT policy:
 *        issue_date = billing_day anchored in the current period,
 *        due_date   = billing_period_end + grace_days,
 *   4. regeneration is idempotent (no duplicate obligation),
 *   5. renewal carries the billing policy forward (no silent reset).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../../p1/replay-bootstrap';

const COMPANY = 'f4000000-0000-4000-8000-000000000001';
const MAKER = 'f4000000-0000-4000-8000-000000000011';
const CHECKER = 'f4000000-0000-4000-8000-000000000012';
const OWNER = 'f4000000-0000-4000-8000-000000000021';
const PROPERTY = 'f4000000-0000-4000-8000-000000000031';
const UNIT = 'f4000000-0000-4000-8000-000000000041';
const TENANT = 'f4000000-0000-4000-8000-000000000051';
const AGREEMENT = 'f4000000-0000-4000-8000-000000000071';

const BILLING_DAY = 5;
const GRACE_DAYS = 10;

let db: PGlite;
let contractId = '';

function num(v: unknown) {
  return Number(v ?? NaN);
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug) values ('${COMPANY}', 'R4 Co', 'r4-co');
    insert into auth.users (id, email, raw_app_meta_data) values
      ('${MAKER}', 'maker@r4.test', '{"company_id":"${COMPANY}"}'::jsonb),
      ('${CHECKER}', 'checker@r4.test', '{"company_id":"${COMPANY}"}'::jsonb);
    insert into public.users (id, email, name, role, status, is_active) values
      ('${MAKER}', 'maker@r4.test', 'Maker', 'ADMIN', 'ACTIVE', true),
      ('${CHECKER}', 'checker@r4.test', 'Checker', 'ADMIN', 'ACTIVE', true);
    insert into public.company_members (company_id, user_id, role) values
      ('${COMPANY}', '${MAKER}', 'ADMIN'),
      ('${COMPANY}', '${CHECKER}', 'ADMIN');
    insert into public.company_settings (id, singleton_key, company_name, currency, vat_enabled, vat_rate, company_id)
    values (gen_random_uuid(), true, 'R4 Co', 'OMR', false, 0, '${COMPANY}');
    insert into public.company_tax_profiles
      (id, company_id, version_no, tax_code, tax_rate, effective_from, status, created_by, approved_by, approved_at)
    values ('f4000000-0000-4000-8000-000000000081', '${COMPANY}', 1, 'NON_TAXABLE', 0, date '2020-01-01', 'ACTIVE', '${MAKER}', '${CHECKER}', now());

    insert into public.owners (id, full_name, name, company_id)
    values ('${OWNER}', 'R4 Owner', 'R4 Owner', '${COMPANY}');
    insert into public.properties (id, title, name, type, address, status, company_id)
    values ('${PROPERTY}', 'R4 Property', 'R4 Property', 'residential', 'Muscat', 'active', '${COMPANY}');
    insert into public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
    values ('${PROPERTY}', '${OWNER}', 100, true, date '2020-01-01', '${COMPANY}');
    insert into public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id)
    values ('${AGREEMENT}', '${OWNER}', '${PROPERTY}', 'property_management', 'RATE', 5, date '2020-01-01', '${COMPANY}');
    -- Activation freezes the agreement snapshot: a version must cover the whole
    -- contract period (S04). Supersede any auto-created version explicitly.
    update public.owner_agreement_versions
       set effective_to = date '2019-12-31', superseded_at = now()
     where owner_agreement_id = '${AGREEMENT}'::uuid and superseded_at is null;
    insert into public.owner_agreement_versions
      (id, owner_agreement_id, company_id, version_no, operating_model, collection_role,
       commission_type, commission_value, commission_recognition_basis, effective_from, effective_to)
    values ('f4000000-0000-4000-8000-000000000091', '${AGREEMENT}', '${COMPANY}', 2,
       'OWNER_AGENCY', 'OWNER_IS_CREDITOR', 'RATE', 5, 'ON_COLLECTION', date '2020-01-01', date '2030-12-31');
    update public.owner_agreements set current_version_id = 'f4000000-0000-4000-8000-000000000091' where id = '${AGREEMENT}';
    insert into public.units (id, property_id, name, unit_number, status, rent_amount, company_id)
    values ('${UNIT}', '${PROPERTY}', 'R4-1', 'R4-1', 'available', 500, '${COMPANY}');
    insert into public.people (id, full_name, type, company_id)
    values ('${TENANT}', 'R4 Tenant', 'tenant', '${COMPANY}');
  `);

  await assumeIdentity(db, MAKER, COMPANY);
  // Chart of accounts: invoice generation posts Dr 1201 / Cr 2000 (+2100).
  await db.query('select public.provision_company_chart_of_accounts($1::uuid)', [COMPANY]);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('R4 — contract → billing authority journey', () => {
  it('creates a DRAFT contract with an EXPLICIT billing policy through the official RPC', async () => {
    const { rows } = await db.query<{ out: any }>(
      `select public.create_contract_atomic(
         $1::text, $2::uuid, $3::uuid, $4::uuid,
         date '2026-01-01', date '2026-12-31',
         500, 'monthly', null, 'draft', null, null, null,
         $5::integer, $6::integer
       ) as out`,
      [PROPERTY, UNIT, TENANT, AGREEMENT, BILLING_DAY, GRACE_DAYS],
    );
    const contract = rows[0]?.out as any;
    contractId = String(contract.id);
    expect(contract.status).toBe('draft');
    expect(num(contract.billing_day)).toBe(BILLING_DAY);
    expect(num(contract.grace_days)).toBe(GRACE_DAYS);
  });

  it('rejects an out-of-contract billing policy at the write boundary', async () => {
    await expect(db.query(
      `select public.create_contract_atomic(
         $1::text, $2::uuid, $3::uuid, $4::uuid,
         date '2027-01-01', date '2027-12-31',
         500, 'monthly', null, 'draft', null, null, null, 31, 0)`,
      [PROPERTY, UNIT, TENANT, AGREEMENT],
    )).rejects.toThrow(/CONTRACT_BILLING_DAY_INVALID/);
    await expect(db.query(
      `select public.create_contract_atomic(
         $1::text, $2::uuid, $3::uuid, $4::uuid,
         date '2027-01-01', date '2027-12-31',
         500, 'monthly', null, 'draft', null, null, null, 5, -1)`,
      [PROPERTY, UNIT, TENANT, AGREEMENT],
    )).rejects.toThrow(/CONTRACT_GRACE_DAYS_INVALID/);
  });

  it('allows editing the billing policy while DRAFT', async () => {
    const { rows } = await db.query<{ out: any }>(
      `select public.update_contract_billing_policy_atomic($1::text, 7, 5) as out`,
      [contractId],
    );
    expect(num(rows[0].out.billing_day)).toBe(7);
    expect(num(rows[0].out.grace_days)).toBe(5);
    // Restore the journey policy.
    await db.query(`select public.update_contract_billing_policy_atomic($1::text, ${BILLING_DAY}, ${GRACE_DAYS})`, [contractId]);
  });

  it('runs the full journey: submit → approve → activate → generate invoice with POLICY-derived dates', async () => {
    // Maker submits, a DIFFERENT checker approves (maker/checker separation).
    await db.query(`select public.submit_contract_for_approval_atomic($1::text, 'R4 Maker')`, [contractId]);
    await assumeIdentity(db, CHECKER, COMPANY);
    await db.query(`select public.approve_contract_atomic($1::text, 'R4 Checker')`, [contractId]);
    const activated = (await db.query<{ out: any }>(
      `select public.activate_contract_with_agreement_snapshot_atomic($1::text) as out`,
      [contractId],
    )).rows[0]?.out as any;
    expect(String(activated.status).toLowerCase()).toBe('active');
    // The agreement snapshot froze WITH the billing policy on the contract row.
    expect(num(activated.billing_day)).toBe(BILLING_DAY);
    expect(num(activated.grace_days)).toBe(GRACE_DAYS);

    // Billing obligation → invoice generation (deterministic dates).
    const generated = (await db.query<{ n: number }>(
      `select public.generate_invoices_from_active_contracts() as n`,
    )).rows[0];
    expect(Number(generated.n)).toBe(1);

    const { rows } = await db.query<{ issue_date: string; due_date: string; billing_period_start: string; billing_period_end: string; amount: string; status: string; document_status: string }>(
      `select issue_date::text, due_date::text, billing_period_start::text, billing_period_end::text,
              amount::text, status, document_status
         from public.invoices where contract_id::text = $1 and deleted_at is null`,
      [contractId],
    );
    expect(rows).toHaveLength(1);
    const invoice = rows[0];

    // Declared policy: issue anchors to billing_day inside the current month;
    // due = period end + grace_days.
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const periodEnd = new Date(year, month, 0); // last day of current month
    const expectedIssue = `${year}-${pad(month)}-${pad(BILLING_DAY)}`;
    const expectedDue = new Date(periodEnd);
    expectedDue.setDate(expectedDue.getDate() + GRACE_DAYS);
    const expectedDueText = `${expectedDue.getFullYear()}-${pad(expectedDue.getMonth() + 1)}-${pad(expectedDue.getDate())}`;

    expect(invoice.issue_date).toBe(expectedIssue);
    expect(invoice.due_date).toBe(expectedDueText);
    expect(invoice.billing_period_start).toBe(`${year}-${pad(month)}-01`);
    expect(Number(invoice.amount)).toBe(500);
    expect(invoice.document_status).toBe('POSTED');

    // RC1 accounting model: this agreement is OWNER_IS_CREDITOR, so the rent
    // obligation is OPERATIONAL — no invoice GL batch may exist until
    // collection (INVOICE_RC1_OWNER_CREDITOR_NO_INVOICE_GL). The journey is
    // still financially closed: classification is stamped on the invoice.
    const { rows: cls } = await db.query<{ c: string; n: string }>(
      `select coalesce(invoice_accounting_classification, '') as c, count(*) over ()::text as n
         from public.invoices where contract_id::text = $1 and deleted_at is null`,
      [contractId],
    );
    expect(cls[0].c).toBe('OWNER_AGENCY_OWNER_CREDITOR_OPERATIONAL');
    const { rows: gl } = await db.query<{ n: string }>(
      `select count(*)::text as n
         from public.journal_batches b
        where b.company_id = $1 and b.source_type = 'invoice'`,
      [COMPANY],
    );
    expect(Number(gl[0].n)).toBe(0);
  });

  it('freezes the billing policy after activation (signed financial term)', async () => {
    await expect(
      db.query(`select public.update_contract_billing_policy_atomic($1::text, 9, 3)`, [contractId]),
    ).rejects.toThrow(/CONTRACT_BILLING_POLICY_IMMUTABLE/);
    // Re-asserting the SAME policy is a no-op and stays allowed.
    const { rows } = await db.query<{ out: any }>(
      `select public.update_contract_billing_policy_atomic($1::text, ${BILLING_DAY}, ${GRACE_DAYS}) as out`,
      [contractId],
    );
    expect(num(rows[0].out.billing_day)).toBe(BILLING_DAY);
  });

  it('regeneration is idempotent: the same billing period never bills twice', async () => {
    const again = (await db.query<{ n: number }>(
      `select public.generate_invoices_from_active_contracts() as n`,
    )).rows[0];
    expect(Number(again.n)).toBe(0);
    const { rows } = await db.query<{ n: string }>(
      `select count(*)::text as n from public.invoices where contract_id::text = $1 and deleted_at is null`,
      [contractId],
    );
    expect(Number(rows[0].n)).toBe(1);
  });

  it('renewal carries the billing policy forward — never a silent reset to day 1', async () => {
    await assumeIdentity(db, MAKER, COMPANY);
    const renewed = (await db.query<{ out: any }>(
      `select public.renew_contract_atomic($1::text, $2::jsonb) as out`,
      [contractId, JSON.stringify({ new_start: '2027-01-01', new_end: '2027-12-31', new_amount: 520 })],
    )).rows[0]?.out as any;
    expect(renewed.status).toBe('renewed');
    expect(num(renewed.billing_day)).toBe(BILLING_DAY);
    expect(num(renewed.grace_days)).toBe(GRACE_DAYS);

    const { rows } = await db.query<{ billing_day: number; grace_days: number; status: string }>(
      `select billing_day, grace_days, status from public.contracts where id::text = $1`,
      [String(renewed.new_contract_id)],
    );
    expect(num(rows[0].billing_day)).toBe(BILLING_DAY);
    expect(num(rows[0].grace_days)).toBe(GRACE_DAYS);
    expect(rows[0].status).toBe('draft');

    // DB invariant (contracts_one_live_draft_per_unit_tenant_uidx): only one
    // live draft may exist per unit+tenant. The 2027 renewal draft must be
    // resolved (canonical soft-delete) before a second renewal may be drafted.
    const resolved = (await db.query<{ out: any }>(
      `select public.soft_delete_contract_atomic($1::text) as out`,
      [String(renewed.new_contract_id)],
    )).rows[0]?.out as any;
    expect(resolved.status).toBe('deleted');

    // Explicit override is honored (still validated).
    const renewed2 = (await db.query<{ out: any }>(
      `select public.renew_contract_atomic($1::text, $2::jsonb) as out`,
      [contractId, JSON.stringify({ new_start: '2028-01-01', new_end: '2028-12-31', new_amount: 540, billing_day: 15, grace_days: 3 })],
    )).rows[0]?.out as any;
    expect(num(renewed2.billing_day)).toBe(15);
    expect(num(renewed2.grace_days)).toBe(3);
  });
});
