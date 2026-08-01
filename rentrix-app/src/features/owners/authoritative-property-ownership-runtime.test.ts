/**
 * MALIK Authoritative Ownership View Runtime RLS Verification
 *
 * Proves that public.current_property_ownership enforces security_invoker RLS in 3 independent tests:
 *   1. Company A sees exactly its own ownership row.
 *   2. Company B sees zero Company A rows.
 *   3. Anonymous role receives permission denied.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createFullReplayedDatabase } from '../../p1/replay-bootstrap';
import type { PGlite } from '@electric-sql/pglite';

const COMPANY_A = 'ca000000-0000-4000-8000-00000000000a';
const COMPANY_B = 'cb000000-0000-4000-8000-00000000000b';
const ADMIN_A = 'aa000000-0000-4000-8000-000000000001';
const ADMIN_B = 'bb000000-0000-4000-8000-000000000002';
const PROP_ID = 'f2000000-0000-4000-8000-000000000001';

async function assume(db: PGlite, userId: string | null, companyId: string | null, role = 'authenticated') {
  const claims = JSON.stringify({
    sub: userId ?? undefined,
    role,
    app_metadata: companyId ? { company_id: companyId } : {},
  });
  await db.query(`SELECT set_config('request.jwt.claims', '${claims}', false);`);
}

describe('public.current_property_ownership security_invoker runtime RLS contract', () => {
  let db: PGlite;

  beforeAll(async () => {
    const replay = await createFullReplayedDatabase({ writeEvidence: false });
    expect(replay.failed).toEqual([]);
    db = replay.db;

    // Seed companies, users, and company members
    await db.exec(`
      insert into public.companies (id, name, slug) values
        ('${COMPANY_A}', 'شركة ألف للملكية', 'alpha-po'),
        ('${COMPANY_B}', 'شركة باء للملكية', 'beta-po')
      on conflict do nothing;

      insert into auth.users (id, email) values
        ('${ADMIN_A}', 'admin.po.a@malik.test'),
        ('${ADMIN_B}', 'admin.po.b@malik.test')
      on conflict do nothing;

      insert into public.users (id, email, name, role, status) values
        ('${ADMIN_A}', 'admin.po.a@malik.test', 'مدير ألف', 'ADMIN', 'ACTIVE'),
        ('${ADMIN_B}', 'admin.po.b@malik.test', 'مدير باء', 'ADMIN', 'ACTIVE')
      on conflict do nothing;

      insert into public.company_members (company_id, user_id, role) values
        ('${COMPANY_A}', '${ADMIN_A}', 'ADMIN'),
        ('${COMPANY_B}', '${ADMIN_B}', 'ADMIN')
      on conflict do nothing;

      insert into public.owners (id, name, display_name, full_name, company_id, is_active)
      values ('f1000000-0000-4000-8000-000000000001', 'مالك أ', 'مالك أ', 'مالك أ', '${COMPANY_A}', true)
      on conflict do nothing;

      insert into public.properties (id, name, title, type, address, owner_id, owner_name, company_id, status)
      values ('${PROP_ID}', 'عقار ألف', 'عقار ألف', 'residential', 'مسقط', 'f1000000-0000-4000-8000-000000000001', 'مالك أ', '${COMPANY_A}', 'active')
      on conflict do nothing;

      insert into public.property_owners (id, property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
      values ('f3000000-0000-4000-8000-000000000001', '${PROP_ID}', 'f1000000-0000-4000-8000-000000000001', 100, true, '2026-01-01', '${COMPANY_A}')
      on conflict do nothing;

      insert into public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id)
      values ('f4000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', '${PROP_ID}', 'property_management', 'RATE', 5, '2026-01-01', '${COMPANY_A}')
      on conflict do nothing;
    `);
  });

  afterEach(async () => {
    await db.query('RESET ROLE;').catch(() => undefined);
  });

  it('1. Company A sees exactly its own ownership row', async () => {
    await assume(db, ADMIN_A, COMPANY_A);
    await db.query('SET ROLE authenticated;');
    const res = await db.query<any>(`
      select * from public.current_property_ownership where property_id = '${PROP_ID}'
    `);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].property_id).toBe(PROP_ID);
    expect(res.rows[0].company_id).toBe(COMPANY_A);
    expect(res.rows[0].owner_name).toBe('مالك أ');
    expect(Number(res.rows[0].ownership_percentage)).toBe(100);
    expect(res.rows[0].agreement_type).toBe('property_management');
  });

  it('2. Company B sees zero Company A rows', async () => {
    await assume(db, ADMIN_B, COMPANY_B);
    await db.query('SET ROLE authenticated;');
    const res = await db.query<{ count: string }>(`
      select count(*) as count from public.current_property_ownership where property_id = '${PROP_ID}'
    `);
    expect(Number(res.rows[0].count)).toBe(0);

    const allA = await db.query<{ count: string }>(`
      select count(*) as count from public.current_property_ownership where company_id = '${COMPANY_A}'
    `);
    expect(Number(allA.rows[0].count)).toBe(0);
  });

  it('3. Anonymous role receives permission denied', async () => {
    await assume(db, null, null, 'anon');
    await db.query('SET ROLE anon;');
    await expect(
      db.query(`select * from public.current_property_ownership`),
    ).rejects.toThrow(/permission denied|42501/i);
  });
});
