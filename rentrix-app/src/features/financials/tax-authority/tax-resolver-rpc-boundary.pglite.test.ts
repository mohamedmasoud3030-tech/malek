/**
 * P0-2 regression: the browser-facing tax read boundary.
 *
 * Before migration 20260901000070 the finance/billing readiness services called
 * public.resolve_active_tax_profile / public.resolve_active_fee_tax_treatment
 * directly. Those two are internal service helpers whose EXECUTE was revoked
 * from every browser role by
 * 20260901000020_revoke_internal_and_trigger_rpc_execute.sql:313-323, so the
 * call failed with 42501 for ADMIN, MANAGER and ACCOUNTANT alike: the readiness
 * panel reported BLOCKED and billing rows failed closed to TAX_CHECK_FAILED
 * instead of answering the tax question.
 *
 * Granting the internals to `authenticated` is not a fix: both are
 * SECURITY DEFINER, owned by a role that bypasses RLS, and take an arbitrary
 * p_company_id with no membership check, so any signed-in user could read any
 * company's tax configuration. The governed wrappers therefore accept no company
 * at all and enforce the same predicate the underlying tables' own SELECT
 * policies use. These tests pin both halves: availability for the intended
 * callers, and denial/no-escalation for everyone else.
 *
 * The replay is migrations-only on purpose — that is the `supabase db push`
 * shape production actually gets, and it also proves company_tax_profiles can be
 * configured there at all (tax_code_catalog used to be seed-only).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createFullReplayedDatabase } from '../../../p1/replay-bootstrap';

const MIGRATIONS_ONLY = 'migrations-only-production-shape';

const COMPANY_A = 'f2000000-0000-4000-8000-0000000000a1';
const COMPANY_B = 'f2000000-0000-4000-8000-0000000000b1';

const A_ADMIN = 'f2000000-0000-4000-8000-0000000001a1';
const A_MANAGER = 'f2000000-0000-4000-8000-0000000001a2';
const A_ACCOUNTANT = 'f2000000-0000-4000-8000-0000000001a3';
const A_USER = 'f2000000-0000-4000-8000-0000000001a4';
const A_VIEWER = 'f2000000-0000-4000-8000-0000000001a5';
const A_OPERATIONS = 'f2000000-0000-4000-8000-0000000001a6';
const B_MANAGER = 'f2000000-0000-4000-8000-0000000001b1';
const B_ADMIN = 'f2000000-0000-4000-8000-0000000001b2';

const A_PROFILE = 'f2000000-0000-4000-8000-0000000002a1';
const B_PROFILE = 'f2000000-0000-4000-8000-0000000002b1';
const A_FEE_TREATMENT = 'f2000000-0000-4000-8000-0000000002c1';

const AS_OF = '2026-03-15';

type Call = { sql: string; userId?: string; companyId?: string | null; login?: 'authenticated' | 'anon' | 'service_role' };
type Outcome = { ok: true; rows: Record<string, unknown>[] } | { ok: false; message: string };

/**
 * Runs one statement as a real PostgREST-shaped caller: the JWT claims supply
 * the identity and company, and `set local role` makes the actual ACLs apply.
 * The transaction is rolled back, so every case starts from the same state and
 * results are deterministic regardless of test order.
 */
async function callAs(db: PGlite, call: Call): Promise<Outcome> {
  const login = call.login ?? 'authenticated';
  const claims =
    login === 'authenticated'
      ? JSON.stringify({
          sub: call.userId,
          role: 'authenticated',
          app_metadata: call.companyId ? { company_id: call.companyId } : {},
        })
      : JSON.stringify({ role: login });
  await db.exec('begin;');
  try {
    await db.exec(`select set_config('request.jwt.claims', ${quote(claims)}, false);`);
    await db.exec(`set local role ${login}`);
    const result = await db.query(call.sql);
    return { ok: true, rows: (result as { rows: Record<string, unknown>[] }).rows ?? [] };
  } catch (error) {
    return { ok: false, message: String((error as { message?: string })?.message ?? error) };
  } finally {
    await db.exec('rollback;').catch(() => undefined);
  }
}

