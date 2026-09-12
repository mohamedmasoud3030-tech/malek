/**
 * PHASE 4 regression — People direct-write ACL restore.
 *
 * people-service.ts performs the same governed direct INSERT/UPDATE writes
 * on public.people that unit-service.ts performs on public.units. After
 * 20260901000001 (bulk REVOKE from authenticated) only properties (000036)
 * and units (20260912000001, PHASE 3) had the minimum direct PostgREST
 * write surface restored, so every person mutation from the UI failed at
 * the authorization layer with 42501 "permission denied for table people"
 * — BEFORE RLS ran.
 *
 * 20260912000002_people_direct_write_acl_restore mirrors 000036 for people
 * and this file is its regression proof:
 *
 *   - happy paths (exact client payloads, PostgREST-identical execution:
 *     set local role authenticated + JWT claims):
 *       * person CREATE persists via direct INSERT;
 *       * person EDIT persists via direct UPDATE (full client payload shape);
 *       * person ARCHIVE persists via the soft deleted_at UPDATE;
 *       * reopened records survive a fresh read (refresh/reopen proof).
 *   - authority stays fail-closed after the grant:
 *       * a plain USER (not ADMIN/MANAGER) cannot insert (RLS
 *         manager_write_people WITH CHECK is_admin_or_manager);
 *       * a MANAGER of another company cannot mutate this company's person
 *         (p0_tenant_isolation restrictive company match → 0 rows);
 *       * hard DELETE is still denied (no DELETE privilege granted).
 *
 * Uses the repository's canonical PGlite mechanism (full migration replay +
 * seed, real role/company fixtures, real RLS/JWT claims), not mocked
 * frontend-only proof.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../../p1/replay-bootstrap';

const COMPANY_A = 'b8000000-0000-4000-8000-000000000001';
const COMPANY_B = 'b8000000-0000-4000-8000-000000000002';
const ADMIN_A = 'b8000000-0000-4000-8000-000000000011';
const USER_A = 'b8000000-0000-4000-8000-000000000013';
const MANAGER_B = 'b8000000-0000-4000-8000-000000000014';

let db: PGlite;
let personId: string;
let archivedPersonId: string;

/** Execute SQL exactly like PostgREST does for a browser request:
 *  authenticated role + JWT claims (sub/role/company_id). Commits on success
 *  (browser requests are autocommit), rolls back on failure. */
async function asBrowser<T>(
  identity: Readonly<{ userId: string; companyId: string }>,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const claims = JSON.stringify({
    sub: identity.userId,
    role: 'authenticated',
    app_metadata: { company_id: identity.companyId },
  });
  await db.exec('begin');
  try {
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
    await db.exec('set local role authenticated');
    const res = await db.query(sql, params);
    await db.exec('commit');
    return res.rows as T[];
  } catch (error) {
    await db.exec('rollback').catch(() => undefined);
    throw error;
  }
}

