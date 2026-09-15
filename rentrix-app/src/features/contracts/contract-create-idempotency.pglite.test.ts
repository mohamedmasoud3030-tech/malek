/**
 * Contract creation convergence proof.
 *
 * The browser supplies one request id for a save intent. The authoritative
 * create RPC serializes that key, fingerprints every command field, and stores
 * the returned contract in the shared idempotency ledger.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../../p1/replay-bootstrap';

const COMPANY = 'c9000000-0000-4000-8000-000000000001';
const ADMIN = 'c9000000-0000-4000-8000-000000000011';
const OWNER = 'c9000000-0000-4000-8000-000000000021';
const PROPERTY = 'c9000000-0000-4000-8000-000000000031';
const UNIT = 'c9000000-0000-4000-8000-000000000041';
const LEGACY_UNIT = 'c9000000-0000-4000-8000-000000000042';
const TENANT = 'c9000000-0000-4000-8000-000000000051';
const LEGACY_TENANT = 'c9000000-0000-4000-8000-000000000052';
const AGREEMENT = 'c9000000-0000-4000-8000-000000000061';
const REQUEST = 'contract-create-retry-001';

let db: PGlite;

async function create(requestId: string, rent = 500) {
  const { rows } = await db.query<{ out: Record<string, unknown> }>(
    `select public.create_contract_atomic_v2(
       $1::text, $2::uuid, $3::uuid, $4::uuid,
       date '2026-10-01', date '2027-09-30', $5::numeric,
       'monthly', null, 'draft', null, 'idempotency journey', null,
       1, 0, 'long_term', null, $6::text) as out`,
    [PROPERTY, UNIT, TENANT, AGREEMENT, rent, requestId],
  );
  return rows[0]?.out;
}

async function createLegacy() {
  const { rows } = await db.query<{ out: Record<string, unknown> }>(
    `select public.create_contract_atomic(
       $1::text, $2::uuid, $3::uuid, $4::uuid,
       date '2028-01-01', date '2028-12-31', 600,
       'monthly', null, 'draft', null, 'legacy retry', null, 1, 0) as out`,
    [PROPERTY, LEGACY_UNIT, LEGACY_TENANT, AGREEMENT],
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
    insert into public.companies (id, name, slug, is_active)
      values ('${COMPANY}', 'عقود التكرار', 'contract-idempotency', true);
    insert into auth.users (id, email, raw_app_meta_data)
      values ('${ADMIN}', 'admin@contract-idempotency.test', '{"company_id":"${COMPANY}"}'::jsonb);
    insert into public.users (id, email, name, role, status, is_active)
      values ('${ADMIN}', 'admin@contract-idempotency.test', 'مدير', 'ADMIN', 'ACTIVE', true);
    insert into public.company_members (company_id, user_id, role, is_active)
      values ('${COMPANY}', '${ADMIN}', 'ADMIN', true);
    insert into public.owners (id, full_name, name, company_id)
      values ('${OWNER}', 'مالك عقود التكرار', 'مالك عقود التكرار', '${COMPANY}');
    insert into public.properties (id, title, name, type, address, status, company_id)
      values ('${PROPERTY}', 'عقار عقود التكرار', 'عقار عقود التكرار', 'residential', 'مسقط', 'active', '${COMPANY}');
    insert into public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
      values ('${PROPERTY}', '${OWNER}', 100, true, date '2020-01-01', '${COMPANY}');
    insert into public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id)
      values ('${AGREEMENT}', '${OWNER}', '${PROPERTY}', 'property_management', 'RATE', 5, date '2020-01-01', '${COMPANY}');
    insert into public.units (id, property_id, name, unit_number, status, rent_amount, company_id)
      values
        ('${UNIT}', '${PROPERTY}', 'I-1', 'I-1', 'available', 500, '${COMPANY}'),
        ('${LEGACY_UNIT}', '${PROPERTY}', 'I-2', 'I-2', 'available', 500, '${COMPANY}');
    insert into public.people (id, full_name, type, company_id)
      values
        ('${TENANT}', 'مستأجر عقود التكرار', 'tenant', '${COMPANY}'),
        ('${LEGACY_TENANT}', 'مستأجر استدعاء قديم', 'tenant', '${COMPANY}');
  `);
  await assumeIdentity(db, ADMIN, COMPANY);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('create_contract_atomic_v2 idempotency and concurrency boundary', () => {
  it('returns the same contract on a retry and records only one live draft', async () => {
    const first = await create(REQUEST);
    const second = await create(REQUEST);

    expect(first?.id).toBeTruthy();
    expect(second?.id).toBe(first?.id);
    expect(first?.idempotent).toBe(false);
    expect(second?.idempotent).toBe(true);

    const { rows } = await db.query<{ count: number; idempotency_count: number }>(
      `select
         (select count(*)::int from public.contracts where company_id = $1::uuid and deleted_at is null) as count,
         (select count(*)::int from public.financial_operation_idempotency
           where operation_name = 'create_contract_atomic_v2:' || $1::text
             and request_id = $2) as idempotency_count`,
      [COMPANY, REQUEST],
    );
    expect(rows[0].count).toBe(1);
    expect(rows[0].idempotency_count).toBe(1);
  });

  it('rejects reuse of a request id for a different command payload', async () => {
    const error = await errorOf(() => create(REQUEST, 700));
    expect(error).toMatch(/CONTRACT_CREATE_IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST/i);

    const { rows } = await db.query<{ count: number }>(
      `select count(*)::int as count from public.contracts where company_id = $1::uuid and deleted_at is null`,
      [COMPANY],
    );
    expect(rows[0].count).toBe(1);
  });

  it('keeps overlap and self-conflict exclusion behind the same unit lock', async () => {
    const error = await errorOf(() => create('contract-create-overlap-002'));
    expect(error).toMatch(/الوحدة محجوزة خلال هذه الفترة|duplicate key/i);
  });

  it('makes the preserved legacy create signature deterministic and idempotent', async () => {
    const first = await createLegacy();
    const retry = await createLegacy();

    expect(first?.id).toBeTruthy();
    expect(retry?.id).toBe(first?.id);
    expect(first?.idempotent).toBe(false);
    expect(retry?.idempotent).toBe(true);
  });
});
