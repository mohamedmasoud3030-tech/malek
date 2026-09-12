/**
 * PHASE 5 — Financial operations: contract → billing → invoice truth.
 *
 * The "Financial actions" class of the core-data-operations matrix:
 * an ACTIVE contract's rent obligation must produce a correctly persisted
 * invoice (amount, billing window, issue/due dates derived from the
 * contract's billing policy), the RC1 accounting classification must be
 * stamped, regeneration must be idempotent, and the billing policy must be
 * frozen after activation.
 *
 * Mirrors the established R4 journey pattern (full migration replay,
 * provisioned chart of accounts, NON_TAXABLE profile) so dates and amounts
 * are deterministic. Invoice creation is the governed
 * generate_invoices_from_active_contracts RPC (no direct table writes).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../../p1/replay-bootstrap';

const COMPANY = 'ba000000-0000-4000-8000-000000000001';
const MAKER = 'ba000000-0000-4000-8000-000000000011';
const CHECKER = 'ba000000-0000-4000-8000-000000000012';
const CHECKER2 = 'ba000000-0000-4000-8000-000000000013';
const OWNER = 'ba000000-0000-4000-8000-000000000021';
const PROPERTY = 'ba000000-0000-4000-8000-000000000031';
const UNIT = 'ba000000-0000-4000-8000-000000000041';
const TENANT = 'ba000000-0000-4000-8000-000000000051';
const AGREEMENT = 'ba000000-0000-4000-8000-000000000071';
const VERSION_2 = 'ba000000-0000-4000-8000-000000000091';

const RENT = 600;
const BILLING_DAY = 5;
const GRACE_DAYS = 10;

let db: PGlite;
let contractId = '';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug) values ('${COMPANY}', 'Matrix Fin Co', 'matrix-fin-co');
    insert into auth.users (id, email, raw_app_meta_data) values
      ('${MAKER}', 'maker@fin5.test', '{\"company_id\":\"${COMPANY}\"}'::jsonb),
      ('${CHECKER}', 'checker@fin5.test', '{\"company_id\":\"${COMPANY}\"}'::jsonb),
      ('${CHECKER2}', 'checker2@fin5.test', '{\"company_id\":\"${COMPANY}\"}'::jsonb);
    insert into public.users (id, email, name, role, status, is_active) values
      ('${MAKER}', 'maker@fin5.test', 'Maker', 'ADMIN', 'ACTIVE', true),
      ('${CHECKER}', 'checker@fin5.test', 'Checker', 'ADMIN', 'ACTIVE', true),
      ('${CHECKER2}', 'checker2@fin5.test', 'Checker 2', 'ADMIN', 'ACTIVE', true);
    insert into public.company_members (company_id, user_id, role) values
      ('${COMPANY}', '${MAKER}', 'ADMIN'),
      ('${COMPANY}', '${CHECKER}', 'ADMIN'),
      ('${COMPANY}', '${CHECKER2}', 'ADMIN');
    insert into public.company_settings (id, singleton_key, company_name, currency, vat_enabled, vat_rate, company_id)
    values (gen_random_uuid(), true, 'Matrix Fin Co', 'OMR', false, 0, '${COMPANY}');
    insert into public.company_tax_profiles
      (id, company_id, version_no, tax_code, tax_rate, effective_from, status, created_by, approved_by, approved_at)
    values (gen_random_uuid(), '${COMPANY}', 1, 'NON_TAXABLE', 0, date '2020-01-01', 'ACTIVE', '${MAKER}', '${CHECKER}', now());

    insert into public.owners (id, full_name, name, company_id)
    values ('${OWNER}', 'Matrix Owner', 'Matrix Owner', '${COMPANY}');
    insert into public.properties (id, title, name, type, address, status, company_id)
    values ('${PROPERTY}', 'Matrix Fin Property', 'Matrix Fin Property', 'residential', 'Muscat', 'active', '${COMPANY}');
    insert into public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
    values ('${PROPERTY}', '${OWNER}', 100, true, date '2020-01-01', '${COMPANY}');
    insert into public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id)
    values ('${AGREEMENT}', '${OWNER}', '${PROPERTY}', 'property_management', 'RATE', 5, date '2020-01-01', '${COMPANY}');
    update public.owner_agreement_versions
       set effective_to = date '2019-12-31', superseded_at = now()
     where owner_agreement_id = '${AGREEMENT}'::uuid and superseded_at is null;
    insert into public.owner_agreement_versions
      (id, owner_agreement_id, company_id, version_no, operating_model, collection_role,
       commission_type, commission_value, commission_recognition_basis, effective_from, effective_to)
    values ('${VERSION_2}', '${AGREEMENT}', '${COMPANY}', 2,
       'OWNER_AGENCY', 'OWNER_IS_CREDITOR', 'RATE', 5, 'ON_COLLECTION', date '2020-01-01', date '2030-12-31');
    update public.owner_agreements set current_version_id = '${VERSION_2}' where id = '${AGREEMENT}';
    insert into public.units (id, property_id, name, unit_number, status, rent_amount, company_id)
    values ('${UNIT}', '${PROPERTY}', 'MF-1', 'MF-1', 'available', ${RENT}, '${COMPANY}');
    insert into public.people (id, full_name, type, company_id)
    values ('${TENANT}', 'Matrix Tenant', 'tenant', '${COMPANY}');
  `);

  await assumeIdentity(db, MAKER, COMPANY);
  await db.query('select public.provision_company_chart_of_accounts($1::uuid)', [COMPANY]);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('FINANCIAL — contract rent obligation → persisted invoice truth', () => {
  it('journey: create draft → submit → approve (maker/checker) → activate', async () => {
    const { rows } = await db.query<{ out: string }>(
      `select public.create_contract_atomic_v2(
         $1::text, $2::uuid, $3::uuid, $4::uuid,
         date '2026-09-01', date '2027-08-31', ${RENT}, 'monthly',
         null::uuid, 'draft', null, null, null, ${BILLING_DAY}, ${GRACE_DAYS}, 'long_term', null
       )::text as out`,
      [PROPERTY, UNIT, TENANT, AGREEMENT],
    );
    contractId = (JSON.parse(rows[0].out) as { id: string }).id;

    await db.query(`select public.submit_contract_for_approval_atomic($1::text, 'fin-maker-sig')`, [contractId]);
    await assumeIdentity(db, CHECKER, COMPANY);
    const { rows: appr } = await db.query<{ out: string }>(
      `select public.approve_contract_atomic($1::text, 'fin-checker-sig')::text as out`,
      [contractId],
    );
    expect(String(JSON.parse(appr[0].out).status).toUpperCase()).toContain('APPROVED');
    await assumeIdentity(db, MAKER, COMPANY);
    const { rows: act } = await db.query<{ out: string }>(
      `select public.activate_contract_with_agreement_snapshot_atomic($1::text)::text as out`,
      [contractId],
    );
    expect(String(JSON.parse(act[0].out).status).toLowerCase()).toBe('active');
  });

  it('generate_invoices_from_active_contracts produces exactly one correct invoice', async () => {
    const { rows } = await db.query<{ n: number }>(
      'select public.generate_invoices_from_active_contracts() as n',
    );
    expect(Number(rows[0].n)).toBe(1);

    const { rows: inv } = await db.query<{
      issue_date: string; due_date: string; period_start: string; period_end: string;
      amount: string; status: string; document_status: string; classification: string;
    }>(
      `select issue_date::text, due_date::text, billing_period_start::text as period_start,
              billing_period_end::text as period_end,
              amount::text, status, document_status,
              coalesce(invoice_accounting_classification, '') as classification
         from public.invoices where contract_id::text = $1 and deleted_at is null`,
      [contractId],
    );
    expect(inv).toHaveLength(1);

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const periodEnd = new Date(year, month, 0);
    const expectedIssue = `${year}-${pad(month)}-${pad(BILLING_DAY)}`;
    const expectedDue = new Date(periodEnd);
    expectedDue.setDate(expectedDue.getDate() + GRACE_DAYS);
    const expectedDueText = `${expectedDue.getFullYear()}-${pad(expectedDue.getMonth() + 1)}-${pad(expectedDue.getDate())}`;

    // The persisted financial truth: rent amount, policy-derived dates, POSTED.
    expect(Number(inv[0].amount)).toBe(RENT);
    expect(inv[0].issue_date).toBe(expectedIssue);
    expect(inv[0].due_date).toBe(expectedDueText);
    expect(inv[0].period_start).toBe(`${year}-${pad(month)}-01`);
    expect(inv[0].document_status).toBe('POSTED');
    // RC1: OWNER_AGENCY + OWNER_IS_CREDITOR rent obligation is OPERATIONAL.
    expect(inv[0].classification).toBe('OWNER_AGENCY_OWNER_CREDITOR_OPERATIONAL');
  });

  it('OPERATIONAL owner-creditor invoices post no invoice GL batch until collection', async () => {
    const { rows } = await db.query<{ n: string }>(
      `select count(*)::text as n from public.journal_batches
        where company_id = $1::uuid and source_type = 'invoice'`,
      [COMPANY],
    );
    expect(Number(rows[0].n)).toBe(0);
  });

  it('regeneration is idempotent: the same billing period never bills twice', async () => {
    const { rows } = await db.query<{ n: number }>(
      'select public.generate_invoices_from_active_contracts() as n',
    );
    expect(Number(rows[0].n)).toBe(0);
    const { rows: inv } = await db.query<{ n: string }>(
      'select count(*)::text as n from public.invoices where contract_id::text = $1 and deleted_at is null',
      [contractId],
    );
    expect(Number(inv[0].n)).toBe(1);
  });

  it('the billing policy is frozen after activation (signed financial term)', async () => {
    await expect(
      db.query(`select public.update_contract_billing_policy_atomic($1::text, 9, 3)`, [contractId]),
    ).rejects.toThrow(/CONTRACT_BILLING_POLICY_IMMUTABLE/i);
    const { rows } = await db.query<{ billing_day: number; grace_days: number }>(
      'select billing_day, grace_days from public.contracts where id = $1::uuid',
      [contractId],
    );
    expect(rows[0].billing_day).toBe(BILLING_DAY);
    expect(rows[0].grace_days).toBe(GRACE_DAYS);
  });

  it('PERSISTENCE: the invoice survives a fresh read as the browser identity', async () => {
    const claims = JSON.stringify({ sub: MAKER, role: 'authenticated', app_metadata: { company_id: COMPANY } });
    await db.exec('begin');
    try {
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
      await db.exec('set local role authenticated');
      const res = await db.query(
        `select id, amount::text as amount, due_date::text as due_date
           from public.invoices where contract_id::text = $1 and deleted_at is null`,
        [contractId],
      );
      await db.exec('commit');
      expect(res.rows).toHaveLength(1);
      expect(Number((res.rows[0] as { amount: string }).amount)).toBe(RENT);
    } catch (error) {
      await db.exec('rollback').catch(() => undefined);
      throw error;
    }
  });
});