// Exact client shape (rentrix-app/src/features/people/person-schema.ts →
// PersonPayload, normalized by normalizePersonPayload in people-service.ts).
const PERSON_CREATE_PAYLOAD = {
  full_name: 'عبدالله سعيد العلي',
  type: 'tenant',
  phone: '+968 9100 0000',
  email: 'abdullah@example.om',
  national_id: null,
  address: 'مسقط',
  notes: null,
};

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug, is_active) values
      ('${COMPANY_A}', 'شركة الأشخاص أ', 'people-phase4-a', true),
      ('${COMPANY_B}', 'شركة الأشخاص ب', 'people-phase4-b', true);

    insert into auth.users (id, email, raw_app_meta_data) values
      ('${ADMIN_A}', 'admin.a@people4.test', '{\"company_id\":\"${COMPANY_A}\"}'::jsonb),
      ('${USER_A}', 'user.a@people4.test', '{\"company_id\":\"${COMPANY_A}\"}'::jsonb),
      ('${MANAGER_B}', 'manager.b@people4.test', '{\"company_id\":\"${COMPANY_B}\"}'::jsonb);

    insert into public.users (id, email, name, role, status, is_active) values
      ('${ADMIN_A}', 'admin.a@people4.test', 'مدير الأشخاص أ', 'ADMIN', 'ACTIVE', true),
      ('${USER_A}', 'user.a@people4.test', 'مستخدم الأشخاص أ', 'USER', 'ACTIVE', true),
      ('${MANAGER_B}', 'manager.b@people4.test', 'مشرف الأشخاص ب', 'MANAGER', 'ACTIVE', true);

    insert into public.company_members (company_id, user_id, role, is_active) values
      ('${COMPANY_A}', '${ADMIN_A}', 'ADMIN', true),
      ('${COMPANY_A}', '${USER_A}', 'USER', true),
      ('${COMPANY_B}', '${MANAGER_B}', 'MANAGER', true);
  `);
  await assumeIdentity(db, ADMIN_A, COMPANY_A);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('people direct-write ACL restore (20260912000002)', () => {
  it('person CREATE persists through the direct PostgREST insert path (exact client payload)', async () => {
    const rows = await asBrowser<{ id: string; company_id: string; full_name: string; type: string }>(
      { userId: ADMIN_A, companyId: COMPANY_A },
      `insert into public.people (full_name, type, phone, email, national_id, address, notes)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id, company_id::text as company_id, full_name, type`,
      [PERSON_CREATE_PAYLOAD.full_name, PERSON_CREATE_PAYLOAD.type, PERSON_CREATE_PAYLOAD.phone,
       PERSON_CREATE_PAYLOAD.email, PERSON_CREATE_PAYLOAD.national_id,
       PERSON_CREATE_PAYLOAD.address, PERSON_CREATE_PAYLOAD.notes],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].company_id).toBe(COMPANY_A); // company_id defaulted from the JWT
    expect(rows[0].type).toBe('tenant');
    personId = rows[0].id;
  });

  it('person EDIT persists through the direct PostgREST update path (exact client payload)', async () => {
    const rows = await asBrowser<{ id: string; phone: string | null; notes: string | null }>(
      { userId: ADMIN_A, companyId: COMPANY_A },
      `update public.people
          set full_name = $2, type = $3, phone = $4, email = $5,
              national_id = $6, address = $7, notes = $8
        where id = $1::uuid and deleted_at is null
        returning id, phone, notes`,
      [personId, PERSON_CREATE_PAYLOAD.full_name, PERSON_CREATE_PAYLOAD.type, '+968 9200 1111',
       PERSON_CREATE_PAYLOAD.email, PERSON_CREATE_PAYLOAD.national_id,
       PERSON_CREATE_PAYLOAD.address, 'تعديل التواصل'],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].phone).toBe('+968 9200 1111');
    expect(rows[0].notes).toBe('تعديل التواصل');
  });

  it('person ARCHIVE persists through the soft deleted_at update path', async () => {
    const created = await asBrowser<{ id: string }>(
      { userId: ADMIN_A, companyId: COMPANY_A },
      `insert into public.people (full_name, type, phone, email, national_id, address, notes)
       values ('مستأجر ثانٍ', 'tenant', '+968 9300 2222', null, null, null, null) returning id`,
      [],
    );
    archivedPersonId = created[0].id;

    const rows = await asBrowser<{ id: string }>(
      { userId: ADMIN_A, companyId: COMPANY_A },
      `update public.people set deleted_at = now()
        where id = $1::uuid and deleted_at is null
        returning id`,
      [archivedPersonId],
    );
    expect(rows).toHaveLength(1);

    const archived = await asBrowser<{ deleted_at: string | null }>(
      { userId: ADMIN_A, companyId: COMPANY_A },
      `select deleted_at from public.people where id = $1::uuid`,
      [archivedPersonId],
    );
    expect(archived[0].deleted_at).toBeTruthy();
  });

  it('reopened records survive a fresh read (refresh/reopen proof)', async () => {
    const person = await asBrowser<{ id: string; full_name: string; phone: string | null; notes: string | null; deleted_at: string | null }>(
      { userId: ADMIN_A, companyId: COMPANY_A },
      `select id, full_name, phone, notes, deleted_at
         from public.people where id = $1::uuid`,
      [personId],
    );
    expect(person).toHaveLength(1);
    expect(person[0]).toMatchObject({
      full_name: 'عبدالله سعيد العلي',
      phone: '+968 9200 1111',
      notes: 'تعديل التواصل',
      deleted_at: null,
    });
    const list = await asBrowser<{ n: number }>(
      { userId: ADMIN_A, companyId: COMPANY_A },
      `select count(*)::int as n from public.people where deleted_at is null`,
    );
    // person 1 active + person 2 archived (excluded by the list filter)
    expect(list[0].n).toBe(1);
  });

  it('a plain USER (not ADMIN/MANAGER) still cannot insert a person', async () => {
    await expect(
      asBrowser<{ id: string }>(
        { userId: USER_A, companyId: COMPANY_A },
        `insert into public.people (full_name, type, phone, email, national_id, address, notes)
         values ('خارج الصلاحية', 'contact', '+968 9900 9999', null, null, null, null) returning id`,
        [],
      ),
    ).rejects.toThrow(/row-level security|new row violates|permission denied/i);
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.people where full_name = 'خارج الصلاحية'`,
    );
    expect(rows[0].n).toBe(0);
  });

  it('a MANAGER of another company cannot mutate this company person (tenant isolation)', async () => {
    const rows = await asBrowser<{ id: string }>(
      { userId: MANAGER_B, companyId: COMPANY_B },
      `update public.people
          set phone = '+968 0000 0000'
        where id = $1::uuid and deleted_at is null
        returning id`,
      [personId],
    );
    expect(rows).toHaveLength(0); // invisible under p0_tenant_isolation
    const { rows: after } = await db.query<{ phone: string | null }>(
      `select phone from public.people where id = $1::uuid`,
      [personId],
    );
    expect(after[0].phone).toBe('+968 9200 1111');
  });

  it('hard DELETE remains denied for browser roles', async () => {
    await expect(
      asBrowser<Record<string, never>>(
        { userId: ADMIN_A, companyId: COMPANY_A },
        `delete from public.people where id = $1::uuid`,
        [archivedPersonId],
      ),
    ).rejects.toThrow(/permission denied for table people/i);
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.people where id = $1::uuid`,
      [archivedPersonId],
    );
    expect(rows[0].n).toBe(1); // row intact
  });
});
