/**
 * P0 — Cause isolation for the pre-fix multi-tenant findings.
 *
 * Protocol (verbatim from the approved gate):
 *   1. Dump every ACTUAL RLS policy for each table that returned 2 rows —
 *      policyname, roles, cmd, qual, with_check, RLS + FORCE flags, owner.
 *   2. Prove the test session identity: current_user, session_user,
 *      request.jwt.claims, current_company_id(), BYPASSRLS / ownership.
 *   3. Re-test as three identities: company A member, company B member,
 *      anon / no-membership user.
 *   4. NEVER use postgres / service_role for the isolation probes themselves.
 *   5. Test each operation separately: SELECT, INSERT, UPDATE, DELETE, RPC.
 *   6. Prove company A can neither see nor modify company B data (or record
 *      precisely where it can).
 *   7. owner_agreements (no company_id pre-P0): trace the real isolation path
 *      via owner_id/property_id, and probe every RPC that reads/writes it.
 *   8-9. Environment deltas (PGlite vs Supabase) are documented in
 *      evidence/p0/cause/env-parity.md and are NOT counted as vulnerabilities.
 *
 * Every observed outcome is recorded with: table, causing policy, role+JWT,
 * reproduction query, expected, actual, and a verdict
 * ('production-bug' | 'contained' | 'env-artifact').
 *
 * Runs against pre-fix main replay only (replay-bootstrap excludes the P0 fix).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDatabase, evidenceDir } from './replay-bootstrap';

const causeDir = join(evidenceDir, 'cause');

const COMPANY_A = 'ca000000-0000-4000-8000-00000000000a';
const COMPANY_B = 'cb000000-0000-4000-8000-00000000000b';
const ADMIN_A = 'aa000000-0000-4000-8000-000000000001';
const MANAGER_B = 'bb000000-0000-4000-8000-000000000002';
const USER_NC = 'cc000000-0000-4000-8000-000000000009'; // app user, NO company membership
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
const PAYMENT_A = '9d000000-0000-4000-8000-00000000000a';
const PAYMENT_B = '9d000000-0000-4000-8000-00000000000b';
const AGREEMENT_A = '7a000000-0000-4000-8000-00000000000a';
const AGREEMENT_B = '7b000000-0000-4000-8000-00000000000b';

const TARGET_TABLES = [
  'payments', 'expenses', 'invoices', 'contracts', 'receipts', 'receipt_allocations',
  'owners', 'properties', 'people', 'units', 'owner_agreements', 'owner_settlements',
  'journal_entries', 'accounts', 'contract_balances',
] as const;

let db: PGlite;
const verdicts: unknown[] = [];

async function q(sql: string, params: unknown[] = []) {
  return (await db.query(sql, params)).rows as any[];
}
async function one(sql: string, params: unknown[] = []) {
  return (await q(sql, params))[0];
}

async function assume(userId: string, companyId: string | null, role = 'authenticated') {
  const claims = JSON.stringify({ sub: userId, role, app_metadata: companyId ? { company_id: companyId } : {} });
  await db.exec(`SELECT set_config('request.jwt.claims', '${claims}', false);`);
}
async function asRole<T>(userId: string, companyId: string | null, role: string, fn: () => Promise<T>): Promise<T> {
  await assume(userId, companyId, role);
  await db.exec(`SET ROLE ${role};`);
  try {
    return await fn();
  } finally {
    await db.exec('RESET ROLE;');
  }
}

type OpOutcome = { ok: boolean; detail?: unknown; error?: string };
async function attempt(fn: () => Promise<unknown>): Promise<OpOutcome> {
  try {
    return { ok: true, detail: await fn() };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 220) };
  }
}

beforeAll(async () => {
  const { db: replayed, failed } = await createReplayedDatabase();
  expect(failed, `replay must be clean: ${JSON.stringify(failed).slice(0, 300)}`).toEqual([]);
  db = replayed;
  await db.exec(`
INSERT INTO public.companies (id, name, slug) VALUES ('${COMPANY_A}','شركة ألف','alpha'),('${COMPANY_B}','شركة باء','beta');
INSERT INTO auth.users (id, email) VALUES ('${ADMIN_A}','admin.a@p0.test'),('${MANAGER_B}','manager.b@p0.test'),('${USER_NC}','no.company@p0.test');
INSERT INTO public.users (id, email, name, role, status) VALUES
  ('${ADMIN_A}','admin.a@p0.test','مدير أ','ADMIN','ACTIVE'),
  ('${MANAGER_B}','manager.b@p0.test','مشرف ب','MANAGER','ACTIVE'),
  ('${USER_NC}','no.company@p0.test','بلا شركة','ADMIN','ACTIVE');
INSERT INTO public.company_members (company_id, user_id, role) VALUES
  ('${COMPANY_A}','${ADMIN_A}','ADMIN'),('${COMPANY_B}','${MANAGER_B}','ADMIN');
INSERT INTO public.owners (id, full_name, name, company_id) VALUES
  ('${OWNER_A}','مالك ألف','مالك ألف','${COMPANY_A}'),('${OWNER_B}','مالك باء','مالك باء','${COMPANY_B}');
INSERT INTO public.properties (id, title, name, type, address, company_id) VALUES
  ('${PROPERTY_A}','عقار ألف','عقار ألف','سكني','مسقط','${COMPANY_A}'),('${PROPERTY_B}','عقار باء','عقار باء','سكني','مسقط','${COMPANY_B}');
INSERT INTO public.property_owners (property_id, owner_id, ownership_percentage, is_primary, company_id) VALUES
  ('${PROPERTY_A}','${OWNER_A}',100,true,'${COMPANY_A}'),('${PROPERTY_B}','${OWNER_B}',100,true,'${COMPANY_B}');
INSERT INTO public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on) VALUES
  ('${AGREEMENT_A}','${OWNER_A}','${PROPERTY_A}','property_management','RATE',10,'2026-01-01'),
  ('${AGREEMENT_B}','${OWNER_B}','${PROPERTY_B}','property_management','RATE',10,'2026-01-01');
INSERT INTO public.units (id, property_id, unit_number, company_id) VALUES
  ('${UNIT_A}','${PROPERTY_A}','A-1','${COMPANY_A}'),('${UNIT_B}','${PROPERTY_B}','B-1','${COMPANY_B}');
INSERT INTO public.people (id, full_name, type, company_id) VALUES
  ('${TENANT_A}','مستأجر ألف','tenant','${COMPANY_A}'),('${TENANT_B}','مستأجر باء','tenant','${COMPANY_B}');
INSERT INTO public.contracts (id, property_id, unit_id, tenant_id, start_date, end_date, rent_amount, status, agreement_id, company_id) VALUES
  ('${CONTRACT_A}','${PROPERTY_A}','${UNIT_A}','${TENANT_A}','2026-01-01','2026-12-31',12000,'active','${AGREEMENT_A}','${COMPANY_A}'),
  ('${CONTRACT_B}','${PROPERTY_B}','${UNIT_B}','${TENANT_B}','2026-01-01','2026-12-31',24000,'active','${AGREEMENT_B}','${COMPANY_B}');
INSERT INTO public.invoices (id, contract_id, issue_date, due_date, amount, paid_amount, tax_amount, status, company_id) VALUES
  ('${INVOICE_A}','${CONTRACT_A}','2026-07-01','2026-07-31',1000,0,0,'UNPAID','${COMPANY_A}'),
  ('${INVOICE_B}','${CONTRACT_B}','2026-07-01','2026-07-31',6000,0,0,'UNPAID','${COMPANY_B}');
INSERT INTO public.receipts (id, amount, status, company_id) VALUES ('${RECEIPT_A}',1000,'POSTED','${COMPANY_A}'),('${RECEIPT_B}',6000,'POSTED','${COMPANY_B}');
INSERT INTO public.payments (id, invoice_id, contract_id, amount, payment_method, payment_date, status, receipt_id, company_id) VALUES
  ('${PAYMENT_A}','${INVOICE_A}','${CONTRACT_A}',1000,'cash','2026-07-15','POSTED','${RECEIPT_A}','${COMPANY_A}'),
  ('${PAYMENT_B}','${INVOICE_B}','${CONTRACT_B}',6000,'cash','2026-07-15','POSTED','${RECEIPT_B}','${COMPANY_B}');
INSERT INTO public.expenses (id, property_id, category, amount, expense_date, status, charged_to, company_id) VALUES
  ('8a000000-0000-4000-8000-00000000000a','${PROPERTY_A}','maintenance',200,'2026-07-20','POSTED','owner','${COMPANY_A}'),
  ('8b000000-0000-4000-8000-00000000000b','${PROPERTY_B}','maintenance',900,'2026-07-20','POSTED','owner','${COMPANY_B}');
  `);
}, 600_000);

afterAll(() => {
  mkdirSync(causeDir, { recursive: true });
  writeFileSync(join(causeDir, 'verdicts.json'), JSON.stringify({ generatedAt: new Date().toISOString(), verdicts }, null, 2));
});

describe('P0 cause isolation — catalog context (introspection only; never used for isolation ops)', () => {
  it('dumps roles, ownership, RLS/FORCE flags, and table-level grants', async () => {
    const roles = await q(
      `SELECT rolname, rolsuper, rolbypassrls, rolcanlogin FROM pg_roles
        WHERE rolname IN ('anon','authenticated','service_role','postgres','supabase_admin') ORDER BY 1`,
    );
    const flags = await q(
      `SELECT c.relname AS table, pg_get_userbyid(c.relowner) AS owner,
              c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname='public' AND c.relkind='r' AND c.relname = ANY($1) ORDER BY 1`,
      [TARGET_TABLES as unknown as string[]],
    );
    const grants = await q(
      `SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants
        WHERE table_schema='public' AND grantee IN ('authenticated','anon')
          AND table_name = ANY($1)
        ORDER BY 1,2,3`,
      [TARGET_TABLES as unknown as string[]],
    );
    mkdirSync(causeDir, { recursive: true });
    writeFileSync(join(causeDir, 'catalog-context.json'), JSON.stringify({ roles, tableFlagsAndOwners: flags, tableGrants: grants }, null, 2));
    // Protocol point 4: the probe roles must NOT be superuser / BYPASSRLS / owners.
    const auth = roles.find((r: any) => r.rolname === 'authenticated');
    expect(auth?.rolsuper).toBe(false);
    expect(auth?.rolbypassrls).toBe(false);
    for (const f of flags) expect(f.owner).not.toBe('authenticated');
  });

  it('dumps EVERY policy (name/roles/cmd/qual/with_check) for the probe tables', async () => {
    const policies = await q(
      `SELECT tablename, policyname, permissive, roles, cmd,
              coalesce(qual,'') AS qual, coalesce(with_check,'') AS with_check
         FROM pg_policies WHERE schemaname='public' AND tablename = ANY($1)
        ORDER BY tablename, policyname`,
      [TARGET_TABLES as unknown as string[]],
    );
    mkdirSync(causeDir, { recursive: true });
    writeFileSync(join(causeDir, 'policies.json'), JSON.stringify(policies, null, 2));
    expect(policies.length).toBeGreaterThan(0);
    // Causal claim, statically verifiable: no policy mentions company_id pre-fix.
    const withCompany = policies.filter((p: any) => `${p.qual} ${p.with_check}`.includes('company'));
    writeFileSync(join(causeDir, 'policies-with-company-predicate.json'), JSON.stringify(withCompany, null, 2));
  });
});

describe('P0 cause isolation — session identity proof', () => {
  it('records current_user/session_user/JWT/current_company_id()/bypass under authenticated@A', async () => {
    const session = await asRole(ADMIN_A, COMPANY_A, 'authenticated', async () => ({
      current_user: (await one(`SELECT current_user AS v`))?.v,
      session_user: (await one(`SELECT session_user AS v`))?.v,
      jwt_claims: (await one(`SELECT current_setting('request.jwt.claims', true) AS v`))?.v,
      // env-parity.md: the stub mirrors Supabase's platform grants
      // (USAGE on schema auth) so direct auth.uid() behaves like production.
      auth_uid: await attempt(async () => (await one(`SELECT auth.uid() AS v`))?.v),
      current_company_id: (await one(`SELECT public.current_company_id() AS v`))?.v,
      is_app_user: (await one(`SELECT coalesce(public.is_app_user(), false) AS v`))?.v,
      role_attrs: await one(`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`),
      owns_payments: (await one(`SELECT pg_get_userbyid(relowner) = current_user AS v FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='payments'`))?.v,
    }));
    mkdirSync(causeDir, { recursive: true });
    writeFileSync(join(causeDir, 'session-identity.json'), JSON.stringify(session, null, 2));
    expect(session.current_user).toBe('authenticated');
    expect(session.is_app_user).toBe(true);
    expect((session.auth_uid as any)?.detail, JSON.stringify(session.auth_uid)).toBe(ADMIN_A);
    expect(session.current_company_id).toBe(COMPANY_A);
    expect(session.role_attrs?.rolbypassrls).toBe(false);
    expect(session.role_attrs?.rolsuper).toBe(false);
    expect(session.owns_payments).toBe(false);
  });
});

describe('P0 cause isolation — operation matrix (SELECT/INSERT/UPDATE/DELETE/RPC × identities)', () => {
  const identities = [
    { id: 'A-admin', user: ADMIN_A, company: COMPANY_A, role: 'authenticated' },
    { id: 'B-manager', user: MANAGER_B, company: COMPANY_B, role: 'authenticated' },
    { id: 'no-membership', user: USER_NC, company: null, role: 'authenticated' },
    { id: 'anon', user: ADMIN_A, company: null, role: 'anon' },
  ];
  const matrix: unknown[] = [];

  afterAll(() => {
    mkdirSync(causeDir, { recursive: true });
    writeFileSync(join(causeDir, 'operation-matrix.json'), JSON.stringify(matrix, null, 2));
  });

  it('SELECT isolation per table per identity (rows visible + which companies)', async () => {
    for (const who of identities) {
      for (const t of ['payments', 'expenses', 'invoices', 'contracts'] as const) {
        const out = await asRole(who.user, who.company, who.role, () =>
          attempt(async () => one(`SELECT count(*)::int AS n, coalesce(array_agg(DISTINCT company_id), '{}') AS companies FROM public.${t}`)),
        );
        matrix.push({
          op: 'SELECT', table: t, identity: who.id, role: who.role, jwt_company: who.company,
          query: `SELECT count(*), array_agg(DISTINCT company_id) FROM public.${t}`,
          expected: who.id === 'A-admin' ? 'exactly company A rows (n=1)' : who.id === 'B-manager' ? 'exactly company B rows (n=1)' : who.id === 'anon' ? 'permission denied' : 'zero rows',
          actual: out.ok && typeof out.detail === 'object' ? `${(out.detail as any)?.n} rows, companies=${((out.detail as any)?.companies ?? []).map((c: string) => (c === COMPANY_A ? 'A' : c === COMPANY_B ? 'B' : c)).join('+')}` : out.error,
          verdict: !out.ok ? 'contained(grant-or-policy)' : (out.detail as any)?.n === 2 && who.role === 'authenticated' ? 'production-bug' : 'needs-review',
        });
      }
    }
    const selA: any = matrix.filter((m: any) => m.op === 'SELECT' && m.identity === 'A-admin');
    // Causal proof pending per protocol: policy dump above shows role-only quals.
    // Here we assert the raw observable, and the verdict column carries the judgement.
    expect(selA.find((m: any) => m.table === 'payments')?.actual).toContain('2 rows');
    expect(selA.find((m: any) => m.table === 'payments')?.actual).toContain('A+B');
  });

  it('INSERT own-company row per identity (baseline write posture)', async () => {
    for (const who of identities) {
      const out = await asRole(who.user, who.company, who.role, async () => {
        await db.exec('BEGIN;');
        const r = await attempt(() =>
          q(`INSERT INTO public.payments (id, contract_id, amount, payment_method, payment_date, status, company_id)
             VALUES (gen_random_uuid(), $1, 5, 'cash', '2026-07-22', 'POSTED', $2) RETURNING id`,
            [who.company === COMPANY_B ? CONTRACT_B : CONTRACT_A, who.company ?? COMPANY_A]),
        );
        await db.exec('ROLLBACK;');
        return r;
      });
      matrix.push({
        op: 'INSERT-own', table: 'payments', identity: who.id, role: who.role, jwt_company: who.company,
        query: `INSERT INTO public.payments (…, company_id=<own>) RETURNING id`,
        expected: who.role === 'anon' ? 'permission denied' : 'allowed (own company, ROLLBACKed)',
        actual: out.ok ? 'inserted' : out.error,
        verdict: out.ok ? (who.role === 'authenticated' ? 'policy-permits-own-insert' : 'needs-review') : 'contained',
      });
    }
  });

  it('INSERT cross-company SPOOF: caller A writes a row stamped company B', async () => {
    for (const who of identities.filter((w) => w.role === 'authenticated')) {
      const out = await asRole(who.user, who.company, who.role, async () => {
        await db.exec('BEGIN;');
        const r = await attempt(() =>
          q(`INSERT INTO public.payments (id, contract_id, amount, payment_method, payment_date, status, company_id)
             VALUES (gen_random_uuid(), $1, 5, 'cash', '2026-07-22', 'POSTED', $2) RETURNING id`,
            [who.company === COMPANY_B ? CONTRACT_B : CONTRACT_A, who.company === COMPANY_B ? COMPANY_A : COMPANY_B]),
        );
        await db.exec('ROLLBACK;');
        return r;
      });
      matrix.push({
        op: 'INSERT-spoof', table: 'payments', identity: who.id, role: who.role, jwt_company: who.company,
        query: `INSERT INTO public.payments (…, company_id=<FOREIGN company>) RETURNING id`,
        expected: 'rejected by WITH CHECK on company scope',
        actual: out.ok ? 'inserted (would have persisted company B row from session A)' : out.error,
        verdict: out.ok ? 'production-bug' : 'contained',
      });
    }
  });

  it('UPDATE + DELETE a foreign row (session A targets company B payment)', async () => {
    const target = await one(`SELECT id::text AS id FROM public.payments WHERE company_id = '${COMPANY_B}' ORDER BY 1 LIMIT 1`);
    const TARGET_B = target?.id as string;
    const upd = await asRole(ADMIN_A, COMPANY_A, 'authenticated', async () => {
      await db.exec('BEGIN;');
      const r = await attempt(async () => one(`WITH u AS (UPDATE public.payments SET amount = amount + 1 WHERE id = '${TARGET_B}' RETURNING id) SELECT count(*)::int AS n FROM u`));
      await db.exec('ROLLBACK;');
      return r;
    });
    matrix.push({
      op: 'UPDATE-foreign', table: 'payments', identity: 'A-admin', role: 'authenticated', jwt_company: COMPANY_A,
      query: `UPDATE public.payments SET amount = amount + 1 WHERE id = <B payment>`,
      expected: '0 rows affected',
      actual: upd.ok ? `${(upd.detail as any)?.n} rows affected` : upd.error,
      verdict: upd.ok && (upd.detail as any)?.n > 0 ? 'production-bug' : 'contained',
    });
    const del = await asRole(ADMIN_A, COMPANY_A, 'authenticated', async () => {
      await db.exec('BEGIN;');
      const r = await attempt(async () => one(`WITH d AS (DELETE FROM public.payments WHERE id = '${TARGET_B}' RETURNING id) SELECT count(*)::int AS n FROM d`));
      await db.exec('ROLLBACK;');
      return r;
    });
    matrix.push({
      op: 'DELETE-foreign', table: 'payments', identity: 'A-admin', role: 'authenticated', jwt_company: COMPANY_A,
      query: `DELETE FROM public.payments WHERE id = <B payment>`,
      expected: '0 rows affected',
      actual: del.ok ? `${(del.detail as any)?.n} rows affected` : del.error,
      verdict: del.ok && (del.detail as any)?.n > 0 ? 'production-bug' : 'contained',
    });
  });

  it('RPC isolation: rpt_cash_flow per identity (definer report)', async () => {
    for (const who of identities) {
      const out = await asRole(who.user, who.company, who.role, () =>
        attempt(() => one(`SELECT public.rpt_cash_flow('2026-07-01'::date, '2026-07-31'::date) AS out`)),
      );
      const j: any = out.ok ? (out.detail as any)?.out : null;
      matrix.push({
        op: 'RPC', table: 'rpt_cash_flow', identity: who.id, role: who.role, jwt_company: who.company,
        query: `SELECT public.rpt_cash_flow('2026-07-01','2026-07-31')`,
        expected: who.id === 'A-admin' ? 'receipts=1000 expenses=200' : who.id === 'B-manager' ? 'receipts=6000 expenses=900' : who.id === 'anon' ? 'permission denied' : 'company context required',
        actual: out.ok ? `receipts=${j?.operating?.receipts} expenses=${j?.operating?.expenses}` : out.error,
        verdict: !out.ok ? 'contained' : Number(j?.operating?.receipts) === 7000 ? 'production-bug' : 'ok',
      });
    }
  });
});

describe('P0 cause isolation — precision probes (why UPDATE/DELETE showed 0 rows; RLS vs domain triggers)', () => {
  afterAll(() => {
    mkdirSync(causeDir, { recursive: true });
    writeFileSync(join(causeDir, 'precision-probes.json'), JSON.stringify(precision, null, 2));
  });
  const precision: unknown[] = [];

  it('pins visibility vs mutability of the foreign payment row as A', async () => {
    // NOTE: a receipt→payments shadow trigger rewrites payment ids to the
    // receipt id, so the foreign row id is resolved DYNAMICALLY (an earlier
    // static-id probe measured 0 rows purely because of that rewrite).
    const target = await one(`SELECT id::text AS id FROM public.payments WHERE company_id = '${COMPANY_B}' ORDER BY 1 LIMIT 1`);
    const TARGET_B = target?.id as string;
    expect(TARGET_B).toBeTruthy();
    const out = await asRole(ADMIN_A, COMPANY_A, 'authenticated', async () => {
      const visible = await one(`SELECT count(*)::int AS n FROM public.payments WHERE id = '${TARGET_B}'`);
      const helper = await one(`SELECT coalesce(public.is_admin_or_manager(), false) AS m, coalesce(public.is_app_user(), false) AS u`);
      let upd: OpOutcome; let del: OpOutcome;
      await db.exec('BEGIN;');
      upd = await attempt(async () => one(`WITH u AS (UPDATE public.payments SET amount = amount + 1 WHERE id = '${TARGET_B}' RETURNING id) SELECT count(*)::int AS n FROM u`));
      await db.exec('ROLLBACK;');
      await db.exec('BEGIN;');
      del = await attempt(async () => {
        // DELETE pays attention to BEFORE DELETE domain triggers too — capture exact error.
        const r = await db.query(`DELETE FROM public.payments WHERE id = '${TARGET_B}'`);
        return { affected: (r as any).affectedRows ?? null };
      });
      await db.exec('ROLLBACK;');
      return { visible: visible?.n, is_admin_or_manager: helper?.m, is_app_user: helper?.u, update: upd, delete: del };
    });
    precision.push({
      probe: 'payments foreign-row visibility vs mutability (identity A-admin)',
      target: TARGET_B,
      finding: out,
      explanation: 'target id resolved from the table itself (shadow-trigger-proof); verdict column derives from real affected-row counts.',
    });
  });

  it('REST write spoof on a table WITHOUT a domain insert-trigger (expenses)', async () => {
    for (const variant of ['own-A', 'spoof-B'] as const) {
      const out = await asRole(ADMIN_A, COMPANY_A, 'authenticated', async () => {
        await db.exec('BEGIN;');
        const r = await attempt(() =>
          q(`INSERT INTO public.expenses (id, property_id, category, amount, expense_date, status, charged_to, company_id)
             VALUES (gen_random_uuid(), $1, 'p0-spoof', 7, '2026-07-22', 'POSTED', 'office', $2) RETURNING id, company_id`,
            [variant === 'own-A' ? PROPERTY_A : PROPERTY_B, variant === 'own-A' ? COMPANY_A : COMPANY_B]),
        );
        await db.exec('ROLLBACK;');
        return r;
      });
      precision.push({
        op: 'INSERT-expenses', variant, identity: 'A-admin',
        query: 'INSERT INTO public.expenses (…, company_id=$foreign)',
        expected: variant === 'own-A' ? 'allowed' : 'rejected by company-scoped WITH CHECK',
        actual: out.ok ? `inserted with company_id=${(out.detail as any)?.[0]?.company_id === COMPANY_B ? 'B (!)' : 'A'}` : out.error,
        verdict: !out.ok ? 'contained' : variant === 'spoof-B' ? 'production-bug' : 'ok',
      });
    }
  });

  it('owner_agreements cross-link isolated from the exclusion constraint (owner B × property A pair)', async () => {
    // B's own pair (owner B, property B) always collides with the open-ended
    // exclusion constraint owner_agreements_no_overlap; the cross pair
    // (owner B, property A) has no existing row → pure RLS WITH CHECK test.
    const out = await asRole(ADMIN_A, COMPANY_A, 'authenticated', async () => {
      await db.exec('BEGIN;');
      const r = await attempt(() =>
        q(`INSERT INTO public.owner_agreements (owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, ends_on)
           VALUES ('${OWNER_B}', '${PROPERTY_A}', 'master_lease', 'FIXED_MONTHLY', 500, '2030-01-01', '2030-12-31') RETURNING id`),
      );
      await db.exec('ROLLBACK;');
      return r;
    });
    precision.push({
      op: 'INSERT-owner-agreement-cross-link', identity: 'A-admin',
      query: "INSERT INTO owner_agreements (owner_id=<B>, property_id=<A>, starts_on='2030-01-01')",
      expected: 'rejected — agreement must not bind foreign owner/property (needs company predicate)',
      actual: out.ok ? 'inserted (ROLLED BACK)' : out.error,
      verdict: out.ok ? 'production-bug' : 'contained',
    });
  });
});

describe('P0 cause isolation — owner_agreements trace (no company_id pre-P0)', () => {
  const trace: unknown[] = [];
  afterAll(() => {
    mkdirSync(causeDir, { recursive: true });
    writeFileSync(join(causeDir, 'owner-agreements-trace.json'), JSON.stringify(trace, null, 2));
  });

  it('documents schema + policies + effective isolation path via owner/property', async () => {
    const cols = await q(`SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='owner_agreements' ORDER BY ordinal_position`);
    const policies = await q(`SELECT policyname, roles, cmd, coalesce(qual,'') AS qual, coalesce(with_check,'') AS with_check FROM pg_policies WHERE schemaname='public' AND tablename='owner_agreements'`);
    const flags = await one(`SELECT c.relrowsecurity AS rls, c.relforcerowsecurity AS forced, pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='owner_agreements'`);
    trace.push({ kind: 'schema+policy', columns: cols.map((c: any) => c.column_name), rls: flags, policies });
    expect(cols.map((c: any) => c.column_name)).not.toContain('company_id'); // structural gap confirmed
  });

  it('SELECT as A: are both companies\' agreements visible?', async () => {
    const out = await asRole(ADMIN_A, COMPANY_A, 'authenticated', () =>
      attempt(() => one(`SELECT count(*)::int AS n, coalesce(array_agg(o.company_id), '{}') AS owner_companies FROM public.owner_agreements ag JOIN public.owners o ON o.id = ag.owner_id`)),
    );
    trace.push({
      op: 'SELECT', identity: 'A-admin', query: 'owner_agreements JOIN owners',
      expected: 'agreements of A owners only',
      actual: out.ok ? `${(out.detail as any)?.n} rows, owner_companies=${((out.detail as any)?.owner_companies ?? []).length}` : out.error,
      verdict: out.ok && (out.detail as any)?.n === 2 ? 'production-bug' : 'contained',
    });
  });

  it('REST cross-link: A inserts an agreement binding B\'s owner+property', async () => {
    const out = await asRole(ADMIN_A, COMPANY_A, 'authenticated', async () => {
      await db.exec('BEGIN;');
      const r = await attempt(() =>
        q(`INSERT INTO public.owner_agreements (owner_id, property_id, agreement_type, commission_type, commission_value, starts_on)
           VALUES ('${OWNER_B}', '${PROPERTY_B}', 'property_management', 'RATE', 99, '2026-07-01') RETURNING id`),
      );
      await db.exec('ROLLBACK;');
      return r;
    });
    trace.push({
      op: 'INSERT-cross-link', identity: 'A-admin',
      query: `INSERT INTO owner_agreements (owner_id=<B>, property_id=<B>, …)`,
      expected: 'rejected — agreement must not bind foreign owner/property',
      actual: out.ok ? 'inserted (ROLLED BACK)' : out.error,
      verdict: out.ok ? 'production-bug' : 'contained',
    });
  });

  it('RPC surface: create_owner_agreement_atomic — valid own vs cross refs', async () => {
    const base = {
      owner_id: OWNER_A, property_id: PROPERTY_A, agreement_type: 'property_management',
      commission_type: 'RATE', commission_value: 12, starts_on: '2026-08-01',
    };
    for (const [label, payload] of [
      ['own-A-refs', base],
      ['cross-B-refs', { ...base, owner_id: OWNER_B, property_id: PROPERTY_B }],
    ] as const) {
      const out = await asRole(ADMIN_A, COMPANY_A, 'authenticated', async () => {
        await db.exec('BEGIN;');
        const r = await attempt(() => q(`SELECT public.create_owner_agreement_atomic($1::jsonb)`, [JSON.stringify(payload)]));
        await db.exec('ROLLBACK;');
        return r;
      });
      trace.push({
        op: 'RPC-create-owner-agreement', variant: label, identity: 'A-admin',
        query: `SELECT public.create_owner_agreement_atomic(payload→${label})`,
        expected: label === 'own-A-refs' ? 'inserts agreement for A' : 'rejected — foreign owner/property',
        actual: out.ok ? 'success' : out.error,
        verdict: 'recorded',
      });
    }
  });

  it('RPC read spoof: rpt_owner_statement(OWNER_B) executed as company A', async () => {
    const out = await asRole(ADMIN_A, COMPANY_A, 'authenticated', () =>
      attempt(() => one(`SELECT public.rpt_owner_statement('${OWNER_B}'::uuid, '2026-07-01'::date, '2026-07-31'::date) AS out`)),
    );
    const j: any = out.ok ? (out.detail as any)?.out : null;
    trace.push({
      op: 'RPC-owner-statement-cross-param', identity: 'A-admin',
      query: `SELECT public.rpt_owner_statement(<B owner>, …)`,
      expected: "{'error':'owner not found'} — B owner invisible to A",
      actual: out.ok ? `owner_name=${j?.owner_name} total_gross=${j?.total_gross}` : out.error,
      verdict: out.ok && j?.owner_name && !j?.error ? 'production-bug' : 'contained',
    });
  });
});
