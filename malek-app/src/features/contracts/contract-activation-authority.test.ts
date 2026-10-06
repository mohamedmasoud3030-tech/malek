import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '@/p1/replay-bootstrap';

const COMPANY = 'c41b0000-0000-4000-8000-000000000001';
const MAKER = 'a41b0000-0000-4000-8000-000000000001';
const CHECKER = 'a41b0000-0000-4000-8000-000000000002';
const OWNER = 'b41b0000-0000-4000-8000-000000000001';
const PROPERTY = 'd41b0000-0000-4000-8000-000000000001';
const UNIT1 = 'e41b0000-0000-4000-8000-000000000001';
const UNIT2 = 'e41b0000-0000-4000-8000-000000000002';
const UNIT3 = 'e41b0000-0000-4000-8000-000000000003';
const TENANT1 = 'f41b0000-0000-4000-8000-000000000001';
const TENANT2 = 'f41b0000-0000-4000-8000-000000000002';
const TENANT3 = 'f41b0000-0000-4000-8000-000000000003';
const AGREEMENT = 'aa41b000-0000-4000-8000-000000000001';
const VERSION = 'ab41b000-0000-4000-8000-000000000001';

let db: PGlite;

async function rpc(sql: string) {
  const { rows } = await db.query<{ r: unknown }>(sql);
  return rows[0]?.r;
}

const createContract = (unit: string, tenant: string, status: string, notes: string) =>
  rpc(`select public.create_contract_atomic(
    '${PROPERTY}', '${unit}', '${tenant}', '${AGREEMENT}',
    date '2026-10-01', date '2027-09-30', 1000, 'monthly', null,
    '${status}', null, '${notes}', null) as r`);

const contractId = (notes: string) =>
  db.query<{ id: string }>(`select id::text as id from public.contracts where notes = '${notes}'`).then((r) => r.rows[0].id);

const updateContract = (notes: string, rent: number, status: string, newNotes: string) =>
  rpc(`select public.update_contract_atomic(
    (select id::text from public.contracts where notes = '${notes}'),
    '${PROPERTY}', '${UNIT1}', '${TENANT1}', '${AGREEMENT}',
    date '2026-10-01', date '2027-09-30', ${rent}, 'monthly', null,
    '${status}', null, '${newNotes}', null) as r`);

