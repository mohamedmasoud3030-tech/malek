/**
 * R13 — Dashboard collection rate: invoice-cohort realization proof.
 *
 * Proves against a FULL migration replay that rpt_dashboard_snapshot's
 * collection_rate compares economically coherent values:
 *
 *   collection_rate = collected_against_period / collectible_period
 *
 * over the period invoice set (issue_date in [from,to], not VOID/CANCELLED):
 *   collectible       = amount + tax - credited_amount
 *   collected_against = least(paid_amount, collectible)
 *
 * This is the corrected business invariant (invoice-cohort realization), NOT
 * the old mismatched "period cash / period invoice issue" ratio. The fixture
 * deliberately separates the cohorts:
 *
 *   invA  issue in period, fully paid (100/100)          -> cohort
 *   invB  issue BEFORE period, paid by in-period cash    -> NOT cohort
 *   invC  issue in period, gross 100, credit 50, paid 50 -> cohort, fully
 *                                                           satisfied by credit
 *   invD  issue in period, partial (40/100)              -> cohort
 *
 * Expected: collectible = 100 + 50 + 100 = 250,
 *           collected   = 100 + 50 +  40 = 190  -> rate 76%.
 * Meanwhile cash collected this period (collected_amount) is 300 (invA 100 +
 * invB 200; the VOID 999 is excluded) — proving cash ≠ cohort-collected.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../../p1/replay-bootstrap';

const COMPANY = 'f3000000-0000-4000-8000-000000000001';
const OTHER_COMPANY = 'f3000000-0000-4000-8000-000000000002';
const ADMIN = 'f3000000-0000-4000-8000-000000000011';
const OTHER_ADMIN = 'f3000000-0000-4000-8000-000000000012';
const PROPERTY = 'f3000000-0000-4000-8000-000000000031';
const UNIT = 'f3000000-0000-4000-8000-000000000041';
const TENANT = 'f3000000-0000-4000-8000-000000000051';
const CONTRACT = 'f3000000-0000-4000-8000-000000000061';

const FROM = '2026-08-01';
const TO = '2026-08-31';
const AS_OF = '2026-08-31';

let db: PGlite;

async function snapshot(from = FROM, to = TO): Promise<Record<string, any>> {
  const { rows } = await db.query<{ value: string }>(
    `select public.rpt_dashboard_snapshot($1::date, $2::date, $3::date)::text as value`,
    [from, to, AS_OF],
  );
  return JSON.parse(rows[0]?.value ?? '{}');
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug) values
      ('${COMPANY}', 'R13 Co', 'r13-co'),
      ('${OTHER_COMPANY}', 'R13 Other', 'r13-other');

    insert into auth.users (id, email, raw_app_meta_data) values
      ('${ADMIN}', 'admin@r13.test', '{"company_id":"${COMPANY}"}'::jsonb),
      ('${OTHER_ADMIN}', 'other@r13.test', '{"company_id":"${OTHER_COMPANY}"}'::jsonb);

    insert into public.users (id, email, name, role, status, is_active) values
      ('${ADMIN}', 'admin@r13.test', 'Admin', 'ADMIN', 'ACTIVE', true),
      ('${OTHER_ADMIN}', 'other@r13.test', 'Other', 'ADMIN', 'ACTIVE', true);

    insert into public.company_members (company_id, user_id, role) values
      ('${COMPANY}', '${ADMIN}', 'ADMIN'),
      ('${OTHER_COMPANY}', '${OTHER_ADMIN}', 'ADMIN');

    insert into public.owners (id, full_name, name, company_id)
    values ('f3000000-0000-4000-8000-000000000021', 'R13 Owner', 'R13 Owner', '${COMPANY}');
    insert into public.properties (id, title, name, type, address, company_id)
    values ('${PROPERTY}', 'R13 Property', 'R13 Property', 'residential', 'Muscat', '${COMPANY}');
    insert into public.units (id, property_id, name, unit_number, status, company_id)
    values ('${UNIT}', '${PROPERTY}', 'R13-1', 'R13-1', 'occupied', '${COMPANY}');
    insert into public.people (id, full_name, type, company_id)
    values ('${TENANT}', 'R13 Tenant', 'tenant', '${COMPANY}');
    insert into public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
    values ('${PROPERTY}', 'f3000000-0000-4000-8000-000000000021', 100, true, date '2020-01-01', '${COMPANY}');
    insert into public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id)
    values ('f3000000-0000-4000-8000-000000000071', 'f3000000-0000-4000-8000-000000000021', '${PROPERTY}', 'property_management', 'RATE', 0, date '2020-01-01', '${COMPANY}');
    insert into public.contracts (id, property_id, unit_id, tenant_id, agreement_id, start_date, end_date, rent_amount, status, company_id)
    values ('${CONTRACT}', '${PROPERTY}', '${UNIT}', '${TENANT}', 'f3000000-0000-4000-8000-000000000071', '2026-01-01', '2026-12-31', 1000, 'active', '${COMPANY}');
  `);

  // Period cohort invoices (issue_date inside [from,to]).
  await db.exec(`
    insert into public.invoices (id, contract_id, issue_date, due_date, amount, tax_amount, paid_amount, credited_amount, status, company_id) values
      ('f3000000-0000-4000-8000-000000000101', '${CONTRACT}', date '2026-08-03', date '2026-08-10', 100, 0, 100, 0, 'PAID', '${COMPANY}'),
      ('f3000000-0000-4000-8000-000000000103', '${CONTRACT}', date '2026-08-05', date '2026-08-12', 100, 0, 50, 50, 'PAID', '${COMPANY}'),
      ('f3000000-0000-4000-8000-000000000104', '${CONTRACT}', date '2026-08-07', date '2026-08-14', 100, 0, 40, 0, 'PARTIALLY_PAID', '${COMPANY}');

    -- Prior-period invoice (issue BEFORE the period) settled by in-period cash.
    insert into public.invoices (id, contract_id, issue_date, due_date, amount, tax_amount, paid_amount, credited_amount, status, company_id) values
      ('f3000000-0000-4000-8000-000000000102', '${CONTRACT}', date '2026-07-01', date '2026-07-08', 200, 0, 200, 0, 'PAID', '${COMPANY}');
  `);

  // Receipts + payments: cash in the period. P1 (invA) and P2 (invB, prior
  // invoice) are POSTED; P3 is VOID and must be excluded everywhere.
  await db.exec(`
    insert into public.receipts (id, contract_id, tenant_id, amount, status, request_id, company_id) values
      ('f3000000-0000-4000-8000-000000000201', '${CONTRACT}', '${TENANT}', 100, 'POSTED', 'r13-p1', '${COMPANY}'),
      ('f3000000-0000-4000-8000-000000000202', '${CONTRACT}', '${TENANT}', 200, 'POSTED', 'r13-p2', '${COMPANY}'),
      ('f3000000-0000-4000-8000-000000000203', '${CONTRACT}', '${TENANT}', 999, 'VOID', 'r13-p3', '${COMPANY}');

    insert into public.payments (receipt_id, invoice_id, contract_id, amount, payment_method, payment_date, status, company_id) values
      ('f3000000-0000-4000-8000-000000000201', 'f3000000-0000-4000-8000-000000000101', '${CONTRACT}', 100, 'cash', date '2026-08-10', 'POSTED', '${COMPANY}'),
      ('f3000000-0000-4000-8000-000000000202', 'f3000000-0000-4000-8000-000000000102', '${CONTRACT}', 200, 'cash', date '2026-08-12', 'POSTED', '${COMPANY}'),
      ('f3000000-0000-4000-8000-000000000203', 'f3000000-0000-4000-8000-000000000103', '${CONTRACT}', 999, 'cash', date '2026-08-13', 'VOID', '${COMPANY}');
  `);

  // A second company with its own in-period invoice — the isolation probe.
  await db.exec(`
    insert into public.owners (id, full_name, name, company_id)
    values ('f3000000-0000-4000-8000-000000000022', 'Other Owner', 'Other Owner', '${OTHER_COMPANY}');
    insert into public.properties (id, title, name, type, address, company_id)
    values ('f3000000-0000-4000-8000-000000000032', 'Other Property', 'Other Property', 'residential', 'Muscat', '${OTHER_COMPANY}');
    insert into public.units (id, property_id, name, unit_number, status, company_id)
    values ('f3000000-0000-4000-8000-000000000042', 'f3000000-0000-4000-8000-000000000032', 'OU1', 'OU1', 'occupied', '${OTHER_COMPANY}');
    insert into public.people (id, full_name, type, company_id)
    values ('f3000000-0000-4000-8000-000000000052', 'Other Tenant', 'tenant', '${OTHER_COMPANY}');
    insert into public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
    values ('f3000000-0000-4000-8000-000000000032', 'f3000000-0000-4000-8000-000000000022', 100, true, date '2020-01-01', '${OTHER_COMPANY}');
    insert into public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id)
    values ('f3000000-0000-4000-8000-000000000072', 'f3000000-0000-4000-8000-000000000022', 'f3000000-0000-4000-8000-000000000032', 'property_management', 'RATE', 0, date '2020-01-01', '${OTHER_COMPANY}');
    insert into public.contracts (id, property_id, unit_id, tenant_id, agreement_id, start_date, end_date, rent_amount, status, company_id)
    values ('f3000000-0000-4000-8000-000000000062', 'f3000000-0000-4000-8000-000000000032',
            'f3000000-0000-4000-8000-000000000042', 'f3000000-0000-4000-8000-000000000052',
            'f3000000-0000-4000-8000-000000000072', '2026-01-01', '2026-12-31', 500, 'active', '${OTHER_COMPANY}');
    insert into public.invoices (contract_id, issue_date, due_date, amount, tax_amount, paid_amount, credited_amount, status, company_id)
    values ('f3000000-0000-4000-8000-000000000062', date '2026-08-03', date '2026-08-04', 500, 0, 0, 0, 'UNPAID', '${OTHER_COMPANY}');
  `);

  await assumeIdentity(db, ADMIN, COMPANY);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('R13 — dashboard collection_rate is invoice-cohort realization', () => {
  it('computes collection_rate over the period invoice cohort (credit-aware), not period cash', async () => {
    const s = await snapshot();

    // Cohort: invA (100) + invC (50 after 50 credit) + invD (40 partial).
    // collectible = 250, collected_against = 190 -> round(76) = 76%.
    expect(Number(s.billing.invoiced_amount)).toBe(300); // 100 + 100 + 100 (period gross)
    expect(Number(s.collections.collection_rate)).toBe(76);

    // Cash collected this period is a DIFFERENT number (300 = 100 + 200; VOID
    // 999 excluded) — proving the metric no longer equates cash to cohort.
    expect(Number(s.collections.collected_amount)).toBe(300);
    expect(s.collections.payments_count).toBe(2);

    // Outstanding is the period-cohort remaining (invD: 60).
    expect(Number(s.collections.outstanding_amount)).toBe(60);
  });

  it('a payment collected this period that settles a PRIOR-period invoice does not inflate collection_rate', async () => {
    // invB (issued July, paid 200 in August) is not in the period cohort.
    // If the old mismatched formula were used, that 200 would enter the
    // numerator; the corrected cohort excludes it entirely.
    const s = await snapshot();
    expect(Number(s.collections.collection_rate)).toBe(76);
  });

  it('a credit reduces the collectible obligation: gross 100 / credit 50 / paid 50 is 100% collected, not 50%', async () => {
    // Isolate the credit scenario: make invC the ONLY period invoice.
    await db.query(`update public.invoices set deleted_at = now() where id::text in
      ('f3000000-0000-4000-8000-000000000101', 'f3000000-0000-4000-8000-000000000104')`);
    const s = await snapshot();
    // invC alone: collectible = 50, collected = 50 -> 100%.
    expect(Number(s.collections.collection_rate)).toBe(100);
    // Restore.
    await db.query(`update public.invoices set deleted_at = null where id::text in
      ('f3000000-0000-4000-8000-000000000101', 'f3000000-0000-4000-8000-000000000104')`);
  });

  it('returns 0 when the period has no invoices (no collectible)', async () => {
    const s = await snapshot('2025-01-01', '2025-01-31');
    expect(Number(s.collections.collection_rate)).toBe(0);
    expect(Number(s.billing.invoiced_amount)).toBe(0);
  });

  it('is company-isolated: the other company never leaks into the rate', async () => {
    await assumeIdentity(db, OTHER_ADMIN, OTHER_COMPANY);
    const s = await snapshot();
    expect(Number(s.billing.invoiced_amount)).toBe(500);
    // Other company: one UNPAID invoice, no collections -> 0%.
    expect(Number(s.collections.collection_rate)).toBe(0);
    expect(Number(s.collections.collected_amount)).toBe(0);
    await assumeIdentity(db, ADMIN, COMPANY);
  });
});
