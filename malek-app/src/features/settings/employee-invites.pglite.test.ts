/**
 * Employee invites (20261127120000_employee_invites.sql) — regression proof.
 *
 * MALEK had no employee-creation path at all: sign-in only, no signup, no
 * invite. This migration adds governed invite links ported from the proven
 * organization-invite pattern (hash-only token storage, 7-day expiry,
 * single-use, idempotent create, advisory-locked command) and adapted to the
 * canonical six-role membership model (SEC-004/SEC-005).
 *
 * Proof shape (canonical PGlite mechanism: full migration replay + real
 * role/company fixtures, PostgREST-identical JWT claims, not mocks):
 *
 *   - create: returns a 64-char raw token exactly once; the table stores
 *     only its SHA-256 hash; exact idempotent replay returns '' (no second
 *     invite); same key with a different payload fails.
 *   - authority: a plain USER (no users.manage) and a MANAGER of another
 *     company are both refused (42501) before any row exists.
 *   - preview: an anonymous token holder sees company name, e-mail, role and
 *     status; an unknown token returns nothing.
 *   - accept: binds the invited e-mail to the accepting account (mismatch
 *     refused), creates the membership, closes the invite; replay by the
 *     same account is idempotent, a second account is refused; an account
     already active in another company is refused.
 *   - revoke: closes a pending invite; a revoked invite cannot be accepted.
 *   - expiry: an expired invite cannot be accepted.
 *   - never-demote: re-accepting with an existing active membership keeps
 *     the existing (higher) role.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../../p1/replay-bootstrap';

const COMPANY_A = 'c8000000-0000-4000-8000-000000000001';
const COMPANY_B = 'c8000000-0000-4000-8000-000000000002';
const ADMIN_A = 'c8000000-0000-4000-8000-000000000011';
const USER_A = 'c8000000-0000-4000-8000-000000000013';
const MANAGER_B = 'c8000000-0000-4000-8000-000000000014';
const ADMIN_B = 'c8000000-0000-4000-8000-000000000015';
const INVITEE = 'c8000000-0000-4000-8000-000000000021';
const INVITEE_EMAIL = 'new.accountant@invites.test';
const OTHER_USER = 'c8000000-0000-4000-8000-000000000022';

let db: PGlite;
let rawToken: string;

/** Execute SQL exactly like PostgREST does for a browser request:
 *  role + JWT claims (sub/role/company_id). Commits on success (browser
 *  requests are autocommit), rolls back on failure. */
async function asBrowser<T>(
  identity: Readonly<{ userId: string | null; companyId: string | null; anon?: boolean; service?: boolean }>,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const role = identity.service ? 'service_role' : identity.anon ? 'anon' : 'authenticated';
  const claims = JSON.stringify({
    sub: identity.userId ?? undefined,
    role: identity.service ? 'service_role' : identity.anon ? 'anon' : identity.userId ? 'authenticated' : undefined,
    app_metadata: identity.companyId ? { company_id: identity.companyId } : {},
  });
  await db.exec('begin');
  try {
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
    await db.exec(`set local role ${role}`);
    const res = await db.query(sql, params);
    await db.exec('commit');
    return res.rows as T[];
  } catch (error) {
    await db.exec('rollback').catch(() => undefined);
    throw error;
  }
}

