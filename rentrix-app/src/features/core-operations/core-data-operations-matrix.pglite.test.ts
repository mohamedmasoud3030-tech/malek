/**
 * PHASE 5 — Core data operations matrix (systematic verification).
 *
 * Per the operator's Phase 5 plan, this verifies the core operation classes
 * across the core data objects — not just one CRUD path:
 *
 *   Create / Read / Update / Persistence (refresh-reopen) / Business actions /
 *   Relationships / (Financial actions: see core-financial-operations)
 *
 * Everything runs on the full canonical migration chain (PGlite replay, real
 * RLS, real grants, real permission catalog) with PostgREST-identical
 * execution: `set local role authenticated` + real JWT claims, exact client
 * payloads from the service layer.
 *
 * This file also regression-proves the 20260912000003 ACL surface restore:
 * the direct-write spot checks below were all 42501 "permission denied for
 * table …" on the pre-fix chain (counter-proof: remove the migration and
 * they fail), while the RLS layer stays authoritative (plain-USER denial,
 * cross-company 0-row denial, maintenance raw-INSERT still blocked by the
 * restrictive(false) policy).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../../p1/replay-bootstrap';

const COMPANY_A = 'b9000000-0000-4000-8000-000000000001';
const COMPANY_B = 'b9000000-0000-4000-8000-000000000002';
const ADMIN_A = 'b9000000-0000-4000-8000-000000000011';
const ADMIN_A2 = 'b9000000-0000-4000-8000-000000000016';
const MANAGER_A = 'b9000000-0000-4000-8000-000000000012';
const USER_A = 'b9000000-0000-4000-8000-000000000013';
const MANAGER_B = 'b9000000-0000-4000-8000-000000000014';
const OWNER_A = 'b9000000-0000-4000-8000-000000000021';
const OWNER_B = 'b9000000-0000-4000-8000-000000000022';

let db: PGlite;
let propertyId = '';
let property2Id = '';
let agreementId = '';
let unitId = '';
let unit2Id = '';
let tenantId = '';
let owner2Id = '';
let contractId = '';
let leadId = '';

const ADMIN = { userId: ADMIN_A, companyId: COMPANY_A };
const MANAGER = { userId: MANAGER_A, companyId: COMPANY_A };
const USER = { userId: USER_A, companyId: COMPANY_A };
const MANAGER_B_ID = { userId: MANAGER_B, companyId: COMPANY_B };

/** PostgREST-identical execution: authenticated role + browser JWT claims. */
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

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug, is_active) values
      ('${COMPANY_A}', 'شركة المصفوفة أ', 'matrix-phase5-a', true),
      ('${COMPANY_B}', 'شركة المصفوفة ب', 'matrix-phase5-b', true);

    insert into auth.users (id, email, raw_app_meta_data) values
      ('${ADMIN_A}', 'admin.a@matrix5.test', '{\"company_id\":\"${COMPANY_A}\"}'::jsonb),
      ('${ADMIN_A2}', 'admin.a2@matrix5.test', '{\"company_id\":\"${COMPANY_A}\"}'::jsonb),
      ('${MANAGER_A}', 'manager.a@matrix5.test', '{\"company_id\":\"${COMPANY_A}\"}'::jsonb),
      ('${USER_A}', 'user.a@matrix5.test', '{\"company_id\":\"${COMPANY_A}\"}'::jsonb),
      ('${MANAGER_B}', 'manager.b@matrix5.test', '{\"company_id\":\"${COMPANY_B}\"}'::jsonb);

    insert into public.users (id, email, name, role, status, is_active) values
      ('${ADMIN_A}', 'admin.a@matrix5.test', 'مدير المصفوفة', 'ADMIN', 'ACTIVE', true),
      ('${ADMIN_A2}', 'admin.a2@matrix5.test', 'مدير المصفوفة ٢', 'ADMIN', 'ACTIVE', true),
      ('${MANAGER_A}', 'manager.a@matrix5.test', 'مشرف المصفوفة', 'MANAGER', 'ACTIVE', true),
      ('${USER_A}', 'user.a@matrix5.test', 'مستخدم المصفوفة', 'USER', 'ACTIVE', true),
      ('${MANAGER_B}', 'manager.b@matrix5.test', 'مشرف ب', 'MANAGER', 'ACTIVE', true);

    insert into public.company_members (company_id, user_id, role, is_active) values
      ('${COMPANY_A}', '${ADMIN_A}', 'ADMIN', true),
      ('${COMPANY_A}', '${ADMIN_A2}', 'ADMIN', true),
      ('${COMPANY_A}', '${MANAGER_A}', 'MANAGER', true),
      ('${COMPANY_A}', '${USER_A}', 'USER', true),
      ('${COMPANY_B}', '${MANAGER_B}', 'MANAGER', true);

    insert into public.company_settings (id, singleton_key, company_name, currency, vat_enabled, vat_rate, company_id)
    values (gen_random_uuid(), true, 'شركة المصفوفة أ', 'OMR', false, 0, '${COMPANY_A}');

    insert into public.owners (id, full_name, name, company_id) values
      ('${OWNER_A}', 'مالك المصفوفة', 'مالك المصفوفة', '${COMPANY_A}'),
      ('${OWNER_B}', 'مالك المصفوفة ب', 'مالك المصفوفة ب', '${COMPANY_A}');

    insert into public.automation_rules (name, rule_type, is_enabled, company_id)
    values ('قاعدة الفواتير المتأخرة', 'overdue_invoice', true, '${COMPANY_A}');
  `);
  await assumeIdentity(db, ADMIN_A, COMPANY_A);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('PROPERTY — core operations', () => {
  it('CREATE: create_property_with_ownership_atomic persists property + ownership + agreement + version', async () => {
    const { rows } = await db.query<{ out: string }>(
      `select public.create_property_with_ownership_atomic(
         'برج المصفوفة', 'commercial', 'مسقط', '${OWNER_A}'::uuid,
         'property_management', 'RATE', 5::numeric,
         '2026-01-01'::date, null::date,
         null, 250000::numeric, 300000::numeric, 'active', null,
         'OWNER_IS_CREDITOR',
         '[{"owner_id":"${OWNER_A}","ownership_percentage":100,"is_primary":true}]'::jsonb
       )::text as out`,
    );
    const result = JSON.parse(rows[0].out) as { property_id: string; agreement_id: string };
    propertyId = result.property_id;
    agreementId = result.agreement_id;

    const { rows: counts } = await db.query<{ p: number; o: number; a: number; v: number }>(
      `select
         (select count(*)::int from public.properties where id = $1::uuid) as p,
         (select count(*)::int from public.property_owners where property_id = $1::uuid) as o,
         (select count(*)::int from public.owner_agreements where id = $2::uuid) as a,
         (select count(*)::int from public.owner_agreement_versions v join public.owner_agreements oa on oa.id = v.owner_agreement_id where oa.id = $2::uuid) as v`,
      [propertyId, agreementId],
    );
    expect(counts[0]).toEqual({ p: 1, o: 1, a: 1, v: 1 });
  });

  it('CREATE: second (empty) property for the archive-rule matrix', async () => {
    const { rows } = await db.query<{ out: string }>(
      `select public.create_property_with_ownership_atomic(
         'عقار فارغ', 'residential', 'مسقط', '${OWNER_A}'::uuid,
         'property_management', 'RATE', 5::numeric,
         '2026-01-01'::date, null::date,
         null, null, null, 'active', null,
         'OWNER_IS_CREDITOR', null
       )::text as out`,
    );
    property2Id = (JSON.parse(rows[0].out) as { property_id: string }).property_id;
  });

  it('READ: admin sees both properties; a plain USER sees them; another company sees none', async () => {
    const admin = await asBrowser<{ n: number }>(ADMIN, 'select count(*)::int as n from public.properties where deleted_at is null');
    expect(admin[0].n).toBe(2);
    const user = await asBrowser<{ n: number }>(USER, 'select count(*)::int as n from public.properties where deleted_at is null');
    expect(user[0].n).toBe(2);
    const other = await asBrowser<{ n: number }>(MANAGER_B_ID, 'select count(*)::int as n from public.properties where deleted_at is null');
    expect(other[0].n).toBe(0);
  });

  it('UPDATE: direct PostgREST update with the exact client payload persists', async () => {
    const rows = await asBrowser<{ id: string; title: string }>(
      ADMIN,
      `update public.properties
          set title = $2, type = $3, address = $4, purchase_value = $5, current_value = $6, status = $7, notes = $8, name = $9
        where id = $1::uuid and deleted_at is null
        returning id, title`,
      [propertyId, 'برج المصفوفة — بعد التعديل', 'commercial', 'طريق الكورنيش', 260000, 310000, 'active', 'تعديل المصفوفة', 'برج المصفوفة — بعد التعديل'],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('برج المصفوفة — بعد التعديل');
  });

  it('PERSISTENCE: a fresh read after "refresh" returns the updated state', async () => {
    const rows = await asBrowser<{ title: string; notes: string; name: string; current_value: string }>(
      ADMIN,
      'select title, notes, name, current_value::text from public.properties where id = $1::uuid and deleted_at is null',
      [propertyId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: 'برج المصفوفة — بعد التعديل',
      notes: 'تعديل المصفوفة',
      name: 'برج المصفوفة — بعد التعديل',
      current_value: '310000.00',
    });
  });

  it('RELATIONSHIPS: ownership link + agreement + current version stay consistent', async () => {
    const { rows } = await db.query<{ owner: string; pct: string; primary: boolean; company: string }>(
      `select owner_id::text as owner, ownership_percentage::text as pct, is_primary as primary, company_id::text as company
         from public.property_owners where property_id = $1::uuid`,
      [propertyId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ owner: OWNER_A, pct: '100.0000', primary: true, company: COMPANY_A });

    const { rows: agr } = await db.query<{ current: string | null }>(
      'select current_version_id::text as current from public.owner_agreements where id = $1::uuid',
      [agreementId],
    );
    expect(agr[0].current).toBeTruthy();
  });
});

describe('UNIT — core operations', () => {
  it('CREATE: direct PostgREST insert with the exact client payload persists', async () => {
    const rows = await asBrowser<{ id: string; company_id: string; rent_amount: string }>(
      ADMIN,
      `insert into public.units (unit_number, floor, status, rent_amount, daily_reference_rate, notes, property_id)
       values ('C-1', '1', 'available', 450, null, null, $1::uuid)
       returning id, company_id::text, rent_amount::text`,
      [propertyId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].company_id).toBe(COMPANY_A);
    expect(rows[0].rent_amount).toBe('450.000');
    unitId = rows[0].id;
  });

  it('CREATE: second unit (no contracts) for the archive success case', async () => {
    const rows = await asBrowser<{ id: string }>(
      ADMIN,
      `insert into public.units (unit_number, floor, status, rent_amount, daily_reference_rate, notes, property_id)
       values ('C-2', '1', 'available', 400, null, null, $1::uuid) returning id`,
      [propertyId],
    );
    unit2Id = rows[0].id;
  });

  it('READ: the unit is visible to admin and USER, invisible to another company', async () => {
    const admin = await asBrowser<{ n: number }>(ADMIN, 'select count(*)::int as n from public.units where id = $1::uuid', [unitId]);
    expect(admin[0].n).toBe(1);
    const user = await asBrowser<{ n: number }>(USER, 'select count(*)::int as n from public.units where id = $1::uuid', [unitId]);
    expect(user[0].n).toBe(1);
    const other = await asBrowser<{ n: number }>(MANAGER_B_ID, 'select count(*)::int as n from public.units where id = $1::uuid', [unitId]);
    expect(other[0].n).toBe(0);
  });

  it('UPDATE: direct PostgREST update with the exact client payload persists', async () => {
    const rows = await asBrowser<{ rent_amount: string; notes: string }>(
      ADMIN,
      `update public.units
          set unit_number = $2, floor = $3, status = $4, rent_amount = $5, daily_reference_rate = $6, notes = $7
        where id = $1::uuid and deleted_at is null
        returning rent_amount::text, notes`,
      [unitId, 'C-1', '1', 'available', 475, null, 'تعديل الوحدة'],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].rent_amount).toBe('475.000');
    expect(rows[0].notes).toBe('تعديل الوحدة');
  });

  it('PERSISTENCE: fresh read returns the edited state', async () => {
    const rows = await asBrowser<{ rent_amount: string; deleted_at: string | null }>(
      ADMIN,
      'select rent_amount::text, deleted_at from public.units where id = $1::uuid',
      [unitId],
    );
    expect(rows[0]).toMatchObject({ rent_amount: '475.000', deleted_at: null });
  });

  it('BUSINESS: manual status change (available→reserved→available) persists', async () => {
    const toReserved = await asBrowser<{ status: string }>(
      ADMIN,
      `update public.units set unit_number = $2, floor = $3, status = $4, rent_amount = $5, daily_reference_rate = $6, notes = $7
        where id = $1::uuid and deleted_at is null returning status`,
      [unitId, 'C-1', '1', 'reserved', 475, null, 'تعديل الوحدة'],
    );
    expect(toReserved[0].status).toBe('reserved');
    const back = await asBrowser<{ status: string }>(
      ADMIN,
      `update public.units set unit_number = $2, floor = $3, status = $4, rent_amount = $5, daily_reference_rate = $6, notes = $7
        where id = $1::uuid and deleted_at is null returning status`,
      [unitId, 'C-1', '1', 'available', 475, null, 'تعديل الوحدة'],
    );
    expect(back[0].status).toBe('available');
  });

  it('BUSINESS: archiving a contract-free unit persists the soft delete', async () => {
    const rows = await asBrowser<{ id: string }>(
      ADMIN,
      'update public.units set deleted_at = now() where id = $1::uuid and deleted_at is null returning id',
      [unit2Id],
    );
    expect(rows).toHaveLength(1);
    const archived = await asBrowser<{ deleted_at: string | null }>(
      ADMIN,
      'select deleted_at from public.units where id = $1::uuid',
      [unit2Id],
    );
    expect(archived[0].deleted_at).toBeTruthy();
  });

  it('RELATIONSHIPS: unit belongs to the property and survives the property join', async () => {
    const { rows } = await db.query<{ property: string; unit: string }>(
      `select u.property_id::text as property, u.id::text as unit from public.units u where u.id = $1::uuid`,
      [unitId],
    );
    expect(rows[0]).toEqual({ property: propertyId, unit: unitId });
  });
});

describe('PERSON (tenant + owner) — core operations', () => {
  it('CREATE: tenant person via direct insert (exact client payload)', async () => {
    const rows = await asBrowser<{ id: string; company_id: string }>(
      ADMIN,
      `insert into public.people (full_name, type, phone, email, national_id, address, notes)
       values ('عبدالله سعيد', 'tenant', '+968 9100 0000', 'abd@example.om', null, 'مسقط', null)
       returning id, company_id::text`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].company_id).toBe(COMPANY_A);
    tenantId = rows[0].id;
  });

  it('CREATE: owner person via direct insert (exact client payload) — restored owners ACL', async () => {
    const rows = await asBrowser<{ id: string; company_id: string }>(
      ADMIN,
      `insert into public.owners (full_name, name, company_id)
       values ('مالك ثانٍ للمصفوفة', 'مالك ثانٍ للمصفوفة', $1::uuid)
       returning id, company_id::text`,
      [COMPANY_A],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].company_id).toBe(COMPANY_A);
    owner2Id = rows[0].id;
  });

  it('READ: both are visible to admin and USER, invisible to another company', async () => {
    const user = await asBrowser<{ n: number }>(USER, 'select count(*)::int as n from public.people where id = $1::uuid', [tenantId]);
    expect(user[0].n).toBe(1);
    const userOwner = await asBrowser<{ n: number }>(USER, 'select count(*)::int as n from public.owners where id = $1::uuid', [owner2Id]);
    expect(userOwner[0].n).toBe(1);
    const other = await asBrowser<{ n: number }>(MANAGER_B_ID, 'select count(*)::int as n from public.people where id = $1::uuid', [tenantId]);
    expect(other[0].n).toBe(0);
  });

  it('UPDATE: tenant edit + owner edit persist via direct updates', async () => {
    const tenant = await asBrowser<{ phone: string }>(
      ADMIN,
      `update public.people
          set full_name = $2, type = $3, phone = $4, email = $5, national_id = $6, address = $7, notes = $8
        where id = $1::uuid and deleted_at is null returning phone`,
      [tenantId, 'عبدالله سعيد', 'tenant', '+968 9200 1111', 'abd@example.om', null, 'مسقط', 'تعديل'],
    );
    expect(tenant[0].phone).toBe('+968 9200 1111');

    const owner = await asBrowser<{ full_name: string }>(
      ADMIN,
      `update public.owners set full_name = $2, name = $3 where id = $1::uuid and deleted_at is null returning full_name`,
      [owner2Id, 'مالك ثانٍ — معدّل', 'مالك ثانٍ — معدّل'],
    );
    expect(owner[0].full_name).toBe('مالك ثانٍ — معدّل');
  });

  it('PERSISTENCE: fresh reads return the edited state', async () => {
    const tenant = await asBrowser<{ phone: string; deleted_at: string | null }>(
      ADMIN,
      'select phone, deleted_at from public.people where id = $1::uuid',
      [tenantId],
    );
    expect(tenant[0]).toMatchObject({ phone: '+968 9200 1111', deleted_at: null });
    const owner = await asBrowser<{ full_name: string }>(
      ADMIN,
      'select full_name from public.owners where id = $1::uuid',
      [owner2Id],
    );
    expect(owner[0].full_name).toBe('مالك ثانٍ — معدّل');
  });

  it('BUSINESS: archiving a person persists and the active list excludes them', async () => {
    const disposable = await asBrowser<{ id: string }>(
      ADMIN,
      "insert into public.people (full_name, type, phone, email, national_id, address, notes) values ('مؤقت', 'contact', '+968 9300 2222', null, null, null, null) returning id",
    );
    const before = await asBrowser<{ n: number }>(ADMIN, 'select count(*)::int as n from public.people where deleted_at is null');
    await asBrowser(ADMIN, 'update public.people set deleted_at = now() where id = $1::uuid', [disposable[0].id]);
    const after = await asBrowser<{ n: number }>(ADMIN, 'select count(*)::int as n from public.people where deleted_at is null');
    expect(after[0].n).toBe(before[0].n - 1);
  });
});

describe('CONTRACT — core operations', () => {
  it('CREATE: create_contract_atomic_v2 (exact client payload) creates a DRAFT contract', async () => {
    const { rows } = await db.query<{ out: string }>(
      `select public.create_contract_atomic_v2(
         $1::text, $2::uuid, $3::uuid, $4::uuid,
         '2026-09-01'::date, '2027-08-31'::date, 475::numeric, 'monthly',
         null::uuid, 'draft', null, null, null, 5, 10, 'long_term', null
       )::text as out`,
      [propertyId, unitId, tenantId, agreementId],
    );
    const contract = JSON.parse(rows[0].out) as { id: string; status: string; billing_day: number; grace_days: number };
    contractId = contract.id;
    expect(contract.status).toBe('draft');
    expect(Number(contract.billing_day)).toBe(5);
    expect(Number(contract.grace_days)).toBe(10);
  });

  it('READ: the draft is visible with its full billing policy', async () => {
    const rows = await asBrowser<{ status: string; billing_day: string; lease_mode: string; rent_amount: string }>(
      ADMIN,
      `select status, billing_day::text, lease_mode, rent_amount::text from public.contracts where id = $1::uuid and deleted_at is null`,
      [contractId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'draft', billing_day: '5', lease_mode: 'long_term', rent_amount: '475.000' });
  });

  it('UPDATE: the billing policy RPC edits the DRAFT policy and it persists', async () => {
    const { rows } = await db.query<{ out: string }>(
      `select public.update_contract_billing_policy_atomic($1::text, 7, 15)::text as out`,
      [contractId],
    );
    const updated = JSON.parse(rows[0].out) as { billing_day: number; grace_days: number };
    expect(Number(updated.billing_day)).toBe(7);
    expect(Number(updated.grace_days)).toBe(15);

    const fresh = await asBrowser<{ billing_day: string; grace_days: string }>(
      ADMIN,
      'select billing_day::text, grace_days::text from public.contracts where id = $1::uuid',
      [contractId],
    );
    expect(fresh[0]).toEqual({ billing_day: '7', grace_days: '15' });
  });

  it('BUSINESS: submit (maker) → self-approve rejected → approve (checker) → activate', async () => {
    // Maker submits (status stays draft; approval sub-state goes PENDING).
    await db.query(`select public.submit_contract_for_approval_atomic($1::text, 'maker-sig-matrix5')`, [contractId]);
    const pending = await asBrowser<{ approval_status: string; status: string; maker: string }>(
      ADMIN,
      'select approval_status, status, maker_user_id::text as maker from public.contracts where id = $1::uuid',
      [contractId],
    );
    expect(pending[0]).toMatchObject({ approval_status: 'PENDING', status: 'draft', maker: ADMIN_A });

    // Maker cannot be their own checker (company has two admins → no sole-admin exception).
    await expect(
      db.query(`select public.approve_contract_atomic($1::text, 'self-sig')`, [contractId]),
    ).rejects.toThrow(/MAKER_CHECKER_MUST_BE_DISTINCT/i);

    // A distinct checker (MANAGER) approves.
    await assumeIdentity(db, MANAGER_A, COMPANY_A);
    const { rows } = await db.query<{ out: string }>(
      `select public.approve_contract_atomic($1::text, 'checker-sig-matrix5')::text as out`,
      [contractId],
    );
    const approved = JSON.parse(rows[0].out) as { status: string; checker_user_id: string };
    expect(String(approved.status).toUpperCase()).toContain('APPROVED');
    expect(String(approved.checker_user_id)).toBe(MANAGER_A);
    await assumeIdentity(db, ADMIN_A, COMPANY_A);

    // Activation flips the canonical status and freezes the agreement snapshot.
    const { rows: actRows } = await db.query<{ out: string }>(
      `select public.activate_contract_with_agreement_snapshot_atomic($1::text)::text as out`,
      [contractId],
    );
    const activated = JSON.parse(actRows[0].out) as { status: string };
    expect(String(activated.status).toLowerCase()).toBe('active');
  });

  it('PERSISTENCE: activated state + frozen snapshot survive a fresh read', async () => {
    const rows = await asBrowser<{ status: string; agreement_version: string | null; model: string | null; collection: string | null }>(
      ADMIN,
      `select status, agreement_version_id::text as agreement_version,
              operating_model_snapshot as model, collection_role_snapshot as collection
         from public.contracts where id = $1::uuid and deleted_at is null`,
      [contractId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('active');
    expect(rows[0].agreement_version).toBeTruthy();
    expect(rows[0].model).toBeTruthy();
    expect(rows[0].collection).toBeTruthy();
  });
});

describe('Business actions & relationships — cross-entity', () => {
  it('archiving a unit with contract history is blocked (23514)', async () => {
    await expect(
      asBrowser(ADMIN, 'update public.units set deleted_at = now() where id = $1::uuid and deleted_at is null returning id', [unitId]),
    ).rejects.toThrow(/UNIT_ARCHIVE_CONTRACT_HISTORY|23514/i);
  });

  it('archiving a property with active units is blocked (23514)', async () => {
    await expect(
      asBrowser(ADMIN, 'update public.properties set deleted_at = now() where id = $1::uuid and deleted_at is null returning id', [propertyId]),
    ).rejects.toThrow(/Cannot archive a property that still has non-archived units|23514/i);
  });

  it('archiving a property with an owner agreement is blocked (23514)', async () => {
    await expect(
      asBrowser(ADMIN, 'update public.properties set deleted_at = now() where id = $1::uuid and deleted_at is null returning id', [property2Id]),
    ).rejects.toThrow(/Cannot archive a property with a saved owner agreement|23514/i);
  });

  it('the contract references intact unit/tenant/property rows of the same company', async () => {
    const { rows } = await db.query<{ unit: string; tenant: string; property: string; company: string; unit_company: string | null; tenant_company: string | null }>(
      `select c.unit_id::text as unit, c.tenant_id::text as tenant, c.property_id::text as property,
              c.company_id::text as company,
              (select u.company_id::text from public.units u where u.id = c.unit_id) as unit_company,
              (select p.company_id::text from public.people p where p.id = c.tenant_id) as tenant_company
         from public.contracts c where c.id = $1::uuid`,
      [contractId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      unit: unitId, tenant: tenantId, property: propertyId,
      company: COMPANY_A, unit_company: COMPANY_A, tenant_company: COMPANY_A,
    });
  });

  it('the frozen agreement snapshot matches the agreement current version', async () => {
    const { rows } = await db.query<{ contract_v: string; current_v: string }>(
      `select c.agreement_version_id::text as contract_v, oa.current_version_id::text as current_v
         from public.contracts c join public.owner_agreements oa on oa.id = c.agreement_id
        where c.id = $1::uuid`,
      [contractId],
    );
    expect(rows[0].contract_v).toBe(rows[0].current_v);
  });

  it('a second overlapping contract on the same unit is rejected', async () => {
    const disposable = await asBrowser<{ id: string }>(
      ADMIN,
      "insert into public.people (full_name, type, phone, email, national_id, address, notes) values ('مستأجر ثانٍ', 'tenant', '+968 9400 3333', null, null, null, null) returning id",
    );
    await expect(
      db.query(
        `select public.create_contract_atomic_v2(
           $1::text, $2::uuid, $3::uuid, $4::uuid,
           '2027-01-01'::date, '2027-06-30'::date, 400::numeric, 'monthly',
           null::uuid, 'draft', null, null, null, 1, 0, 'long_term', null
         )`,
        [propertyId, unitId, disposable[0].id, agreementId],
      ),
    ).rejects.toThrow(/overlap|تداخل|OVERLAP|محجوزة|23514/i);
  });

  it('property_owners relationship: link a second owner via the direct-write path', async () => {
    // Split the empty property's ownership 60/40 through the client's edit
    // shape. The concurrent-ownership total check (≤100%) is enforced at the
    // write boundary, so the primary share is reduced first.
    const primary = await asBrowser<{ n: number }>(
      ADMIN,
      `update public.property_owners set ownership_percentage = 60
        where property_id = $1::uuid and owner_id = $2::uuid
        returning 1`,
      [property2Id, OWNER_A],
    );
    expect(primary).toHaveLength(1);

    const link = await asBrowser<{ id: string; pct: string }>(
      ADMIN,
      `insert into public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
       values ($1::uuid, $2::uuid, 40, false, '2026-01-01'::date, $3::uuid)
       returning id, ownership_percentage::text as pct`,
      [property2Id, OWNER_B, COMPANY_A],
    );
    expect(link).toHaveLength(1);
    expect(link[0].pct).toBe('40.0000');

    const total = await db.query<{ total: string }>(
      `select coalesce(sum(ownership_percentage), 0)::text as total from public.property_owners where property_id = $1::uuid`,
      [property2Id],
    );
    expect(Number(total.rows[0].total)).toBe(100);
  });
});

describe('Restored direct-write surface — 20260912000003 spot checks', () => {
  it('leads: insert with the exact client payload persists', async () => {
    const rows = await asBrowser<{ id: string; status: string }>(
      ADMIN,
      `insert into public.leads (id, name, phone, email, source, status, desired_unit_type, min_budget, max_budget, notes, company_id)
       values (gen_random_uuid(), 'عميل محتمل', '+968 9500 4444', null, 'referral', 'new', null, null, null, null, $1::uuid)
       returning id, status`,
      [COMPANY_A],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('new');
    leadId = rows[0].id;
  });

  it('lands: insert with the exact client payload persists', async () => {
    const rows = await asBrowser<{ id: string; category: string }>(
      ADMIN,
      `insert into public.lands (id, plot_no, name, location, area, owner_id, purchase_price, owner_price, commission, category, status, notes, company_id)
       values (gen_random_uuid(), 'P-100', 'قطعة المصفوفة', 'السيب', 1200, $1::uuid, 400000, 420000, 12000, 'residential', 'available', null, $2::uuid)
       returning id, category`,
      [OWNER_A, COMPANY_A],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].category).toBe('residential');
  });

  it('communication_records: insert with the exact client payload persists', async () => {
    const rows = await asBrowser<{ id: string; channel: string }>(
      ADMIN,
      `insert into public.communication_records (contact_name, contact_phone, contact_email, channel, direction, status, subject, body, related_entity_type, related_entity_id, company_id)
       values ('عبدالله سعيد', '+968 9200 1111', null, 'phone', 'outbound', 'logged', 'تذكير إيجار', 'تم الاتصال', 'person', $1::uuid, $2::uuid)
       returning id, channel`,
      [tenantId, COMPANY_A],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].channel).toBe('phone');
  });

  it('cost_centers: insert with the exact client payload persists', async () => {
    const rows = await asBrowser<{ id: string; name: string }>(
      ADMIN,
      `insert into public.cost_centers (name, parent_id, is_active, company_id)
       values ('إدارة العقارات', null, true, $1::uuid) returning id, name`,
      [COMPANY_A],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('إدارة العقارات');
  });

  it('payment_terms_templates: insert with the exact client payload persists', async () => {
    const rows = await asBrowser<{ id: string; interval_type: string }>(
      ADMIN,
      `insert into public.payment_terms_templates (name, installments, interval_type, notes, is_active)
       values ('ثلاثة أشهر', 3, 'quarterly', null, true) returning id, interval_type`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].interval_type).toBe('quarterly');
  });

  it('service_provider_categories: insert with the exact client payload persists', async () => {
    const rows = await asBrowser<{ id: string; name: string }>(
      ADMIN,
      `insert into public.service_provider_categories (name, description, is_active, company_id)
       values ('كهرباء', 'فواتير الكهرباء', true, $1::uuid) returning id, name`,
      [COMPANY_A],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('كهرباء');
  });

  it('utility_meters: insert with the exact client payload persists', async () => {
    const rows = await asBrowser<{ id: string; utility_type: string }>(
      ADMIN,
      `insert into public.utility_meters (property_id, unit_id, utility_type, meter_number, account_number, provider_name, responsible_party, is_active, notes, company_id)
       values ($1::uuid, $2::uuid, 'electricity', 'M-101', 'ACC-101', null, 'tenant', true, null, $3::uuid)
       returning id, utility_type`,
      [propertyId, unitId, COMPANY_A],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].utility_type).toBe('electricity');
  });

  it('utility_bills: insert with the exact client payload persists', async () => {
    const meters = await asBrowser<{ id: string }>(ADMIN, 'select id from public.utility_meters where meter_number = $1', ['M-101']);
    const rows = await asBrowser<{ id: string; charged_to: string; status: string }>(
      ADMIN,
      `insert into public.utility_bills (property_id, contract_id, type, amount, billing_period_start, billing_period_end, due_date,
              charged_to, actual_payer, status, reference_no, notes, meter_id, unit_id, previous_reading, current_reading,
              consumption_units, paid_amount, attachment_url, company_id)
       values ($1::uuid, null, 'meter_bill', 120, '2026-09-01'::date, '2026-09-30'::date, '2026-10-15'::date,
               'TENANT', null, 'UNPAID', null, null, $2::uuid, $3::uuid, 100, 130, 30, 0, null, $4::uuid)
       returning id, charged_to, status`,
      [propertyId, meters[0].id, unitId, COMPANY_A],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ charged_to: 'TENANT', status: 'UNPAID' });
  });

  it('vault_documents: insert with the exact client payload persists', async () => {
    const rows = await asBrowser<{ id: string; title: string }>(
      ADMIN,
      `insert into public.vault_documents (title, category, related_entity_type, related_entity_id, file_name, file_url, storage_path, file_size, mime_type, company_id)
       values ('عقد المسكن', 'contracts', 'contract', $1::uuid, 'contract.pdf', 'vault/x/contract.pdf', 'vault/x/contract.pdf', 1024, 'application/pdf', $2::uuid)
       returning id, title`,
      [contractId, COMPANY_A],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('عقد المسكن');
  });

  it('company_settings: update persists (admin-only RLS)', async () => {
    const rows = await asBrowser<{ company_name: string }>(
      ADMIN,
      `update public.company_settings set company_name = $2 where company_id = $1::uuid returning company_name`,
      [COMPANY_A, 'شركة المصفوفة أ — محدثة'],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].company_name).toBe('شركة المصفوفة أ — محدثة');
  });

  it('automation_rules: enable/disable toggle persists', async () => {
    const rows = await asBrowser<{ is_enabled: boolean }>(
      ADMIN,
      `update public.automation_rules set is_enabled = false, updated_at = now()
        where company_id = $1::uuid and rule_type = 'overdue_invoice' returning is_enabled`,
      [COMPANY_A],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].is_enabled).toBe(false);
  });

  it('maintenance_records: creation stays on the RPC boundary; metadata edit is a direct update', async () => {
    const { rows } = await db.query<{ out: string }>(
      `select public.create_maintenance_atomic(
         $1::text, null::text, 'تسريب مياه', null::text, 'medium',
         null::text, null::text, null::date, null::text,
         gen_random_uuid()::text, null::uuid, null::uuid
       )::text as out`,
      [propertyId],
    );
    const created = JSON.parse(rows[0].out) as { maintenance?: { id?: string } };
    const maintenanceId = created.maintenance?.id;
    expect(maintenanceId).toBeTruthy();

    const rows2 = await asBrowser<{ title: string }>(
      ADMIN,
      `update public.maintenance_records set title = $2 where id = $1::uuid and deleted_at is null returning title`,
      [maintenanceId, 'تسريب مياه — تم التحديد'],
    );
    expect(rows2).toHaveLength(1);
    expect(rows2[0].title).toBe('تسريب مياه — تم التحديد');
  });

  it('maintenance raw INSERT is still blocked by the restrictive(false) policy', async () => {
    await expect(
      asBrowser(
        ADMIN,
        `insert into public.maintenance_records (property_id, title, priority, status, company_id)
         values ($1::uuid, 'خام', 'low', 'open', $2::uuid) returning id`,
        [propertyId, COMPANY_A],
      ),
    ).rejects.toThrow(/row-level security|new row violates|permission denied/i);
  });

  it('plain USER cannot write the restored surface (RLS stays authoritative)', async () => {
    await expect(
      asBrowser(
        USER,
        `insert into public.leads (id, name, phone, email, source, status, desired_unit_type, min_budget, max_budget, notes, company_id)
         values (gen_random_uuid(), 'خارج الصلاحية', null, null, 'walk_in', 'new', null, null, null, null, $1::uuid) returning id`,
        [COMPANY_A],
      ),
    ).rejects.toThrow(/row-level security|new row violates|permission denied/i);
  });

  it('another company cannot mutate these rows (tenant isolation → 0 rows)', async () => {
    const rows = await asBrowser<{ id: string }>(
      MANAGER_B_ID,
      'update public.leads set notes = $2 where id = $1 returning id',
      [leadId, 'تسريب عابر'],
    );
    expect(rows).toHaveLength(0);
    const { rows: after } = await db.query<{ notes: string | null }>(
      'select notes from public.leads where id = $1',
      [leadId],
    );
    expect(after[0].notes).toBe(null);
  });

  it('ACL gate: every restored table exposes the exact intended privilege set', async () => {
    const { rows } = await db.query<{ table: string; ins: boolean; upd: boolean }>(
      `select t.t as table,
              has_table_privilege('authenticated', 'public.' || t.t, 'INSERT') as ins,
              has_table_privilege('authenticated', 'public.' || t.t, 'UPDATE') as upd
         from (values ('automation_rules'),('communication_records'),('company_settings'),('cost_centers'),
                      ('lands'),('leads'),('owners'),('payment_terms_templates'),('property_owners'),
                      ('service_provider_categories'),('utility_bills'),('utility_meters'),('vault_documents'),
                      ('maintenance_records')) as t(t)
         order by t.t`,
    );
    const byName = new Map(rows.map((r) => [r.table, r]));
    for (const name of ['automation_rules', 'communication_records', 'company_settings', 'cost_centers', 'lands', 'leads', 'owners', 'payment_terms_templates', 'property_owners', 'service_provider_categories', 'utility_bills', 'utility_meters', 'vault_documents']) {
      expect(byName.get(name), name).toEqual({ table: name, ins: true, upd: true });
    }
    // maintenance_records: UPDATE only — creation stays on the RPC boundary.
    expect(byName.get('maintenance_records')).toEqual({ table: 'maintenance_records', ins: false, upd: true });
    // No hard-delete surface anywhere in the restored set.
    for (const r of rows) {
      expect(await hasDelete(r.table), r.table).toBe(false);
    }
  });
});

async function hasDelete(table: string): Promise<boolean> {
  const { rows } = await db.query<{ d: boolean }>(
    `select has_table_privilege('authenticated', 'public.' || $1, 'DELETE') as d`,
    [table],
  );
  return rows[0].d;
}
