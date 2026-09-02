/**
 * R1 — Dashboard Truth: authoritative read-model execution proof.
 *
 * Proves against a FULL migration replay (PGlite, all 270+ migrations) that
 * public.rpt_dashboard_snapshot:
 *   1. authenticates and requires a company context (fail-closed),
 *   2. computes every KPI as an SQL aggregate — verified at >1000 invoices,
 *      beyond every PostgREST row cap that corrupted the old client-derived
 *      dashboard (R1 exit gate: tests with more than 500 and 1000 records),
 *   3. is credit-aware: remaining = amount + tax - paid - credited,
 *   4. reconciles exactly with the report RPCs the Reports workspace uses
 *      (rpt_financial_summary, rpt_overdue_invoices, rpt_aged_receivables) —
 *      Dashboard = Reports numbers by construction,
 *   5. is company-isolated (a second company sees only its own truth),
 *   6. returns bounded queues (max 5 rows) whose numbers never replace KPIs.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../../p1/replay-bootstrap';

const COMPANY = 'd1000000-0000-4000-8000-000000000001';
const OTHER_COMPANY = 'd1000000-0000-4000-8000-000000000002';
const MAKER = 'd1000000-0000-4000-8000-000000000011';
const OTHER = 'd1000000-0000-4000-8000-000000000012';
const OWNER = 'd1000000-0000-4000-8000-000000000021';
const PROPERTY = 'd1000000-0000-4000-8000-000000000031';
const TENANT = 'd1000000-0000-4000-8000-000000000051';

// Deterministic period for every seeded document.
const FROM = '2026-08-01';
const TO = '2026-08-31';
const AS_OF = '2026-08-16';

// Scale gate: strictly more than 1000 active invoices, all overdue.
const INVOICE_COUNT = 1100;
const INVOICE_AMOUNT = 10; // OMR each, no tax.

let db: PGlite;

type Snapshot = Record<string, any>;

async function snapshot(from = FROM, to = TO, asOf = AS_OF): Promise<Snapshot> {
  const { rows } = await db.query<{ value: string }>(
    `select public.rpt_dashboard_snapshot($1::date, $2::date, $3::date)::text as value`,
    [from, to, asOf],
  );
  return JSON.parse(rows[0]?.value ?? '{}') as Snapshot;
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug) values
      ('${COMPANY}', 'R1 Co', 'r1-co'),
      ('${OTHER_COMPANY}', 'R1 Other', 'r1-other');

    insert into auth.users (id, email, raw_app_meta_data) values
      ('${MAKER}', 'maker@r1.test', '{"company_id":"${COMPANY}"}'::jsonb),
      ('${OTHER}', 'other@r1.test', '{"company_id":"${OTHER_COMPANY}"}'::jsonb);

    insert into public.users (id, email, name, role, status, is_active) values
      ('${MAKER}', 'maker@r1.test', 'Maker', 'ADMIN', 'ACTIVE', true),
      ('${OTHER}', 'other@r1.test', 'Other', 'ADMIN', 'ACTIVE', true);

    insert into public.company_members (company_id, user_id, role) values
      ('${COMPANY}', '${MAKER}', 'ADMIN'),
      ('${OTHER_COMPANY}', '${OTHER}', 'ADMIN');

    insert into public.owners (id, full_name, name, company_id)
    values ('${OWNER}', 'R1 Owner', 'R1 Owner', '${COMPANY}');
    insert into public.properties (id, title, name, type, address, company_id)
    values ('${PROPERTY}', 'R1 Property', 'R1 Property', 'residential', 'Muscat', '${COMPANY}');
    insert into public.people (id, full_name, type, company_id)
    values ('${TENANT}', 'R1 Tenant', 'tenant', '${COMPANY}');
    insert into public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
    values ('${PROPERTY}', '${OWNER}', 100, true, date '2020-01-01', '${COMPANY}');
    insert into public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id)
    values ('d1000000-0000-4000-8000-000000000071', '${OWNER}', '${PROPERTY}', 'property_management', 'RATE', 0, date '2020-01-01', '${COMPANY}');
  `);

  // 5 units: U1/U2/U5 get active contracts (occupancy projection keeps them
  // occupied), U3 stays available (vacant), U4 stays in maintenance (neither).
  await db.exec(`
    insert into public.units (id, property_id, name, unit_number, status, company_id) values
      ('d1000000-0000-4000-8000-000000000101', '${PROPERTY}', 'U1', 'U1', 'occupied', '${COMPANY}'),
      ('d1000000-0000-4000-8000-000000000102', '${PROPERTY}', 'U2', 'U2', 'occupied', '${COMPANY}'),
      ('d1000000-0000-4000-8000-000000000103', '${PROPERTY}', 'U3', 'U3', 'available', '${COMPANY}'),
      ('d1000000-0000-4000-8000-000000000104', '${PROPERTY}', 'U4', 'U4', 'maintenance', '${COMPANY}'),
      ('d1000000-0000-4000-8000-000000000106', '${PROPERTY}', 'U5', 'U5', 'occupied', '${COMPANY}');
  `);

  // 3 ACTIVE contracts: end dates inside the 30/60/90 windows.
  await db.exec(`
    insert into public.contracts (id, property_id, unit_id, tenant_id, agreement_id, start_date, end_date, rent_amount, status, company_id) values
      ('d1000000-0000-4000-8000-000000000201', '${PROPERTY}', 'd1000000-0000-4000-8000-000000000101', '${TENANT}',
       'd1000000-0000-4000-8000-000000000071', date '2026-01-01', date '2026-09-01', 100, 'active', '${COMPANY}'),
      ('d1000000-0000-4000-8000-000000000202', '${PROPERTY}', 'd1000000-0000-4000-8000-000000000102', '${TENANT}',
       'd1000000-0000-4000-8000-000000000071', date '2026-01-02', date '2026-10-01', 100, 'active', '${COMPANY}'),
      ('d1000000-0000-4000-8000-000000000203', '${PROPERTY}', 'd1000000-0000-4000-8000-000000000106', '${TENANT}',
       'd1000000-0000-4000-8000-000000000071', date '2026-01-03', date '2026-11-10', 100, 'active', '${COMPANY}');
  `);

  // >1000 overdue invoices attached to contract 201, all inside the period,
  // all due before AS_OF. generate_series keeps the seed fast and exact.
  await db.exec(`
    insert into public.invoices
      (contract_id, issue_date, due_date, amount, tax_amount, paid_amount, status, company_id)
    select
      'd1000000-0000-4000-8000-000000000201'::uuid,
      date '${FROM}' + (n % 10),
      date '2026-08-05',
      ${INVOICE_AMOUNT}, 0, 0,
      'UNPAID',
      '${COMPANY}'::uuid
    from generate_series(1, ${INVOICE_COUNT}) as n;
  `);

  // Direct payments seed (period collections): status POSTED + one VOID that
  // must be excluded everywhere. Every payment must be receipt-backed with a
  // shared identity (payments_enforce_receipt_shared_identity).
  await db.exec(`
    with target as (
      select i.id as invoice_id, i.contract_id, row_number() over (order by i.id) as rn
        from public.invoices i
       where i.company_id = '${COMPANY}' and i.deleted_at is null
       order by i.id
       limit 5
    ), receipt_rows as (
      insert into public.receipts (id, contract_id, tenant_id, amount, status, request_id, company_id)
      select gen_random_uuid(), t.contract_id, '${TENANT}',
             case when t.rn <= 4 then 2.500 else 999 end,
             case when t.rn <= 4 then 'POSTED' else 'VOID' end,
             'r1-receipt-' || t.rn,
             '${COMPANY}'::uuid
        from target t
      returning id, contract_id, amount, status, request_id
    )
    insert into public.payments (receipt_id, invoice_id, contract_id, amount, payment_method, payment_date, status, company_id)
    select r.id, t.invoice_id, r.contract_id, r.amount, 'cash',
           case when r.status = 'POSTED' then date '2026-08-10' else date '2026-08-11' end,
           r.status, '${COMPANY}'::uuid
      from receipt_rows r
      join target t on ('r1-receipt-' || t.rn) = r.request_id;
  `);

  // Mirror the POSTED collections into the invoice settlement fields — the
  // seed bypasses record_invoice_payment_atomic on purpose (scale fixture),
  // and paid_amount is the settlement projection the KPIs must respect.
  await db.exec(`
    update public.invoices i
       set paid_amount = 2.500
     where i.id in (
       select p.invoice_id from public.payments p
        where p.company_id = '${COMPANY}' and upper(p.status) = 'POSTED'
     );
  `);

  // Expenses in the period.
  await db.exec(`
    insert into public.expenses (property_id, category, amount, expense_date, company_id) values
      ('${PROPERTY}', 'maintenance', 3.250, date '2026-08-09', '${COMPANY}'),
      ('${PROPERTY}', 'utilities', 1.750, date '2026-08-12', '${COMPANY}');
  `);

  // Maintenance lifecycle rows. NOTE: the current DB constraint (pre-R8)
  // only allows open/in_progress/resolved/closed; a closed urgent ticket
  // stands in for the future Cancelled state and must NOT count as open.
  // 'Urgent leak' is attached to U4: the unit-status projection trigger keeps
  // U4 in 'maintenance' (neither occupied nor vacant) because of the open ticket.
  await db.exec(`
    insert into public.maintenance_records (property_id, unit_id, title, priority, status, company_id) values
      ('${PROPERTY}', 'd1000000-0000-4000-8000-000000000104', 'Urgent leak', 'urgent', 'open', '${COMPANY}');
    insert into public.maintenance_records (property_id, title, priority, status, company_id) values
      ('${PROPERTY}', 'Urgent AC', 'urgent', 'in_progress', '${COMPANY}'),
      ('${PROPERTY}', 'Paint', 'medium', 'open', '${COMPANY}'),
      ('${PROPERTY}', 'Old ticket', 'high', 'resolved', '${COMPANY}'),
      ('${PROPERTY}', 'Closed urgent ticket', 'urgent', 'closed', '${COMPANY}');
  `);

  // Owner settlements: DRAFT + APPROVED count toward payable, PAID does not.
  await db.exec(`
    insert into public.owner_settlements
      (id, owner_id, status, gross_collected, net_payable, amount, method, company_id,
       created_at, approved_at, approved_by, paid_at, paid_by) values
      ('r1-st-1', '${OWNER}', 'DRAFT', 40.500, 40.500, 40.500, null, '${COMPANY}',
       now(), null, null, null, null),
      ('r1-st-2', '${OWNER}', 'APPROVED', 10.250, 10.250, 10.250, null, '${COMPANY}',
       now(), now(), '${MAKER}', null, null),
      ('r1-st-3', '${OWNER}', 'PAID', 99, 99, 99, 'bank_transfer', '${COMPANY}',
       now(), now(), '${MAKER}', now(), '${MAKER}');
  `);

  // Bank statement lines: 2 unmatched, 1 matched.
  await db.exec(`
    insert into public.bank_accounts (id, account_name, company_id) values
      ('d1000000-0000-4000-8000-000000000301', 'R1 Bank', '${COMPANY}');
    insert into public.bank_statement_lines (bank_account_id, transaction_date, description, amount, status, company_id) values
      ('d1000000-0000-4000-8000-000000000301', date '2026-08-05', 'in', 100, 'unmatched', '${COMPANY}'),
      ('d1000000-0000-4000-8000-000000000301', date '2026-08-06', 'in', 200, 'unmatched', '${COMPANY}'),
      ('d1000000-0000-4000-8000-000000000301', date '2026-08-07', 'in', 300, 'matched', '${COMPANY}');
  `);

  // A second company with its own single invoice — the isolation probe.
  await db.exec(`
    insert into public.owners (id, full_name, name, company_id)
    values ('d1000000-0000-4000-8000-000000000022', 'Other Owner', 'Other Owner', '${OTHER_COMPANY}');
    insert into public.properties (id, title, name, type, address, company_id)
    values ('d1000000-0000-4000-8000-000000000032', 'Other Property', 'Other Property', 'residential', 'Muscat', '${OTHER_COMPANY}');
    insert into public.units (id, property_id, name, unit_number, status, company_id)
    values ('d1000000-0000-4000-8000-000000000105', 'd1000000-0000-4000-8000-000000000032', 'OU1', 'OU1', 'occupied', '${OTHER_COMPANY}');
    insert into public.people (id, full_name, type, company_id)
    values ('d1000000-0000-4000-8000-000000000052', 'Other Tenant', 'tenant', '${OTHER_COMPANY}');
    insert into public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
    values ('d1000000-0000-4000-8000-000000000032', 'd1000000-0000-4000-8000-000000000022', 100, true, date '2020-01-01', '${OTHER_COMPANY}');
    insert into public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id)
    values ('d1000000-0000-4000-8000-000000000072', 'd1000000-0000-4000-8000-000000000022',
            'd1000000-0000-4000-8000-000000000032', 'property_management', 'RATE', 0, date '2020-01-01', '${OTHER_COMPANY}');
    insert into public.contracts (id, property_id, unit_id, tenant_id, agreement_id, start_date, end_date, rent_amount, status, company_id)
    values ('d1000000-0000-4000-8000-000000000204', 'd1000000-0000-4000-8000-000000000032',
            'd1000000-0000-4000-8000-000000000105', 'd1000000-0000-4000-8000-000000000052',
            'd1000000-0000-4000-8000-000000000072',
            date '2026-01-01', date '2027-01-01', 500, 'active', '${OTHER_COMPANY}');
    insert into public.invoices (contract_id, issue_date, due_date, amount, tax_amount, paid_amount, status, company_id)
    values ('d1000000-0000-4000-8000-000000000204', date '2026-08-03', date '2026-08-04', 500, 0, 0, 'UNPAID', '${OTHER_COMPANY}');
  `);

  await assumeIdentity(db, MAKER, COMPANY);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('R1 — rpt_dashboard_snapshot authoritative read model', () => {
  it('fails closed without an authenticated app user', async () => {
    await assumeIdentity(db, null, null);
    await expect(snapshot()).rejects.toThrow(/42501|required/i);
    await assumeIdentity(db, MAKER, COMPANY);
  });

  it('rejects an invalid period instead of guessing', async () => {
    await expect(snapshot('2026-09-01', '2026-08-01')).rejects.toThrow(/22023|period/i);
  });

  it('computes portfolio and occupancy KPIs as SQL aggregates', async () => {
    const s = await snapshot();
    const { rows } = await db.query<{ occupied: string }>(`
      select count(distinct unit_id)::text as occupied
        from public.contracts
       where company_id = $1
         and lower(status) = 'active'
         and start_date <= current_date
         and end_date >= current_date
    `, [COMPANY]);
    const occupied = Number(rows[0]?.occupied ?? 0);

    expect(s.portfolio).toEqual({ properties: 1, units: 5 });
    // Occupancy intentionally follows leases active on current_date. Deriving
    // the expectation from the independently-seeded contract rows prevents
    // this fixed-date replay from decaying when CI runs after a lease end.
    expect(s.occupancy.occupied_units).toBe(occupied);
    expect(s.occupancy.vacant_units).toBe(1); // 'available' only; 'maintenance' is neither.
    expect(s.occupancy.occupancy_rate).toBe(Math.round((occupied / 5) * 100));
  });

  it('computes contract KPIs including cumulative 30/60/90 expiry windows', async () => {
    const s = await snapshot();
    expect(s.contracts.active).toBe(3);
    expect(s.contracts.expiring_30).toBe(1);  // 2026-09-01
    expect(s.contracts.expiring_60).toBe(2);  // + 2026-10-01
    expect(s.contracts.expiring_90).toBe(3);  // + 2026-11-10
  });

  it('holds KPI truth beyond 1000 records — the exact failure mode of the old client dashboard', async () => {
    const s = await snapshot();
    // 1100 invoices in the period + none excluded.
    expect(s.billing.invoices_count).toBe(INVOICE_COUNT);
    expect(Number(s.billing.invoiced_amount)).toBe(INVOICE_COUNT * INVOICE_AMOUNT);
    // Overdue count is the full 1100 (all due 2026-08-05 < as_of), NOT 500/1000.
    expect(s.arrears.overdue_count).toBe(INVOICE_COUNT);
    expect(Number(s.arrears.total_overdue)).toBe(INVOICE_COUNT * INVOICE_AMOUNT - 4 * 2.5);
    // Aging: 11 days overdue -> everything in days_1_30.
    expect(s.arrears.buckets.days_1_30.count).toBe(INVOICE_COUNT);
    expect(s.arrears.buckets.days_90_plus.count).toBe(0);
    // Queues stay bounded at 5 — presentation rows never replace the KPI.
    expect(s.queues.overdue_invoices).toHaveLength(5);
    expect(s.queues.expiring_contracts.length).toBeLessThanOrEqual(5);
  });

  it('collections exclude VOID payments and net cash subtracts period expenses', async () => {
    const s = await snapshot();
    expect(Number(s.collections.collected_amount)).toBe(10); // 4 × 2.500, VOID 999 excluded.
    expect(s.collections.payments_count).toBe(4);
    expect(Number(s.expenses.total_amount)).toBe(5);          // 3.250 + 1.750
    expect(s.expenses.count).toBe(2);
    expect(Number(s.net_cash)).toBe(5);                       // 10 − 5
    // Collection rate: 10 / 11000 rounds to 0%.
    expect(Number(s.collections.collection_rate)).toBe(0);
  });

  it('reconciles exactly with the Reports RPC (rpt_financial_summary)', async () => {
    const s = await snapshot();
    const { rows } = await db.query<{ collected: string; expenses: string; overdue_amount: string; overdue_count: string; active_contracts: string }>(
      `select collected::text, expenses::text, overdue_amount::text, overdue_count::text, active_contracts::text
         from public.rpt_financial_summary(date '${FROM}', date '${TO}')`,
    );
    const summary = rows[0];
    expect(Number(s.collections.collected_amount)).toBe(Number(summary.collected));
    expect(Number(s.expenses.total_amount)).toBe(Number(summary.expenses));
    expect(s.contracts.active).toBe(Number(summary.active_contracts));
    // rpt_financial_summary is not credit-aware and uses current_date; with no
    // credits and an all-overdue fixture the counts still agree structurally.
    expect(s.arrears.overdue_count).toBe(Number(summary.overdue_count));
  });

  it('reconciles exactly with rpt_overdue_invoices and rpt_aged_receivables', async () => {
    const s = await snapshot();
    const overdue = JSON.parse((await db.query<{ v: string }>(
      `select public.rpt_overdue_invoices(date '${AS_OF}')::text as v`,
    )).rows[0].v);
    expect(s.arrears.overdue_count).toBe(Number(overdue.count));
    expect(Number(s.arrears.total_overdue)).toBe(Number(overdue.total_overdue));

    const aged = JSON.parse((await db.query<{ v: string }>(
      `select public.rpt_aged_receivables(date '${AS_OF}')::text as v`,
    )).rows[0].v);
    expect(Number(s.arrears.buckets.days_1_30.total)).toBe(Number(aged.totals['1_30']));
    expect(Number(s.arrears.buckets.days_90_plus.total)).toBe(Number(aged.totals['90plus']));
  });

  it('is credit-aware: a posted credit reduces the dashboard arrears AND the aged receivables report identically', async () => {
    const before = await snapshot();
    // Simulate the Phase-3 cached credit column directly (the atomic RPC
    // needs the full RC1 agreement fixture; the KPI contract under test is
    // the credit-aware remaining formula).
    const { rows } = await db.query<{ id: string }>(
      `select id from public.invoices
        where company_id = $1 and deleted_at is null and paid_amount = 0
        order by id limit 1`,
      [COMPANY],
    );
    const invoiceId = rows[0].id;
    await db.query(`update public.invoices set credited_amount = 4 where id = $1::uuid`, [invoiceId]);

    const after = await snapshot();
    expect(Number(after.arrears.total_overdue)).toBe(Number(before.arrears.total_overdue) - 4);

    const aged = JSON.parse((await db.query<{ v: string }>(
      `select public.rpt_aged_receivables(date '${AS_OF}')::text as v`,
    )).rows[0].v);
    const agedTotal = Number(aged.totals['1_30']) + Number(aged.totals.current)
      + Number(aged.totals['31_60']) + Number(aged.totals['61_90']) + Number(aged.totals['90plus']);
    expect(Number(after.arrears.total_outstanding)).toBe(agedTotal);

    await db.query(`update public.invoices set credited_amount = 0 where id = $1::uuid`, [invoiceId]);
  });

  it('surfaces owner funds, maintenance lifecycle and exception KPIs', async () => {
    const s = await snapshot();
    expect(Number(s.owner_funds.net_payable)).toBe(50.75); // 40.500 + 10.250, PAID excluded.
    expect(s.owner_funds.settlements_draft).toBe(1);
    expect(s.owner_funds.settlements_approved).toBe(1);
    expect(s.maintenance.open).toBe(2);          // urgent leak + paint (resolved/cancelled excluded)
    expect(s.maintenance.in_progress).toBe(1);
    expect(s.maintenance.urgent_open).toBe(2);   // open + in_progress urgent; closed urgent excluded.
    expect(s.exceptions.unmatched_bank_lines).toBe(2);
    expect(s.exceptions.pending_settlements).toBe(2);
  });

  it('is company-isolated: the other company sees only its own numbers', async () => {
    await assumeIdentity(db, OTHER, OTHER_COMPANY);
    const s = await snapshot();
    expect(s.portfolio).toEqual({ properties: 1, units: 1 });
    expect(s.contracts.active).toBe(1);
    expect(s.billing.invoices_count).toBe(1);
    expect(Number(s.billing.invoiced_amount)).toBe(500);
    expect(s.arrears.overdue_count).toBe(1);
    expect(s.exceptions.unmatched_bank_lines).toBe(0);
    expect(s.owner_funds.settlements_draft).toBe(0);
    await assumeIdentity(db, MAKER, COMPANY);
  });

  it('returns queue rows with drill-down identifiers and honest context', async () => {
    const s = await snapshot();
    const queueRow = s.queues.overdue_invoices[0];
    expect(queueRow.invoice_id).toBeTruthy();
    expect(queueRow.days_overdue).toBe(11);
    expect(queueRow.tenant_name).toBe('R1 Tenant');
    expect(queueRow.property_title).toBe('R1 Property');
    const contractRow = s.queues.expiring_contracts[0];
    expect(contractRow.id).toBe('d1000000-0000-4000-8000-000000000201');
    expect(contractRow.end_date).toBe('2026-09-01');
    expect(contractRow.days_remaining).toBe(16);
  });
});
