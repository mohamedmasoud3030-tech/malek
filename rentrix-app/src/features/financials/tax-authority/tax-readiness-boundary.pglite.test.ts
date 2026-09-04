/**
 * P0-2 Tax / billing readiness RPC authorization boundary — database-backed proof.
 *
 * `public.resolve_active_tax_profile(uuid,date)` and
 * `public.resolve_active_fee_tax_treatment(uuid,text,date)` are internal
 * service helpers. Migration
 * `20260901000020_revoke_internal_and_trigger_rpc_execute.sql` revoked browser
 * EXECUTE on both, granted it to `service_role` only, and aborts if that
 * boundary is ever re-opened. They also take a caller-supplied `p_company_id`.
 *
 * The browser path therefore has to be
 * `public.resolve_tax_authority_readiness(date[])`
 * (migration `20260904000002_tax_authority_readiness_browser_boundary.sql`):
 * company scope derived from the authenticated caller, capability enforced
 * inside the SECURITY DEFINER body, and readiness status only — never a profile
 * id, tax code or rate.
 *
 * Replayed from the migration chain alone (no seed.sql), so nothing here depends
 * on reference seed data for its authority.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createFullReplayedDatabase } from '@/p1/replay-bootstrap';

const COMPANY_A = '93000000-0000-4000-8000-00000000000a';
const COMPANY_B = '93000000-0000-4000-8000-00000000000b';

const MANAGER_A = '93000000-0000-4000-8000-0000000000a1';
const VIEWER_A = '93000000-0000-4000-8000-0000000000a2';
const USER_A = '93000000-0000-4000-8000-0000000000a3';
const ADMIN_B = '93000000-0000-4000-8000-0000000000b1';

const INTERNAL_RESOLVERS = [
  'public.resolve_active_tax_profile(uuid,date)',
  'public.resolve_active_fee_tax_treatment(uuid,text,date)',
] as const;

const WRAPPER = 'public.resolve_tax_authority_readiness(date[])';

let db: PGlite;

beforeEach(async () => {
  // Never leak a `set role authenticated` from a previous test into a
  // superuser-owned setup statement.
  await reset();
});

async function assume(userId: string, companyId: string | null) {
  const claims = companyId
    ? JSON.stringify({ sub: userId, role: 'authenticated', app_metadata: { company_id: companyId } })
    : JSON.stringify({ sub: userId, role: 'authenticated' });
  await db.exec(`reset role; select set_config('request.jwt.claims', '${claims}', false); set role authenticated;`);
}

async function reset() {
  await db.exec(`reset role; select set_config('request.jwt.claims', '{}', false);`);
}

async function hasExecute(role: 'anon' | 'authenticated' | 'service_role', signature: string): Promise<boolean> {
  const { rows } = await db.query<{ allowed: boolean }>(
    `select has_function_privilege($1, $2, 'EXECUTE') as allowed`,
    [role, signature],
  );
  return rows[0]?.allowed === true;
}

type ReadinessRow = { effective_date: string; tax_scope: string; readiness_status: string };

async function readiness(dates: string[]): Promise<ReadinessRow[]> {
  const { rows, fields } = await db.query<ReadinessRow>(
    `select to_char(effective_date, 'YYYY-MM-DD') as effective_date, tax_scope, readiness_status
       from public.resolve_tax_authority_readiness($1::date[])
      order by effective_date, tax_scope`,
    [dates],
  );
  // Lock the exposed surface: readiness status only, never a profile id, tax
  // code or rate.
  expect((fields ?? []).map((field) => field.name)).toEqual(['effective_date', 'tax_scope', 'readiness_status']);
  return rows;
}

async function statusFor(dates: string[], scope: string): Promise<Map<string, string>> {
  const rows = await readiness(dates);
  return new Map(rows.filter((row) => row.tax_scope === scope).map((row) => [row.effective_date, row.readiness_status]));
}

async function errorOf(operation: () => Promise<unknown>): Promise<string> {
  try {
    await operation();
  } catch (error) {
    return String((error as { message?: string }).message ?? error);
  }
  throw new Error('Expected operation to fail');
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ applySeed: false });
  db = replay.db;
  expect(replay.failed, JSON.stringify(replay.failed.slice(-5))).toEqual([]);

  await db.query(
    `insert into public.companies(id, name, slug, is_active) values
       ($1,'Tax Readiness A','tax-readiness-a',true),
       ($2,'Tax Readiness B','tax-readiness-b',true)
     on conflict (id) do update set is_active = true`,
    [COMPANY_A, COMPANY_B],
  );

  // tax_code_catalog is global reference data (seed-owned by design, not an
  // authorization authority). Provide the code the profiles reference so this
  // proof runs on a migrations-only database.
  await db.query(
    `insert into public.tax_code_catalog(code, name_ar, name_en, is_active)
     values ('VAT','ضريبة القيمة المضافة','Value Added Tax', true)
     on conflict (code) do update set is_active = true`,
  );

  const members: Array<[string, string, string, string]> = [
    [MANAGER_A, 'manager-a@tax.test', 'Manager A', COMPANY_A],
    [VIEWER_A, 'viewer-a@tax.test', 'Viewer A', COMPANY_A],
    [USER_A, 'user-a@tax.test', 'User A', COMPANY_A],
    [ADMIN_B, 'admin-b@tax.test', 'Admin B', COMPANY_B],
  ];
  for (const [userId, email, name, companyId] of members) {
    await db.query(`insert into auth.users(id, email, raw_app_meta_data) values($1,$2,'{}') on conflict(id) do nothing`, [userId, email]);
    await db.query(
      `insert into public.users(id, email, name, full_name, role, status, is_active, deleted_at)
       values($1,$2,$3,$3,'USER','ACTIVE',true,null)
       on conflict(id) do update set status='ACTIVE', is_active=true, deleted_at=null`,
      [userId, email, name],
    );
    const role = userId === USER_A ? 'USER' : userId === VIEWER_A ? 'VIEWER' : userId === ADMIN_B ? 'ADMIN' : 'MANAGER';
    await db.query(
      `insert into public.company_members(company_id, user_id, role, is_active) values($1,$2,$3,true)
       on conflict(company_id,user_id) do update set role=excluded.role, is_active=true`,
      [companyId, userId, role],
    );
  }
});

describe('P0-2 EXECUTE boundary on the internal tax resolvers', () => {
  it('keeps them service_role-only', async () => {
    for (const signature of INTERNAL_RESOLVERS) {
      expect(await hasExecute('anon', signature), `anon ${signature}`).toBe(false);
      expect(await hasExecute('authenticated', signature), `authenticated ${signature}`).toBe(false);
      expect(await hasExecute('service_role', signature), `service_role ${signature}`).toBe(true);
    }
  });

  it('grants the governed wrapper to authenticated only', async () => {
    expect(await hasExecute('anon', WRAPPER)).toBe(false);
    expect(await hasExecute('authenticated', WRAPPER)).toBe(true);
    expect(await hasExecute('service_role', WRAPPER)).toBe(true);
  });

  it('enforces its own authorization boundary inside the SECURITY DEFINER body', async () => {
    const { rows } = await db.query<{ prosecdef: boolean; config: string[] | null; definition: string }>(
      `select p.prosecdef, coalesce(p.proconfig, array[]::text[]) as config, pg_get_functiondef(p.oid) as definition
         from pg_proc p where p.oid = to_regprocedure($1)`,
      [WRAPPER],
    );
    const wrapper = rows[0];
    expect(wrapper?.prosecdef, 'wrapper must be SECURITY DEFINER to reach the internal resolvers').toBe(true);
    expect(wrapper?.config?.join(','), 'search_path must be pinned').toBe('search_path=public, pg_temp');
    expect(wrapper?.definition).toContain('public.require_company_id()');
    expect(wrapper?.definition).toContain('public.is_app_user()');
    expect(wrapper?.definition).toContain("public.current_user_has_effective_app_permission('financial.workspace.view')");
    // Company scope comes from the authenticated caller, never from an argument.
    expect(wrapper?.definition).not.toMatch(/p_company_id/);
    expect(wrapper?.definition).toContain('public.resolve_active_tax_profile(v_company, v_date)');
    expect(wrapper?.definition).toContain('public.resolve_active_fee_tax_treatment(v_company, v_fee_kind, v_date)');
  });
});

describe('P0-2 fail-closed tax readiness semantics', () => {
  it('reports TAX_PROFILE_MISSING / FEE_TAX_TREATMENT_MISSING when nothing is configured', async () => {
    await assume(MANAGER_A, COMPANY_A);
    const dates = ['2026-09-01', '2026-10-01'];
    expect([...(await statusFor(dates, 'RENT')).values()]).toEqual(['TAX_PROFILE_MISSING', 'TAX_PROFILE_MISSING']);
    expect([...(await statusFor(dates, 'RATE_MANAGEMENT_FEE')).values()]).toEqual([
      'FEE_TAX_TREATMENT_MISSING',
      'FEE_TAX_TREATMENT_MISSING',
    ]);
    expect([...(await statusFor(dates, 'FIXED_MONTHLY')).values()]).toEqual([
      'FEE_TAX_TREATMENT_MISSING',
      'FEE_TAX_TREATMENT_MISSING',
    ]);
    await reset();
  });

  it('reports READY only for dates an authoritative active profile covers', async () => {
    await db.query(
      `insert into public.company_tax_profiles
         (company_id, version_no, tax_code, tax_rate, effective_from, effective_to, status, created_by, approved_by, approved_at)
       values ($1, 1, 'VAT', 0.050, date '2026-01-01', date '2026-09-30', 'ACTIVE', $2, $3, now())`,
      [COMPANY_A, MANAGER_A, VIEWER_A],
    );

    await assume(MANAGER_A, COMPANY_A);
    const covered = await statusFor(['2026-09-01', '2026-10-01', '2025-06-01'], 'RENT');
    expect(covered.get('2026-09-01')).toBe('READY');
    // After the window closes the resolver must not silently fall back.
    expect(covered.get('2026-10-01')).toBe('TAX_PROFILE_MISSING');
    expect(covered.get('2025-06-01')).toBe('TAX_PROFILE_MISSING');
    await reset();
  });

  it('answers one row per requested distinct date and de-duplicates input', async () => {
    await assume(MANAGER_A, COMPANY_A);
    const rows = await readiness(['2026-09-01', '2026-09-01', '2026-09-02']);
    expect(rows).toHaveLength(6); // 2 distinct dates x 3 tax scopes
    expect(new Set(rows.map((row) => row.effective_date)).size).toBe(2);
    await reset();
  });

  it('never exposes a tax rate, code or profile id through the boundary', async () => {
    await assume(MANAGER_A, COMPANY_A);
    const rows = await readiness(['2026-09-01']);
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain('0.05');
    expect(serialized).not.toContain('VAT');
    expect(serialized).not.toContain('profile_id');
    await reset();
  });
});

describe('P0-2 company scope is derived, never accepted', () => {
  it('cannot be pointed at another company', async () => {
    // Company B configures an active profile; company A's manager must still see
    // MISSING for the same date, because the wrapper has no company argument.
    await db.query(
      `insert into public.company_tax_profiles
         (company_id, version_no, tax_code, tax_rate, effective_from, status, created_by, approved_by, approved_at)
       values ($1, 1, 'VAT', 0.050, date '2026-01-01', 'ACTIVE', $2, $3, now())`,
      [COMPANY_B, ADMIN_B, MANAGER_A],
    );

    await assume(MANAGER_A, COMPANY_A);
    expect((await statusFor(['2026-12-01'], 'RENT')).get('2026-12-01')).toBe('TAX_PROFILE_MISSING');
    await reset();

    await assume(ADMIN_B, COMPANY_B);
    expect((await statusFor(['2026-12-01'], 'RENT')).get('2026-12-01')).toBe('READY');
    await reset();
  });

  it('fails closed without a validated company claim', async () => {
    await assume(MANAGER_A, null);
    expect(await errorOf(() => readiness(['2026-09-01']))).toMatch(/company context is required/i);
    await reset();
  });
});

describe('P0-2 capability gate and input validation', () => {
  it('denies a member whose role has no financial workspace capability', async () => {
    await assume(USER_A, COMPANY_A);
    expect(await errorOf(() => readiness(['2026-09-01']))).toMatch(/TAX_READINESS_FORBIDDEN/);
    await reset();
  });

  it('allows the read-only roles that legitimately see the financial workspace', async () => {
    await assume(VIEWER_A, COMPANY_A);
    const viewer = await statusFor(['2026-09-01'], 'RENT');
    expect(viewer.get('2026-09-01')).toBe('READY');
    await reset();
  });

  it('rejects null input and bounds the requested date set', async () => {
    await assume(MANAGER_A, COMPANY_A);
    expect(await errorOf(() => db.query('select * from public.resolve_tax_authority_readiness(null::date[])'))).toMatch(
      /TAX_READINESS_INPUT_REQUIRED/,
    );
    const many = Array.from({ length: 61 }, (_, index) => `2026-01-${String((index % 28) + 1).padStart(2, '0')}`);
    expect(await errorOf(() => readiness(many))).toMatch(/TAX_READINESS_DATE_LIMIT_EXCEEDED/);
    await reset();
  });

  it('returns no rows for an empty date list instead of guessing', async () => {
    await assume(MANAGER_A, COMPANY_A);
    expect(await readiness([])).toEqual([]);
    await reset();
  });
});
