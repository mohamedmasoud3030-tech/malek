import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const migration = readFileSync(
  `${repoRoot}supabase/migrations/20260715000003_purge_qa_journal_entries_residuals.sql`,
  'utf8',
);

describe('QA journal residual purge migration execution', () => {
  let db: PGlite;

  beforeEach(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE TABLE journal_entries (
        id uuid PRIMARY KEY, no text, source_id uuid, entity_id text,
        type text, amount numeric
      )
    `);
  });

  afterEach(async () => {
    await db.close();
  });

  it('is an idempotent no-op when the QA residuals are absent', async () => {
    await expect(db.exec(migration)).resolves.toBeDefined();
  });

  it('deletes exactly the validated debit and credit pair', async () => {
    await db.exec(`
      INSERT INTO journal_entries VALUES
        ('00000000-0000-4000-8000-000000000001', 'PAY-testqapaymen-D',
         'cef11264-fcb2-4f29-81c5-0b0b99e156a4', 'b81853ee-b305-43f8-a7bc-39aed420781a', 'DEBIT', 150),
        ('00000000-0000-4000-8000-000000000002', 'PAY-testqapaymen-C',
         'cef11264-fcb2-4f29-81c5-0b0b99e156a4', 'b81853ee-b305-43f8-a7bc-39aed420781a', 'CREDIT', 150)
    `);

    await db.exec(migration);

    const rows = await db.query<{ count: number }>(
      'SELECT count(*)::integer AS count FROM journal_entries',
    );
    expect(rows.rows[0]?.count).toBe(0);
  });

  it('fails closed without deleting a partial target pair', async () => {
    await db.exec(`
      INSERT INTO journal_entries VALUES
        ('00000000-0000-4000-8000-000000000003', 'PAY-testqapaymen-D',
         'cef11264-fcb2-4f29-81c5-0b0b99e156a4', 'b81853ee-b305-43f8-a7bc-39aed420781a', 'DEBIT', 150)
    `);

    await expect(db.exec(migration)).rejects.toThrow('Expected either 0 or exactly 2 rows');
    await db.exec('ROLLBACK');

    const rows = await db.query<{ count: number }>(
      'SELECT count(*)::integer AS count FROM journal_entries',
    );
    expect(rows.rows[0]?.count).toBe(1);
  });
});
