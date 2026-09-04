/**
 * P0-1 Permission authority parity — database-backed regression lock.
 *
 * The migration chain is replayed into disposable PGlite WITHOUT
 * `supabase/seed.sql`, so everything proven here is reproducible from
 * migrations alone. Before migration
 * `20260904000001_authoritative_permission_catalog_parity.sql` this replay
 * produced a 21-row `public.app_permission_catalog`, and because
 * `current_user_has_effective_app_permission()` fails closed for any code the
 * catalog does not contain:
 *   - `list_my_effective_app_permissions()` silently dropped 39 legitimate
 *     capabilities for every non-admin role;
 *   - ADMIN lost them server-side too (the ADMIN branch is
 *     `exists(select 1 from app_permission_catalog ...)`);
 *   - `app_private.can_manage_company_members()`, which gates on
 *     `users.manage`, was permanently false.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createFullReplayedDatabase } from '@/p1/replay-bootstrap';
import { appPermissions } from './permissions';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const migrationsDir = resolve(repoRoot, 'supabase/migrations');

const COMPANY = '92000000-0000-4000-8000-00000000000a';
const OTHER_COMPANY = '92000000-0000-4000-8000-00000000000b';

/** A plain USER member used as the target of owner permission decisions. */
const TARGET_EMPLOYEE = '92000000-0000-4000-8000-0000000000c1';

const MEMBERS = {
  ADMIN: '92000000-0000-4000-8000-0000000000a1',
  MANAGER: '92000000-0000-4000-8000-0000000000a2',
  ACCOUNTANT: '92000000-0000-4000-8000-0000000000a3',
  OPERATIONS: '92000000-0000-4000-8000-0000000000a4',
  USER: '92000000-0000-4000-8000-0000000000a5',
  VIEWER: '92000000-0000-4000-8000-0000000000a6',
  OUTSIDER: '92000000-0000-4000-8000-0000000000b1',
} as const;

type MemberRole = keyof typeof MEMBERS;
const EMPLOYEE_ROLES: MemberRole[] = ['MANAGER', 'ACCOUNTANT', 'OPERATIONS', 'USER', 'VIEWER'];

let db: PGlite;

async function assume(userId: string, companyId: string) {
  const claims = JSON.stringify({ sub: userId, role: 'authenticated', app_metadata: { company_id: companyId } });
  await db.exec(`reset role; select set_config('request.jwt.claims', '${claims}', false); set role authenticated;`);
}

async function reset() {
  await db.exec(`reset role; select set_config('request.jwt.claims', '{}', false);`);
}

async function effectivePermissions(): Promise<string[]> {
  const { rows } = await db.query<{ permission: string }>('select permission from public.list_my_effective_app_permissions()');
  return rows.map((row) => row.permission).sort();
}

async function hasEffective(permission: string): Promise<boolean> {
  const { rows } = await db.query<{ allowed: boolean }>('select public.current_user_has_effective_app_permission($1) as allowed', [permission]);
  return rows[0]?.allowed === true;
}

/** The server's own six-role matrix, evaluated over the authoritative catalog. */
async function serverRoleMatrix(role: string): Promise<string[]> {
  const { rows } = await db.query<{ permission: string }>(
    `select c.permission
       from public.app_permission_catalog c
      where public.role_has_app_permission($1, c.permission)
      order by c.permission`,
    [role],
  );
  return rows.map((row) => row.permission);
}

/**
 * Granular action → historical broad-write compatibility parents, read from the
 * effective resolver's own `v_parent` precedence chain so this expectation stays
 * derived from the migration chain instead of hardcoded beside it.
 */
function compatibilityParents(): Map<string, string> {
  const parents = new Map<string, string>();
  for (const file of readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()) {
    const sql = readFileSync(resolve(migrationsDir, file), 'utf8');
    const index = sql.lastIndexOf('function public.current_user_has_effective_app_permission');
    if (index < 0) continue;
    const body = sql.slice(index);
    const caseIndex = body.indexOf('v_parent := case p_permission');
    if (caseIndex < 0) continue;
    const caseBlock = body.slice(caseIndex, body.indexOf('else null', caseIndex));
    parents.clear();
    for (const match of caseBlock.matchAll(/when\s+'([a-z0-9_.]+)'\s+then\s+'([a-z0-9_.]+)'/g)) {
      parents.set(match[1], match[2]);
    }
  }
  return parents;
}

const parents = compatibilityParents();

/**
 * What a member with no owner overrides and no explicit grants must project:
 * the role matrix, plus every granular child whose compatibility parent the
 * role still holds (migration 00051 precedence).
 */
