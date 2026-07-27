import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '@/p1/replay-bootstrap';
import {
  ADMIN_A,
  AGREEMENT_A,
  COMPANY_A,
  CONTRACT_A,
  CONTRACT_B,
  PROPERTY_A,
  PROPERTY_B,
  TENANT_A,
  UNIT_A,
  UNIT_B,
  seedPhase3a1bFixture,
} from '@/p3/phase3a1b-fixture';

let db: PGlite;

describe('contract workflow invariants migration execution', () => {
  beforeAll(async () => {
    const replay = await createFullReplayedDatabase({ writeEvidence: false });
    expect(replay.failed).toEqual([]);
    db = replay.db;
    await seedPhase3a1bFixture(db);
    await assumeIdentity(db, ADMIN_A, COMPANY_A);
  }, 420_000);

  afterAll(async () => {
    await db?.close();
  });

  it('rejects direct contract rewiring across the property/company boundary', async () => {
    await expect(db.query(
      `update public.contracts
       set property_id = $1, unit_id = $2::uuid
       where id = $3`,
      [PROPERTY_B, UNIT_B, CONTRACT_A],
    )).rejects.toThrow(/property|company/i);
  });

  it('does not reveal another company contract through update_contract_atomic', async () => {
    await expect(db.query(
      `select public.update_contract_atomic(
        $1, $2, $3::uuid, $4::uuid, $5::uuid,
        date '2026-01-01', date '2026-12-31', 700,
        'monthly', null, 'active', null, null, null
      )`,
      [CONTRACT_B, PROPERTY_B, UNIT_B, TENANT_A, AGREEMENT_A],
    )).rejects.toThrow(/العقد غير موجود/);
  });

  it('rejects an operational contract when its property is inactive', async () => {
    await db.query(
      `update public.contracts
       set status = 'expired'
       where id = $1`,
      [CONTRACT_A],
    );
    await db.query(
      `update public.properties
       set status = 'inactive'
       where id = $1::uuid`,
      [PROPERTY_A],
    );

    await expect(db.query(
      `update public.contracts
       set status = 'active'
       where id = $1`,
      [CONTRACT_A],
    )).rejects.toThrow(/property must be live/i);
  });

  it('allows a valid same-company update and returns only that contract', async () => {
    await db.query(
      `update public.properties
       set status = 'active'
       where id = $1::uuid`,
      [PROPERTY_A],
    );

    const { rows } = await db.query<{ result: { id: string; company_id: string; rent_amount: number } }>(
      `select public.update_contract_atomic(
        $1, $2, $3::uuid, $4::uuid, $5::uuid,
        date '2026-01-01', date '2026-12-31', 1100,
        'monthly', null, 'active', null, 'validated', null
      ) as result`,
      [CONTRACT_A, PROPERTY_A, UNIT_A, TENANT_A, AGREEMENT_A],
    );

    expect(rows[0].result).toMatchObject({
      id: CONTRACT_A,
      company_id: COMPANY_A,
      rent_amount: 1100,
    });
  });
});
