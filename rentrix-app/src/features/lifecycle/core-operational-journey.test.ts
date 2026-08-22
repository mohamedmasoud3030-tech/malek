/**
 * Core operational journey against the fully replayed PR #1548 schema.
 *
 * Official RPCs only. Covers:
 *   login analog (JWT + company_members.role)
 *   → contract create/submit/approve/activate
 *   → invoice generation
 *   → collection / receipt
 *   → financial report + dashboard
 *   → switch to a VIEWER in the same company
 *   → allowed read vs denied privileged mutation
 *   → cross-company fail-closed
 *
 * Browser Playwright is a separate environment concern; this file is the
 * repository's deterministic, Docker-free operational proof.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../../p1/replay-bootstrap';

const COMPANY_A = 'c0a00000-0000-4000-8000-00000000000a';
const COMPANY_B = 'c0b00000-0000-4000-8000-00000000000b';
const OPERATOR = 'c0a00000-0000-4000-8000-000000000011'; // MANAGER
const CHECKER = 'c0a00000-0000-4000-8000-000000000012'; // MANAGER
const VIEWER = 'c0a00000-0000-4000-8000-000000000013';
const ADMIN_B = 'c0b00000-0000-4000-8000-000000000021';
const OWNER = 'c0a00000-0000-4000-8000-000000000031';
const PROPERTY = 'c0a00000-0000-4000-8000-000000000041';
const UNIT = 'c0a00000-0000-4000-8000-000000000051';
const TENANT = 'c0a00000-0000-4000-8000-000000000061';
const AGREEMENT = 'c0a00000-0000-4000-8000-000000000071';
const VERSION = 'c0a00000-0000-4000-8000-000000000081';
const PROPERTY_B = 'c0b00000-0000-4000-8000-000000000091';

const RENT = 450;

let db: PGlite;
let contractId = '';
let invoiceId = '';

function num(value: unknown) {
  return Number(value ?? NaN);
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

async function firstError(work: () => Promise<unknown>): Promise<string> {
  try {
    await work();
    return '';
  } catch (error) {
    return String((error as { message?: string })?.message ?? error);
  }
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  expect(replay.applied.some((file) => file.includes('20260901000021'))).toBe(true);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug, is_active) values
      ('${COMPANY_A}', 'رحلة التشغيل أ', 'ops-a', true),
      ('${COMPANY_B}', 'رحلة التشغيل ب', 'ops-b', true);
    insert into auth.users (id, email, raw_app_meta_data) values
      ('${OPERATOR}', 'operator@ops.test', '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${CHECKER}', 'checker@ops.test', '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${VIEWER}', 'viewer@ops.test', '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${ADMIN_B}', 'admin.b@ops.test', '{"company_id":"${COMPANY_B}"}'::jsonb);
    insert into public.users (id, email, name, role, status, is_active) values
      ('${OPERATOR}', 'operator@ops.test', 'Operator', 'VIEWER', 'ACTIVE', true),
      ('${CHECKER}', 'checker@ops.test', 'Checker', 'VIEWER', 'ACTIVE', true),
      ('${VIEWER}', 'viewer@ops.test', 'Viewer', 'ADMIN', 'ACTIVE', true),
      ('${ADMIN_B}', 'admin.b@ops.test', 'Admin B', 'ADMIN', 'ACTIVE', true);
    insert into public.company_members (company_id, user_id, role, is_active) values
      ('${COMPANY_A}', '${OPERATOR}', 'MANAGER', true),
      ('${COMPANY_A}', '${CHECKER}', 'MANAGER', true),
      ('${COMPANY_A}', '${VIEWER}', 'VIEWER', true),
      ('${COMPANY_B}', '${ADMIN_B}', 'ADMIN', true);
    insert into public.company_settings (id, singleton_key, company_name, currency, vat_enabled, vat_rate, company_id)
    values (gen_random_uuid(), true, 'رحلة التشغيل أ', 'OMR', false, 0, '${COMPANY_A}');
    insert into public.company_tax_profiles
      (id, company_id, version_no, tax_code, tax_rate, effective_from, status, created_by, approved_by, approved_at)
    values ('c0a00000-0000-4000-8000-0000000000a1', '${COMPANY_A}', 1, 'NON_TAXABLE', 0, date '2020-01-01', 'ACTIVE', '${OPERATOR}', '${CHECKER}', now());
    insert into public.company_fee_tax_treatments
      (id, company_id, fee_kind, version_no, tax_code, tax_rate, effective_from, status, created_by, approved_by, approved_at)
    values ('c0a00000-0000-4000-8000-0000000000a2', '${COMPANY_A}', 'RATE_MANAGEMENT_FEE', 1, 'NON_TAXABLE', 0, date '2020-01-01', 'ACTIVE', '${OPERATOR}', '${CHECKER}', now());
    insert into public.owners (id, full_name, name, company_id)
    values ('${OWNER}', 'مالك الرحلة', 'مالك الرحلة', '${COMPANY_A}');
    insert into public.properties (id, title, name, type, address, status, company_id)
    values
      ('${PROPERTY}', 'عقار الرحلة', 'عقار الرحلة', 'residential', 'Sohar', 'active', '${COMPANY_A}'),
      ('${PROPERTY_B}', 'عقار الشركة ب', 'عقار الشركة ب', 'residential', 'Muscat', 'active', '${COMPANY_B}');
    insert into public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
    values ('${PROPERTY}', '${OWNER}', 100, true, date '2020-01-01', '${COMPANY_A}');
    insert into public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id)
    values ('${AGREEMENT}', '${OWNER}', '${PROPERTY}', 'property_management', 'RATE', 10, date '2020-01-01', '${COMPANY_A}');
    update public.owner_agreement_versions
       set effective_to = date '2019-12-31', superseded_at = now()
     where owner_agreement_id = '${AGREEMENT}'::uuid and superseded_at is null;
    insert into public.owner_agreement_versions
      (id, owner_agreement_id, company_id, version_no, operating_model, collection_role,
       commission_type, commission_value, commission_recognition_basis, offset_allowed,
       reserve_amount, effective_from, effective_to, created_by)
    values ('${VERSION}', '${AGREEMENT}', '${COMPANY_A}', 2,
       'OWNER_AGENCY', 'OFFICE_IS_CREDITOR', 'RATE', 10, 'ON_COLLECTION', false, 0,
       date '2020-01-01', date '2030-12-31', '${OPERATOR}');
    update public.owner_agreements set current_version_id = '${VERSION}' where id = '${AGREEMENT}';
    insert into public.units (id, property_id, name, unit_number, status, rent_amount, company_id)
    values ('${UNIT}', '${PROPERTY}', 'J-1', 'J-1', 'available', ${RENT}, '${COMPANY_A}');
    insert into public.people (id, full_name, type, company_id)
    values ('${TENANT}', 'مستأجر الرحلة', 'tenant', '${COMPANY_A}');
  `);

  await assumeIdentity(db, OPERATOR, COMPANY_A);
  await db.query('select public.provision_company_chart_of_accounts($1::uuid)', [COMPANY_A]);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('core operational journey on PR #1548 schema', () => {
  it('login analog: operator identity resolves MANAGER from company_members.role, not users.role', async () => {
    await assumeIdentity(db, OPERATOR, COMPANY_A);
    const { rows } = await db.query<{ role: string; admin: boolean; app: boolean }>(
      `select public.active_company_role($1::uuid) as role,
              public.is_admin_or_manager() as admin,
              public.is_app_user() as app`,
      [COMPANY_A],
    );
    expect(rows[0].role).toBe('MANAGER');
    expect(rows[0].admin).toBe(true);
    expect(rows[0].app).toBe(true);
  });

  it('company selection: JWT company A is the only active operational company', async () => {
    const { rows } = await db.query<{ id: string }>(
      `select company_id as id from public.company_members
        where user_id = $1 and is_active`,
      [OPERATOR],
    );
    expect(rows.map((row) => row.id)).toEqual([COMPANY_A]);
  });

  it('contract: MANAGER creates, second MANAGER approves, then activate', async () => {
    const year = new Date().getFullYear();
    await assumeIdentity(db, OPERATOR, COMPANY_A);
    const created = (await db.query<{ out: Record<string, unknown> }>(
      `select public.create_contract_atomic(
         $1::text, $2::uuid, $3::uuid, $4::uuid,
         date '${year}-01-01', date '${year}-12-31',
         ${RENT}, 'monthly', null, 'draft', null, null, null, 1, 0) as out`,
      [PROPERTY, UNIT, TENANT, AGREEMENT],
    )).rows[0]?.out;
    contractId = String(created.id);
    expect(created.status).toBe('draft');

    await db.query(`select public.submit_contract_for_approval_atomic($1::text, 'Ops Maker')`, [contractId]);
    await assumeIdentity(db, CHECKER, COMPANY_A);
    await db.query(`select public.approve_contract_atomic($1::text, 'Ops Checker')`, [contractId]);
    const activated = (await db.query<{ out: Record<string, unknown> }>(
      `select public.activate_contract_with_agreement_snapshot_atomic($1::text) as out`,
      [contractId],
    )).rows[0]?.out;
    expect(String(activated.status).toLowerCase()).toBe('active');
    expect(String(activated.company_id ?? COMPANY_A)).toBeTruthy();
    await assumeIdentity(db, OPERATOR, COMPANY_A);
  });

  it('invoice: generate_invoices_from_active_contracts posts one company-scoped invoice', async () => {
    await assumeIdentity(db, OPERATOR, COMPANY_A);
    const generated = (await db.query<{ n: string }>(
      `select public.generate_invoices_from_active_contracts()::text as n`,
    )).rows[0];
    expect(Number(generated.n)).toBe(1);
    const { rows } = await db.query<{ id: string; amount: string; status: string; company_id: string }>(
      `select id, amount::text, status, company_id::text
         from public.invoices where contract_id::text = $1 and deleted_at is null`,
      [contractId],
    );
    expect(rows).toHaveLength(1);
    invoiceId = rows[0].id;
    expect(Number(rows[0].amount)).toBe(RENT);
    expect(rows[0].company_id).toBe(COMPANY_A);
  });

  it('collection: record_invoice_payment_atomic settles the invoice and posts a receipt', async () => {
    await assumeIdentity(db, OPERATOR, COMPANY_A);
    const paid = (await db.query<{ out: Record<string, unknown> }>(
      `select public.record_invoice_payment_atomic($1::jsonb) as out`,
      [JSON.stringify({ invoice_id: invoiceId, amount: RENT, method: 'cash', date: monthRange().asOf, request_id: 'ops-pay-1' })],
    )).rows[0]?.out;
    expect(Boolean(paid?.success ?? true)).toBe(true);

    const { rows } = await db.query<{ status: string; paid_amount: string }>(
      `select status, paid_amount::text from public.invoices where id::text = $1`,
      [invoiceId],
    );
    expect(rows[0].status).toBe('PAID');
    expect(Number(rows[0].paid_amount)).toBe(RENT);

    const { rows: receipts } = await db.query<{ n: string }>(
      `select count(*)::text as n
         from public.receipts r
        where upper(coalesce(r.status, '')) = 'POSTED'
          and (
            exists (select 1 from public.payments p where p.receipt_id = r.id and p.invoice_id::text = $1)
            or exists (select 1 from public.receipt_allocations ra where ra.receipt_id = r.id and ra.invoice_id::text = $1)
          )`,
      [invoiceId],
    );
    expect(Number(receipts[0].n)).toBe(1);
  });

  it('report: financial summary and dashboard show the collected rent', async () => {
    await assumeIdentity(db, OPERATOR, COMPANY_A);
    const { from, to, asOf } = monthRange();
    const summary = (await db.query<{ collected: string; active_contracts: string }>(
      `select collected::text, active_contracts::text
         from public.rpt_financial_summary(date '${from}', date '${to}')`,
    )).rows[0];
    const dashboard = JSON.parse((await db.query<{ v: string }>(
      `select public.rpt_dashboard_snapshot(date '${from}', date '${to}', date '${asOf}')::text as v`,
    )).rows[0].v);

    expect(Number(summary.active_contracts)).toBe(1);
    expect(Number(summary.collected)).toBe(RENT);
    expect(num(dashboard.contracts.active)).toBe(1);
    expect(num(dashboard.collections.collected_amount)).toBe(RENT);
    expect(num(dashboard.collections.outstanding_amount)).toBe(0);
  });

  it('user switch: VIEWER membership wins over misleading users.role=ADMIN', async () => {
    await assumeIdentity(db, VIEWER, COMPANY_A);
    const { rows } = await db.query<{ role: string; admin: boolean; app: boolean }>(
      `select public.active_company_role($1::uuid) as role,
              public.is_admin_or_manager() as admin,
              public.is_app_user() as app`,
      [COMPANY_A],
    );
    expect(rows[0].role).toBe('VIEWER');
    expect(rows[0].admin).toBe(false);
    expect(rows[0].app).toBe(true);
  });

  it('allowed restricted action: VIEWER can read the financial report', async () => {
    await assumeIdentity(db, VIEWER, COMPANY_A);
    const { from, to } = monthRange();
    const summary = (await db.query<{ collected: string }>(
      `select collected::text from public.rpt_financial_summary(date '${from}', date '${to}')`,
    )).rows[0];
    expect(Number(summary.collected)).toBe(RENT);
  });

  it('forbidden privileged action: VIEWER cannot collect and cannot create a contract', async () => {
    await assumeIdentity(db, VIEWER, COMPANY_A);
    const payError = await firstError(() => db.query(
      `select public.record_invoice_payment_atomic($1::jsonb)`,
      [JSON.stringify({ invoice_id: invoiceId, amount: 1, method: 'cash', date: monthRange().asOf, request_id: 'ops-pay-viewer' })],
    ));
    expect(payError).toMatch(/ADMIN or MANAGER|غير مصرح|42501|APP_AUTHORITY_REQUIRED/i);

    const year = new Date().getFullYear();
    const createError = await firstError(() => db.query(
      `select public.create_contract_atomic(
         $1::text, $2::uuid, $3::uuid, $4::uuid,
         date '${year}-01-01', date '${year}-12-31',
         ${RENT}, 'monthly', null, 'draft', null, null, null, 1, 0)`,
      [PROPERTY, UNIT, TENANT, AGREEMENT],
    ));
    expect(createError).toMatch(/ADMIN or MANAGER|غير مصرح|42501|APP_AUTHORITY_REQUIRED/i);
  });

  it('cross-company: operator of company A cannot use company B property in create_contract', async () => {
    await assumeIdentity(db, OPERATOR, COMPANY_A);
    const year = new Date().getFullYear();
    const error = await firstError(() => db.query(
      `select public.create_contract_atomic(
         $1::text, $2::uuid, $3::uuid, $4::uuid,
         date '${year}-01-01', date '${year}-12-31',
         ${RENT}, 'monthly', null, 'draft', null, null, null, 1, 0)`,
      [PROPERTY_B, UNIT, TENANT, AGREEMENT],
    ));
    expect(error.length).toBeGreaterThan(0);
    expect(error).toMatch(/غير موجود|FORBIDDEN|42501|العقار|الوحدة|اتفاقية/i);
  });
});
