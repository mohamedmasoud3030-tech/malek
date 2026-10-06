import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createFullReplayedDatabase } from '@/p1/replay-bootstrap';

let db: PGlite;

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe('company settings database defaults', () => {
  it('uses MALEK as the default company name on fresh rows', async () => {
    const result = await db.query<{ column_default: string }>(`
      SELECT column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'company_settings'
        AND column_name = 'company_name'
    `);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.column_default).toBe("'MALEK'::text");
  });
});
