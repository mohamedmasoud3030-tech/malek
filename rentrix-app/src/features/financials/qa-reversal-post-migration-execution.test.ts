import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const migration = readFileSync(
  `${repoRoot}supabase/migrations/20260715000005_post_qa_reversal_entries.sql`,
  'utf8',
);

describe('QA reversal posting migration execution', () => {
  let db: PGlite;

  beforeEach(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE TABLE journal_entries (
        id uuid PRIMARY KEY, no text, source_id uuid, entity_id text,
        status text, type text, amount numeric,
        created_at timestamptz, updated_at timestamptz
      );
      CREATE TABLE audit_log (
        id uuid PRIMARY KEY, ts bigint, user_id uuid, username text, action text,
        entity text, entity_id text, note text, "table" text, details text,
        created_at timestamptz, updated_at timestamptz
      );
    `);
  });

  afterEach(async () => {
    await db.close();
  });

  it('is an idempotent no-op when the complete QA graph is absent', async () => {
    await expect(db.exec(migration)).resolves.toBeDefined();
  });

  it('posts the exact balanced reversal pair and writes an audit row', async () => {
    await db.exec(`
      INSERT INTO journal_entries VALUES
        ('00000000-0000-4000-8000-000000000001', 'PAY-testqapaymen-D', 'cef11264-fcb2-4f29-81c5-0b0b99e156a4', 'b81853ee-b305-43f8-a7bc-39aed420781a', 'posted', 'DEBIT', 150, now(), now()),
        ('00000000-0000-4000-8000-000000000002', 'PAY-testqapaymen-C', 'cef11264-fcb2-4f29-81c5-0b0b99e156a4', 'b81853ee-b305-43f8-a7bc-39aed420781a', 'posted', 'CREDIT', 150, now(), now()),
        ('00000000-0000-4000-8000-000000000003', 'REV-QA-PAY-testqapaymen-D', 'cef11264-fcb2-4f29-81c5-0b0b99e156a4', 'b81853ee-b305-43f8-a7bc-39aed420781a', 'draft', 'CREDIT', 150, NULL, NULL),
        ('00000000-0000-4000-8000-000000000004', 'REV-QA-PAY-testqapaymen-C', 'cef11264-fcb2-4f29-81c5-0b0b99e156a4', 'b81853ee-b305-43f8-a7bc-39aed420781a', 'draft', 'DEBIT', 150, NULL, NULL)
    `);

    await db.exec(migration);

    const result = await db.query<{ posted: number; audits: number }>(`
      SELECT
        (SELECT count(*)::integer FROM journal_entries WHERE status = 'posted') AS posted,
        (SELECT count(*)::integer FROM audit_log) AS audits
    `);
    expect(result.rows).toEqual([{ posted: 4, audits: 1 }]);
  });

  it('fails closed on a partial QA graph', async () => {
    await db.exec(`
      INSERT INTO journal_entries VALUES
        ('00000000-0000-4000-8000-000000000005', 'PAY-testqapaymen-D', 'cef11264-fcb2-4f29-81c5-0b0b99e156a4', 'b81853ee-b305-43f8-a7bc-39aed420781a', 'posted', 'DEBIT', 150, now(), now())
    `);

    await expect(db.exec(migration)).rejects.toThrow('expected either 0 or exactly 4');
    await db.exec('ROLLBACK');
    const rows = await db.query<{ count: number }>(
      'SELECT count(*)::integer AS count FROM journal_entries',
    );
    expect(rows.rows[0]?.count).toBe(1);
  });
});
