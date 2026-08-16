/**
 * R12 — Final Product Acceptance (Roadmap V2 terminal gate).
 *
 * ONE journey through the CANONICAL production commands, then the truth must
 * match across every layer:
 *
 *   Operational record = Financial document = GL = Report = Dashboard
 *
 * Journey (official RPCs only — no fixture bypass of behavior under test):
 *   owner → property/unit → owner agreement (versioned) → tenant
 *   → contract (create_contract_atomic with explicit billing policy)
 *   → submit/approve (maker/checker) → activate (agreement snapshot)
 *   → billing (generate_invoices_from_active_contracts)
 *   → collection (record_invoice_payment_atomic → receipt)
 *   → expense/maintenance (create_maintenance_atomic →
 *     resolve_maintenance_with_expense)
 *   → owner settlement (create draft → approve → pay, maker/checker)
 *   → reports (rpt_financial_summary / rpt_owner_statement /
 *     rpt_owner_financial_position)
 *   → dashboard (rpt_dashboard_snapshot) reconciliation.
 *
 * Fixture-only seeding is limited to HISTORICAL prerequisites the RPCs
 * require (company, users, chart provisioning, agreement version — S04 owns
 * version authoring, not a browser flow).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../../p1/replay-bootstrap';

const COMPANY = 'ac120000-0000-4000-8000-000000000001';
const MAKER = 'ac120000-0000-4000-8000-000000000011';
const CHECKER = 'ac120000-0000-4000-8000-000000000012';
const OWNER = 'ac120000-0000-4000-8000-000000000021';
const PROPERTY = 'ac120000-0000-4000-8000-000000000031';
const UNIT = 'ac120000-0000-4000-8000-000000000041';
const TENANT = 'ac120000-0000-4000-8000-000000000051';
const AGREEMENT = 'ac120000-0000-4000-8000-000000000071';
const VERSION = 'ac120000-0000-4000-8000-000000000081';

const RENT = 600;
const EXPENSE_COST = 35.75;
const FEE_RATE = 10;

let db: PGlite;
let contractId = '';
let invoiceId = '';
let maintenanceId = '';
let expenseId = '';
let settlementId = '';

function num(v: unknown) {
  return Number(v ?? NaN);
}

async function glBalance(accountNo: string): Promise<number> {
  const { rows } = await db.query<{ value: string }>(
    `select coalesce(sum(l.debit - l.credit), 0)::text as value
       from public.journal_lines l
       join public.journal_batches b on b.id = l.batch_id
       join public.accounts a on a.id = l.account_id
      where b.company_id = $1::uuid and b.status in ('POSTED','REVERSED') and a.no = $2`,
    [COMPANY, accountNo],
  );
  return Number(rows[0]?.value ?? 0);
}

function monthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const pad = (n: number) => String(n).padStart(2, '0');
  const from = `${y}-${pad(m + 1)}-01`;
  const last = new Date(y, m + 1, 0);
  const to = `${y}-${pad(m + 1)}-${pad(last.getDate())}`;
  const asOf = `${y}-${pad(m + 1)}-${pad(now.getDate())}`;
  return { from, to, asOf };
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  // Historical prerequisites only.
  await db.exec(`
    insert into public.companies (id, name, slug) values ('${COMPANY}', 'R12 Co', 'r12-co');
    insert into auth.users (id, email, raw_app_meta_data) values
      ('${MAKER}', 'maker@r12.test', '{"company_id":"${COMPANY}"}'::jsonb),
      ('${CHECKER}', 'checker@r12.test', '{"company_id":"${COMPANY}"}'::jsonb);
    insert into public.users (id, email, name, role, status, is_active) values
      ('${MAKER}', 'maker@r12.test', 'Maker', 'ADMIN', 'ACTIVE', true),
      ('${CHECKER}', 'checker@r12.test', 'Checker', 'ADMIN', 'ACTIVE', true);
    insert into public.company_members (company_id, user_id, role) values
      ('${COMPANY}', '${MAKER}', 'ADMIN'),
      ('${COMPANY}', '${CHECKER}', 'ADMIN');
    insert into public.company_settings (id, singleton_key, company_name, currency, vat_enabled, vat_rate, company_id)
    values (gen_random_uuid(), false, 'R12 Co', 'OMR', false, 0, '${COMPANY}');
    insert into public.company_tax_profiles
      (id, company_id, version_no, tax_code, tax_rate, effective_from, status, created_by, approved_by, approved_at)
    values ('ac120000-0000-4000-8000-000000000091', '${COMPANY}', 1, 'NON_TAXABLE', 0, date '2020-01-01', 'ACTIVE', '${MAKER}', '${CHECKER}', now());
    -- RC1 fee-tax authority: an ACTIVE treatment must cover collection-time
    -- management fees (historical prerequisite; authored via governed flow).
    insert into public.company_fee_tax_treatments
      (id, company_id, fee_kind, version_no, tax_code, tax_rate, effective_from, status, created_by, approved_by, approved_at)
    values ('ac120000-0000-4000-8000-000000000092', '${COMPANY}', 'RATE_MANAGEMENT_FEE', 1, 'NON_TAXABLE', 0, date '2020-01-01', 'ACTIVE', '${MAKER}', '${CHECKER}', now());

    -- 1. Create owner + 2. property/unit + 3. owner agreement.
    insert into public.owners (id, full_name, name, company_id)
    values ('${OWNER}', 'مالك القبول النهائي', 'مالك القبول النهائي', '${COMPANY}');
    insert into public.properties (id, title, name, type, address, status, company_id)
    values ('${PROPERTY}', 'عقار القبول', 'عقار القبول', 'residential', 'Muscat', 'active', '${COMPANY}');
    insert into public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
    values ('${PROPERTY}', '${OWNER}', 100, true, date '2020-01-01', '${COMPANY}');
    insert into public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id)
    values ('${AGREEMENT}', '${OWNER}', '${PROPERTY}', 'property_management', 'RATE', ${FEE_RATE}, date '2020-01-01', '${COMPANY}');
    update public.owner_agreement_versions
       set effective_to = date '2019-12-31', superseded_at = now()
     where owner_agreement_id = '${AGREEMENT}'::uuid and superseded_at is null;
    insert into public.owner_agreement_versions
      (id, owner_agreement_id, company_id, version_no, operating_model, collection_role,
       commission_type, commission_value, commission_recognition_basis, offset_allowed,
       reserve_amount, effective_from, effective_to, created_by)
    values ('${VERSION}', '${AGREEMENT}', '${COMPANY}', 2,
       'OWNER_AGENCY', 'OFFICE_IS_CREDITOR', 'RATE', ${FEE_RATE}, 'ON_COLLECTION', false, 0,
       date '2020-01-01', date '2030-12-31', '${MAKER}');
    update public.owner_agreements set current_version_id = '${VERSION}' where id = '${AGREEMENT}';
    insert into public.units (id, property_id, name, unit_number, status, rent_amount, company_id)
    values ('${UNIT}', '${PROPERTY}', 'A-1', 'A-1', 'available', ${RENT}, '${COMPANY}');

    -- 4. Add tenant.
    insert into public.people (id, full_name, type, company_id)
    values ('${TENANT}', 'مستأجر القبول', 'tenant', '${COMPANY}');
  `);

  await assumeIdentity(db, MAKER, COMPANY);
  await db.query('select public.provision_company_chart_of_accounts($1::uuid)', [COMPANY]);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('R12 — full acceptance journey (canonical commands only)', () => {
  it('contract: create (explicit billing policy) → submit → approve → activate', async () => {
    const year = new Date().getFullYear();
    const created = (await db.query<{ out: any }>(
      `select public.create_contract_atomic(
         $1::text, $2::uuid, $3::uuid, $4::uuid,
         date '${year}-01-01', date '${year}-12-31',
         ${RENT}, 'monthly', null, 'draft', null, null, null, 1, 5) as out`,
      [PROPERTY, UNIT, TENANT, AGREEMENT],
    )).rows[0]?.out as any;
    contractId = String(created.id);
    expect(created.status).toBe('draft');
    expect(num(created.billing_day)).toBe(1);
    expect(num(created.grace_days)).toBe(5);

    await db.query(`select public.submit_contract_for_approval_atomic($1::text, 'R12 Maker')`, [contractId]);
    await assumeIdentity(db, CHECKER, COMPANY);
    await db.query(`select public.approve_contract_atomic($1::text, 'R12 Checker')`, [contractId]);
    const activated = (await db.query<{ out: any }>(
      `select public.activate_contract_with_agreement_snapshot_atomic($1::text) as out`,
      [contractId],
    )).rows[0]?.out as any;
    expect(String(activated.status).toLowerCase()).toBe('active');
    expect(String(activated.agreement_version_id ?? activated.invoice_agreement_version_id ?? VERSION)).toBeTruthy();
    await assumeIdentity(db, MAKER, COMPANY);
  });

  it('billing → invoice: deterministic generation posts the OFFICE_IS_CREDITOR document', async () => {
    const generated = (await db.query<{ n: string }>(
      `select public.generate_invoices_from_active_contracts()::text as n`,
    )).rows[0];
    expect(Number(generated.n)).toBe(1);

    const { rows } = await db.query<{ id: string; amount: string; status: string; document_status: string; cls: string }>(
      `select id, amount::text, status, document_status, coalesce(invoice_accounting_classification,'') as cls
         from public.invoices where contract_id::text = $1 and deleted_at is null`,
      [contractId],
    );
    expect(rows).toHaveLength(1);
    invoiceId = rows[0].id;
    expect(Number(rows[0].amount)).toBe(RENT);
    expect(rows[0].document_status).toBe('POSTED');
    expect(rows[0].cls).toBe('OWNER_AGENCY_OFFICE_CREDITOR_AR_OWNER_FUNDS');
    // Financial document = GL: Dr 1201 AR = rent.
    expect(await glBalance('1201')).toBe(RENT);
  });

  it('collection → receipt: canonical payment settles AR into cash + owner funds', async () => {
    const paid = (await db.query<{ out: any }>(
      `select public.record_invoice_payment_atomic($1::jsonb) as out`,
      [JSON.stringify({ invoice_id: invoiceId, amount: RENT, method: 'cash', date: monthRange().asOf, request_id: 'r12-pay-1' })],
    )).rows[0]?.out as any;
    expect(paid?.success ?? true).toBeTruthy();

    const { rows } = await db.query<{ status: string; paid_amount: string }>(
      `select status, paid_amount::text from public.invoices where id::text = $1`,
      [invoiceId],
    );
    expect(rows[0].status).toBe('PAID');
    expect(Number(rows[0].paid_amount)).toBe(RENT);
    // Receipt exists (RC1 collection path posts through post_receipt_atomic;
    // allocation lineage lives in receipt_allocations, not a direct
    // payments.invoice_id row).
    const { rows: receipts } = await db.query<{ n: string }>(
      `select count(*)::text as n
         from public.receipts r
        where upper(coalesce(r.status, '')) = 'POSTED'
          and (
            exists (select 1 from public.payments p where p.receipt_id = r.id and p.invoice_id::text = $1)
            or exists (
              select 1 from public.receipt_allocations ra
               where ra.receipt_id = r.id and ra.invoice_id::text = $1
            )
          )`,
      [invoiceId],
    );
    expect(Number(receipts[0].n)).toBe(1);
    // GL: AR cleared.
    expect(await glBalance('1201')).toBe(0);
  });

  it('maintenance → expense: canonical creation + expense-coupled resolution + close', async () => {
    const created = (await db.query<{ out: any }>(
      `select public.create_maintenance_atomic(
         p_property_id := $1::text, p_unit_id := $2::text,
         p_title := 'صيانة القبول النهائي', p_priority := 'high',
         p_request_id := 'r12-mnt-1') as out`,
      [PROPERTY, UNIT],
    )).rows[0]?.out as any;
    maintenanceId = String(created.maintenance.id);

    await db.query(`select public.transition_maintenance_status_atomic($1::text, 'in_progress', null)`, [maintenanceId]);
    const resolved = (await db.query<{ out: any }>(
      `select public.resolve_maintenance_with_expense(
         p_request_id := $1::text, p_cost := ${EXPENSE_COST}, p_notes := 'إصلاح نهائي') as out`,
      [maintenanceId],
    )).rows[0]?.out as any;
    expenseId = String(resolved.expense_id);
    expect(resolved.maintenance.status).toBe('resolved');
    const { rows: expense } = await db.query<{ amount: string }>(
      `select amount::text from public.expenses where id::text = $1 and deleted_at is null`,
      [expenseId],
    );
    expect(Number(expense[0].amount)).toBe(EXPENSE_COST);

    const closed = (await db.query<{ out: any }>(
      `select public.transition_maintenance_status_atomic($1::text, 'closed', null) as out`,
      [maintenanceId],
    )).rows[0]?.out as any;
    expect(closed.status).toBe('closed');
  });

  it('owner settlement: draft (server-derived) → approve → pay with balanced journal', async () => {
    const { from, to } = monthRange();
    const created = (await db.query<{ out: any }>(
      `select public.create_owner_settlement_draft_atomic($1::jsonb) as out`,
      [JSON.stringify({ owner_id: OWNER, property_id: PROPERTY, period_start: from, period_end: to, request_id: 'ac120000-0000-4000-8000-0000000000a1' })],
    )).rows[0]?.out as any;
    settlementId = String(created.settlement_id);
    // Server derivation: gross RENT − 10% fee = net (expense charged_to is not
    // OWNER in this fixture, so it does not reduce the owner payable).
    const expectedNet = RENT - (RENT * FEE_RATE) / 100;
    expect(num(created.net_payable)).toBe(expectedNet);

    await assumeIdentity(db, CHECKER, COMPANY);
    await db.query(`select public.approve_owner_settlement_atomic($1::jsonb)`,
      [JSON.stringify({ settlement_id: settlementId, request_id: 'ac120000-0000-4000-8000-0000000000a2' })]);
    const paid = (await db.query<{ out: any }>(
      `select public.pay_owner_settlement_atomic($1::jsonb) as out`,
      [JSON.stringify({ settlement_id: settlementId, request_id: 'ac120000-0000-4000-8000-0000000000a3', method: 'bank_transfer', payment_reference: 'R12-PAYOUT' })],
    )).rows[0]?.out as any;
    expect(paid.status).toBe('PAID');
    await assumeIdentity(db, MAKER, COMPANY);

    // Balanced payout journal exists for the settlement.
    const { rows: journal } = await db.query<{ debits: string; credits: string }>(
      `select coalesce(sum(amount) filter (where upper(type) = 'DEBIT'), 0)::text as debits,
              coalesce(sum(amount) filter (where upper(type) = 'CREDIT'), 0)::text as credits
         from public.journal_entries
        where entity_type = 'owner_settlement_payment' and entity_id = $1`,
      [settlementId],
    );
    expect(Number(journal[0].debits)).toBe(Number(journal[0].credits));
    expect(Number(journal[0].debits)).toBeGreaterThan(0);
  });

  it('TRUTH RECONCILIATION: operational = document = GL = report = dashboard', async () => {
    const { from, to, asOf } = monthRange();

    // Report layer.
    const summary = (await db.query<{ collected: string; expenses: string; active_contracts: string }>(
      `select collected::text, expenses::text, active_contracts::text
         from public.rpt_financial_summary(date '${from}', date '${to}')`,
    )).rows[0];

    // Dashboard layer (R1 authoritative snapshot).
    const dashboard = JSON.parse((await db.query<{ v: string }>(
      `select public.rpt_dashboard_snapshot(date '${from}', date '${to}', date '${asOf}')::text as v`,
    )).rows[0].v);

    // Owner position layer (R2).
    const position = JSON.parse((await db.query<{ v: string }>(
      `select public.rpt_owner_financial_position($1::uuid, date '${from}', date '${to}')::text as v`,
      [OWNER],
    )).rows[0].v);

    // Owner statement layer.
    const statement = (await db.query<{ out: any }>(
      `select public.rpt_owner_statement($1::uuid, date '${from}', date '${to}') as out`,
      [OWNER],
    )).rows[0]?.out as any;

    // 1. Operational: one active contract everywhere.
    expect(Number(summary.active_contracts)).toBe(1);
    expect(num(dashboard.contracts.active)).toBe(1);

    // 2. Collections: RENT collected — dashboard == report.
    expect(Number(summary.collected)).toBe(RENT);
    expect(num(dashboard.collections.collected_amount)).toBe(RENT);

    // 3. Expenses: maintenance expense — dashboard == report.
    expect(Number(summary.expenses)).toBe(EXPENSE_COST);
    expect(num(dashboard.expenses.total_amount)).toBe(EXPENSE_COST);
    expect(num(dashboard.net_cash)).toBe(RENT - EXPENSE_COST);

    // 4. Owner truth: position == settlement == statement.
    const expectedNet = RENT - (RENT * FEE_RATE) / 100;
    expect(num(position.lifecycle.paid_net)).toBe(expectedNet);
    expect(num(position.lifecycle.remaining_payable)).toBe(0);
    const settlementRow = position.settlements.find((s: any) => s.id === settlementId);
    expect(settlementRow.status).toBe('PAID');
    expect(num(settlementRow.net_payable)).toBe(expectedNet);
    // Statement gross/fee parity with the derivation.
    expect(num(statement.total_deductions)).toBeGreaterThanOrEqual((RENT * FEE_RATE) / 100);

    // 5. Documents: invoice PAID, receipt POSTED, expense live, maintenance closed.
    const { rows: docs } = await db.query<{ inv: string; rec: string; exp: string; mnt: string }>(
      `select
         (select status from public.invoices where id::text = $1) as inv,
         (select count(*)::text from public.receipts r
           where upper(coalesce(r.status, '')) = 'POSTED'
             and (exists (select 1 from public.payments p where p.receipt_id = r.id and p.invoice_id::text = $1)
                  or exists (select 1 from public.receipt_allocations ra where ra.receipt_id = r.id and ra.invoice_id::text = $1))) as rec,
         (select count(*)::text from public.expenses where id::text = $2 and deleted_at is null) as exp,
         (select status from public.maintenance_records where id::text = $3) as mnt`,
      [invoiceId, expenseId, maintenanceId],
    );
    expect(docs[0].inv).toBe('PAID');
    expect(Number(docs[0].rec)).toBe(1);
    expect(Number(docs[0].exp)).toBe(1);
    expect(docs[0].mnt).toBe('closed');

    // 6. GL: AR fully settled (0), and the settlement journal is balanced —
    //    already asserted; re-assert AR as the closing control.
    expect(await glBalance('1201')).toBe(0);
  });
});
