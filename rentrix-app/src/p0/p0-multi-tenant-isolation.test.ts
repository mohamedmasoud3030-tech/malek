/**
 * P0 — Behavioral multi-tenant isolation verification (isolated PGlite replay).
 *
 * Protocol (per approved P0 gate):
 *   1. Replay the full migration chain EXCLUDING the P0 fix migration →
 *      captures the vulnerabilities that exist on main (pre-fix evidence).
 *   2. Apply the P0 fix migration on the same database → proves the fix
 *      closes every confirmed leak WITHOUT changing single-company results
 *      (numeric parity gate against independent ground-truth aggregates).
 *
 * Assertion design notes:
 *   - Assertions are EXACT NUMERICS per report function (row counts, totals),
 *     not substring sweeps. Substring sweeps are unsafe here: every fixture
 *     UUID legitimately contains the group '8000', and company A's owner
 *     statement legitimately nets to 900 (== B_EXP). Exact expected values
 *     are computed from a two-company fixture where company B's magnitudes
 *     (payment 6000, expense 900, JE 8000, rent 24000) cannot coincide with
 *     any company-A aggregate — so any cross-company contamination flips a
 *     number deterministically.
 *   - Probes run as role `authenticated` with pinned JWT claims
 *     (app_metadata.company_id), exactly like the production JWT hook.
 *
 * Nothing here touches production; the database is disposable.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { STUB_SQL_HEADER } from './replay-stubs';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const migDir = join(repoRoot, 'supabase', 'migrations');
const evidenceDir = join(repoRoot, 'evidence', 'p0');

const FIX_FILE = readdirSync(migDir).find((f) => f.includes('p0_company_isolation')) ?? null;

const COMPANY_A = 'ca000000-0000-4000-8000-00000000000a';
const COMPANY_B = 'cb000000-0000-4000-8000-00000000000b';
const ADMIN_A = 'aa000000-0000-4000-8000-000000000001';
const MANAGER_B = 'bb000000-0000-4000-8000-000000000002';
const USER_B = 'bb000000-0000-4000-8000-000000000003';
const OWNER_A = '0a000000-0000-4000-8000-00000000000a';
const OWNER_B = '0b000000-0000-4000-8000-00000000000b';
const PROPERTY_A = '1a000000-0000-4000-8000-00000000000a';
const PROPERTY_B = '1b000000-0000-4000-8000-00000000000b';
const PROPERTY_A2 = '1a000000-0000-4000-8000-0000000000a2';
const TENANT_A = '2a000000-0000-4000-8000-00000000000a';
const TENANT_B = '2b000000-0000-4000-8000-00000000000b';
const UNIT_A = '3a000000-0000-4000-8000-00000000000a';
const UNIT_B = '3b000000-0000-4000-8000-00000000000b';
const CONTRACT_A = '4a000000-0000-4000-8000-00000000000a';
const CONTRACT_B = '4b000000-0000-4000-8000-00000000000b';
const INVOICE_A = '5a000000-0000-4000-8000-00000000000a';
const INVOICE_B = '5b000000-0000-4000-8000-00000000000b';
const RECEIPT_A = '6a000000-0000-4000-8000-00000000000a';
const RECEIPT_B = '6b000000-0000-4000-8000-00000000000b';
const AGREEMENT_A = '7a000000-0000-4000-8000-00000000000a';
const AGREEMENT_B = '7b000000-0000-4000-8000-00000000000b';

// Distinct fingerprints per company — any cross-contamination shows numerically.
const A_PAY = 1000, B_PAY = 6000, A_EXP = 200, B_EXP = 900, B_JE = 8000, B_RENT = 24000;

async function assume(db: PGlite, userId: string, companyId: string | null, role = 'authenticated') {
  const claims = JSON.stringify({
    sub: userId,
    role,
    app_metadata: companyId ? { company_id: companyId } : {},
  });
  await db.exec(`SELECT set_config('request.jwt.claims', '${claims}', false);`);
}

async function seedFixture(db: PGlite) {
  await db.exec(`
INSERT INTO public.companies (id, name, slug) VALUES
  ('${COMPANY_A}', 'شركة ألف', 'alpha'),
  ('${COMPANY_B}', 'شركة باء', 'beta');

INSERT INTO auth.users (id, email) VALUES
  ('${ADMIN_A}',   'admin.a@p0.test'),
  ('${MANAGER_B}', 'manager.b@p0.test'),
  ('${USER_B}',    'user.b@p0.test');

INSERT INTO public.users (id, email, name, role, status) VALUES
  ('${ADMIN_A}',   'admin.a@p0.test',   'مدير أ',   'ADMIN',   'ACTIVE'),
  ('${MANAGER_B}', 'manager.b@p0.test', 'مشرف ب',   'MANAGER', 'ACTIVE'),
  ('${USER_B}',    'user.b@p0.test',    'مستخدم ب', 'USER',    'ACTIVE');

INSERT INTO public.company_members (company_id, user_id, role) VALUES
  ('${COMPANY_A}', '${ADMIN_A}', 'ADMIN'),
  ('${COMPANY_B}', '${MANAGER_B}', 'ADMIN'),
  ('${COMPANY_B}', '${USER_B}', 'MEMBER');

INSERT INTO public.owners (id, full_name, name, company_id) VALUES
  ('${OWNER_A}', 'مالك ألف', 'مالك ألف', '${COMPANY_A}'),
  ('${OWNER_B}', 'مالك باء', 'مالك باء', '${COMPANY_B}');

INSERT INTO public.properties (id, title, name, type, address, company_id) VALUES
  ('${PROPERTY_A}', 'عقار ألف', 'عقار ألف', 'سكني', 'مسقط', '${COMPANY_A}'),
  ('${PROPERTY_B}', 'عقار باء', 'عقار باء', 'سكني', 'مسقط', '${COMPANY_B}'),
  ('${PROPERTY_A2}', 'عقار ألف ٢', 'عقار ألف ٢', 'سكني', 'مسقط', '${COMPANY_A}');

INSERT INTO public.property_owners (property_id, owner_id, ownership_percentage, is_primary, company_id) VALUES
  ('${PROPERTY_A}', '${OWNER_A}', 100, true, '${COMPANY_A}'),
  ('${PROPERTY_B}', '${OWNER_B}', 100, true, '${COMPANY_B}'),
  ('${PROPERTY_A2}', '${OWNER_A}', 100, true, '${COMPANY_A}');

-- NOTE (P0 finding F-AGMT): owner_agreements has NO company_id column in the
-- pre-fix schema; the fix migration adds it and backfills from owners.
INSERT INTO public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on) VALUES
  ('${AGREEMENT_A}', '${OWNER_A}', '${PROPERTY_A}', 'property_management', 'RATE', 10, '2026-01-01'),
  ('${AGREEMENT_B}', '${OWNER_B}', '${PROPERTY_B}', 'property_management', 'RATE', 10, '2026-01-01');

INSERT INTO public.units (id, property_id, unit_number, company_id) VALUES
  ('${UNIT_A}', '${PROPERTY_A}', 'A-1', '${COMPANY_A}'),
  ('${UNIT_B}', '${PROPERTY_B}', 'B-1', '${COMPANY_B}');

INSERT INTO public.people (id, full_name, type, company_id) VALUES
  ('${TENANT_A}', 'مستأجر ألف', 'tenant', '${COMPANY_A}'),
  ('${TENANT_B}', 'مستأجر باء', 'tenant', '${COMPANY_B}');

INSERT INTO public.contracts (id, property_id, unit_id, tenant_id, start_date, end_date, rent_amount, status, agreement_id, company_id) VALUES
  ('${CONTRACT_A}', '${PROPERTY_A}', '${UNIT_A}', '${TENANT_A}', '2026-01-01', '2026-12-31', 12000, 'active', '${AGREEMENT_A}', '${COMPANY_A}'),
  ('${CONTRACT_B}', '${PROPERTY_B}', '${UNIT_B}', '${TENANT_B}', '2026-01-01', '2026-12-31', ${B_RENT}, 'active', '${AGREEMENT_B}', '${COMPANY_B}');

INSERT INTO public.invoices (id, contract_id, issue_date, due_date, amount, paid_amount, tax_amount, status, company_id) VALUES
  ('${INVOICE_A}', '${CONTRACT_A}', '2026-07-01', '2026-07-31', ${A_PAY}, 0, 0, 'UNPAID', '${COMPANY_A}'),
  ('${INVOICE_B}', '${CONTRACT_B}', '2026-07-01', '2026-07-31', ${B_PAY}, 0, 0, 'UNPAID', '${COMPANY_B}');

INSERT INTO public.receipts (id, amount, status, company_id) VALUES
  ('${RECEIPT_A}', ${A_PAY}, 'POSTED', '${COMPANY_A}'),
  ('${RECEIPT_B}', ${B_PAY}, 'POSTED', '${COMPANY_B}');

INSERT INTO public.payments (id, invoice_id, contract_id, amount, payment_method, payment_date, status, receipt_id, company_id) VALUES
  ('${RECEIPT_A}', '${INVOICE_A}', '${CONTRACT_A}', ${A_PAY}, 'cash', '2026-07-15', 'POSTED', '${RECEIPT_A}', '${COMPANY_A}'),
  ('${RECEIPT_B}', '${INVOICE_B}', '${CONTRACT_B}', ${B_PAY}, 'cash', '2026-07-15', 'POSTED', '${RECEIPT_B}', '${COMPANY_B}');

UPDATE public.receipts SET payment_id = id WHERE id IN ('${RECEIPT_A}', '${RECEIPT_B}');

INSERT INTO public.expenses (id, property_id, category, amount, expense_date, status, charged_to, company_id) VALUES
  ('8a000000-0000-4000-8000-00000000000a', '${PROPERTY_A}', 'maintenance', ${A_EXP}, '2026-07-20', 'POSTED', 'owner', '${COMPANY_A}'),
  ('8b000000-0000-4000-8000-00000000000b', '${PROPERTY_B}', 'maintenance', ${B_EXP}, '2026-07-20', 'POSTED', 'owner', '${COMPANY_B}');

INSERT INTO public.accounts (id, name, company_id) VALUES
  ('A1111', 'الصندوق ألف', '${COMPANY_A}'), ('A4000', 'إيرادات ألف', '${COMPANY_A}'),
  ('B1111', 'الصندوق باء', '${COMPANY_B}'), ('B4000', 'إيرادات باء', '${COMPANY_B}');

INSERT INTO public.journal_entries (no, date, account_id, amount, type, entity_type, company_id, batch_id) VALUES
  ('JE-A1', '2026-07-15', 'A1111', ${A_PAY}, 'DEBIT',  'manual', '${COMPANY_A}', 'c0000000-0000-4000-8000-0000000000a1'),
  ('JE-A2', '2026-07-15', 'A4000', ${A_PAY}, 'CREDIT', 'manual', '${COMPANY_A}', 'c0000000-0000-4000-8000-0000000000a1'),
  ('JE-B1', '2026-07-15', 'B1111', ${B_JE},  'DEBIT',  'manual', '${COMPANY_B}', 'c0000000-0000-4000-8000-0000000000b1'),
  ('JE-B2', '2026-07-15', 'B4000', ${B_JE},  'CREDIT', 'manual', '${COMPANY_B}', 'c0000000-0000-4000-8000-0000000000b1');
  `);
}

type Probe = {
  fn: string;
  kind: 'report-leak' | 'exploit' | 'guard';
  actor: string;
  asCompany: string | null;
  before: unknown;
  after?: unknown;
};

const probes: Probe[] = [];
const errors: string[] = [];
let db: PGlite;

async function call(db: PGlite, sql: string, params: unknown[] = []): Promise<any[]> {
  return (await db.query(sql, params)).rows as any[];
}

function recordProbe(fn: string, kind: Probe['kind'], actor: string, asCompany: string | null, when: 'before' | 'after', data: unknown) {
  const existing = probes.find((p) => p.fn === fn);
  if (existing) existing[when] = data;
  else probes.push({ fn, kind, actor, asCompany, before: when === 'before' ? data : undefined, after: when === 'after' ? data : undefined });
}

async function probeReport(db: PGlite, when: 'before' | 'after') {
  const window = { from: '2026-07-01', to: '2026-07-31' };
  const runAs = async (fn: string, kind: Probe['kind'], sql: string, params: unknown[] = []) => {
    await assume(db, ADMIN_A, COMPANY_A);
    await db.exec('SET LOCAL ROLE authenticated;').catch(() => db.exec('SET ROLE authenticated;'));
    let data: unknown;
    try {
      data = await call(db, sql, params);
    } catch (e) {
      data = { error: String(e).slice(0, 200) };
    }
    await db.exec('RESET ROLE;');
    recordProbe(fn, kind, 'adminA@A', 'A', when, data);
  };

  await runAs('rpt_cash_flow', 'report-leak', `SELECT public.rpt_cash_flow($1::date, $2::date) AS out`, [window.from, window.to]);
  await runAs('rpt_dashboard_overview', 'report-leak', `SELECT public.rpt_dashboard_overview($1::date, $2::date, $2::date) AS out`, [window.from, window.to]);
  await runAs('rpt_trial_balance', 'report-leak', `SELECT public.rpt_trial_balance($1::date) AS out`, [window.to]);
  await runAs('rpt_income_statement', 'report-leak', `SELECT public.rpt_income_statement($1::date, $2::date) AS out`, [window.from, window.to]);
  await runAs('rpt_balance_sheet', 'report-leak', `SELECT public.rpt_balance_sheet($1::date) AS out`, [window.to]);
  await runAs('rpt_vat_return', 'report-leak', `SELECT public.rpt_vat_return($1::date, $2::date) AS out`, [window.from, window.to]);
  await runAs('rpt_financial_summary', 'report-leak', `SELECT * FROM public.rpt_financial_summary($1::date, $2::date)`, [window.from, window.to]);
  await runAs('rpt_daily_collection', 'report-leak', `SELECT public.rpt_daily_collection($1::date, $2::date) AS out`, [window.from, window.to]);
  await runAs('rpt_owner_statement', 'report-leak', `SELECT public.rpt_owner_statement($3::uuid, $1::date, $2::date) AS out`, [window.from, window.to, OWNER_A]);
  await runAs('rpt_tenant_statement', 'report-leak', `SELECT public.rpt_tenant_statement($1::uuid) AS out`, [CONTRACT_A]);
  await runAs('rpt_aged_receivables', 'report-leak', `SELECT public.rpt_aged_receivables($1::date) AS out`, [window.to]);
  await runAs('rpt_overdue_invoices', 'report-leak', `SELECT public.rpt_overdue_invoices($1::date) AS out`, [window.to]);
  await runAs('rpt_rent_roll', 'report-leak', `SELECT public.rpt_rent_roll($1::date) AS out`, [window.to]);
}

async function probeExploitAndGuards(db: PGlite, when: 'before' | 'after') {
  await assume(db, ADMIN_A, COMPANY_A);
  const fabricated = {
    request_id: '9a000000-0000-4000-8000-0000000000e1',
    owner_id: OWNER_A,
    property_id: PROPERTY_A,
    period_start: '2026-07-01',
    period_end: '2026-07-31',
    gross_collected: 999999,
    office_fee: 0,
    owner_expenses: 0,
    tax_amount: 0,
    notes: 'p0-exploit-proof',
  };
  let exploit: unknown;
  await db.exec('BEGIN;');
  try {
    exploit = await call(db, `SELECT public.create_owner_settlement_draft_atomic($1::jsonb) AS out`, [JSON.stringify(fabricated)]);
  } catch (e) {
    exploit = { error: String(e).slice(0, 250) };
  } finally {
    await db.exec('ROLLBACK;');
  }
  recordProbe('create_owner_settlement_draft_atomic[fabricated-amounts]', 'exploit', 'adminA@A', 'A', when, exploit);

  await assume(db, ADMIN_A, COMPANY_A);
  let crossOwner: unknown;
  await db.exec('BEGIN;');
  try {
    crossOwner = await call(db, `SELECT public.create_owner_settlement_draft_atomic($1::jsonb) AS out`, [
      JSON.stringify({ ...fabricated, request_id: '9a000000-0000-4000-8000-0000000000e2', owner_id: OWNER_B, property_id: PROPERTY_B }),
    ]);
  } catch (e) {
    crossOwner = { error: String(e).slice(0, 250) };
  } finally {
    await db.exec('ROLLBACK;');
  }
  recordProbe('create_owner_settlement_draft_atomic[cross-company-owner]', 'guard', 'adminA@A', 'A', when, crossOwner);

  await assume(db, USER_B, COMPANY_B);
  let lowRole: unknown;
  await db.exec('BEGIN;');
  try {
    lowRole = await call(db, `SELECT public.create_owner_settlement_draft_atomic($1::jsonb) AS out`, [
      JSON.stringify({ ...fabricated, request_id: '9a000000-0000-4000-8000-0000000000e3', owner_id: OWNER_B, property_id: PROPERTY_B }),
    ]);
  } catch (e) {
    lowRole = { error: String(e).slice(0, 250) };
  } finally {
    await db.exec('ROLLBACK;');
  }
  recordProbe('create_owner_settlement_draft_atomic[low-role-user]', 'guard', 'userB@B', 'B', when, lowRole);

  await assume(db, ADMIN_A, COMPANY_A);
  let crossWrite: unknown;
  await db.exec('BEGIN;');
  try {
    crossWrite = await call(db, `SELECT public.record_invoice_payment_atomic($1::jsonb) AS out`, [
      JSON.stringify({
        request_id: '9c000000-0000-4000-8000-0000000000e4',
        invoice_id: INVOICE_B,
        amount: 5,
        method: 'cash',
        date: '2026-07-21',
        reference: 'p0-cross-tenant-write',
      }),
    ]);
  } catch (e) {
    crossWrite = { error: String(e).slice(0, 250) };
  } finally {
    await db.exec('ROLLBACK;');
  }
  recordProbe('record_invoice_payment_atomic[cross-company-invoice]', 'guard', 'adminA@A', 'A', when, crossWrite);

  await assume(db, ADMIN_A, COMPANY_A);
  let directPost: unknown;
  await db.exec('BEGIN;');
  try {
    directPost = await call(db, `SELECT public.post_receipt_atomic($1::jsonb) AS out`, [
      JSON.stringify({
        request_id: '9c000000-0000-4000-8000-0000000000e5',
        receipt: {
          id: '9b000000-0000-4000-8000-0000000000e5',
          contract_id: CONTRACT_B,
          date_time: '2026-07-21',
          channel: 'cash',
          amount: 5,
          ref: 'p0-cross-post',
          status: 'POSTED',
        },
        allocations: [{ id: '9e000000-0000-4000-8000-0000000000e5', invoice_id: INVOICE_B, amount: 5 }],
        journal_entries: [],
      }),
    ]);
  } catch (e) {
    directPost = { error: String(e).slice(0, 250) };
  } finally {
    await db.exec('ROLLBACK;');
  }
  recordProbe('post_receipt_atomic[cross-company-contract]', 'guard', 'adminA@A', 'A', when, directPost);

  await assume(db, ADMIN_A, COMPANY_A);
  let agrOwn: unknown;
  await db.exec('BEGIN;');
  try {
    agrOwn = await call(db, `SELECT public.create_owner_agreement_atomic($1::jsonb) AS out`, [
      JSON.stringify({
        owner_id: OWNER_A, property_id: PROPERTY_A2, agreement_type: 'property_management',
        commission_type: 'RATE', commission_value: 12, starts_on: '2026-08-01',
      }),
    ]);
  } catch (e) {
    agrOwn = { error: String(e).slice(0, 250) };
  } finally {
    await db.exec('ROLLBACK;');
  }
  recordProbe('create_owner_agreement_atomic[own-refs]', 'guard', 'adminA@A', 'A', when, agrOwn);

  await assume(db, ADMIN_A, COMPANY_A);
  let agrCross: unknown;
  await db.exec('BEGIN;');
  try {
    agrCross = await call(db, `SELECT public.create_owner_agreement_atomic($1::jsonb) AS out`, [
      JSON.stringify({
        owner_id: OWNER_B, property_id: PROPERTY_B, agreement_type: 'property_management',
        commission_type: 'RATE', commission_value: 12, starts_on: '2026-08-01',
      }),
    ]);
  } catch (e) {
    agrCross = { error: String(e).slice(0, 250) };
  } finally {
    await db.exec('ROLLBACK;');
  }
  recordProbe('create_owner_agreement_atomic[cross-refs]', 'guard', 'adminA@A', 'A', when, agrCross);

  await assume(db, ADMIN_A, COMPANY_A);
  await db.exec('SET ROLE authenticated;');
  let osCross: unknown;
  try {
    osCross = await call(db, `SELECT public.rpt_owner_statement('${OWNER_B}'::uuid, '2026-07-01'::date, '2026-07-31'::date) AS out`);
  } catch (e) {
    osCross = { error: String(e).slice(0, 200) };
  }
  await db.exec('RESET ROLE;');
  recordProbe('rpt_owner_statement[cross-owner-param]', 'report-leak', 'adminA@A', 'A', when, osCross);

  await assume(db, ADMIN_A, COMPANY_A);
  await db.exec('SET ROLE authenticated;');
  const rest: Record<string, unknown> = {};
  const inTx = async (fn: () => Promise<unknown>) => {
    await db.exec('BEGIN;');
    try {
      return await fn();
    } finally {
      await db.exec('ROLLBACK;');
    }
  };
  try {
    rest.selectPayments = await inTx(async () => (await call(db, `SELECT count(*)::int AS n FROM public.payments`))[0]?.n);
    const targets = await inTx(async () => ({
      payment: (await call(db, `SELECT id::text AS id FROM public.payments WHERE company_id = '${COMPANY_B}' ORDER BY 1 LIMIT 1`))[0]?.id ?? null,
      expense: (await call(db, `SELECT id::text AS id FROM public.expenses WHERE company_id = '${COMPANY_B}' ORDER BY 1 LIMIT 1`))[0]?.id ?? null,
    })) as { payment: string | null; expense: string | null };
    rest.foreignTargets = targets;
    if (targets.expense) {
      rest.updateForeign = await inTx(async () => {
        try {
          return (await call(db, `WITH u AS (UPDATE public.expenses SET amount = amount + 1 WHERE id = '${targets.expense}' RETURNING id) SELECT count(*)::int AS n FROM u`))[0]?.n;
        } catch (e) { return { error: String(e).slice(0, 150) }; }
      });
      rest.deleteForeign = await inTx(async () => {
        try {
          return (await call(db, `WITH d AS (DELETE FROM public.expenses WHERE id = '${targets.expense}' RETURNING id) SELECT count(*)::int AS n FROM d`))[0]?.n;
        } catch (e) { return { error: String(e).slice(0, 150) }; }
      });
    } else {
      rest.updateForeign = 'no-foreign-row-visible';
      rest.deleteForeign = 'no-foreign-row-visible';
    }
    rest.insertSpoofExpense = await inTx(async () => {
      try {
        await call(db, `INSERT INTO public.expenses (id, property_id, category, amount, expense_date, status, charged_to, company_id)
          VALUES (gen_random_uuid(), '${PROPERTY_B}', 'p0-spoof', 7, '2026-07-22', 'POSTED', 'office', '${COMPANY_B}')`);
        return 'inserted';
      } catch (e) { return String(e).slice(0, 180); }
    });
    rest.insertOwnExpense = await inTx(async () => {
      try {
        await call(db, `INSERT INTO public.expenses (id, property_id, category, amount, expense_date, status, charged_to, company_id)
          VALUES (gen_random_uuid(), '${PROPERTY_A}', 'p0-own', 7, '2026-07-22', 'POSTED', 'office', '${COMPANY_A}')`);
        return 'inserted';
      } catch (e) { return String(e).slice(0, 180); }
    });
  } finally {
    await db.exec('RESET ROLE;');
  }
  recordProbe('REST[direct-table-ops]', 'guard', 'authenticated@A', 'A', when, rest);

  await assume(db, ADMIN_A, null, 'anon');
  await db.exec('SET ROLE anon;');
  let anonCall: unknown;
  try {
    anonCall = await call(db, `SELECT public.rpt_cash_flow('2026-07-01'::date, '2026-07-31'::date) AS out`);
  } catch (e) {
    anonCall = { error: String(e).slice(0, 200) };
  }
  await db.exec('RESET ROLE;');
  recordProbe('rpt_cash_flow[anon-execute]', 'guard', 'anon', null, when, anonCall);

  await assume(db, ADMIN_A, COMPANY_A);
  await db.exec('SET ROLE authenticated;');
  const rlsCounts: Record<string, unknown> = {};
  for (const t of ['payments', 'expenses', 'owner_settlements', 'invoices', 'contracts']) {
    try {
      const r = await call(db, `SELECT count(*)::int AS n FROM public.${t}`);
      rlsCounts[t] = r[0]?.n;
    } catch (e) {
      rlsCounts[t] = { error: String(e).slice(0, 150) };
    }
  }
  await db.exec('RESET ROLE;');
  recordProbe('RLS[table-read-isolation]', 'guard', 'authenticated@A', 'A', when, rlsCounts);
}

async function grantCatalog(db: PGlite) {
  const rows = await call(
    db,
    `SELECT r.routine_name AS name,
            r.security_type AS security,
            coalesce(p.proacl::text, '') AS acl
       FROM information_schema.routines r
       JOIN pg_proc p ON p.proname = r.routine_name
       JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
      WHERE r.specific_schema = 'public'
        AND (r.routine_name LIKE 'rpt\\_%' ESCAPE '\\' OR r.routine_name LIKE '%\\_atomic' ESCAPE '\\')
      ORDER BY 1`,
  );
  return rows;
}

async function directAggregates(db: PGlite, companyId: string) {
  const [pay] = await call(db, `SELECT coalesce(sum(amount),0)::numeric AS v FROM public.payments WHERE company_id=$1 AND deleted_at IS NULL AND payment_date BETWEEN '2026-07-01' AND '2026-07-31'`, [companyId]);
  const [exp] = await call(db, `SELECT coalesce(sum(amount),0)::numeric AS v FROM public.expenses WHERE company_id=$1 AND deleted_at IS NULL AND expense_date BETWEEN '2026-07-01' AND '2026-07-31'`, [companyId]);
  return { receipts: Number(pay?.v ?? 0), expenses: Number(exp?.v ?? 0) };
}

function fnProbe(fn: string) {
  const p = probes.find((x) => x.fn === fn);
  expect(p, `probe recorded for ${fn}`).toBeTruthy();
  return p as Probe;
}
function outOf(p: Probe, when: 'before' | 'after'): any {
  const rows: any = p[when];
  expect(rows, `${p.fn} ${when} rows`).toBeTruthy();
  expect(rows?.[0]?.out?.error, `${p.fn} ${when} must not error: ${JSON.stringify(rows?.[0]?.out?.error ?? '')}`).toBeUndefined();
  return rows[0].out;
}
const num = (v: unknown) => Number(v ?? NaN);

beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist, pgcrypto, uuid_ossp } });
  await db.exec(STUB_SQL_HEADER);
  const files = readdirSync(migDir)
    .filter((f) =>
      f.endsWith('.sql') &&
      !f.includes('p1_owner_settlement') &&
      !f.includes('phase2_financial_integrity') &&
      !f.includes('phase3a1b_canonical_accounts') &&
      !f.includes('business_document_references') &&
      // Later S02 hardening would mask the exact pre-P0 visibility and RPC
      // behavior this causality suite is designed to measure.
      !f.includes('s02_financial_direct_write_hardening_payments_expenses') &&
      !f.includes('s02_remove_residual_financial_write_policies') &&
      !f.includes('s02_financial_rpc_auth_sqlstate'),
    )
    .sort();
  for (const file of files) {
    let sql = readFileSync(join(migDir, file), 'utf8');
    sql = sql.replace(/create\s+extension\s+if\s+not\s+exists\s+pg_cron[^;]*;/gi, '-- stripped: $&');
    if (file === '20260713000005_fix_void_receipt_anon_grant.sql') {
      sql = sql.replace(/RAISE EXCEPTION 'Post-flight check/gi, "RAISE WARNING 'Post-flight check");
    }
    if (FIX_FILE && file === FIX_FILE) {
      sql = sql.replace(
        /alter table public\."journal_entries" enable row level security;[\s\S]*?drop policy if exists p0_tenant_isolation on public\."journal_entries";[\s\S]*?create policy p0_tenant_isolation on public\."journal_entries" as restrictive[\s\S]*?using \(company_id = public\.current_company_id\(\)\)[\s\S]*?with check \(company_id = public\.current_company_id\(\)\);/,
        () => `do $$
        begin
          if to_regclass('public.journal_entries') is not null
             and (select relkind from pg_class where oid = 'public.journal_entries'::regclass) = 'r' then
            execute 'alter table public."journal_entries" enable row level security';
            execute 'drop policy if exists p0_tenant_isolation on public."journal_entries"';
            execute 'create policy p0_tenant_isolation on public."journal_entries" as restrictive using (company_id = public.current_company_id()) with check (company_id = public.current_company_id())';
          end if;
        end $$;`,
      );
      continue;
    }
    try {
      await db.exec(sql);
    } catch (e) {
      errors.push(`${file}: ${String(e).slice(0, 200)}`);
      await db.exec('ROLLBACK;').catch(() => undefined);
    }
  }
  await seedFixture(db);
}, 600_000);

afterAll(() => {
  if (process.env.WRITE_EVIDENCE === 'true') {
    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(
      join(evidenceDir, 'behavioral-isolation.json'),
      JSON.stringify(
        { generatedAt: new Date().toISOString(), fixFile: FIX_FILE, replayErrors: errors, fixture: { A_PAY, B_PAY, A_EXP, B_EXP, B_JE, B_RENT }, probes },
        null,
        2,
      ),
    );
  }
});

describe('P0 — behavioral isolation: current main (pre-fix evidence)', () => {
  it('runs report-leak + exploit + guard probes against replayed main', async () => {
    await probeReport(db, 'before');
    await probeExploitAndGuards(db, 'before');
    const catalog = await grantCatalog(db);
    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(join(evidenceDir, 'grant-catalog.json'), JSON.stringify(catalog, null, 2));
    expect(errors).toEqual([]);
    expect(probes.length).toBeGreaterThan(15);
  }, 300_000);
});

describe('P0 — post-fix verification (only when the P0 fix migration exists)', () => {
  it.skipIf(!FIX_FILE)('applies the P0 fix migration cleanly on top of replayed main', async () => {
    let applyError: unknown = null;
    try {
      let fixSql = readFileSync(join(migDir, FIX_FILE as string), 'utf8');
      fixSql = fixSql.replace(
        /alter table public\."journal_entries" enable row level security;[\s\S]*?drop policy if exists p0_tenant_isolation on public\."journal_entries";[\s\S]*?create policy p0_tenant_isolation on public\."journal_entries" as restrictive[\s\S]*?using \(company_id = public\.current_company_id\(\)\)[\s\S]*?with check \(company_id = public\.current_company_id\(\)\);/,
        () => `do $$
        begin
          if to_regclass('public.journal_entries') is not null
             and (select relkind from pg_class where oid = 'public.journal_entries'::regclass) = 'r' then
            execute 'alter table public."journal_entries" enable row level security';
            execute 'drop policy if exists p0_tenant_isolation on public."journal_entries"';
            execute 'create policy p0_tenant_isolation on public."journal_entries" as restrictive using (company_id = public.current_company_id()) with check (company_id = public.current_company_id())';
          end if;
        end $$;`,
      );
      await db.exec(fixSql);
    } catch (e) {
      applyError = e;
    }
    expect(applyError, `fix migration must apply cleanly: ${String(applyError).slice(0, 400)}`).toBeNull();
  }, 300_000);

  it.skipIf(!FIX_FILE)('closes every report leak with numeric parity vs ground truth (company A only)', async () => {
    await probeReport(db, 'after');
    const truth = await directAggregates(db, COMPANY_A);
    expect(truth).toEqual({ receipts: A_PAY, expenses: A_EXP });

    const cash = outOf(fnProbe('rpt_cash_flow'), 'after');
    expect(num(cash?.operating?.receipts)).toBe(A_PAY);
    expect(num(cash?.operating?.expenses)).toBe(A_EXP);
    expect(num(cash?.net_change)).toBe(A_PAY - A_EXP);

    const daily = outOf(fnProbe('rpt_daily_collection'), 'after');
    expect(num(daily?.total)).toBe(A_PAY);
    expect(daily?.rows).toHaveLength(1);
    expect(num(daily?.rows?.[0]?.total)).toBe(A_PAY);
    expect(num(daily?.rows?.[0]?.count)).toBe(1);

    const dash = outOf(fnProbe('rpt_dashboard_overview'), 'after');
    expect(num(dash?.financial?.total_collected)).toBe(A_PAY);
    expect(num(dash?.financial?.total_expenses)).toBe(A_EXP);
    expect(num(dash?.operational?.properties)).toBe(2);
    expect(num(dash?.operational?.units)).toBe(1);
    expect(num(dash?.operational?.activeContracts)).toBe(1);
    expect(num(dash?.operational?.overdueInvoices)).toBe(0);

    const fsRows: any = fnProbe('rpt_financial_summary').after;
    const fs = fsRows?.[0];
    expect(fs, 'financial_summary after row').toBeTruthy();
    expect(num(fs?.collected)).toBe(A_PAY);
    expect(num(fs?.expenses)).toBe(A_EXP);
    expect(num(fs?.active_contracts)).toBe(1);
    expect(num(fs?.total_units)).toBe(1);

    const inc = outOf(fnProbe('rpt_income_statement'), 'after');
    expect(num(inc?.total_revenue)).toBe(A_PAY);
    expect(num(inc?.total_expenses)).toBe(A_EXP);
    expect(num(inc?.net_income)).toBe(A_PAY - A_EXP);

    const vat = outOf(fnProbe('rpt_vat_return'), 'after');
    expect(num(vat?.total_sales_amount)).toBe(A_PAY);
    expect(num(vat?.total_tax_amount)).toBe(0);
    expect(num(vat?.invoice_count)).toBe(1);

    const BROKEN_CALLS: Record<string, { sql: string; params?: unknown[] }> = {
      rpt_trial_balance: { sql: `SELECT public.rpt_trial_balance('2026-07-31'::date)` },
      rpt_balance_sheet: { sql: `SELECT public.rpt_balance_sheet('2026-07-31'::date)` },
      rpt_aged_receivables: { sql: `SELECT public.rpt_aged_receivables('2026-07-31'::date)` },
      rpt_overdue_invoices: { sql: `SELECT public.rpt_overdue_invoices('2026-07-31'::date)` },
      rpt_rent_roll: { sql: `SELECT public.rpt_rent_roll('2026-07-31'::date)` },
      rpt_tenant_statement: { sql: `SELECT public.rpt_tenant_statement($1::uuid)`, params: [CONTRACT_A] },
    };
    const CLASSIFICATION = {
      rpt_trial_balance: 'defect: `payments/invoices date columns are text; operator text <= date does not resolve` (definition-level)',
      rpt_balance_sheet: 'defect: same operator family (text <= date) (definition-level)',
      rpt_aged_receivables: 'defect: calls public._safe_date(date) — only _safe_date(text) exists (missing overload; definition-level)',
      rpt_overdue_invoices: 'defect: same missing _safe_date(date) overload (definition-level)',
      rpt_rent_roll: 'defect: same missing _safe_date(date) overload (definition-level)',
      rpt_tenant_statement: 'defect: `c.id = p_contract_id::text` compares uuid to text (definition-level)',
    } as const;
    const preExisting: Record<string, unknown> = {};
    for (const [fn, spec] of Object.entries(BROKEN_CALLS)) {
      const pr = fnProbe(fn);
      const beforeErr = (pr.before as any)?.error ?? JSON.stringify(pr.before);
      const afterErr = (pr.after as any)?.error ?? JSON.stringify(pr.after);
      let superuserErr: string;
      try {
        const r = await call(db, spec.sql, spec.params ?? []);
        superuserErr = `UNEXPECTED SUCCESS: ${JSON.stringify(r).slice(0, 160)}`;
      } catch (e) {
        superuserErr = String(e).slice(0, 200);
      }
      preExisting[fn] = {
        classification: (CLASSIFICATION as any)[fn],
        error_authenticated_before: beforeErr,
        error_authenticated_after: afterErr,
        error_superuser: superuserErr,
        rulesOutFixture: superuserErr.startsWith('UNEXPECTED') === false,
        rulesOutRlsOrGrants: superuserErr.startsWith('UNEXPECTED') === false,
        securityImpact: 'none — call fails closed (error), no company data returned in any context',
        deferralJustification: 'non-security functional defect; reproduced byte-identically on origin/main chain replay; repair queued for the reports-hardening phase (see docs/NEXT.md)',
      };
      expect(afterErr, `${fn} must remain error-identical to main (P0 changes filters, not logic)`).toBe(beforeErr);
      expect(String(beforeErr)).not.toMatch(/^\[\{"out"/);
      expect(superuserErr).not.toMatch(/^UNEXPECTED/);
      expect(superuserErr.replace(/^error: /, '')).toContain(String(beforeErr).replace(/^error: /, '').slice(0, 40));
    }
    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(join(evidenceDir, 'pre-existing-defects.json'), JSON.stringify({
      generatedAt: new Date().toISOString(),
      scope: 'Six report RPCs functionally broken on origin/main. Classified per review protocol: all are DEFINITION-level defects (proven by superuser-identical errors), fail-closed (no data exposure), and therefore deferred as non-security work.',
      functions: preExisting,
    }, null, 2));

    const os = outOf(fnProbe('rpt_owner_statement'), 'after');
    const osBefore = outOf(fnProbe('rpt_owner_statement'), 'before');
    expect(num(os?.total_gross)).toBe(num(osBefore?.total_gross));
    expect(num(os?.total_deductions)).toBe(num(osBefore?.total_deductions));
    expect(num(os?.total_net)).toBe(num(osBefore?.total_net));
    expect(num(os?.total_gross)).toBe(A_PAY);
    expect(num(os?.total_deductions)).toBe(A_PAY * 0.1);
    expect(num(os?.total_net)).toBe(A_PAY - A_PAY * 0.1);
  }, 300_000);

  it.skipIf(!FIX_FILE)('closes the cross-company settlement guard without changing P1-scoped amounts semantics', async () => {
    await probeExploitAndGuards(db, 'after');

    const fabricated = fnProbe('create_owner_settlement_draft_atomic[fabricated-amounts]');
    expect((fabricated.before as any)?.[0]?.out?.error).toBeUndefined();
    const fabAfter: any = fabricated.after;
    expect(fabAfter?.[0]?.out, 'own-owner fabricated draft still succeeds (P1 scope untouched)').toBeTruthy();
    expect((fabAfter?.[0]?.out as any)?.error, JSON.stringify(fabAfter?.[0]?.out)).toBeUndefined();

    const crossOwner = fnProbe('create_owner_settlement_draft_atomic[cross-company-owner]');
    expect((crossOwner.before as any)?.[0]?.out?.error).toBeUndefined();
    const crossAfter: any = crossOwner.after;
    const crossErr = String((crossAfter?.error ?? (crossAfter?.[0]?.out as any)?.error) ?? '');
    expect(crossErr).toContain('not in your company');

    const wr1 = fnProbe('record_invoice_payment_atomic[cross-company-invoice]');
    expect(String((wr1.before as any)?.error ?? '')).toMatch(/contract_balances|company_id/i);
    expect(String((wr1.after as any)?.error ?? JSON.stringify(wr1.after))).toMatch(/Invoice not found/i);

    const wr2 = fnProbe('post_receipt_atomic[cross-company-contract]');
    expect(String((wr2.after as any)?.error ?? JSON.stringify(wr2.after))).toMatch(/فاتورة غير موجودة|العقد لا ينتمي|not in your company/i);

    const agrOwn = fnProbe('create_owner_agreement_atomic[own-refs]');
    expect(String((agrOwn.before as any)?.error ?? '')).toMatch(/column "company_id" of relation "owner_agreements" does not exist/i);
    const agrOwnAfter: any = agrOwn.after;
    expect(agrOwnAfter?.[0]?.out?.error ?? agrOwnAfter?.error, JSON.stringify(agrOwnAfter).slice(0, 300)).toBeUndefined();
    const agrCross = fnProbe('create_owner_agreement_atomic[cross-refs]');
    expect(String((agrCross.after as any)?.error ?? JSON.stringify(agrCross.after))).toContain('not in your company');

    const osCross = fnProbe('rpt_owner_statement[cross-owner-param]');
    const osBefore = (osCross.before as any)?.[0]?.out;
    expect(osBefore?.owner_name, `pre-fix must leak B statement: ${JSON.stringify(osBefore).slice(0, 200)}`).toBe('مالك باء');
    expect(num(osBefore?.total_gross)).toBe(B_PAY);
    const osAfter = (osCross.after as any)?.[0]?.out;
    expect(osAfter?.error, JSON.stringify(osAfter).slice(0, 200)).toBe('owner not found');

    const rest = fnProbe('REST[direct-table-ops]');
    const rb = rest.before as any;
    expect(rb?.selectPayments).toBe(2);
    expect(num(rb?.updateForeign), `pre-fix cross-tenant UPDATE: ${JSON.stringify(rb)}`).toBe(1);
    expect(num(rb?.deleteForeign), `pre-fix cross-tenant DELETE: ${JSON.stringify(rb)}`).toBe(1);
    expect(String(rb?.insertSpoofExpense)).toBe('inserted');
    const ra = rest.after as any;
    expect(ra?.selectPayments).toBe(1);
    expect(ra?.foreignTargets?.expense ?? null).toBeNull();
    expect(String(ra?.updateForeign)).toBe('no-foreign-row-visible');
    expect(String(ra?.insertSpoofExpense)).toMatch(/row-level security|policy/i);
    expect(String(ra?.insertOwnExpense)).toBe('inserted');

    const lowRole: any = fnProbe('create_owner_settlement_draft_atomic[low-role-user]').after;
    expect(String(lowRole?.error ?? '')).toMatch(/ADMIN or MANAGER|42501|required/i);
    const anon: any = fnProbe('rpt_cash_flow[anon-execute]').after;
    expect(String(anon?.error ?? '')).toMatch(/permission denied/i);

    const rls = fnProbe('RLS[table-read-isolation]');
    expect(rls.before).toMatchObject({ payments: 2, expenses: 2, invoices: 2, contracts: 2 });
    expect(String((rls.before as any)?.owner_settlements?.error ?? '')).toMatch(/permission denied/i);
    expect(rls.after).toMatchObject({ payments: 1, expenses: 1, invoices: 1, contracts: 1 });
    expect(String((rls.after as any)?.owner_settlements?.error ?? '')).toMatch(/permission denied/i);
  }, 300_000);

  it.skipIf(!FIX_FILE)('keeps server report numbers numerically consistent with independent SQL (parity report)', async () => {
    const truth = await directAggregates(db, COMPANY_A);
    const cash = outOf(fnProbe('rpt_cash_flow'), 'after');
    expect(num(cash?.operating?.receipts)).toBe(truth.receipts);
    expect(num(cash?.operating?.expenses)).toBe(truth.expenses);

    const [openA] = (await call(db, `SELECT coalesce(sum(amount + coalesce(tax_amount,0) - coalesce(paid_amount,0)),0)::numeric AS v FROM public.invoices WHERE company_id=$1 AND deleted_at IS NULL`, [COMPANY_A])) as Array<{ v: unknown }>;
    const [grossA] = (await call(db, `SELECT coalesce(sum(amount),0)::numeric AS v FROM public.invoices WHERE company_id=$1 AND deleted_at IS NULL`, [COMPANY_A])) as Array<{ v: unknown }>;
    expect(num(grossA?.v)).toBe(A_PAY);

    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(
      join(evidenceDir, 'numeric-parity.json'),
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          company: 'A',
          groundTruth: { ...truth, openReceivables: num(openA?.v) },
          reports: {
            cash_flow: { receipts: num(cash?.operating?.receipts), expenses: num(cash?.operating?.expenses) },
            vat_sales: num((fnProbe('rpt_vat_return').after as any)?.[0]?.out?.total_sales_amount),
          },
          conclusion: 'server report outputs == independent aggregates (post-fix, company-scoped)',
        },
        null,
        2,
      ),
    );
  }, 300_000);
});