async function expectedEffectiveProjection(role: string): Promise<string[]> {
  const matrix = new Set(await serverRoleMatrix(role));
  const { rows } = await db.query<{ permission: string }>(
    'select permission from public.app_permission_catalog order by permission',
  );
  return rows
    .map((row) => row.permission)
    .filter((permission) => matrix.has(permission) || matrix.has(parents.get(permission) ?? ''))
    .sort();
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
  // Migration chain only. No seed.sql: the catalog must be reproducible from
  // the migrations that own it.
  const replay = await createFullReplayedDatabase({ applySeed: false });
  db = replay.db;
  expect(replay.failed, JSON.stringify(replay.failed.slice(-5))).toEqual([]);

  await db.query(
    `insert into public.companies(id, name, slug, is_active) values
       ($1, 'Permission Authority', 'permission-authority', true),
       ($2, 'Permission Authority Other', 'permission-authority-other', true)
     on conflict (id) do update set is_active = true`,
    [COMPANY, OTHER_COMPANY],
  );

  for (const [role, userId] of Object.entries(MEMBERS)) {
    const email = `${role.toLowerCase()}-authority@test.invalid`;
    await db.query(`insert into auth.users(id, email, raw_app_meta_data) values($1,$2,'{}') on conflict(id) do nothing`, [userId, email]);
    await db.query(
      `insert into public.users(id, email, name, full_name, role, status, is_active, deleted_at)
       values($1,$2,$3,$3,'USER','ACTIVE',true,null)
       on conflict(id) do update set status='ACTIVE', is_active=true, deleted_at=null`,
      [userId, email, role],
    );
  }

  // company_members.role is the sole operational role authority.
  const memberships: Array<[string, string, MemberRole]> = [
    ...EMPLOYEE_ROLES.map((role): [string, string, MemberRole] => [COMPANY, MEMBERS[role], role]),
    [COMPANY, MEMBERS.ADMIN, 'ADMIN'],
    [OTHER_COMPANY, MEMBERS.OUTSIDER, 'ADMIN'],
  ];
  for (const [companyId, userId, role] of memberships) {
    await db.query(
      `insert into public.company_members(company_id, user_id, role, is_active)
       values($1,$2,$3,true)
       on conflict(company_id,user_id) do update set role=excluded.role, is_active=true`,
      [companyId, userId, role],
    );
  }

  await db.query(
    `insert into auth.users(id, email, raw_app_meta_data) values($1,'target-authority@test.invalid','{}') on conflict(id) do nothing`,
    [TARGET_EMPLOYEE],
  );
  await db.query(
    `insert into public.users(id, email, name, full_name, role, status, is_active, deleted_at)
     values($1,'target-authority@test.invalid','Target Employee','Target Employee','USER','ACTIVE',true,null)
     on conflict(id) do update set status='ACTIVE', is_active=true, deleted_at=null`,
    [TARGET_EMPLOYEE],
  );
  await db.query(
    `insert into public.company_members(company_id, user_id, role, is_active) values($1,$2,'USER',true)
     on conflict(company_id,user_id) do update set role='USER', is_active=true`,
    [COMPANY, TARGET_EMPLOYEE],
  );
  // Start from a clean override slate so the projection assertions measure role
  // defaults plus catalog coverage, not leftover owner decisions.
  await db.query(`delete from public.user_permission_overrides where company_id = $1`, [COMPANY]);
});

describe('P0-1 database replay reproduces the authoritative catalog from migrations alone', () => {
  it('produces exactly the frontend permission vocabulary', async () => {
    const { rows } = await db.query<{ permission: string }>(
      'select permission from public.app_permission_catalog order by permission',
    );
    expect(rows.map((row) => row.permission)).toEqual([...appPermissions].sort());
  });

  it('produces the same catalog whether or not the reference seed is applied', async () => {
    const seeded = await createFullReplayedDatabase();
    expect(seeded.failed, JSON.stringify(seeded.failed.slice(-5))).toEqual([]);
    const { rows } = await seeded.db.query<{ permission: string; requestable: boolean }>(
      'select permission, requestable from public.app_permission_catalog order by permission',
    );
    await seeded.db.close();

    const { rows: migrationOnly } = await db.query<{ permission: string; requestable: boolean }>(
      'select permission, requestable from public.app_permission_catalog order by permission',
    );
    expect(rows).toEqual(migrationOnly);
  });
});

