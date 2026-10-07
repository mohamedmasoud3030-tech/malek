/**
 * R7 — Party / Identity domain: unified directory + identity invariants.
 *
 * Proves against a FULL migration replay:
 *   1. owners.name can NEVER diverge from owners.full_name (the compatibility
 *      trigger keeps one identity fact — no duplicated names),
 *   2. property.owner_name is only a projection of the temporal
 *      property_owners relation (ownership remains temporal),
 *   3. tenant history is preserved: ending an ownership or archiving people
 *      never touches contract references,
 *   4. public.party_directory exposes ONE row per identity+role across
 *      owners/people, and surfaces legacy owner-typed person rows as
 *      'owner_legacy_person' instead of hiding the duplication,
 *   5. the directory is honest: no fabricated identities, live/active flags
 *      reflect the sources.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../../p1/replay-bootstrap';

const COMPANY = 'a7000000-0000-4000-8000-000000000001';
const ADMIN = 'a7000000-0000-4000-8000-000000000011';
const OWNER = 'a7000000-0000-4000-8000-000000000021';
const OWNER2 = 'a7000000-0000-4000-8000-000000000022';
const PROPERTY = 'a7000000-0000-4000-8000-000000000031';
const TENANT = 'a7000000-0000-4000-8000-000000000051';
const LEGACY_OWNER_PERSON = 'a7000000-0000-4000-8000-000000000052';
const CONTACT = 'a7000000-0000-4000-8000-000000000053';
const UNIT = 'a7000000-0000-4000-8000-000000000041';
const CONTRACT = 'a7000000-0000-4000-8000-000000000061';
const AGREEMENT = 'a7000000-0000-4000-8000-000000000071';

let db: PGlite;

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug) values ('${COMPANY}', 'R7 Co', 'r7-co');
    insert into auth.users (id, email, raw_app_meta_data) values
      ('${ADMIN}', 'admin@r7.test', '{"company_id":"${COMPANY}"}'::jsonb);
    insert into public.users (id, email, name, role, status, is_active) values
      ('${ADMIN}', 'admin@r7.test', 'Admin', 'ADMIN', 'ACTIVE', true);
    insert into public.company_members (company_id, user_id, role) values
      ('${COMPANY}', '${ADMIN}', 'ADMIN');

    insert into public.owners (id, full_name, name, company_id) values
      ('${OWNER}', 'مالك الهوية', 'مالك الهوية', '${COMPANY}'),
      ('${OWNER2}', 'المالك الثاني', 'المالك الثاني', '${COMPANY}');
    insert into public.properties (id, title, name, type, address, company_id)
    values ('${PROPERTY}', 'R7 Property', 'R7 Property', 'residential', 'Muscat', '${COMPANY}');
    insert into public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
    values ('${PROPERTY}', '${OWNER}', 100, true, date '2026-01-01', '${COMPANY}');
    insert into public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id)
    values ('${AGREEMENT}', '${OWNER}', '${PROPERTY}', 'property_management', 'RATE', 5, date '2026-01-01', '${COMPANY}');
    insert into public.units (id, property_id, unit_number, company_id)
    values ('${UNIT}', '${PROPERTY}', 'R7-1', '${COMPANY}');

    insert into public.people (id, full_name, type, phone, company_id) values
      ('${TENANT}', 'مستأجر الهوية', 'tenant', '+96890001111', '${COMPANY}'),
      ('${LEGACY_OWNER_PERSON}', 'مالك قديم داخل people', 'owner', null, '${COMPANY}'),
      ('${CONTACT}', 'جهة اتصال', 'contact', null, '${COMPANY}');

    insert into public.contracts (id, property_id, unit_id, tenant_id, agreement_id, start_date, end_date, rent_amount, status, company_id)
    values ('${CONTRACT}', '${PROPERTY}', '${UNIT}', '${TENANT}', '${AGREEMENT}', date '2026-01-01', date '2026-12-31', 400, 'active', '${COMPANY}');
  `);

  await assumeIdentity(db, ADMIN, COMPANY);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('R7 — one identity fact per party', () => {
  it('owners.name can never diverge from owners.full_name (sync trigger)', async () => {
    // Update full_name only — name must follow.
    await db.query(`update public.owners set full_name = 'مالك الهوية المحدث' where id = $1::uuid`, [OWNER]);
    const { rows } = await db.query<{ name: string; full_name: string }>(
      `select name, full_name from public.owners where id = $1::uuid`, [OWNER],
    );
    expect(rows[0].name).toBe('مالك الهوية المحدث');
    expect(rows[0].full_name).toBe('مالك الهوية المحدث');

    // Update name only — full_name must follow. Never two divergent facts.
    await db.query(`update public.owners set name = 'اسم جديد تماماً' where id = $1::uuid`, [OWNER]);
    const { rows: rows2 } = await db.query<{ name: string; full_name: string }>(
      `select name, full_name from public.owners where id = $1::uuid`, [OWNER],
    );
    expect(rows2[0].name).toBe('اسم جديد تماماً');
    expect(rows2[0].full_name).toBe('اسم جديد تماماً');
  });

  it('property.owner_name is a projection of temporal ownership, not an identity fact', async () => {
    const { rows } = await db.query<{ owner_name: string | null; owner_id: string | null }>(
      `select owner_name, owner_id::text as owner_id from public.properties where id::text = $1`,
      [PROPERTY],
    );
    // The projection tracks the current primary owner. NOTE: the projection
    // refreshes on OWNERSHIP events, not on renames — a stale name after a
    // rename is exactly what the data-integrity check «أسماء ملاك غير متزامنة»
    // surfaces. Identity truth lives in owners; the projection is display-only.
    expect(rows[0].owner_id).toBe(OWNER);
    expect(rows[0].owner_name).toBe('مالك الهوية');

    // Transfer ownership temporally: end the current link, start a new one.
    await db.query(`update public.property_owners set ends_on = date '2026-06-30' where property_id::text = $1 and owner_id::text = $2`, [PROPERTY, OWNER]);
    await db.query(
      `insert into public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
       values ($1::uuid, $2::uuid, 100, true, date '2026-07-01', $3::uuid)`,
      [PROPERTY, OWNER2, COMPANY],
    );
    const { rows: after } = await db.query<{ owner_id: string | null; owner_name: string | null }>(
      `select owner_id::text as owner_id, owner_name from public.properties where id::text = $1`,
      [PROPERTY],
    );
    expect(after[0].owner_id).toBe(OWNER2);
    expect(after[0].owner_name).toBe('المالك الثاني');

    // History is preserved: the ended link still exists with its dates.
    const { rows: history } = await db.query<{ n: string }>(
      `select count(*)::text as n from public.property_owners
        where property_id::text = $1 and owner_id::text = $2 and ends_on = date '2026-06-30'`,
      [PROPERTY, OWNER],
    );
    expect(Number(history[0].n)).toBe(1);
  });

  it('tenant history survives ownership churn (contract references intact)', async () => {
    const { rows } = await db.query<{ tenant_id: string; full_name: string }>(
      `select c.tenant_id::text as tenant_id, p.full_name
         from public.contracts c join public.people p on p.id = c.tenant_id
        where c.id::text = $1`,
      [CONTRACT],
    );
    expect(rows[0].tenant_id).toBe(TENANT);
    expect(rows[0].full_name).toBe('مستأجر الهوية');
  });
});

describe('R7 — party_directory unified read model', () => {
  it('exposes one row per identity+role with honest flags', async () => {
    const { rows } = await db.query<{ party_key: string; role: string; display_name: string; live: boolean }>(
      `select party_key, role, display_name, live from public.party_directory
        where company_id = $1::uuid order by party_key`,
      [COMPANY],
    );
    const byRole = new Map<string, typeof rows>(
      [...new Set(rows.map((r) => r.role))].map((role) => [role, rows.filter((r) => r.role === role)]),
    );
    expect(byRole.get('owner')).toHaveLength(2);
    expect(byRole.get('tenant')).toHaveLength(1);
    expect(byRole.get('contact')).toHaveLength(1);
    // The legacy duplicate is VISIBLE with its own role — not hidden, not merged.
    expect(byRole.get('owner_legacy_person')).toHaveLength(1);
    expect(byRole.get('owner_legacy_person')![0].display_name).toBe('مالك قديم داخل people');
    // Every row is live in this fixture.
    expect(rows.every((r) => r.live)).toBe(true);
  });

  it('reflects soft-deletion honestly (live=false, never dropped silently)', async () => {
    await db.query(`update public.people set deleted_at = now() where id = $1::uuid`, [CONTACT]);
    const { rows } = await db.query<{ live: boolean }>(
      `select live from public.party_directory where source_id = $1 and source_table = 'people'`,
      [CONTACT],
    );
    expect(rows[0].live).toBe(false);
    await db.query(`update public.people set deleted_at = null where id = $1::uuid`, [CONTACT]);
  });

  it('never fabricates identities: directory count equals source counts', async () => {
    const { rows } = await db.query<{ d: string; o: string; p: string }>(
      `select
         (select count(*) from public.party_directory where company_id = $1::uuid)::text as d,
         (select count(*) from public.owners where company_id = $1::uuid)::text as o,
         (select count(*) from public.people where company_id = $1::uuid)::text as p`,
      [COMPANY],
    );
    expect(Number(rows[0].d)).toBe(Number(rows[0].o) + Number(rows[0].p));
  });
});
