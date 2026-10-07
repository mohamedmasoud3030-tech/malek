/**
 * soft_delete_contract_atomic — runtime RPC regression contract.
 *
 * Proves the canonicalization fix (migration 00022): the public RPC keeps its
 * text signature, but internally normalizes the id to uuid so every uuid
 * comparison works. Also pins the authorization / company-scope / input-
 * validation contract so the RPC can never regress to "operator does not
 * exist: uuid = text" again.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../../p1/replay-bootstrap';

const COMPANY_A = 'f5000000-0000-4000-8000-00000000000a';
const COMPANY_B = 'f5000000-0000-4000-8000-00000000000b';
const ADMIN_A = 'f5000000-0000-4000-8000-000000000011';
const USER_A = 'f5000000-0000-4000-8000-000000000012';
const ADMIN_B = 'f5000000-0000-4000-8000-000000000013';
const OWNER = 'f5000000-0000-4000-8000-000000000021';
const PROPERTY = 'f5000000-0000-4000-8000-000000000031';
const UNIT = 'f5000000-0000-4000-8000-000000000041';
const TENANT = 'f5000000-0000-4000-8000-000000000051';
const AGREEMENT = 'f5000000-0000-4000-8000-000000000061';
const CONTRACT = 'f5000000-0000-4000-8000-000000000071';

let db: PGlite;

async function softDelete(contractId: string) {
  const { rows } = await db.query<{ out: any }>(
    `select public.soft_delete_contract_atomic($1::text) as out`,
    [contractId],
  );
  return rows[0]?.out;
}

async function errorOf(operation: () => Promise<unknown>) {
  try {
    await operation();
  } catch (error) {
    return String((error as { message?: string }).message ?? error);
  }
  throw new Error('Expected operation to fail');
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug) values
      ('${COMPANY_A}', 'SoftDelete A', 'soft-delete-a'),
      ('${COMPANY_B}', 'SoftDelete B', 'soft-delete-b');
    insert into auth.users (id, email) values
      ('${ADMIN_A}', 'admin.a@softdelete.test'),
      ('${USER_A}', 'user.a@softdelete.test'),
      ('${ADMIN_B}', 'admin.b@softdelete.test');
    insert into public.users (id, email, name, role, status, is_active) values
      ('${ADMIN_A}', 'admin.a@softdelete.test', 'Admin A', 'ADMIN', 'ACTIVE', true),
      ('${USER_A}', 'user.a@softdelete.test', 'User A', 'USER', 'ACTIVE', true),
      ('${ADMIN_B}', 'admin.b@softdelete.test', 'Admin B', 'ADMIN', 'ACTIVE', true);
    insert into public.company_members (company_id, user_id, role) values
      ('${COMPANY_A}', '${ADMIN_A}', 'ADMIN'),
      ('${COMPANY_A}', '${USER_A}', 'USER'),
      ('${COMPANY_B}', '${ADMIN_B}', 'ADMIN');
    insert into public.owners (id, full_name, name, company_id)
      values ('${OWNER}', 'SoftDelete Owner', 'SoftDelete Owner', '${COMPANY_A}');
    insert into public.properties (id, title, name, type, address, status, company_id)
      values ('${PROPERTY}', 'SoftDelete Property', 'SoftDelete Property', 'residential', 'Sohar', 'active', '${COMPANY_A}');
    insert into public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
      values ('${PROPERTY}', '${OWNER}', 100, true, date '2020-01-01', '${COMPANY_A}');
    insert into public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id)
      values ('${AGREEMENT}', '${OWNER}', '${PROPERTY}', 'property_management', 'RATE', 5, date '2020-01-01', '${COMPANY_A}');
    insert into public.units (id, property_id, name, unit_number, status, rent_amount, company_id)
      values ('${UNIT}', '${PROPERTY}', 'SD-1', 'SD-1', 'available', 500, '${COMPANY_A}');
    insert into public.people (id, full_name, type, company_id)
      values ('${TENANT}', 'SoftDelete Tenant', 'tenant', '${COMPANY_A}');
    insert into public.contracts
      (id, property_id, unit_id, tenant_id, agreement_id, start_date, end_date, rent_amount, payment_cycle, status, company_id)
    values ('${CONTRACT}', '${PROPERTY}', '${UNIT}', '${TENANT}', '${AGREEMENT}', date '2026-01-01', date '2026-12-31', 500, 'monthly', 'draft', '${COMPANY_A}');
  `);
});

afterAll(async () => {
  await db?.close();
});

describe('soft_delete_contract_atomic runtime RPC contract', () => {
  it('soft-deletes a valid contract by text uuid as an admin', async () => {
    await assumeIdentity(db, ADMIN_A, COMPANY_A);
    const out = await softDelete(CONTRACT);
    expect(out.status).toBe('deleted');
    expect(out.contract_id).toBe(CONTRACT);

    const { rows } = await db.query<{ deleted: boolean }>(
      `select deleted_at is not null as deleted from public.contracts where id::text = $1`,
      [CONTRACT],
    );
    expect(rows[0].deleted).toBe(true);
  });

  it('reports a nonexistent contract as not found', async () => {
    await assumeIdentity(db, ADMIN_A, COMPANY_A);
    const error = await errorOf(() => softDelete('f5000000-0000-4000-8000-0000000000ff'));
    expect(error).toMatch(/العقد غير موجود/);
  });

  it('fails cleanly on malformed uuid input', async () => {
    await assumeIdentity(db, ADMIN_A, COMPANY_A);
    const error = await errorOf(() => softDelete('not-a-uuid'));
    expect(error).toMatch(/invalid input syntax for type uuid|22P02/);
  });

  it('treats empty input as not found (matches sibling RPC semantics)', async () => {
    await assumeIdentity(db, ADMIN_A, COMPANY_A);
    const error = await errorOf(() => softDelete(''));
    expect(error).toMatch(/العقد غير موجود/);
  });

  it('denies a plain USER member', async () => {
    await assumeIdentity(db, USER_A, COMPANY_A);
    const error = await errorOf(() => softDelete(CONTRACT));
    expect(error).toMatch(/غير مصرح|42501/);
  });

  it('keeps company isolation: an admin of another company cannot see the contract', async () => {
    await assumeIdentity(db, ADMIN_B, COMPANY_B);
    const error = await errorOf(() => softDelete(CONTRACT));
    expect(error).toMatch(/العقد غير موجود/);
  });

  it('stays idempotent: deleting an already-deleted contract is not found', async () => {
    await assumeIdentity(db, ADMIN_A, COMPANY_A);
    const error = await errorOf(() => softDelete(CONTRACT));
    expect(error).toMatch(/العقد غير موجود/);
  });
});