describe('P0-1 non-admin roles do not silently lose capabilities', () => {
  it('projects the complete server role matrix for every employee role', async () => {
    expect(parents.size, 'compatibility parent chain must be derived from the resolver').toBeGreaterThan(0);
    for (const role of EMPLOYEE_ROLES) {
      const expected = await expectedEffectiveProjection(role);
      expect(expected.length, `${role} matrix must not be empty`).toBeGreaterThan(0);
      await assume(MEMBERS[role], COMPANY);
      const projected = await effectivePermissions();
      await reset();
      // Equality, not containment: the projection must neither drop a
      // role-default capability (catalog absence) nor invent one (widening).
      expect(projected, `${role} effective projection`).toEqual(expected);
    }
  });

  it('restores capabilities that were previously unreachable for MANAGER', async () => {
    await assume(MEMBERS.MANAGER, COMPANY);
    for (const permission of [
      'expenses.view',
      'lands.view',
      'documents.write',
      'financial.invoices.generate',
      'financial.bank_reconciliation.match',
      'support.operations.view',
    ]) {
      expect(await hasEffective(permission), permission).toBe(true);
    }
    await reset();
  });

  it('restores ADMIN authority over the whole catalog', async () => {
    await assume(MEMBERS.ADMIN, COMPANY);
    const projected = await effectivePermissions();
    for (const permission of appPermissions) {
      expect(await hasEffective(permission), permission).toBe(true);
    }
    await reset();
    expect(projected).toEqual([...appPermissions].sort());
  });

  it('repairs the users.manage gate that authorizes membership management', async () => {
    await assume(MEMBERS.ADMIN, COMPANY);
    const { rows } = await db.query<{ allowed: boolean }>(
      'select app_private.can_manage_company_members($1) as allowed',
      [COMPANY],
    );
    expect(rows[0]?.allowed).toBe(true);
    await reset();

    // MANAGER is not granted users.manage by the role matrix, so the same gate
    // stays closed for it — the repair did not widen membership management.
    await assume(MEMBERS.MANAGER, COMPANY);
    const manager = await db.query<{ allowed: boolean }>(
      'select app_private.can_manage_company_members($1) as allowed',
      [COMPANY],
    );
    expect(manager.rows[0]?.allowed).toBe(false);
    await reset();
  });
});

describe('P0-1 unknown permission codes still fail closed', () => {
  const unknownCodes = ['made.up.permission', 'people.view', 'settings.manage', 'financial.reports.delete'];

  it('denies them for ADMIN and for every employee role', async () => {
    for (const role of ['ADMIN', ...EMPLOYEE_ROLES] as MemberRole[]) {
      await assume(MEMBERS[role], COMPANY);
      for (const code of unknownCodes) {
        expect(await hasEffective(code), `${role}/${code}`).toBe(false);
      }
      await reset();
    }
  });

  it('rejects them in the permission-request workflow and as explicit grants', async () => {
    await assume(MEMBERS.USER, COMPANY);
    expect(await errorOf(() => db.query('select public.request_permission($1,$2,$3)', ['made.up.permission', '/lands', 'سبب'])))
      .toMatch(/unknown permission/i);
    await reset();

    await assume(MEMBERS.ADMIN, COMPANY);
    expect(
      await errorOf(() =>
        db.query('select public.set_employee_permission($1,$2,true,$3)', [
          TARGET_EMPLOYEE,
          'made.up.permission',
          'سبب',
        ]),
      ),
    ).toMatch(/EMPLOYEE_PERMISSION_NOT_ASSIGNABLE/);
    await reset();
  });

  it('denies everything when identity, membership or company context cannot be proven', async () => {
    // No company claim: require_company_id() fails closed before any shortcut.
    await db.exec(`reset role; select set_config('request.jwt.claims', '{"sub":"${MEMBERS.ADMIN}","role":"authenticated"}', false); set role authenticated;`);
    expect(await errorOf(() => hasEffective('app.dashboard.view'))).toMatch(/company context is required/i);
    await reset();

    // Valid claim, but a member of a different company.
    await assume(MEMBERS.OUTSIDER, OTHER_COMPANY);
    expect(await hasEffective('app.dashboard.view')).toBe(true);
    expect(await hasEffective('users.manage')).toBe(true); // ADMIN of its own company only
    await reset();
  });
});

describe('P0-1 compatibility parents stay resolvable but non-assignable', () => {
  it('keeps broad writes out of the owner-facing editor', async () => {
    await assume(MEMBERS.ADMIN, COMPANY);
    for (const parent of ['properties.write', 'contracts.write', 'maintenance.write']) {
      expect(
        await errorOf(() =>
          db.query('select public.set_employee_permission($1,$2,true,$3)', [
            TARGET_EMPLOYEE,
            parent,
            'سبب',
          ]),
        ),
        parent,
      ).toMatch(/EMPLOYEE_PERMISSION_NOT_ASSIGNABLE/);
    }
    // The granular child the parent was replaced by remains assignable.
    const { rows } = await db.query<{ allowed: boolean }>(
      `select (public.set_employee_permission($1,$2,true,$3)->>'allowed')::boolean as allowed`,
      [TARGET_EMPLOYEE, 'properties.create', 'سبب'],
    );
    expect(rows[0]?.allowed).toBe(true);
    await reset();
  });
});
