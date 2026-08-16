/**
 * PHASE 2 — Invoice Truth & Billing Integrity.
 *
 * Proves against a full migration replay:
 *   - deterministic billing/due dates from contract policy (billing_day, grace_days)
 *   - idempotent recurring generation (repeat same period -> no duplicate)
 *   - DB-level billing obligation uniqueness (concurrency / duplicate protection,
 *     distinct charge types allowed in the same period)
 *   - posted invoice immutability (document fields blocked, hard delete blocked)
 *   - invoice lineage / cross-company rejection
 *   - document lifecycle (DRAFT -> POSTED) separated from derived payment status
 * See docs/audits/FINANCIAL_HARDENING_AUDIT_20260815.md (F01-F04, F09, F14).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../../p1/replay-bootstrap';

const COMPANY = 'b1000000-0000-4000-8000-000000000001';
const MAKER = 'b1000000-0000-4000-8000-000000000011';
const OTHER = 'b1000000-0000-4000-8000-000000000012';
const OTHER_COMPANY = 'b1000000-0000-4000-8000-000000000002';
const OWNER = 'b1000000-0000-4000-8000-000000000021';
const PROPERTY = 'b1000000-0000-4000-8000-000000000031';
const UNIT = 'b1000000-0000-4000-8000-000000000041';
const TENANT = 'b1000000-0000-4000-8000-000000000051';
const CONTRACT = 'b1000000-0000-4000-8000-000000000061';
const AGREEMENT = 'b1000000-0000-4000-8000-000000000071';

const RENT = 1000;

let db: PGlite;

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug) values
      ('${COMPANY}', 'Phase2 Co', 'phase2-co'),
      ('${OTHER_COMPANY}', 'Other Co', 'phase2-other');

    insert into auth.users (id, email, raw_app_meta_data) values
      ('${MAKER}', 'maker@phase2.test', '{"company_id":"${COMPANY}"}'::jsonb),
      ('${OTHER}', 'other@phase2.test', '{"company_id":"${OTHER_COMPANY}"}'::jsonb);

    insert into public.users (id, email, name, role, status, is_active) values
      ('${MAKER}', 'maker@phase2.test', 'Maker', 'ADMIN', 'ACTIVE', true),
      ('${OTHER}', 'other@phase2.test', 'Other', 'ADMIN', 'ACTIVE', true);

    insert into public.company_members (company_id, user_id, role) values
      ('${COMPANY}', '${MAKER}', 'ADMIN'),
      ('${OTHER_COMPANY}', '${OTHER}', 'ADMIN');

    insert into public.company_settings
      (id, singleton_key, company_name, currency, company_id)
    values (gen_random_uuid(), false, 'Phase2 Co', 'OMR', '${COMPANY}');

    insert into public.owners (id, full_name, name, company_id)
    values ('${OWNER}', 'P2 Owner', 'P2 Owner', '${COMPANY}');

    insert into public.properties (id, title, name, type, address, company_id)
    values ('${PROPERTY}', 'P2 Property', 'P2 Property', 'residential', 'Muscat', '${COMPANY}');

    insert into public.property_owners
      (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
    values ('${PROPERTY}', '${OWNER}', 100, true, date '2026-01-01', '${COMPANY}');

    insert into public.owner_agreements
      (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id)
    values ('${AGREEMENT}', '${OWNER}', '${PROPERTY}', 'property_management', 'RATE', 0, date '2026-01-01', '${COMPANY}');

    insert into public.units (id, property_id, name, unit_number, company_id)
    values ('${UNIT}', '${PROPERTY}', 'P2 Unit', 'P2-1', '${COMPANY}');

    insert into public.people (id, full_name, type, company_id)
    values ('${TENANT}', 'P2 Tenant', 'tenant', '${COMPANY}');

    -- billing_day=15, grace_days=5 => deterministic issue/due dates.
    insert into public.contracts
      (id, property_id, unit_id, tenant_id, agreement_id, start_date, end_date,
       rent_amount, status, company_id, billing_day, grace_days)
    values (
      '${CONTRACT}', '${PROPERTY}', '${UNIT}', '${TENANT}', '${AGREEMENT}',
      date '2026-01-01', date '2026-12-31', ${RENT}, 'active', '${COMPANY}', 15, 5
    );
  `);

  await assumeIdentity(db, MAKER, COMPANY);
  await db.query('select public.provision_company_chart_of_accounts($1::uuid)', [COMPANY]);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

function currentPeriod(): { start: string; end: string; day15: string; due: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-based
  const start = new Date(Date.UTC(y, m, 1));
  const end = new Date(Date.UTC(y, m + 1, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const day15 = new Date(Date.UTC(y, m, Math.min(15, end.getUTCDate())));
  const due = new Date(Date.UTC(y, m + 1, 0 + 5));
  return { start: iso(start), end: iso(end), day15: iso(day15), due: iso(due) };
}

describe('PHASE 2 — invoice truth & billing integrity', () => {
  it('generates an invoice with deterministic billing/due dates from policy', async () => {
    const gen = await db.query<{ count: string }>(
      'select public.generate_invoices_from_active_contracts()::text as count',
    );
    expect(Number(gen.rows[0].count)).toBe(1);

    const p = currentPeriod();
    const { rows } = await db.query<{
      issue_date: string; due_date: string; billing_period_start: string;
      billing_period_end: string; document_status: string; charge_type: string; amount: string;
    }>(
      `select issue_date::text as issue_date, due_date::text as due_date,
              billing_period_start::text as billing_period_start,
              billing_period_end::text as billing_period_end,
              document_status, charge_type, amount::text as amount
         from public.invoices where contract_id::text = $1 and deleted_at is null`,
      [CONTRACT],
    );
    expect(rows.length).toBe(1);
    const inv = rows[0];
    expect(inv.issue_date).toBe(p.day15);
    expect(inv.due_date).toBe(p.due);
    expect(inv.billing_period_start).toBe(p.start);
    expect(inv.billing_period_end).toBe(p.end);
    expect(inv.document_status).toBe('POSTED');
    expect(inv.charge_type).toBe('RENT');
    expect(Number(inv.amount)).toBe(RENT);
  });

  it('is idempotent on repeat generation for the same billing period', async () => {
    const gen = await db.query<{ count: string }>(
      'select public.generate_invoices_from_active_contracts()::text as count',
    );
    expect(Number(gen.rows[0].count)).toBe(0); // no new invoice created

    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.invoices where contract_id::text = $1 and deleted_at is null`,
      [CONTRACT],
    );
    expect(rows[0].n).toBe(1);
  });

  it('rejects a duplicate billing obligation at the DB level (unique index)', async () => {
    const p = currentPeriod();
    await expect(
      db.query(
        `insert into public.invoices
           (contract_id, issue_date, due_date, amount, tax_amount, status, company_id,
            document_status, charge_type, billing_period_start, billing_period_end)
         values ($1::uuid, $2::date, $3::date, 1000, 0, 'UNPAID', $4::uuid,
            'POSTED', 'RENT', $5::date, $6::date)`,
        [CONTRACT, p.start, p.due, COMPANY, p.start, p.end],
      ),
    ).rejects.toThrow(/duplicate key|billing_obligation|23505/);
  });

  it('allows a distinct charge type in the same billing period', async () => {
    const p = currentPeriod();
    await db.query(
      `insert into public.invoices
         (contract_id, issue_date, due_date, amount, tax_amount, status, company_id,
          document_status, charge_type, billing_period_start, billing_period_end)
       values ($1::uuid, $2::date, $3::date, 25.000, 0, 'UNPAID', $4::uuid,
          'POSTED', 'UTILITY', $5::date, $6::date)`,
      [CONTRACT, p.start, p.due, COMPANY, p.start, p.end],
    );
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.invoices
        where contract_id::text = $1 and charge_type = 'UTILITY' and deleted_at is null`,
      [CONTRACT],
    );
    expect(rows[0].n).toBe(1);
  });

  it('blocks edits to financially meaningful fields of a posted invoice', async () => {
    const { rows } = await db.query<{ id: string }>(
      `select id from public.invoices where contract_id::text = $1 and charge_type = 'RENT' limit 1`,
      [CONTRACT],
    );
    const invId = rows[0].id;
    await expect(
      db.query(`update public.invoices set amount = 9999 where id = $1::uuid`, [invId]),
    ).rejects.toThrow(/POSTED_INVOICE_IMMUTABLE|42501/);
    await expect(
      db.query(`update public.invoices set due_date = date '2030-01-01' where id = $1::uuid`, [invId]),
    ).rejects.toThrow(/POSTED_INVOICE_IMMUTABLE|42501/);
    await expect(
      db.query(`delete from public.invoices where id = $1::uuid`, [invId]),
    ).rejects.toThrow(/POSTED_INVOICE_HARD_DELETE_BLOCKED|42501/);
  });

  it('still allows settlement-field updates (paid_amount) through the posting path', async () => {
    const { rows } = await db.query<{ id: string }>(
      `select id from public.invoices where contract_id::text = $1 and charge_type = 'RENT' limit 1`,
      [CONTRACT],
    );
    // posting engine updates paid_amount/status — must not be blocked by the trigger.
    await db.query(
      `update public.invoices set paid_amount = 100, status = 'PARTIALLY_PAID', updated_at = now()
        where id = $1::uuid`,
      [rows[0].id],
    );
    const { rows: chk } = await db.query<{ paid_amount: string }>(
      `select paid_amount::text from public.invoices where id = $1::uuid`, [rows[0].id],
    );
    expect(Number(chk[0].paid_amount)).toBe(100);
  });

  it('enforces DRAFT -> POSTED lifecycle and blocks edits after POST', async () => {
    // Insert a DRAFT invoice (document fields editable while draft).
    const draft = await db.query<{ id: string }>(
      `insert into public.invoices
         (contract_id, issue_date, due_date, amount, tax_amount, status, company_id,
          document_status, charge_type, billing_period_start, billing_period_end)
       values ($1::uuid, date '2026-09-01', date '2026-09-30', 500, 0, 'UNPAID', $2::uuid,
          'DRAFT', 'RENT', date '2026-09-01', date '2026-09-30')
        returning id::text as id`,
      [CONTRACT, COMPANY],
    );
    const draftId = draft.rows[0].id;
    await db.query(`update public.invoices set amount = 600 where id = $1::uuid`, [draftId]);
    // POST the draft (must pass the required-fields check).
    await db.query(`update public.invoices set document_status = 'POSTED' where id = $1::uuid`, [draftId]);
    // After POST, amount is immutable.
    await expect(
      db.query(`update public.invoices set amount = 700 where id = $1::uuid`, [draftId]),
    ).rejects.toThrow(/POSTED_INVOICE_IMMUTABLE|42501/);
  });

  it('rejects cross-company invoice creation at the DB level (lineage)', async () => {
    await expect(
      db.query(
        `insert into public.invoices
           (contract_id, issue_date, due_date, amount, tax_amount, status, company_id,
            document_status, charge_type, billing_period_start, billing_period_end)
         values ($1::uuid, date '2026-09-01', date '2026-09-30', 500, 0, 'UNPAID', $2::uuid,
            'POSTED', 'RENT', date '2026-09-01', date '2026-09-30')`,
        [CONTRACT, OTHER_COMPANY],
      ),
    ).rejects.toThrow(/INVOICE_COMPANY_MISMATCH|42501/);
  });
});
