/**
 * TD-01 / R-01 — Atomic Property Ownership Payload.
 *
 * Regression proof that property/agreement creation and the complete
 * ownership split commit in ONE database transaction through
 * public.create_property_with_ownership_atomic, and that any failure leaves
 * no partial onboarding state:
 *
 *   - happy paths: default single-owner (100%) and explicit split (60/40)
 *     persist property + ownership rows + agreement + first version together;
 *   - every ownership validation failure (total, duplicate owner, inactive
 *     owner, cross-company owner, >1 primary, primary mismatch, out-of-range /
 *     over-precise percentage, malformed payload) rolls back ALL writes —
 *     property, ownership, agreement, and version counts stay unchanged;
 *   - scalar creation failures (invalid agreement window / commission) also
 *     leave zero residue;
 *   - a failed attempt followed by a retry creates exactly one complete set;
 *   - an explicit transaction abort after a successful RPC call leaves no
 *     rows (the RPC's internal multi-statement writes are one atomic unit);
 *   - the legacy creation RPC remains a working compatibility seam;
 *   - unauthenticated callers are rejected and ACLs stay fail-closed.
 *
 * Uses the repository's canonical PGlite mechanism (full migration replay +
 * seed, real role/company fixtures, real RLS/JWT claims), not mocked
 * frontend-only proof.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../../p1/replay-bootstrap';

const COMPANY_A = 'a5000000-0000-4000-8000-000000000001';
const COMPANY_B = 'a5000000-0000-4000-8000-000000000002';
const ADMIN_A = 'a5000000-0000-4000-8000-000000000011';
const ADMIN_B = 'a5000000-0000-4000-8000-000000000012';
const OWNER_P = 'a5000000-0000-4000-8000-000000000021'; // primary (company A)
const OWNER_C1 = 'a5000000-0000-4000-8000-000000000022'; // co-owner (company A)
const OWNER_C2 = 'a5000000-0000-4000-8000-000000000023'; // co-owner 2 (company A)
const OWNER_INACTIVE = 'a5000000-0000-4000-8000-000000000024'; // inactive (company A)
const OWNER_DELETED = 'a5000000-0000-4000-8000-000000000025'; // soft-deleted (company A)
const OWNER_B = 'a5000000-0000-4000-8000-000000000031'; // owner of company B

const STARTS_ON = '2026-01-01';
const ENDS_ON = '2026-12-31';

let db: PGlite;

type OwnershipEntry = Readonly<{
  owner_id: string;
  ownership_percentage: number;
  is_primary: boolean;
}>;

async function callCreate(options: Readonly<{
  ownerId?: string;
  ownership?: readonly OwnershipEntry[] | null;
  title?: string;
  startsOn?: string | null;
  endsOn?: string | null;
  commissionValue?: number;
}> = {}): Promise<{ property_id: string; agreement_id: string }> {
  const ownershipParam = options.ownership == null ? null : JSON.stringify(options.ownership);
  const { rows } = await db.query<{ out: string | null }>(
    `select public.create_property_with_ownership_atomic(
       $1::text, 'commercial', 'مسقط', $2::uuid,
       'property_management', 'RATE', $3::numeric,
       $4::date, $5::date, null, null, null, 'active', null,
       'OWNER_IS_CREDITOR', $6::jsonb)::text as out`,
    [
      options.title ?? 'عقار الاختبار الذري',
      options.ownerId ?? OWNER_P,
      options.commissionValue ?? 5,
      options.startsOn === undefined ? STARTS_ON : options.startsOn,
      options.endsOn === undefined ? ENDS_ON : options.endsOn,
      ownershipParam,
    ],
  );
  if (!rows[0]?.out) throw new Error('empty RPC result');
  return JSON.parse(rows[0].out) as { property_id: string; agreement_id: string };
}

type CompanySnapshot = Readonly<{ props: number; ownership: number; agreements: number; versions: number }>;

async function snapshot(companyId: string): Promise<CompanySnapshot> {
  const { rows } = await db.query<CompanySnapshot>(
    `select
       (select count(*)::int from public.properties where company_id = $1::uuid) as props,
       (select count(*)::int from public.property_owners where company_id = $1::uuid) as ownership,
       (select count(*)::int from public.owner_agreements where company_id = $1::uuid) as agreements,
       (select count(*)::int from public.owner_agreement_versions v
          join public.owner_agreements oa on oa.id = v.owner_agreement_id
         where oa.company_id = $1::uuid) as versions`,
    [companyId],
  );
  return rows[0];
}

async function expectRollback(options: Parameters<typeof callCreate>[0], pattern: RegExp) {
  const before = await snapshot(COMPANY_A);
  await expect(callCreate(options)).rejects.toThrow(pattern);
  const after = await snapshot(COMPANY_A);
  expect(after).toEqual(before);
}

async function ownershipRows(propertyId: string) {
  const { rows } = await db.query<{
    owner_id: string;
    ownership_percentage: string;
    is_primary: boolean;
    starts_on: string;
    ends_on: string;
  }>(
    `select owner_id::text as owner_id,
            ownership_percentage::text as ownership_percentage,
            is_primary, starts_on::text as starts_on, ends_on::text as ends_on
       from public.property_owners
      where property_id = $1::uuid
      order by is_primary desc, owner_id`,
    [propertyId],
  );
  return rows;
}

const split60_40: readonly OwnershipEntry[] = [
  { owner_id: OWNER_P, ownership_percentage: 60, is_primary: true },
  { owner_id: OWNER_C1, ownership_percentage: 40, is_primary: false },
];
const split40_30_30: readonly OwnershipEntry[] = [
  { owner_id: OWNER_P, ownership_percentage: 40, is_primary: true },
  { owner_id: OWNER_C1, ownership_percentage: 30, is_primary: false },
  { owner_id: OWNER_C2, ownership_percentage: 30, is_primary: false },
];

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug, is_active) values
      ('${COMPANY_A}', 'شركة الذرية أ', 'atomic-a', true),
      ('${COMPANY_B}', 'شركة الذرية ب', 'atomic-b', true);

    insert into auth.users (id, email, raw_app_meta_data) values
      ('${ADMIN_A}', 'admin.a@atomic.test', '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${ADMIN_B}', 'admin.b@atomic.test', '{"company_id":"${COMPANY_B}"}'::jsonb);

    insert into public.users (id, email, name, role, status, is_active) values
      ('${ADMIN_A}', 'admin.a@atomic.test', 'مدير ألف', 'ADMIN', 'ACTIVE', true),
      ('${ADMIN_B}', 'admin.b@atomic.test', 'مدير باء', 'ADMIN', 'ACTIVE', true);

    insert into public.company_members (company_id, user_id, role, is_active) values
      ('${COMPANY_A}', '${ADMIN_A}', 'ADMIN', true),
      ('${COMPANY_B}', '${ADMIN_B}', 'ADMIN', true);

    insert into public.owners (id, name, display_name, full_name, company_id, is_active, deleted_at) values
      ('${OWNER_P}', 'المالك الأساسي', 'المالك الأساسي', 'المالك الأساسي', '${COMPANY_A}', true, null),
      ('${OWNER_C1}', 'الشريك الأول', 'الشريك الأول', 'الشريك الأول', '${COMPANY_A}', true, null),
      ('${OWNER_C2}', 'الشريك الثاني', 'الشريك الثاني', 'الشريك الثاني', '${COMPANY_A}', true, null),
      ('${OWNER_INACTIVE}', 'الشريك غير النشط', 'الشريك غير النشط', 'الشريك غير النشط', '${COMPANY_A}', false, null),
      ('${OWNER_DELETED}', 'الشريك المؤرشف', 'الشريك المؤرشف', 'الشريك المؤرشف', '${COMPANY_A}', true, now()),
      ('${OWNER_B}', 'مالك شركة ب', 'مالك شركة ب', 'مالك شركة ب', '${COMPANY_B}', true, null);
  `);
  await assumeIdentity(db, ADMIN_A, COMPANY_A);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('create_property_with_ownership_atomic — single-transaction ownership payload', () => {
  it('happy path: single-owner default creates property + 100% ownership + agreement + first version together', async () => {
    const before = await snapshot(COMPANY_A);
    const created = await callCreate({ ownership: null });
    const after = await snapshot(COMPANY_A);

    expect(after.props).toBe(before.props + 1);
    expect(after.agreements).toBe(before.agreements + 1);
    expect(after.versions).toBe(before.versions + 1);

    const links = await ownershipRows(created.property_id);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      owner_id: OWNER_P,
      ownership_percentage: '100.0000',
      is_primary: true,
      starts_on: STARTS_ON,
      ends_on: ENDS_ON,
    });

    const agreement = await db.query<{ current_version_id: string | null }>(
      'select current_version_id::text as current_version_id from public.owner_agreements where id = $1::uuid',
      [created.agreement_id],
    );
    expect(agreement.rows[0]?.current_version_id).toBeTruthy();
  });

  it('happy path: explicit 60/40 split persists primary share and co-owner rows in the same transaction', async () => {
    const before = await snapshot(COMPANY_A);
    const created = await callCreate({ ownership: split60_40 });
    const after = await snapshot(COMPANY_A);

    expect(after.props).toBe(before.props + 1);
    expect(after.ownership).toBe(before.ownership + 2);
    expect(after.agreements).toBe(before.agreements + 1);
    expect(after.versions).toBe(before.versions + 1);

    const links = await ownershipRows(created.property_id);
    expect(links).toHaveLength(2);
    expect(links[0]).toMatchObject({
      owner_id: OWNER_P,
      ownership_percentage: '60.0000',
      is_primary: true,
      starts_on: STARTS_ON,
      ends_on: ENDS_ON,
    });
    expect(links[1]).toMatchObject({
      owner_id: OWNER_C1,
      ownership_percentage: '40.0000',
      is_primary: false,
      starts_on: STARTS_ON,
      ends_on: ENDS_ON,
    });
  });

  it('happy path: three-way split persists all three rows', async () => {
    const before = await snapshot(COMPANY_A);
    const created = await callCreate({ ownership: split40_30_30 });
    const after = await snapshot(COMPANY_A);
    expect(after.props).toBe(before.props + 1);
    expect(after.ownership).toBe(before.ownership + 3);
    const links = await ownershipRows(created.property_id);
    expect(links.map((row) => row.owner_id)).toEqual([OWNER_P, OWNER_C1, OWNER_C2]);
    expect(links.map((row) => Number(row.ownership_percentage))).toEqual([40, 30, 30]);
  });
});

describe('create_property_with_ownership_atomic — every ownership validation failure rolls back completely', () => {
  it.each([
    ['ownership total below 100 (60+30)', { ownership: [
      { owner_id: OWNER_P, ownership_percentage: 60, is_primary: true },
      { owner_id: OWNER_C1, ownership_percentage: 30, is_primary: false },
    ] }, /OWNERSHIP_TOTAL_NOT_100/],
    ['ownership total above 100 (60+50)', { ownership: [
      { owner_id: OWNER_P, ownership_percentage: 60, is_primary: true },
      { owner_id: OWNER_C1, ownership_percentage: 50, is_primary: false },
    ] }, /OWNERSHIP_TOTAL_NOT_100/],
    ['duplicate owner (50+50 same owner)', { ownership: [
      { owner_id: OWNER_P, ownership_percentage: 50, is_primary: true },
      { owner_id: OWNER_P, ownership_percentage: 50, is_primary: false },
    ] }, /OWNERSHIP_DUPLICATE_OWNER/],
    ['duplicate owner as two co-owner rows', { ownership: [
      { owner_id: OWNER_P, ownership_percentage: 50, is_primary: true },
      { owner_id: OWNER_C1, ownership_percentage: 25, is_primary: false },
      { owner_id: OWNER_C1, ownership_percentage: 25, is_primary: false },
    ] }, /OWNERSHIP_DUPLICATE_OWNER/],
    ['inactive owner fails closed', { ownership: [
      { owner_id: OWNER_P, ownership_percentage: 60, is_primary: true },
      { owner_id: OWNER_INACTIVE, ownership_percentage: 40, is_primary: false },
    ] }, /المالك غير موجود في شركتك أو غير نشط أو مؤرشف/],
    ['soft-deleted owner fails closed', { ownership: [
      { owner_id: OWNER_P, ownership_percentage: 60, is_primary: true },
      { owner_id: OWNER_DELETED, ownership_percentage: 40, is_primary: false },
    ] }, /المالك غير موجود في شركتك أو غير نشط أو مؤرشف/],
    ['cross-company co-owner fails closed', { ownership: [
      { owner_id: OWNER_P, ownership_percentage: 60, is_primary: true },
      { owner_id: OWNER_B, ownership_percentage: 40, is_primary: false },
    ] }, /المالك غير موجود في شركتك أو غير نشط أو مؤرشف/],
    ['two primary owners fail closed', { ownership: [
      { owner_id: OWNER_P, ownership_percentage: 60, is_primary: true },
      { owner_id: OWNER_C1, ownership_percentage: 40, is_primary: true },
    ] }, /OWNERSHIP_PRIMARY_REQUIRED/],
    ['no primary owner fails closed', { ownership: [
      { owner_id: OWNER_P, ownership_percentage: 60, is_primary: false },
      { owner_id: OWNER_C1, ownership_percentage: 40, is_primary: false },
    ] }, /OWNERSHIP_PRIMARY_REQUIRED/],
    ['payload primary differs from the property owner', { ownerId: OWNER_P, ownership: [
      { owner_id: OWNER_C1, ownership_percentage: 60, is_primary: true },
      { owner_id: OWNER_P, ownership_percentage: 40, is_primary: false },
    ] }, /OWNERSHIP_PRIMARY_MISMATCH/],
    ['percentage above 100 fails closed', { ownership: [
      { owner_id: OWNER_P, ownership_percentage: 101, is_primary: true },
    ] }, /أكبر من صفر وألا تتجاوز 100/],
    ['zero percentage fails closed', { ownership: [
      { owner_id: OWNER_P, ownership_percentage: 0, is_primary: true },
    ] }, /أكبر من صفر وألا تتجاوز 100/],
    ['percentage with 5 decimals fails closed', { ownership: [
      { owner_id: OWNER_P, ownership_percentage: 99.99999, is_primary: true },
    ] }, /OWNERSHIP_PAYLOAD_INVALID/],
    ['empty ownership array fails closed', { ownership: [] }, /OWNERSHIP_PRIMARY_REQUIRED/],
  ] as const)('%s failure leaves no property/ownership/agreement/version residue', async (_name, options, pattern) => {
    await expectRollback(options, pattern);
  });

  it('malformed ownership payload (not an array) rolls back', async () => {
    // Force a non-array jsonb value through the parameterised call.
    const before = await snapshot(COMPANY_A);
    await expect(
      db.query<{ out: string | null }>(
        `select public.create_property_with_ownership_atomic(
           'عقار خاطئ', 'commercial', 'مسقط', $1::uuid,
           'property_management', 'RATE', 5.0,
           date '2026-01-01', date '2026-12-31', null, null, null, 'active', null,
           'OWNER_IS_CREDITOR', '{"owner_id":"${OWNER_P}"}'::jsonb)::text as out`,
        [OWNER_P],
      ),
    ).rejects.toThrow(/OWNERSHIP_PAYLOAD_INVALID/);
    expect(await snapshot(COMPANY_A)).toEqual(before);
  });

  it('invalid agreement window fails closed with zero residue', async () => {
    await expectRollback(
      { ownership: null, startsOn: '2026-12-31', endsOn: '2026-01-01' },
      /فترة اتفاقية التشغيل غير صحيحة/,
    );
  });

  it('invalid commission (RATE above 100) fails closed with zero residue', async () => {
    await expectRollback({ ownership: null, commissionValue: 150 }, /نسبة العمولة يجب أن تكون بين 0 و100/);
  });

  it('a failed attempt followed by a retry creates exactly one complete set', async () => {
    const before = await snapshot(COMPANY_A);

    // First attempt fails (total 90).
    await expectRollback(
      { title: 'عقار إعادة المحاولة', ownership: [
        { owner_id: OWNER_P, ownership_percentage: 60, is_primary: true },
        { owner_id: OWNER_C1, ownership_percentage: 30, is_primary: false },
      ] },
      /OWNERSHIP_TOTAL_NOT_100/,
    );

    // Retry with a corrected payload succeeds once.
    const created = await callCreate({
      title: 'عقار إعادة المحاولة',
      ownership: split60_40,
    });
    const after = await snapshot(COMPANY_A);

    expect(after.props).toBe(before.props + 1);
    expect(after.ownership).toBe(before.ownership + 2);
    expect(after.agreements).toBe(before.agreements + 1);
    expect(after.versions).toBe(before.versions + 1);

    const links = await ownershipRows(created.property_id);
    expect(links).toHaveLength(2);
    expect(Number(links[0].ownership_percentage)).toBe(60);
    expect(Number(links[1].ownership_percentage)).toBe(40);
  });

  it('an explicit transaction abort after a successful RPC call leaves no rows (single atomic unit)', async () => {
    const before = await snapshot(COMPANY_A);
    await db.exec('begin;');
    await callCreate({ title: 'عقار يُلغى بعده', ownership: split60_40 });
    const midTxn = await snapshot(COMPANY_A);
    expect(midTxn.props).toBe(before.props + 1);
    await db.exec('rollback;');
    expect(await snapshot(COMPANY_A)).toEqual(before);
  });
});

describe('authorization, isolation, and the legacy compatibility seam', () => {
  it('legacy versioned creation RPC remains a working compatibility seam', async () => {
    const before = await snapshot(COMPANY_A);
    const { rows } = await db.query<{ out: string }>(
      `select public.create_property_with_versioned_agreement_atomic(
         'عقار المسار القديم', 'commercial', 'مسقط', $1::uuid,
         'property_management', 'RATE', 5.0,
         date '2026-01-01', date '2026-12-31', null, null, null, 'active', null,
         'OWNER_IS_CREDITOR')::text as out`,
      [OWNER_P],
    );
    const result = JSON.parse(rows[0].out) as { property_id: string };
    const after = await snapshot(COMPANY_A);
    expect(after.props).toBe(before.props + 1);
    expect(after.agreements).toBe(before.agreements + 1);
    expect(after.versions).toBe(before.versions + 1);
    const links = await ownershipRows(result.property_id);
    expect(links).toHaveLength(1);
    expect(Number(links[0].ownership_percentage)).toBe(100);
    expect(links[0].is_primary).toBe(true);
  });

  it('unauthorized (anon) caller is rejected', async () => {
    await assumeIdentity(db, null, null);
    await expect(
      callCreate({ ownership: null }),
    ).rejects.toThrow(/غير مصرح/);
    await assumeIdentity(db, ADMIN_A, COMPANY_A);
  });

  it('company B cannot create a property with a company A owner', async () => {
    await assumeIdentity(db, ADMIN_B, COMPANY_B);
    const beforeB = await snapshot(COMPANY_B);
    await expect(
      callCreate({ ownerId: OWNER_P, ownership: null }),
    ).rejects.toThrow(/المالك غير موجود في شركتك أو غير نشط أو مؤرشف/);
    expect(await snapshot(COMPANY_B)).toEqual(beforeB);
    await assumeIdentity(db, ADMIN_A, COMPANY_A);
  });

  it('company A rows stay invisible to company B under RLS', async () => {
    await assumeIdentity(db, ADMIN_B, COMPANY_B);
    await db.query('SET ROLE authenticated;');
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.properties where company_id = $1::uuid`,
      [COMPANY_A],
    );
    expect(rows[0].n).toBe(0);
    await db.query('RESET ROLE;').catch(() => undefined);
    await assumeIdentity(db, ADMIN_A, COMPANY_A);
  });
});
