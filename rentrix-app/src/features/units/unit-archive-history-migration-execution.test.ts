import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createFullReplayedDatabase } from '@/p1/replay-bootstrap';
import {
  COMPANY_A,
  PROPERTY_A,
  UNIT_A,
  seedPhase3a1bFixture,
} from '@/p3/phase3a1b-fixture';

let db: PGlite;

describe('unit archive history migration execution', () => {
  beforeAll(async () => {
    const replay = await createFullReplayedDatabase({ writeEvidence: false });
    expect(replay.failed).toEqual([]);
    db = replay.db;
    await seedPhase3a1bFixture(db);
  }, 420_000);

  afterAll(async () => {
    await db?.close();
  });

  it('rejects direct archive when any contract history references the unit', async () => {
    await expect(db.query(
      'update public.units set deleted_at = now() where id = $1::uuid',
      [UNIT_A],
    )).rejects.toThrow(/contract history/);
  });

  it('rejects direct archive while unit maintenance is open', async () => {
    const unitId = 'e31b0000-0000-4000-8000-000000000011';
    await db.query(
      `insert into public.units (id, property_id, name, unit_number, company_id)
       values ($1::uuid, $2::uuid, 'Maintenance unit', 'A-11', $3::uuid)`,
      [unitId, PROPERTY_A, COMPANY_A],
    );
    await db.query(
      `insert into public.maintenance_records
        (id, property_id, unit_id, title, status, company_id)
       values
        (gen_random_uuid(), $1::uuid, $2::uuid, 'Open work', 'open', $3::uuid)`,
      [PROPERTY_A, unitId, COMPANY_A],
    );

    await expect(db.query(
      'update public.units set deleted_at = now() where id = $1::uuid',
      [unitId],
    )).rejects.toThrow(/maintenance is open/);
  });

  it('allows archiving an unused unit with no history or open maintenance', async () => {
    const unitId = 'e31b0000-0000-4000-8000-000000000012';
    await db.query(
      `insert into public.units (id, property_id, name, unit_number, company_id)
       values ($1::uuid, $2::uuid, 'Unused unit', 'A-12', $3::uuid)`,
      [unitId, PROPERTY_A, COMPANY_A],
    );

    const { rows } = await db.query<{ archived: boolean }>(
      `update public.units
       set deleted_at = now()
       where id = $1::uuid
       returning deleted_at is not null as archived`,
      [unitId],
    );

    expect(rows[0].archived).toBe(true);
  });
});