/** The driver returns dates as Date instances; compare the calendar day. */
function day(value: unknown) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function quote(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

async function errorFor(db: PGlite, call: Call): Promise<string> {
  const outcome = await callAs(db, call);
  return outcome.ok ? '' : outcome.message;
}

async function rowsFor(db: PGlite, call: Call) {
  const outcome = await callAs(db, call);
  if (!outcome.ok) throw new Error(`unexpected failure: ${outcome.message}`);
  return outcome.rows;
}

const taxRpc = (asOf = AS_OF) =>
  `select * from public.resolve_current_company_tax_profile('${asOf}'::date)`;
const feeRpc = (feeKind: string, asOf = AS_OF) =>
  `select * from public.resolve_current_company_fee_tax_treatment('${feeKind}', '${asOf}'::date)`;

describe('tax authority read boundary (P0-2)', () => {
  let db: PGlite;

  beforeAll(async () => {
    const replay = await createFullReplayedDatabase({ excludeMigrations: [MIGRATIONS_ONLY] });
    expect(replay.failed).toEqual([]);
    db = replay.db;

    await db.exec(`
      insert into public.companies (id, name, slug) values
        ('${COMPANY_A}', 'Tax Boundary A', 'tax-boundary-a'),
        ('${COMPANY_B}', 'Tax Boundary B', 'tax-boundary-b');

      insert into auth.users (id, email, raw_app_meta_data) values
        ('${A_ADMIN}', 'a-admin@malek.test', '{"company_id":"${COMPANY_A}"}'::jsonb),
        ('${A_MANAGER}', 'a-manager@malek.test', '{"company_id":"${COMPANY_A}"}'::jsonb),
        ('${A_ACCOUNTANT}', 'a-accountant@malek.test', '{"company_id":"${COMPANY_A}"}'::jsonb),
        ('${A_USER}', 'a-user@malek.test', '{"company_id":"${COMPANY_A}"}'::jsonb),
        ('${A_VIEWER}', 'a-viewer@malek.test', '{"company_id":"${COMPANY_A}"}'::jsonb),
        ('${A_OPERATIONS}', 'a-operations@malek.test', '{"company_id":"${COMPANY_A}"}'::jsonb),
        ('${B_MANAGER}', 'b-manager@malek.test', '{"company_id":"${COMPANY_B}"}'::jsonb),
        ('${B_ADMIN}', 'b-admin@malek.test', '{"company_id":"${COMPANY_B}"}'::jsonb);

      -- Role authority is proven through an active user row joined to an active
      -- membership (public.active_company_role()), so the fixture has to supply
      -- both; a missing users row fails closed to NULL role.
      insert into public.users (id, email, name, role, status, is_active) values
        ('${A_ADMIN}', 'a-admin@malek.test', 'A Admin', 'ADMIN', 'ACTIVE', true),
        ('${A_MANAGER}', 'a-manager@malek.test', 'A Manager', 'MANAGER', 'ACTIVE', true),
        ('${A_ACCOUNTANT}', 'a-accountant@malek.test', 'A Accountant', 'ACCOUNTANT', 'ACTIVE', true),
        ('${A_USER}', 'a-user@malek.test', 'A User', 'USER', 'ACTIVE', true),
        ('${A_VIEWER}', 'a-viewer@malek.test', 'A Viewer', 'VIEWER', 'ACTIVE', true),
        ('${A_OPERATIONS}', 'a-operations@malek.test', 'A Operations', 'OPERATIONS', 'ACTIVE', true),
        ('${B_MANAGER}', 'b-manager@malek.test', 'B Manager', 'MANAGER', 'ACTIVE', true),
        ('${B_ADMIN}', 'b-admin@malek.test', 'B Admin', 'ADMIN', 'ACTIVE', true);

      insert into public.company_members (company_id, user_id, role) values
        ('${COMPANY_A}', '${A_ADMIN}', 'ADMIN'),
        ('${COMPANY_A}', '${A_MANAGER}', 'MANAGER'),
        ('${COMPANY_A}', '${A_ACCOUNTANT}', 'ACCOUNTANT'),
        ('${COMPANY_A}', '${A_USER}', 'USER'),
        ('${COMPANY_A}', '${A_VIEWER}', 'VIEWER'),
        ('${COMPANY_A}', '${A_OPERATIONS}', 'OPERATIONS'),
        ('${COMPANY_B}', '${B_MANAGER}', 'MANAGER'),
        ('${COMPANY_B}', '${B_ADMIN}', 'ADMIN');

      -- Configuration as the operator surfaces create it: an ACTIVE profile per
      -- company with different rates, and one fee treatment that exists only for
      -- RATE_MANAGEMENT_FEE so the missing FIXED_MONTHLY case stays observable.
      insert into public.company_tax_profiles
        (id, company_id, version_no, tax_code, tax_rate, effective_from, status, created_by, approved_by, approved_at)
      values
        ('${A_PROFILE}', '${COMPANY_A}', 1, 'VAT', 5.000, date '2020-01-01', 'ACTIVE', '${A_ADMIN}', '${A_ACCOUNTANT}', now()),
        ('${B_PROFILE}', '${COMPANY_B}', 1, 'VAT', 15.000, date '2020-01-01', 'ACTIVE', '${B_MANAGER}', '${B_ADMIN}', now());

      insert into public.company_fee_tax_treatments
        (id, company_id, fee_kind, version_no, tax_code, tax_rate, effective_from, status, created_by, approved_by, approved_at)
      values
        ('${A_FEE_TREATMENT}', '${COMPANY_A}', 'RATE_MANAGEMENT_FEE', 1, 'NON_TAXABLE', 0.000, date '2020-01-01', 'ACTIVE', '${A_ADMIN}', '${A_ACCOUNTANT}', now());
    `);
  }, 300_000);

  afterAll(async () => {
    await db?.close();
  });

  it('lets the roles that own the tax setup resolve the active profile', async () => {
    for (const userId of [A_ADMIN, A_MANAGER, A_ACCOUNTANT]) {
      const rows = await rowsFor(db, { sql: taxRpc(), userId, companyId: COMPANY_A });
      expect(rows.length, userId).toBe(1);
      expect(rows[0]).toMatchObject({ profile_id: A_PROFILE, tax_code: 'VAT', effective_to: null });
      expect(day(rows[0]?.effective_from)).toBe('2020-01-01');
      // tax_rate arrives as a numeric string from the driver; compare numerically.
      expect(Number(rows[0]?.tax_rate)).toBe(5);
    }
  });

  it('resolves the fee treatment and preserves the missing-config error', async () => {
    const rows = await rowsFor(db, { sql: feeRpc('RATE_MANAGEMENT_FEE'), userId: A_MANAGER, companyId: COMPANY_A });
    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({ treatment_id: A_FEE_TREATMENT, tax_code: 'NON_TAXABLE' });

    // A rate of zero must never be *assumed*: an uncovered fee kind still fails
    // closed with the code the frontend matches on.
    expect(await errorFor(db, { sql: feeRpc('FIXED_MONTHLY'), userId: A_MANAGER, companyId: COMPANY_A }))
      .toContain('FEE_TAX_TREATMENT_MISSING');
    expect(await errorFor(db, { sql: taxRpc('2000-01-01'), userId: A_MANAGER, companyId: COMPANY_A }))
      .toContain('TAX_PROFILE_MISSING');
  });

  it('denies every role the underlying tables deny', async () => {
    for (const userId of [A_USER, A_VIEWER, A_OPERATIONS]) {
      expect(await errorFor(db, { sql: taxRpc(), userId, companyId: COMPANY_A }), userId)
        .toContain('TAX_AUTHORITY_READ_FORBIDDEN');
      expect(await errorFor(db, { sql: feeRpc('RATE_MANAGEMENT_FEE'), userId, companyId: COMPANY_A }), userId)
        .toContain('TAX_AUTHORITY_READ_FORBIDDEN');
    }
    // No company context is not a licence to read somebody else's: the company
    // comes from the JWT, so the resolver fails closed instead.
    expect(await errorFor(db, { sql: taxRpc(), userId: A_MANAGER, companyId: null }))
      .toMatch(/Company context is required|TAX_AUTHORITY_READ/);
  });

  it('is unreachable for anonymous callers at the ACL, not only at the gate', async () => {
    expect(await errorFor(db, { sql: taxRpc(), login: 'anon' }))
      .toContain('permission denied for function resolve_current_company_tax_profile');
    expect(await errorFor(db, { sql: feeRpc('RATE_MANAGEMENT_FEE'), login: 'anon' }))
      .toContain('permission denied for function resolve_current_company_fee_tax_treatment');
  });

  it('keeps the parameterised internals out of browser reach', async () => {
    // The old call sites must stay broken on purpose: re-granting these two would
    // hand every signed-in user an arbitrary-company read.
    const manager = { userId: A_MANAGER, companyId: COMPANY_A } as const;
    expect(await errorFor(db, {
      sql: `select * from public.resolve_active_tax_profile('${COMPANY_A}'::uuid, '${AS_OF}'::date)`,
      ...manager,
    })).toContain('permission denied for function resolve_active_tax_profile');
    expect(await errorFor(db, {
      sql: `select * from public.resolve_active_fee_tax_treatment('${COMPANY_A}'::uuid, 'RATE_MANAGEMENT_FEE', '${AS_OF}'::date)`,
      ...manager,
    })).toContain('permission denied for function resolve_active_fee_tax_treatment');

    // service_role and internal SQL callers keep working unchanged.
    const svc = await rowsFor(db, {
      sql: `select * from public.resolve_active_tax_profile('${COMPANY_A}'::uuid, '${AS_OF}'::date)`,
      login: 'service_role',
    });
    expect(svc.length).toBe(1);
    expect(String(svc[0]?.profile_id)).toBe(A_PROFILE);
  });

  it('makes a cross-company read structurally impossible', async () => {
    // 1. There is no company argument left to abuse: the only inputs are the
    //    date (and fee kind), so a caller cannot name another company at all.
    const args = await db.query<{ proname: string; in_names: string | null; in_count: number }>(
      `select p.proname,
              (select string_agg(p.proargnames[m.n], ',' order by m.n)
                 from unnest(p.proargmodes) with ordinality as m(mode, n)
                where m.mode = 'i') as in_names,
              (select count(*)::int
                 from unnest(p.proargmodes) as mode
                where mode = 'i') as in_count
         from pg_proc p
         join pg_namespace ns on ns.oid = p.pronamespace
        where ns.nspname = 'public'
          and p.proname in ('resolve_current_company_tax_profile', 'resolve_current_company_fee_tax_treatment')
        order by p.proname`,
    );
    const rows = (args as { rows: { proname: string; in_names: string | null; in_count: number }[] }).rows;
    expect(rows.map((r) => [r.proname, r.in_names, r.in_count])).toEqual([
      ['resolve_current_company_fee_tax_treatment', 'p_fee_kind,p_effective_date', 2],
      ['resolve_current_company_tax_profile', 'p_effective_date', 1],
    ]);
    for (const entry of rows) {
      expect(entry.in_names).not.toMatch(/company/);
    }

    // 2. Company A's manager can only ever see A's row, and company B's manager
    //    only B's — each is resolved from their own token.
    const aRows = await rowsFor(db, { sql: taxRpc(), userId: A_MANAGER, companyId: COMPANY_A });
    const bRows = await rowsFor(db, { sql: taxRpc(), userId: B_MANAGER, companyId: COMPANY_B });
    expect(String(aRows[0]?.profile_id)).toBe(A_PROFILE);
    expect(String(bRows[0]?.profile_id)).toBe(B_PROFILE);
    expect(Number(aRows[0]?.tax_rate)).toBe(5);
    expect(Number(bRows[0]?.tax_rate)).toBe(15);
    // B's manager cannot read A's fee treatment either.
    expect(await errorFor(db, { sql: feeRpc('RATE_MANAGEMENT_FEE'), userId: B_MANAGER, companyId: COMPANY_B }))
      .toContain('FEE_TAX_TREATMENT_MISSING');
  });

  it('is deterministic and repeatable for the same caller and date', async () => {
    const call = { sql: taxRpc(), userId: A_ACCOUNTANT, companyId: COMPANY_A } as const;
    const first = await rowsFor(db, call);
    const second = await rowsFor(db, call);
    expect(second).toEqual(first);
    expect(await rowsFor(db, call)).toEqual(first);
  });

  it('ships the boundary with the least privilege that works', async () => {
    const acl = await db.query<{
      proname: string;
      owner: string;
      security_definer: boolean;
      search_path: string | null;
      anon_exec: boolean;
      auth_exec: boolean;
      svc_exec: boolean;
      guard_exec: boolean;
    }>(
      `select p.proname,
              pg_get_userbyid(p.proowner) as owner,
              p.prosecdef as security_definer,
              coalesce(array_to_string(p.proconfig, ','), '') as search_path,
              has_function_privilege('anon', p.oid, 'execute') as anon_exec,
              has_function_privilege('authenticated', p.oid, 'execute') as auth_exec,
              has_function_privilege('service_role', p.oid, 'execute') as svc_exec,
              has_function_privilege('authenticated',
                'app_private.require_tax_authority_read()', 'execute') as guard_exec
         from pg_proc p
         join pg_namespace ns on ns.oid = p.pronamespace
        where p.proname in ('resolve_current_company_tax_profile', 'resolve_current_company_fee_tax_treatment')
        order by p.proname`,
    );
    const rows = (acl as { rows: typeof acl.rows extends never ? never : Array<Record<string, unknown>> }).rows;
    expect(rows.length).toBe(2);
    for (const row of rows) {
      expect(row.owner, String(row.proname)).toBe('postgres');
      // Owner runs the read, so RLS is bypassed on purpose — which is exactly
      // why the wrapper takes no company argument and gates the role itself.
      expect(row.security_definer).toBe(true);
      expect(row.search_path).toBe('search_path=public, pg_temp');
      expect(row.anon_exec).toBe(false);
      expect(row.auth_exec).toBe(true);
      expect(row.svc_exec).toBe(true);
      // The guard stays private: it is only reachable through the wrapper.
      expect(row.guard_exec).toBe(false);
    }
    // The internals keep the ACL that made them unreachable, so nothing was
    // quietly widened while the boundary was added.
    const internals = await db.query<{ auth_exec: boolean; svc_exec: boolean }>(
      `select has_function_privilege('authenticated', p.oid, 'execute') as auth_exec,
              has_function_privilege('service_role', p.oid, 'execute') as svc_exec
         from pg_proc p
         join pg_namespace ns on ns.oid = p.pronamespace
        where ns.nspname = 'public'
          and p.proname in ('resolve_active_tax_profile', 'resolve_active_fee_tax_treatment')`,
    );
    for (const row of (internals as { rows: { auth_exec: boolean; svc_exec: boolean }[] }).rows) {
      expect(row.auth_exec).toBe(false);
      expect(row.svc_exec).toBe(true);
    }
  });
});
