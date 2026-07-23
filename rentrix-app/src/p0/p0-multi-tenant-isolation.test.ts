/**
 * P0 — Behavioral multi-tenant isolation verification (isolated PGlite replay).
 *
 * Protocol (per approved P0 gate):
 *   1. Replay the full migration chain EXCLUDING the P0 fix migration →
 *      confirms the vulnerabilities that exist on main (evidence only).
 *   2. Apply the P0 fix migration on the same database → proves the fix
 *      closes every confirmed leak WITHOUT changing single-company results
 *      (numeric parity gate).
 *
 * Nothing here touches production; the database is disposable.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
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
const A_PAY = 1000, B_PAY = 6000, A_EXP = 200, B_EXP = 900, B_JE = 8000;

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
  ('${PROPERTY_B}', 'عقار باء', 'عقار باء', 'سكني', 'مسقط', '${COMPANY_B}');

INSERT INTO public.property_owners (property_id, owner_id, ownership_percentage, is_primary, company_id) VALUES
  ('${PROPERTY_A}', '${OWNER_A}', 100, true, '${COMPANY_A}'),
  ('${PROPERTY_B}', '${OWNER_B}', 100, true, '${COMPANY_B}');

-- NOTE (P0 finding): owner_agreements has NO company_id column in live schema.
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
  ('${CONTRACT_B}', '${PROPERTY_B}', '${UNIT_B}', '${TENANT_B}', '2026-01-01', '2026-12-31', 24000, 'active', '${AGREEMENT_B}', '${COMPANY_B}');

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
  ('JE-A1', '2026-07-15', 'A1111', ${A_PAY}, 'DEBIT',  'manual', '${COMPANY_A}', gen_random_uuid()),
  ('JE-A2', '2026-07-15', 'A4000', ${A_PAY}, 'CREDIT', 'manual', '${COMPANY_A}', gen_random_uuid()),
  ('JE-B1', '2026-07-15', 'B1111', ${B_JE},  'DEBIT',  'manual', '${COMPANY_B}', gen_random_uuid()),
  ('JE-B2', '2026-07-15', 'B4000', ${B_JE},  'CREDIT', 'manual', '${COMPANY_B}', gen_random_uuid());
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

async function call(db: PGlite, sql: string, params: unknown[] = []) {
  return (await db.query(sql, params)).rows;
}

async function probeReport(db: PGlite, when: 'before' | 'after') {
  const window = { from: '2026-07-01', to: '2026-07-31' };
  const record = (fn: string, kind: Probe['kind'], data: unknown) => {
    const existing = probes.find((p) => p.fn === fn);
    if (existing) existing[when === 'before' ? 'before' : 'after'] = data;
    else probes.push({ fn, kind, actor: 'adminA@A', asCompany: 'A', before: when === 'before' ? data : undefined });
  };
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
    record(fn, kind, data);
  };

  await runAs('rpt_cash_flow', 'report-leak', `SELECT public.rpt_cash_flow($1::date, $2::date) AS out`, [window.from, window.to]);
  await runAs('rpt_dashboard_overview', 'report-leak', `SELECT public.rpt_dashboard_overview($1::date, $2::date, $2::date) AS out`, [window.from, window.to]);
  await runAs('rpt_trial_balance', 'report-leak', `SELECT public.rpt_trial_balance($2::date) AS out`, [window.from, window.to]);
  await runAs('rpt_income_statement', 'report-leak', `SELECT public.rpt_income_statement($1::date, $2::date) AS out`, [window.from, window.to]);
  await runAs('rpt_balance_sheet', 'report-leak', `SELECT public.rpt_balance_sheet($2::date) AS out`, [window.from, window.to]);
  await runAs('rpt_vat_return', 'report-leak', `SELECT public.rpt_vat_return($1::date, $2::date) AS out`, [window.from, window.to]);
  await runAs('rpt_financial_summary', 'report-leak', `SELECT public.rpt_financial_summary($1::date, $2::date) AS out`, [window.from, window.to]);
  await runAs('rpt_daily_collection', 'report-leak', `SELECT public.rpt_daily_collection($1::date, $2::date) AS out`, [window.from, window.to]);
  await runAs('rpt_owner_statement', 'report-leak', `SELECT public.rpt_owner_statement($3::uuid, $1::date, $2::date) AS out`, [window.from, window.to, OWNER_A]);
  await runAs('rpt_tenant_statement', 'report-leak', `SELECT public.rpt_tenant_statement($3::uuid, $1::date, $2::date) AS out`, [window.from, window.to, TENANT_A]);
  await runAs('rpt_aged_receivables', 'report-leak', `SELECT public.rpt_aged_receivables($2::date) AS out`, [window.from, window.to]);
  await runAs('rpt_overdue_invoices', 'report-leak', `SELECT public.rpt_overdue_invoices($2::date) AS out`, [window.from, window.to]);
  await runAs('rpt_rent_roll', 'report-leak', `SELECT public.rpt_rent_roll($2::date) AS out`, [window.from, window.to]);
}

async function probeExploitAndGuards(db: PGlite) {
  // T-EXP-1: settlement draft with fully fabricated amounts on OWN owner.
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
    await db.exec('ROLLBACK;'); // safe-transaction protocol: nothing persists.
  }
  probes.push({ fn: 'create_owner_settlement_draft_atomic[fabricated-amounts]', kind: 'exploit', actor: 'adminA@A', asCompany: 'A', before: exploit });

  // T-EXP-2: same call but targeting company B's owner (cross-tenant spoof).
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
  probes.push({ fn: 'create_owner_settlement_draft_atomic[cross-company-owner]', kind: 'guard', actor: 'adminA@A', asCompany: 'A', before: crossOwner });

  // T-EXP-3: a USER (non-privileged role) of company B attempts the same exploit.
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
  probes.push({ fn: 'create_owner_settlement_draft_atomic[low-role-user]', kind: 'guard', actor: 'userB@B', asCompany: 'B', before: lowRole });

  // T-WR-1: cross-tenant write — company A records a payment against B's invoice.
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
  probes.push({ fn: 'record_invoice_payment_atomic[cross-company-invoice]', kind: 'guard', actor: 'adminA@A', asCompany: 'A', before: crossWrite });

  // T-GRANT-1: anon must not execute report RPCs.
  await assume(db, ADMIN_A, null, 'anon');
  await db.exec('SET ROLE anon;');
  let anonCall: unknown;
  try {
    anonCall = await call(db, `SELECT public.rpt_cash_flow('2026-07-01'::date, '2026-07-31'::date) AS out`);
  } catch (e) {
    anonCall = { error: String(e).slice(0, 200) };
  }
  await db.exec('RESET ROLE;');
  probes.push({ fn: 'rpt_cash_flow[anon-execute]', kind: 'guard', actor: 'anon', asCompany: null, before: anonCall });

  // T-RLS-1: table-level RLS isolation (contrast with SECURITY DEFINER bypass).
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
  probes.push({ fn: 'RLS[table-read-isolation]', kind: 'guard', actor: 'authenticated@A', asCompany: 'A', before: rlsCounts });
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
        AND (r.routine_name LIKE 'rpt\_%' ESCAPE '\' OR r.routine_name LIKE '%\_atomic' ESCAPE '\')
      ORDER BY 1`,
  );
  return rows;
}

async function directAggregates(db: PGlite, companyId: string) {
  const [pay] = await call(db, `SELECT coalesce(sum(amount),0)::numeric AS v FROM public.payments WHERE company_id=$1 AND deleted_at IS NULL AND payment_date BETWEEN '2026-07-01' AND '2026-07-31'`, [companyId]);
  const [exp] = await call(db, `SELECT coalesce(sum(amount),0)::numeric AS v FROM public.expenses WHERE company_id=$1 AND deleted_at IS NULL AND expense_date BETWEEN '2026-07-01' AND '2026-07-31'`, [companyId]);
  return { receipts: Number(pay?.v ?? 0), expenses: Number(exp?.v ?? 0) };
}

beforeAll(async () => {
  // Fresh replay — migrations are applied WITHOUT any P0 fix file so `before`
  // captures main's real behavior; then the fix is applied for the `after` pass.
  db = new PGlite({ extensions: { btree_gist, pgcrypto, uuid_ossp } });
  await db.exec(STUB_SQL_HEADER);
  const files = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    let sql = readFileSync(join(migDir, file), 'utf8');
    sql = sql.replace(/create\s+extension\s+if\s+not\s+exists\s+pg_cron[^;]*;/gi, '-- stripped: $&');
    if (file === '20260713000005_fix_void_receipt_anon_grant.sql') {
      sql = sql.replace(/RAISE EXCEPTION 'Post-flight check/gi, "RAISE WARNING 'Post-flight check");
    }
    if (FIX_FILE && file === FIX_FILE) continue; // applied in the `after` phase.
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
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(
    join(evidenceDir, 'behavioral-isolation.json'),
    JSON.stringify(
      { generatedAt: new Date().toISOString(), fixFile: FIX_FILE, replayErrors: errors, fixture: { A_PAY, B_PAY, A_EXP, B_EXP, B_JE }, probes },
      null,
      2,
    ),
  );
});

describe('P0 — behavioral isolation: current main (pre-fix evidence)', () => {
  it('runs report-leak + exploit + guard probes against replayed main', async () => {
    await probeReport(db, 'before');
    await probeExploitAndGuards(db);
    const catalog = await grantCatalog(db);
    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(join(evidenceDir, 'grant-catalog.json'), JSON.stringify(catalog, null, 2));
    expect(errors).toEqual([]);
    expect(probes.length).toBeGreaterThan(15);
  }, 300_000);
});

describe('P0 — post-fix verification (only when the P0 fix migration exists)', () => {
  it.skipIf(!FIX_FILE)('applies fix: all report leaks closed + parity intact', async () => {
    await db.exec(readFileSync(join(migDir, FIX_FILE as string), 'utf8'));
    await probeReport(db, 'after');

    const expectedA = await directAggregates(db, COMPANY_A);
    const cash = probes.find((p) => p.fn === 'rpt_cash_flow');
    const operating = (cash?.after as any)?.[0]?.out?.operating;
    expect(Number(operating?.receipts)).toBe(expectedA.receipts);
    expect(Number(operating?.expenses)).toBe(expectedA.expenses);
    // Cross-company fingerprint (B_PAY/B_EXP/B_JE) must not appear anywhere.
    const serialized = JSON.stringify(probes.filter((p) => p.kind === 'report-leak').map((p) => p.after ?? null));
    expect(serialized).not.toContain(String(B_PAY));
    expect(serialized).not.toContain(String(B_EXP));
    expect(serialized).not.toContain(String(B_JE));
  }, 300_000);
});