describe('WP-03 GAP-004 contract activation authority (PGlite behavioral)', () => {
  beforeAll(async () => {
    const replay = await createFullReplayedDatabase({ writeEvidence: false });
    expect(replay.failed).toEqual([]);
    db = replay.db;

    await db.exec(`
      insert into public.companies (id, name, slug) values
        ('${COMPANY}', 'GAP004 Co', 'gap004');

      insert into auth.users (id, email) values
        ('${MAKER}', 'gap004-maker@test.invalid'),
        ('${CHECKER}', 'gap004-checker@test.invalid');

      insert into public.users (id, email, name, role, status, is_active) values
        ('${MAKER}', 'gap004-maker@test.invalid', 'Maker', 'ADMIN', 'ACTIVE', true),
        ('${CHECKER}', 'gap004-checker@test.invalid', 'Checker', 'MANAGER', 'ACTIVE', true);

      insert into public.company_members (company_id, user_id, role) values
        ('${COMPANY}', '${MAKER}', 'ADMIN'),
        ('${COMPANY}', '${CHECKER}', 'ADMIN');

      insert into public.owners (id, full_name, name, company_id) values
        ('${OWNER}', 'Owner', 'Owner', '${COMPANY}');

      insert into public.properties (id, title, name, type, address, company_id) values
        ('${PROPERTY}', 'Property', 'Property', 'residential', 'Sohar', '${COMPANY}');

      insert into public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, ends_on, company_id) values
        ('${PROPERTY}', '${OWNER}', 100, true, date '2026-01-01', date '2027-12-31', '${COMPANY}');

      insert into public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, ends_on, company_id) values
        ('${AGREEMENT}', '${OWNER}', '${PROPERTY}', 'property_management', 'RATE', 5, date '2026-01-01', date '2027-12-31', '${COMPANY}');

      insert into public.owner_agreement_versions (id, owner_agreement_id, company_id, version_no, operating_model, collection_role, commission_type, commission_value, commission_recognition_basis, effective_from, effective_to) values
        ('${VERSION}', '${AGREEMENT}', '${COMPANY}', 1, 'OWNER_AGENCY', 'OWNER_IS_CREDITOR', 'RATE', 5, 'ON_COLLECTION', date '2026-01-01', date '2027-12-31');

      update public.owner_agreements set current_version_id = '${VERSION}' where id = '${AGREEMENT}';

      insert into public.units (id, property_id, name, unit_number, company_id) values
        ('${UNIT1}', '${PROPERTY}', 'Unit 1', 'U-1', '${COMPANY}'),
        ('${UNIT2}', '${PROPERTY}', 'Unit 2', 'U-2', '${COMPANY}'),
        ('${UNIT3}', '${PROPERTY}', 'Unit 3', 'U-3', '${COMPANY}');

      insert into public.people (id, full_name, type, company_id) values
        ('${TENANT1}', 'Tenant 1', 'tenant', '${COMPANY}'),
        ('${TENANT2}', 'Tenant 2', 'tenant', '${COMPANY}'),
        ('${TENANT3}', 'Tenant 3', 'tenant', '${COMPANY}');
    `);
  }, 420_000);

  afterAll(async () => {
    await db?.close();
  });

  it('rejects creating a contract in a non-draft status', async () => {
    await assumeIdentity(db, MAKER, COMPANY);
    await expect(createContract(UNIT1, TENANT1, 'active', 'gap004-c1')).rejects.toThrow(/CONTRACT_CREATE_MUST_BE_DRAFT/i);
  });

  it('allows draft creation and freezes the snapshot only at activation', async () => {
    await assumeIdentity(db, MAKER, COMPANY);
    await createContract(UNIT1, TENANT1, 'draft', 'gap004-c1');
    const id = await contractId('gap004-c1');

    await rpc(`select public.submit_contract_for_approval_atomic('${id}', 'maker-sig') as r`);
    await assumeIdentity(db, CHECKER, COMPANY);
    await rpc(`select public.approve_contract_atomic('${id}', 'checker-sig') as r`);
    await rpc(`select public.activate_contract_with_agreement_snapshot_atomic('${id}') as r`);

    const row = await db.query<{ status: string; version: string }>(
      `select status, agreement_version_id::text as version from public.contracts where id = '${id}'`,
    );
    expect(row.rows[0].status).toBe('active');
    expect(row.rows[0].version).toBe(VERSION);
  });

  it('rejects self-approval: the maker cannot approve their own submission', async () => {
    await assumeIdentity(db, MAKER, COMPANY);
    // Non-overlapping period on UNIT1 (existing contracts cover 2026-10-01+).
    await rpc(`select public.create_contract_atomic(
      '${PROPERTY}', '${UNIT1}', '${TENANT2}', '${AGREEMENT}',
      date '2026-01-15', date '2026-09-15', 900, 'monthly', null,
      'draft', null, 'gap004-self-approval', null) as r`);
    const id = await contractId('gap004-self-approval');
    await rpc(`select public.submit_contract_for_approval_atomic('${id}', 'maker-sig-self') as r`);

    await expect(
      rpc(`select public.approve_contract_atomic('${id}', 'maker-tries-checker-sig') as r`),
    ).rejects.toThrow(/MAKER_CHECKER_MUST_BE_DISTINCT/i);

    const row = await db.query<{ approval_status: string | null }>(
      `select approval_status from public.contracts where id = '${id}'`,
    );
    expect(row.rows[0].approval_status).toBe('PENDING');
  });

  it('rejects commercial edits and status changes on an active contract', async () => {
    await assumeIdentity(db, CHECKER, COMPANY);
    await expect(updateContract('gap004-c1', 1500, 'active', 'gap004-c1')).rejects.toThrow(/CONTRACT_SIGNED_TERMS_IMMUTABLE/i);
    await expect(updateContract('gap004-c1', 1000, 'draft', 'gap004-c1')).rejects.toThrow(/CONTRACT_ACTIVE_STATUS_IMMUTABLE/i);
  });

  it('allows non-commercial edits on an active contract', async () => {
    await assumeIdentity(db, CHECKER, COMPANY);
    await updateContract('gap004-c1', 1000, 'active', 'gap004-c1-notes');
    const row = await db.query<{ notes: string }>(
      `select notes from public.contracts where notes = 'gap004-c1-notes'`,
    );
    expect(row.rows.length).toBe(1);
  });

  it('rejects commercial edits on an APPROVED draft', async () => {
    await assumeIdentity(db, MAKER, COMPANY);
    await createContract(UNIT2, TENANT2, 'draft', 'gap004-c2');
    const id = await contractId('gap004-c2');
    await rpc(`select public.submit_contract_for_approval_atomic('${id}', 'maker-sig-2') as r`);
    await assumeIdentity(db, CHECKER, COMPANY);
    await rpc(`select public.approve_contract_atomic('${id}', 'checker-sig-2') as r`);

    await expect(
      rpc(`select public.update_contract_atomic(
        '${id}', '${PROPERTY}', '${UNIT2}', '${TENANT2}', '${AGREEMENT}',
        date '2026-10-01', date '2027-09-30', 900, 'monthly', null,
        'draft', null, 'gap004-c2', null) as r`),
    ).rejects.toThrow(/CONTRACT_APPROVED_TERMS_IMMUTABLE/i);
  });

  it('keeps a fresh draft editable and rejects direct activation', async () => {
    await assumeIdentity(db, MAKER, COMPANY);
    await createContract(UNIT3, TENANT3, 'draft', 'gap004-c3');
    const id = await contractId('gap004-c3');

    await rpc(`select public.update_contract_atomic(
      '${id}', '${PROPERTY}', '${UNIT3}', '${TENANT3}', '${AGREEMENT}',
      date '2026-10-01', date '2027-09-30', 750, 'monthly', null,
      'draft', null, 'gap004-c3', null) as r`);

    await expect(
      rpc(`select public.update_contract_atomic(
        '${id}', '${PROPERTY}', '${UNIT3}', '${TENANT3}', '${AGREEMENT}',
        date '2026-10-01', date '2027-09-30', 750, 'monthly', null,
        'active', null, 'gap004-c3', null) as r`),
    ).rejects.toThrow(/CONTRACT_ACTIVATION_VIA_RPC/i);

    const row = await db.query<{ status: string }>(`select status from public.contracts where id = '${id}'`);
    expect(row.rows[0].status).toBe('draft');
  });
});
