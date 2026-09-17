import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createFullReplayedDatabase } from '@/p1/replay-bootstrap';

// AUDIT — company isolation for tables that carry NO company_id column.
//
// The WP-DB0 isolation gate only inspects tables that have a company_id
// column: `tenantTables = tables.filter(t => columns(t).has('company_id'))`.
// Ten tables fall outside that filter and are therefore never checked for
// cross-company reachability by any gate. This suite closes that blind spot
// with real SQL under real `authenticated` role + JWT claims, so the answer
// comes from the engine and not from reading a policy expression.
//
// The question asked of every table below is exactly one: can an actor whose
// company context is A observe a row that belongs to company B?

const COMPANY_A = '95000000-0000-4000-8000-00000000000a';
const COMPANY_B = '95000000-0000-4000-8000-00000000000b';
const ADMIN_A = '95000000-0000-4000-8000-000000000001';
const ADMIN_B = '95000000-0000-4000-8000-000000000002';
const VIEWER_A = '95000000-0000-4000-8000-000000000003';

let db: PGlite;

async function assume(userId: string, companyId: string) {
  const claims = JSON.stringify({
    sub: userId,
    role: 'authenticated',
    app_metadata: { company_id: companyId },
  });
  await db.exec(
    `reset role; select set_config('request.jwt.claims', '${claims}', false); set role authenticated;`,
  );
}

async function asService() {
  await db.exec(`reset role; select set_config('request.jwt.claims', '{}', false);`);
}

/**
 * Executes a statement that must never take effect, accepting a refusal from
 * EITHER authorization layer:
 *
 *   * the outer PostgreSQL privilege gate — `permission denied for table …`
 *     (`20260917000001_converge_authenticated_delete_privileges.sql` revokes
 *     DELETE/TRUNCATE from browser roles, so this is the expected outcome for
 *     audit_log deletes), or
 *   * the inner RLS policy gate — the statement runs and affects zero rows.
 *
 * A refusal is not a licence to ignore errors: anything that is NOT an
 * authorization refusal (syntax error, missing table, connection failure) is
 * re-thrown so a broken test can never masquerade as a hardened one.
 */
async function expectRefusedOrNoEffect(run: () => Promise<unknown>, what: string): Promise<void> {
  try {
    await run();
  } catch (error) {
    const code = (error as { code?: string }).code;
    const message = error instanceof Error ? error.message : String(error);
    const isAuthorizationRefusal = code === '42501' || /permission denied|row-level security/i.test(message);
    if (!isAuthorizationRefusal) {
      throw new Error(`${what} failed for a non-authorization reason: ${message}`);
    }
  }
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase();
  db = replay.db;
  expect(replay.failed, JSON.stringify(replay.failed.slice(-5))).toEqual([]);

  await asService();

  for (const [id, name, slug] of [
    [COMPANY_A, 'شركة أ', 'company-a'],
    [COMPANY_B, 'شركة ب', 'company-b'],
  ]) {
    await db.query(
      `insert into public.companies(id,name,slug) values($1,$2,$3) on conflict(id) do nothing`,
      [id, name, slug],
    );
  }

  for (const [id, email, name, role] of [
    [ADMIN_A, 'admin-a@example.com', 'مدير أ', 'ADMIN'],
    [ADMIN_B, 'admin-b@example.com', 'مدير ب', 'ADMIN'],
    [VIEWER_A, 'viewer-a@example.com', 'مطالع أ', 'VIEWER'],
  ]) {
    await db.query(
      `insert into auth.users(id,email,raw_app_meta_data) values($1,$2,'{}') on conflict(id) do nothing`,
      [id, email],
    );
    await db.query(
      `insert into public.users(id,email,name,full_name,role,status,is_active)
       values($1,$2,$3,$3,$4,'ACTIVE',true)
       on conflict(id) do update set role=excluded.role,status='ACTIVE',is_active=true`,
      [id, email, name, role],
    );
  }

  // company_members.role is the sole operational role authority.
  for (const [companyId, userId, role] of [
    [COMPANY_A, ADMIN_A, 'ADMIN'],
    [COMPANY_B, ADMIN_B, 'ADMIN'],
    [COMPANY_A, VIEWER_A, 'VIEWER'],
  ]) {
    await db.query(
      `insert into public.company_members(company_id,user_id,role) values($1,$2,$3)
       on conflict(company_id,user_id) do update set role=excluded.role,is_active=true`,
      [companyId, userId, role],
    );
  }
});