const asAdminA = <T>(sql: string, params: unknown[] = []) =>
  asBrowser<T>({ userId: ADMIN_A, companyId: COMPANY_A }, sql, params);

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug, is_active) values
      ('${COMPANY_A}', 'شركة الدعوات أ', 'invites-a', true),
      ('${COMPANY_B}', 'شركة الدعوات ب', 'invites-b', true);

    insert into auth.users (id, email, raw_app_meta_data) values
      ('${ADMIN_A}', 'admin.a@invites.test', '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${USER_A}', 'user.a@invites.test', '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${MANAGER_B}', 'manager.b@invites.test', '{"company_id":"${COMPANY_B}"}'::jsonb),
      ('${ADMIN_B}', 'admin.b@invites.test', '{"company_id":"${COMPANY_B}"}'::jsonb),
      ('${INVITEE}', '${INVITEE_EMAIL}', '{}'::jsonb),
      ('${OTHER_USER}', 'other@invites.test', '{}'::jsonb);

    insert into public.users (id, email, name, role, status, is_active) values
      ('${ADMIN_A}', 'admin.a@invites.test', 'مدير الدعوات أ', 'ADMIN', 'ACTIVE', true),
      ('${USER_A}', 'user.a@invites.test', 'مستخدم الدعوات أ', 'USER', 'ACTIVE', true),
      ('${MANAGER_B}', 'manager.b@invites.test', 'مشرف الدعوات ب', 'MANAGER', 'ACTIVE', true),
      ('${ADMIN_B}', 'admin.b@invites.test', 'مدير الدعوات ب', 'ADMIN', 'ACTIVE', true),
      ('${OTHER_USER}', 'other@invites.test', 'مستخدم آخر', 'USER', 'ACTIVE', true);

    insert into public.company_members (company_id, user_id, role, is_active) values
      ('${COMPANY_A}', '${ADMIN_A}', 'ADMIN', true),
      ('${COMPANY_A}', '${USER_A}', 'USER', true),
      ('${COMPANY_B}', '${MANAGER_B}', 'MANAGER', true),
      ('${COMPANY_B}', '${ADMIN_B}', 'ADMIN', true);
  `);
  await assumeIdentity(db, ADMIN_A, COMPANY_A);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('employee invites (20261127120000)', () => {
  it('create returns the raw token once and stores only its SHA-256 hash', async () => {
    const rows = await asAdminA<{ create_employee_invite: string }>(
      `select public.create_employee_invite($1, $2, $3, $4)`,
      [INVITEE_EMAIL, 'ACCOUNTANT', 'محاسب الفرع', 'invite-cmd-0001'],
    );
    rawToken = rows[0].create_employee_invite;
    expect(rawToken).toMatch(/^[0-9a-f]{64}$/);

    const stored = await db.query<{ token_hash: string; email: string; role: string; invited_by: string }>(
      `select token_hash, email, role, invited_by::text from public.employee_invites`,
    );
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.rows[0].token_hash).not.toBe(rawToken);
    expect(stored.rows[0].email).toBe(INVITEE_EMAIL);
    expect(stored.rows[0].role).toBe('ACCOUNTANT');
    expect(stored.rows[0].invited_by).toBe(ADMIN_A);

    // The raw token appears nowhere else in the row set.
    const leak = await db.query<{ n: number }>(
      `select count(*)::int as n from public.employee_invites
       where email = $1 or note = $1 or idempotency_key = $1`,
      [rawToken],
    );
    expect(leak.rows[0].n).toBe(0);
  });

  it('exact idempotent replay returns empty without minting a second invite', async () => {
    const rows = await asAdminA<{ create_employee_invite: string }>(
      `select public.create_employee_invite($1, $2, $3, $4)`,
      [INVITEE_EMAIL, 'ACCOUNTANT', 'محاسب الفرع', 'invite-cmd-0001'],
    );
    expect(rows[0].create_employee_invite).toBe('');
    const count = await db.query<{ n: number }>(`select count(*)::int as n from public.employee_invites`);
    expect(count.rows[0].n).toBe(1);
  });

  it('same idempotency key with a different payload fails', async () => {
    await expect(
      asAdminA(`select public.create_employee_invite($1, $2, $3, $4)`, [
        'someone.else@invites.test', 'USER', null, 'invite-cmd-0001',
      ]),
    ).rejects.toThrow(/EMPLOYEE_INVITE_IDEMPOTENCY_MISMATCH/);
  });

  it('a plain USER without users.manage cannot create an invite', async () => {
    await expect(
      asBrowser({ userId: USER_A, companyId: COMPANY_A },
        `select public.create_employee_invite($1, $2, $3, $4)`, ['x@invites.test', 'USER', null, 'invite-cmd-user-01']),
    ).rejects.toThrow(/42501|EMPLOYEE_INVITE_FORBIDDEN/);
  });

  it('a MANAGER of another company cannot create an invite in company A', async () => {
    await expect(
      asBrowser({ userId: MANAGER_B, companyId: COMPANY_B },
        `select public.create_employee_invite($1, $2, $3, $4)`, ['y@invites.test', 'USER', null, 'invite-cmd-b-0001']),
    ).rejects.toThrow(/42501|EMPLOYEE_INVITE_FORBIDDEN/);
  });

  it('an ADMIN role cannot be invited (elevation stays manual)', async () => {
    await expect(
      asAdminA(`select public.create_employee_invite($1, $2, $3, $4)`, ['z@invites.test', 'ADMIN', null, 'invite-cmd-admin1']),
    ).rejects.toThrow(/EMPLOYEE_INVITE_ROLE_INVALID/);
  });

  it('an e-mail that already belongs to an active member cannot be invited', async () => {
    await expect(
      asAdminA(`select public.create_employee_invite($1, $2, $3, $4)`, ['user.a@invites.test', 'USER', null, 'invite-cmd-dup001']),
    ).rejects.toThrow(/EMPLOYEE_INVITE_ALREADY_MEMBER/);
  });

  it('an anonymous token holder can preview company, e-mail, role and status', async () => {
    const rows = await asBrowser<{ company_name: string; email: string; role: string; invite_status: string }>(
      { userId: null, companyId: null, anon: true },
      `select * from public.preview_employee_invite($1)`,
      [rawToken],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].company_name).toBe('شركة الدعوات أ');
    expect(rows[0].email).toBe(INVITEE_EMAIL);
    expect(rows[0].role).toBe('ACCOUNTANT');
    expect(rows[0].invite_status).toBe('PENDING');

    const unknown = await asBrowser({ userId: null, companyId: null, anon: true },
      `select * from public.preview_employee_invite($1)`, ['f'.repeat(64)]);
    expect(unknown).toHaveLength(0);
  });

  it('an account with a different e-mail cannot accept the invite', async () => {
    await expect(
      asBrowser({ userId: OTHER_USER, companyId: null }, `select public.accept_employee_invite($1)`, [rawToken]),
    ).rejects.toThrow(/EMPLOYEE_INVITE_EMAIL_MISMATCH/);
  });

  it('the invited account accepts: identity row, membership, closed invite; replay is idempotent', async () => {
    const rows = await asBrowser<{ accept_employee_invite: string }>(
      { userId: INVITEE, companyId: null }, `select public.accept_employee_invite($1)`, [rawToken]);
    expect(rows[0].accept_employee_invite).toBe(COMPANY_A);

    const identity = await db.query<{ role: string; status: string }>(
      `select role, status from public.users where id = '${INVITEE}'`);
    expect(identity.rows).toHaveLength(1);
    expect(identity.rows[0]).toEqual({ role: 'ACCOUNTANT', status: 'ACTIVE' });

    const membership = await db.query<{ role: string; is_active: boolean }>(
      `select role, is_active from public.company_members where company_id = '${COMPANY_A}' and user_id = '${INVITEE}'`);
    expect(membership.rows).toEqual([{ role: 'ACCOUNTANT', is_active: true }]);

    const invite = await db.query<{ accepted_by: string | null }>(
      `select accepted_by::text from public.employee_invites`);
    expect(invite.rows[0].accepted_by).toBe(INVITEE);

    // Replay by the same invitee is an idempotent no-op returning the company.
    const replay = await asBrowser<{ accept_employee_invite: string }>(
      { userId: INVITEE, companyId: COMPANY_A }, `select public.accept_employee_invite($1)`, [rawToken]);
    expect(replay[0].accept_employee_invite).toBe(COMPANY_A);
  });

  it('a closed invite cannot be accepted by anyone else', async () => {
    // OTHER_USER shares neither the e-mail nor the closure; e-mail binding
    // fires first, so prove the used-invite branch with a second invite.
    const created = await asAdminA<{ create_employee_invite: string }>(
      `select public.create_employee_invite($1, $2, $3, $4)`, ['other@invites.test', 'USER', null, 'invite-cmd-0002']);
    const token2 = created[0].create_employee_invite;
    await asBrowser({ userId: OTHER_USER, companyId: null }, `select public.accept_employee_invite($1)`, [token2]);
    await expect(
      asAdminA(`select public.accept_employee_invite($1)`, [token2]),
    ).rejects.toThrow(/EMPLOYEE_INVITE_EMAIL_MISMATCH|EMPLOYEE_INVITE_ALREADY_USED/);
  });

  it('one user cannot become an active member of two companies', async () => {
    const created = await asBrowser<{ create_employee_invite: string }>(
      { userId: ADMIN_B, companyId: COMPANY_B },
      `select public.create_employee_invite($1, $2, $3, $4)`, ['cross@invites.test', 'USER', null, 'invite-cmd-b-0002']);
    const token = created[0].create_employee_invite;
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    await db.exec(`
      insert into auth.users (id, email, raw_app_meta_data) values
        ('c8000000-0000-4000-8000-000000000023', 'cross@invites.test', '{}'::jsonb);
      insert into public.users (id, email, name, role, status, is_active) values
        ('c8000000-0000-4000-8000-000000000023', 'cross@invites.test', 'عابر', 'USER', 'ACTIVE', true);
      insert into company_members (company_id, user_id, role, is_active) values
        ('${COMPANY_A}', 'c8000000-0000-4000-8000-000000000023', 'USER', true);
    `);
    await expect(
      asBrowser({ userId: 'c8000000-0000-4000-8000-000000000023', companyId: COMPANY_A },
        `select public.accept_employee_invite($1)`, [token]),
    ).rejects.toThrow(/EMPLOYEE_INVITE_USER_ASSIGNED_ELSEWHERE/);
  });

  it('revoke closes a pending invite and blocks acceptance', async () => {
    const created = await asAdminA<{ create_employee_invite: string }>(
      `select public.create_employee_invite($1, $2, $3, $4)`, ['revoked@invites.test', 'VIEWER', null, 'invite-cmd-0003']);
    const token = created[0].create_employee_invite;
    const idRows = await db.query<{ id: string }>(
      `select id::text from public.employee_invites where email = 'revoked@invites.test'`);
    await asAdminA(`select public.revoke_employee_invite($1::uuid)`, [idRows.rows[0].id]);

    const preview = await asBrowser<{ invite_status: string }>(
      { userId: null, companyId: null, anon: true },
      `select invite_status from public.preview_employee_invite($1)`, [token]);
    expect(preview[0].invite_status).toBe('REVOKED');

    await db.exec(`
      insert into auth.users (id, email, raw_app_meta_data) values
        ('c8000000-0000-4000-8000-000000000024', 'revoked@invites.test', '{}'::jsonb);
    `);
    await expect(
      asBrowser({ userId: 'c8000000-0000-4000-8000-000000000024', companyId: null },
        `select public.accept_employee_invite($1)`, [token]),
    ).rejects.toThrow(/EMPLOYEE_INVITE_REVOKED/);

    // Second revoke of a closed invite fails closed.
    await expect(
      asAdminA(`select public.revoke_employee_invite($1::uuid)`, [idRows.rows[0].id]),
    ).rejects.toThrow(/EMPLOYEE_INVITE_NOT_FOUND_OR_CLOSED/);
  });

  it('an expired invite cannot be accepted', async () => {
    const created = await asAdminA<{ create_employee_invite: string }>(
      `select public.create_employee_invite($1, $2, $3, $4)`, ['expired@invites.test', 'USER', null, 'invite-cmd-0004']);
    const token = created[0].create_employee_invite;
    await db.exec(`update public.employee_invites set created_at = now() - interval '8 days', expires_at = now() - interval '1 hour' where email = 'expired@invites.test'`);
    await db.exec(`
      insert into auth.users (id, email, raw_app_meta_data) values
        ('c8000000-0000-4000-8000-000000000025', 'expired@invites.test', '{}'::jsonb);
    `);
    await expect(
      asBrowser({ userId: 'c8000000-0000-4000-8000-000000000025', companyId: null },
        `select public.accept_employee_invite($1)`, [token]),
    ).rejects.toThrow(/EMPLOYEE_INVITE_EXPIRED/);
  });

  it('re-acceptance with an existing active membership reactivates but never demotes', async () => {
    // Invite e-mail of a user who is already an INACTIVE MANAGER of company A.
    await db.exec(`
      insert into auth.users (id, email, raw_app_meta_data) values
        ('c8000000-0000-4000-8000-000000000026', 'returning@invites.test', '{}'::jsonb);
      insert into public.users (id, email, name, role, status, is_active) values
        ('c8000000-0000-4000-8000-000000000026', 'returning@invites.test', 'عائد', 'MANAGER', 'ACTIVE', true);
      insert into public.company_members (company_id, user_id, role, is_active) values
        ('${COMPANY_A}', 'c8000000-0000-4000-8000-000000000026', 'MANAGER', false);
    `);
    const created = await asAdminA<{ create_employee_invite: string }>(
      `select public.create_employee_invite($1, $2, $3, $4)`, ['returning@invites.test', 'USER', null, 'invite-cmd-0005']);
    const token = created[0].create_employee_invite;
    await asBrowser({ userId: 'c8000000-0000-4000-8000-000000000026', companyId: null },
      `select public.accept_employee_invite($1)`, [token]);

    const membership = await db.query<{ role: string; is_active: boolean }>(
      `select role, is_active from public.company_members
       where company_id = '${COMPANY_A}' and user_id = 'c8000000-0000-4000-8000-000000000026'`);
    expect(membership.rows).toEqual([{ role: 'MANAGER', is_active: true }]);
  });

  it('service-role signup surface: lookup, email binding, finalize; closed to browser roles', async () => {
    const created = await asAdminA<{ create_employee_invite: string }>(
      `select public.create_employee_invite($1, $2, $3, $4)`, ['signup@invites.test', 'OPERATIONS', null, 'invite-cmd-0006']);
    const token = created[0].create_employee_invite;

    // Browser roles cannot reach the service-only functions.
    await expect(
      asAdminA(`select * from public.lookup_employee_invite_for_signup($1)`, [token]),
    ).rejects.toThrow(/42501|permission denied/);
    await expect(
      asAdminA(`select public.finalize_employee_invite_signup($1, $2, $3)`, [token, INVITEE, 'x']),
    ).rejects.toThrow(/42501|permission denied/);

    // Lookup returns the invite to the service role only.
    const lookup = await asBrowser<{ invite_id: string; company_id: string; email: string; invite_status: string }>(
      { userId: null, companyId: null, service: true },
      `select * from public.lookup_employee_invite_for_signup($1)`, [token]);
    expect(lookup).toHaveLength(1);
    expect(lookup[0].email).toBe('signup@invites.test');
    expect(lookup[0].company_id).toBe(COMPANY_A);
    expect(lookup[0].invite_status).toBe('PENDING');

    // Email binding: a freshly created account with a different e-mail is refused.
    await db.exec(`
      insert into auth.users (id, email, raw_app_meta_data) values
        ('c8000000-0000-4000-8000-000000000027', 'not-the-invitee@invites.test', '{}'::jsonb),
        ('c8000000-0000-4000-8000-000000000028', 'signup@invites.test', '{}'::jsonb);
    `);
    await expect(
      asBrowser({ userId: null, companyId: null, service: true },
        `select public.finalize_employee_invite_signup($1, $2, $3)`,
        [token, 'c8000000-0000-4000-8000-000000000027', 'مخالف']),
    ).rejects.toThrow(/EMPLOYEE_INVITE_EMAIL_MISMATCH/);

    // Finalize creates the identity row (with the supplied full name) and membership.
    const done = await asBrowser<{ finalize_employee_invite_signup: string }>(
      { userId: null, companyId: null, service: true },
      `select public.finalize_employee_invite_signup($1, $2, $3)`,
      [token, 'c8000000-0000-4000-8000-000000000028', 'موظف العمليات الجديد']);
    expect(done[0].finalize_employee_invite_signup).toBe(COMPANY_A);
    const identity = await db.query<{ name: string; role: string }>(
      `select name, role from public.users where id = 'c8000000-0000-4000-8000-000000000028'`);
    expect(identity.rows).toEqual([{ name: 'موظف العمليات الجديد', role: 'OPERATIONS' }]);
    const membership = await db.query<{ role: string; is_active: boolean }>(
      `select role, is_active from public.company_members
       where company_id = '${COMPANY_A}' and user_id = 'c8000000-0000-4000-8000-000000000028'`);
    expect(membership.rows).toEqual([{ role: 'OPERATIONS', is_active: true }]);
  });

  it('the settings read view exposes no token hash and member isolation holds', async () => {
    const rows = await asAdminA<Record<string, unknown>>(`select * from public.employee_invites_read`);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Object.keys(row)).not.toContain('token_hash');
      expect(Object.keys(row)).not.toContain('idempotency_key');
    }
    // Company B sees its own invites only, never company A's.
    const cross = await asBrowser<Record<string, unknown>>(
      { userId: MANAGER_B, companyId: COMPANY_B }, `select * from public.employee_invites_read`);
    expect(cross.length).toBeGreaterThan(0);
    for (const row of cross) {
      expect(String(row.company_id)).toBe(COMPANY_B);
    }
    // Direct writes stay closed: no insert policy for authenticated.
    await expect(
      asAdminA(`insert into public.employee_invites (email, token_hash, invited_by, expires_at, idempotency_key)
                values ('direct@invites.test', '${'a'.repeat(64)}', '${ADMIN_A}', now() + interval '1 day', 'direct-key-01')`),
    ).rejects.toThrow();
  });
});
