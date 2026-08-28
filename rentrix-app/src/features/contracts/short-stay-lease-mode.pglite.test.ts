/**
 * Short Stay lease mode (P2) — authoritative PGlite integration proof.
 *
 * Exercises the real callable chain on the fully replayed schema:
 *   create_contract_atomic_v2 (mode + reference rate validation)
 *   → approval/activation
 *   → generate_invoices_from_active_contracts (one invoice per stay)
 *   → idempotent regeneration
 *   → update_contract_atomic_v2 (draft edit + active term freeze)
 *
 * Long-term contracts on the same run keep the recurring calendar behavior.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../../p1/replay-bootstrap';

const COMPANY = 'e1000000-0000-4000-8000-000000000001';
const MAKER = 'e1000000-0000-4000-8000-000000000011';
const CHECKER = 'e1000000-0000-4000-8000-000000000012';
const OWNER = 'e1000000-0000-4000-8000-000000000021';
const AGREEMENT = 'e1000000-0000-4000-8000-000000000031';
const VERSION = 'e1000000-0000-4000-8000-000000000041';
const PROPERTY = 'e1000000-0000-4000-8000-000000000051';
const LONG_UNIT = 'e1000000-0000-4000-8000-000000000061';
const STAY_UNIT = 'e1000000-0000-4000-8000-000000000062';
const TENANT = 'e1000000-0000-4000-8000-000000000071';
const TENANT2 = 'e1000000-0000-4000-8000-000000000072';

const LONG_RENT = 450;
const STAY_TOTAL = 300;
const STAY_DAILY_RATE = 100;

let db: PGlite;
let stayContractId = '';
let longContractId = '';

async function firstError(work: () => Promise<unknown>): Promise<string> {
  try {
    await work();
    return '';
  } catch (error) {
    return String((error as { message?: string })?.message ?? error);
  }
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function currentMonthRange() {
  const now = new Date();
  const from = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const to = iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)));
  return { from, to };
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  expect(replay.applied.some((file) => file.includes('20260901000037_short_stay_lease_mode'))).toBe(true);
  db = replay.db;

  const { from, to } = currentMonthRange();

  await db.exec(`
    insert into public.companies (id, name, slug, is_active) values
      ('${COMPANY}', 'شركة الإقامة القصيرة', 'short-stay-co', true);
    insert into auth.users (id, email, raw_app_meta_data) values
      ('${MAKER}', 'maker@short-stay.test', '{"company_id":"${COMPANY}"}'::jsonb),
      ('${CHECKER}', 'checker@short-stay.test', '{"company_id":"${COMPANY}"}'::jsonb);
    insert into public.users (id, email, name, role, status, is_active) values
      ('${MAKER}', 'maker@short-stay.test', 'Maker', 'ADMIN', 'ACTIVE', true),
      ('${CHECKER}', 'checker@short-stay.test', 'Checker', 'ADMIN', 'ACTIVE', true);
    insert into public.company_members (company_id, user_id, role, is_active) values
      ('${COMPANY}', '${MAKER}', 'MANAGER', true),
      ('${COMPANY}', '${CHECKER}', 'MANAGER', true);
    insert into public.company_settings (id, singleton_key, company_name, currency, vat_enabled, vat_rate, company_id)
    values (gen_random_uuid(), true, 'شركة الإقامة القصيرة', 'OMR', false, 0, '${COMPANY}');
    insert into public.company_tax_profiles
      (id, company_id, version_no, tax_code, tax_rate, effective_from, status, created_by, approved_by, approved_at)
    values ('e1000000-0000-4000-8000-000000000081', '${COMPANY}', 1, 'NON_TAXABLE', 0, date '2020-01-01', 'ACTIVE', '${MAKER}', '${CHECKER}', now());
    insert into public.company_fee_tax_treatments
      (id, company_id, fee_kind, version_no, tax_code, tax_rate, effective_from, status, created_by, approved_by, approved_at)
    values ('e1000000-0000-4000-8000-000000000082', '${COMPANY}', 'RATE_MANAGEMENT_FEE', 1, 'NON_TAXABLE', 0, date '2020-01-01', 'ACTIVE', '${MAKER}', '${CHECKER}', now());
    insert into public.owners (id, full_name, name, company_id)
    values ('${OWNER}', 'مالك الإقامة', 'مالك الإقامة', '${COMPANY}');
    insert into public.properties (id, title, name, type, address, status, company_id)
    values ('${PROPERTY}', 'عقار الإقامة', 'عقار الإقامة', 'residential', 'Muscat', 'active', '${COMPANY}');
    insert into public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
    values ('${PROPERTY}', '${OWNER}', 100, true, date '2020-01-01', '${COMPANY}');
    insert into public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id)
    values ('${AGREEMENT}', '${OWNER}', '${PROPERTY}', 'property_management', 'RATE', 10, date '2020-01-01', '${COMPANY}');
    update public.owner_agreement_versions
       set effective_to = date '2019-12-31', superseded_at = now()
     where owner_agreement_id = '${AGREEMENT}'::uuid and superseded_at is null;
    insert into public.owner_agreement_versions
      (id, owner_agreement_id, company_id, version_no, operating_model, collection_role,
       commission_type, commission_value, commission_recognition_basis, offset_allowed,
       reserve_amount, effective_from, effective_to, created_by)
    values ('${VERSION}', '${AGREEMENT}', '${COMPANY}', 2,
       'OWNER_AGENCY', 'OFFICE_IS_CREDITOR', 'RATE', 10, 'ON_COLLECTION', false, 0,
       date '2020-01-01', date '2030-12-31', '${MAKER}');
    update public.owner_agreements set current_version_id = '${VERSION}' where id = '${AGREEMENT}';
    insert into public.units (id, property_id, name, unit_number, status, rent_amount, company_id)
    values
      ('${LONG_UNIT}', '${PROPERTY}', 'L-1', 'L-1', 'available', ${LONG_RENT}, '${COMPANY}'),
      ('${STAY_UNIT}', '${PROPERTY}', 'S-1', 'S-1', 'available', ${STAY_DAILY_RATE}, '${COMPANY}');
    insert into public.people (id, full_name, type, company_id)
    values
      ('${TENANT}', 'مستأجر طويل المدى', 'tenant', '${COMPANY}'),
      ('${TENANT2}', 'ضيف الإقامة', 'tenant', '${COMPANY}');
  `);

  await assumeIdentity(db, MAKER, COMPANY);
  await db.query('select public.provision_company_chart_of_accounts($1::uuid)', [COMPANY]);

  // Long-term draft on one unit.
  const longCreated = (await db.query<{ out: Record<string, unknown> }>(
    `select public.create_contract_atomic_v2(
       $1::text, $2::uuid, $3::uuid, $4::uuid,
       date '2020-01-01', date '2030-12-31',
       ${LONG_RENT}, 'monthly', null, 'draft', null, null, null, 1, 0) as out`,
    [PROPERTY, LONG_UNIT, TENANT, AGREEMENT],
  )).rows[0]?.out;
  longContractId = String(longCreated?.id);

  // Short-stay draft on another unit of the same property, inside the current month.
  const stayCreated = (await db.query<{ out: Record<string, unknown> }>(
    `select public.create_contract_atomic_v2(
       $1::text, $2::uuid, $3::uuid, $4::uuid,
       date '${from}', date '${to}',
       ${STAY_TOTAL}, 'monthly', null, 'draft', null, null, null, 1, 2,
       'short_stay', ${STAY_DAILY_RATE}) as out`,
    [PROPERTY, STAY_UNIT, TENANT2, AGREEMENT],
  )).rows[0]?.out;
  stayContractId = String(stayCreated?.id);
  expect(String(stayCreated?.lease_mode)).toBe('short_stay');
  expect(Number(stayCreated?.daily_reference_rate)).toBe(STAY_DAILY_RATE);

  // Approval chain then activation for both contracts.
  for (const contractId of [longContractId, stayContractId]) {
    await db.query(`select public.submit_contract_for_approval_atomic($1::text, 'Short Stay Maker')`, [contractId]);
    await assumeIdentity(db, CHECKER, COMPANY);
    await db.query(`select public.approve_contract_atomic($1::text, 'Short Stay Checker')`, [contractId]);
    await assumeIdentity(db, MAKER, COMPANY);
    const activated = (await db.query<{ out: Record<string, unknown> }>(
      `select public.activate_contract_with_agreement_snapshot_atomic($1::text) as out`,
      [contractId],
    )).rows[0]?.out;
    expect(String(activated?.status).toLowerCase()).toBe('active');
  }
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('short stay lease mode — RPC validation', () => {
  it('rejects an unknown lease mode', async () => {
    await assumeIdentity(db, MAKER, COMPANY);
    const { from, to } = currentMonthRange();
    const error = await firstError(() => db.query(
      `select public.create_contract_atomic_v2(
         $1::text, $2::uuid, $3::uuid, $4::uuid,
         date '${from}', date '${to}',
         100, 'monthly', null, 'draft', null, null, null, 1, 0, 'hotel')`,
      [PROPERTY, STAY_UNIT, TENANT2, AGREEMENT],
    ));
    expect(error).toMatch(/CONTRACT_LEASE_MODE_INVALID/i);
  });

  it('rejects a reference daily rate on a long-term contract', async () => {
    await assumeIdentity(db, MAKER, COMPANY);
    const { from, to } = currentMonthRange();
    const error = await firstError(() => db.query(
      `select public.create_contract_atomic_v2(
         $1::text, $2::uuid, $3::uuid, $4::uuid,
         date '${from}', date '${to}',
         100, 'monthly', null, 'draft', null, null, null, 1, 0,
         'long_term', 25)`,
      [PROPERTY, STAY_UNIT, TENANT2, AGREEMENT],
    ));
    expect(error).toMatch(/CONTRACT_DAILY_RATE_REQUIRES_SHORT_STAY/i);
  });

  it('rejects a reference daily rate beyond OMR 3dp precision', async () => {
    await assumeIdentity(db, MAKER, COMPANY);
    const { from, to } = currentMonthRange();
    const error = await firstError(() => db.query(
      `select public.create_contract_atomic_v2(
         $1::text, $2::uuid, $3::uuid, $4::uuid,
         date '${from}', date '${to}',
         100, 'monthly', null, 'draft', null, null, null, 1, 0,
         'short_stay', 25.0004)`,
      [PROPERTY, STAY_UNIT, TENANT2, AGREEMENT],
    ));
    expect(error).toMatch(/CONTRACT_DAILY_RATE_OMR_3DP_INVALID/i);
  });

  it('defaults the mode to long_term and the reference rate to null', async () => {
    const { rows } = await db.query<{ lease_mode: string; daily_reference_rate: string | null }>(
      `select lease_mode, daily_reference_rate::text from public.contracts where id::text = $1`,
      [longContractId],
    );
    expect(rows[0].lease_mode).toBe('long_term');
    expect(rows[0].daily_reference_rate).toBeNull();
  });
});

describe('short stay lease mode — billing integration', () => {
  it('issues exactly one invoice per short stay covering the whole stay, due at arrival + grace', async () => {
    await assumeIdentity(db, MAKER, COMPANY);
    const generated = (await db.query<{ n: string }>(
      `select public.generate_invoices_from_active_contracts()::text as n`,
    )).rows[0];
    // One for the long-term contract (current month) + one for the stay.
    expect(Number(generated.n)).toBe(2);

    const { from, to } = currentMonthRange();
    const { rows } = await db.query<{
      id: string;
      amount: string;
      due_date: string;
      billing_period_start: string;
      billing_period_end: string;
      charge_type: string;
      document_status: string;
      status: string;
    }>(
      `select id::text, amount::text, due_date::text, billing_period_start::text,
              billing_period_end::text, charge_type, document_status, status
         from public.invoices
        where contract_id::text = $1 and deleted_at is null`,
      [stayContractId],
    );
    expect(rows).toHaveLength(1);
    const invoice = rows[0];
    expect(Number(invoice.amount)).toBe(STAY_TOTAL);
    expect(invoice.charge_type).toBe('RENT');
    expect(invoice.document_status).toBe('POSTED');
    expect(invoice.status).toBe('UNPAID');
    expect(invoice.billing_period_start).toBe(from);
    expect(invoice.billing_period_end).toBe(to);
    // grace_days = 2 on the stay contract → due at arrival + 2 days.
    expect(invoice.due_date).toBe(iso(new Date(new Date(`${from}T00:00:00Z`).getTime() + 2 * 86_400_000)));
  });

  it('keeps the long-term contract on the recurring calendar-cycle behavior', async () => {
    const { from, to } = currentMonthRange();
    const { rows } = await db.query<{ amount: string; billing_period_start: string; billing_period_end: string; due_date: string }>(
      `select amount::text, billing_period_start::text, billing_period_end::text, due_date::text
         from public.invoices
        where contract_id::text = $1 and deleted_at is null`,
      [longContractId],
    );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].amount)).toBe(LONG_RENT);
    expect(rows[0].billing_period_start).toBe(from);
    expect(rows[0].billing_period_end).toBe(to);
    // Long-term due date = period end + 0 grace.
    expect(rows[0].due_date).toBe(to);
  });

  it('is idempotent: regenerating does not duplicate the stay invoice', async () => {
    await assumeIdentity(db, MAKER, COMPANY);
    const regenerated = (await db.query<{ n: string }>(
      `select public.generate_invoices_from_active_contracts()::text as n`,
    )).rows[0];
    expect(Number(regenerated.n)).toBe(0);

    const { rows } = await db.query<{ count: string }>(
      `select count(*)::text as count from public.invoices
        where contract_id::text = $1 and deleted_at is null`,
      [stayContractId],
    );
    expect(Number(rows[0].count)).toBe(1);
  });

  it('posts the stay invoice through the canonical owner-agency journal (Dr 1201 / Cr 2000)', async () => {
    const { rows } = await db.query<{ net_debit: string }>(
      `select coalesce(sum(jl.debit - jl.credit), 0)::text as net_debit
         from public.journal_lines jl
         join public.journal_batches jb on jb.id = jl.batch_id
         join public.accounts a on a.id = jl.account_id and a.company_id = jb.company_id
        where jb.company_id = $1::uuid
          and jb.status in ('POSTED', 'REVERSED')
          and a.no = '1201'`,
      [COMPANY],
    );
    // 1201 carries AR only for OFFICE_IS_CREDITOR invoices: stay + long-term.
    expect(Number(rows[0].net_debit)).toBe(STAY_TOTAL + LONG_RENT);

    const { rows: ownerFunds } = await db.query<{ net_credit: string }>(
      `select coalesce(sum(jl.credit - jl.debit), 0)::text as net_credit
         from public.journal_lines jl
         join public.journal_batches jb on jb.id = jl.batch_id
         join public.accounts a on a.id = jl.account_id and a.company_id = jb.company_id
        where jb.company_id = $1::uuid
          and jb.status in ('POSTED', 'REVERSED')
          and a.no = '2000'`,
      [COMPANY],
    );
    expect(Number(ownerFunds[0].net_credit)).toBe(STAY_TOTAL + LONG_RENT);
  });
});

describe('short stay lease mode — edit authority', () => {
  it('freezes the lease mode once the contract is active', async () => {
    await assumeIdentity(db, MAKER, COMPANY);
    const { from, to } = currentMonthRange();
    const error = await firstError(() => db.query(
      `select public.update_contract_atomic_v2(
         $1::text, $2::text, $3::uuid, $4::uuid, $5::uuid,
         date '${from}', date '${to}',
         ${STAY_TOTAL}, 'monthly', null, 'active', null, null, null,
         'long_term', null)`,
      [stayContractId, PROPERTY, STAY_UNIT, TENANT2, AGREEMENT],
    ));
    expect(error).toMatch(/CONTRACT_SIGNED_TERMS_IMMUTABLE/i);
  });
});