describe('tables without company_id — cross-company reachability', () => {
  it('companies: a member only sees the companies they belong to', async () => {
    await assume(ADMIN_A, COMPANY_A);
    const { rows } = await db.query<{ id: string }>('select id::text as id from public.companies');
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(COMPANY_A);
    expect(ids).not.toContain(COMPANY_B);
  });

  it('users: an admin of company A cannot enumerate a member of company B', async () => {
    await assume(ADMIN_A, COMPANY_A);
    const { rows } = await db.query<{ id: string }>('select id::text as id from public.users');
    const ids = rows.map((r) => r.id);
    // Reading yourself is always legitimate.
    expect(ids).toContain(ADMIN_A);
    expect(
      ids,
      'an ADMIN of company A must not be able to read the user row of an admin of company B',
    ).not.toContain(ADMIN_B);
  });

  it('users: the vestigial password_hash column holds no credential material', async () => {
    // public.users.password_hash exists in the canonical dump but is never
    // written by any migration or application path -- Supabase Auth owns
    // credentials. Asserting "the read returned null" would prove nothing
    // (a null read is indistinguishable from an empty column), so assert the
    // real invariant: the column is empty for every row, everywhere.
    await asService();
    const { rows } = await db.query<{ n: number }>(
      'select count(*)::int as n from public.users where password_hash is not null',
    );
    expect(
      rows[0].n,
      'no row may carry a password hash; credentials live in auth.users only',
    ).toBe(0);
  });

  it('audit_log: company A cannot read an audit entry written for company B', async () => {
    await asService();
    await db.query(
      `insert into public.audit_log(id,ts,user_id,username,action,entity,entity_id,note,"table",details,created_at)
       values(gen_random_uuid(),extract(epoch from now())::bigint,$1,'مدير ب','SECRET_B','contract','ent-b','سري',
              'contracts', jsonb_build_object('company_id',$2::text)::text, now())`,
      [ADMIN_B, COMPANY_B],
    );

    await assume(ADMIN_A, COMPANY_A);
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.audit_log where action = 'SECRET_B'`,
    );
    expect(
      rows[0].n,
      'audit_log has no company_id column; an ADMIN of company A must still not read company B history',
    ).toBe(0);
  });

  it('audit_log: a non-admin cannot read audit history at all', async () => {
    await assume(VIEWER_A, COMPANY_A);
    const { rows } = await db.query<{ n: number }>(
      'select count(*)::int as n from public.audit_log',
    );
    expect(rows[0].n).toBe(0);
  });

  it('audit_log: an admin still reads their OWN company history', async () => {
    // The fence must not be a blunt denial -- the feature has to keep working.
    await asService();
    await db.query(
      `insert into public.audit_log(id,ts,user_id,username,action,entity,entity_id,note,"table",company_id,created_at)
       values(gen_random_uuid(),extract(epoch from now())::bigint,$1,'مدير أ','VISIBLE_A','contract','ent-a','مسموح',
              'contracts',$2,now())`,
      [ADMIN_A, COMPANY_A],
    );

    await assume(ADMIN_A, COMPANY_A);
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.audit_log where action = 'VISIBLE_A'`,
    );
    expect(rows[0].n).toBe(1);
  });

  it('audit_log: unattributed history is withheld, never guessed into a company', async () => {
    await asService();
    await db.query(
      `insert into public.audit_log(id,ts,user_id,username,action,entity,entity_id,note,"table",company_id,created_at)
       values(gen_random_uuid(),extract(epoch from now())::bigint,$1,'قديم','ORPHAN_HISTORY','contract','ent-x','بلا إسناد',
              'contracts',null,now())`,
      [ADMIN_A],
    );

    for (const [actor, company] of [
      [ADMIN_A, COMPANY_A],
      [ADMIN_B, COMPANY_B],
    ]) {
      await assume(actor, company);
      const { rows } = await db.query<{ n: number }>(
        `select count(*)::int as n from public.audit_log where action = 'ORPHAN_HISTORY'`,
      );
      expect(
        rows[0].n,
        'a row with no proven company must not surface for any company admin',
      ).toBe(0);
    }
  });

  it('audit_log: new writes are attributed from the caller company context', async () => {
    await assume(ADMIN_A, COMPANY_A);
    // Written through a definer path in production; here the default is what
    // matters -- an insert that omits company_id must not land unattributed.
    await asService();
    await db.exec(
      `select set_config('request.jwt.claims','${JSON.stringify({
        sub: ADMIN_A,
        role: 'authenticated',
        app_metadata: { company_id: COMPANY_A },
      })}', false)`,
    );
    await db.query(
      `insert into public.audit_log(id,ts,user_id,username,action,entity,entity_id,note,"table",created_at)
       values(gen_random_uuid(),extract(epoch from now())::bigint,$1,'مدير أ','DEFAULTED','contract','ent-d','إسناد تلقائي',
              'contracts',now())`,
      [ADMIN_A],
    );
    const { rows } = await db.query<{ company_id: string | null }>(
      `select company_id::text as company_id from public.audit_log where action = 'DEFAULTED'`,
    );
    expect(rows[0].company_id).toBe(COMPANY_A);
  });

  it('audit_log: a browser role can never rewrite or delete history', async () => {
    await asService();
    const { rows: seed } = await db.query<{ id: string }>(
      `insert into public.audit_log(id,ts,user_id,username,action,entity,entity_id,note,"table",company_id,created_at)
       values(gen_random_uuid(),extract(epoch from now())::bigint,$1,'مدير أ','IMMUTABLE','contract','ent-i','ثابت',
              'contracts',$2,now()) returning id::text as id`,
      [ADMIN_A, COMPANY_A],
    );

    await assume(ADMIN_A, COMPANY_A);
    // Both mutations must be refused. Since the ACL convergence migration the
    // delete is blocked at the privilege gate before RLS is even consulted, so
    // the attempt is expected to raise rather than silently match zero rows;
    // the assertions below still prove the history is intact either way.
    await expectRefusedOrNoEffect(
      () => db.query(`update public.audit_log set note = 'مُحرَّف' where id = $1`, [seed[0].id]),
      'browser update of audit log history',
    );
    await expectRefusedOrNoEffect(
      () => db.query('delete from public.audit_log where id = $1', [seed[0].id]),
      'browser delete of audit log history',
    );

    await asService();
    const { rows } = await db.query<{ note: string }>(
      'select note from public.audit_log where id = $1',
      [seed[0].id],
    );
    expect(rows, 'the row must survive a client delete attempt').toHaveLength(1);
    expect(rows[0].note, 'the row must survive a client update attempt').toBe('ثابت');

    // Stronger and more precise than the survival check above: the browser role
    // must not even hold the DELETE privilege on an audit trail, so the refusal
    // does not depend on an RLS policy continuing to omit a DELETE clause.
    // A future permissive `FOR ALL` policy must not be able to reopen this.
    const { rows: privilege } = await db.query<{ can_delete: boolean; can_truncate: boolean }>(
      `select has_table_privilege('authenticated', 'public.audit_log', 'DELETE')   as can_delete,
              has_table_privilege('authenticated', 'public.audit_log', 'TRUNCATE') as can_truncate`,
    );
    expect(privilege[0].can_delete, 'authenticated must not hold DELETE on the audit trail').toBe(false);
    expect(privilege[0].can_truncate, 'authenticated must not hold TRUNCATE on the audit trail').toBe(false);
  });

  it('automation_jobs / catalogs: readable but carry no company-owned data', async () => {
    // These are deliberately global reference data. The isolation requirement
    // is not "unreadable" but "contains nothing company-identifying", so assert
    // the schema shape that makes global exposure safe.
    await asService();
    const { rows } = await db.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name
         from information_schema.columns
        where table_schema='public'
          and table_name in ('automation_jobs','app_permission_catalog','tax_code_catalog',
                             'onboarding_requirement_templates','payment_terms_templates','governance')
          and column_name in ('company_id','owner_id','tenant_id','property_id','contract_id')`,
    );
    expect(
      rows,
      'a globally-readable reference table must not carry a company-owned foreign key',
    ).toEqual([]);
  });
});
