import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const migration = readFileSync(
  `${repoRoot}supabase/migrations/20260714000006_fix_rpt_financial_summary_status.sql`,
  'utf8',
);

describe('financial summary status migration execution', () => {
  let db: PGlite | undefined;

  afterEach(async () => {
    await db?.close();
    db = undefined;
  });

  async function createSchema(dueDateType: 'date' | 'text') {
    await db?.exec(`
      CREATE ROLE service_role;
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE TABLE payments (
        amount numeric, payment_date date, status text, deleted_at timestamptz
      );
      CREATE TABLE expenses (amount numeric, expense_date date, deleted_at timestamptz);
      CREATE TABLE invoices (
        amount numeric, tax_amount numeric, paid_amount numeric, issue_date date,
        due_date ${dueDateType}, status text, deleted_at timestamptz
      );
      CREATE TABLE contracts (status text, deleted_at timestamptz);
      CREATE TABLE units (status text, deleted_at timestamptz);
    `);
  }

  it('creates and executes against the clean DATE baseline', async () => {
    db = new PGlite();
    await createSchema('date');
    await db.exec(`
      INSERT INTO invoices VALUES (100, 5, 25, current_date, current_date - 1, 'OVERDUE', NULL);
      INSERT INTO invoices VALUES (500, 0, 0, current_date, current_date - 1, 'VOID', NULL);
    `);

    await db.exec(migration);

    const result = await db.query<{ revenue: number; overdue_amount: number }>(`
      SELECT revenue::integer, overdue_amount::integer
      FROM rpt_financial_summary(current_date - 2, current_date + 1)
    `);
    expect(result.rows).toEqual([{ revenue: 105, overdue_amount: 80 }]);
  });

  it('ignores blank due dates in the historical TEXT layout', async () => {
    db = new PGlite();
    await createSchema('text');
    await db.exec(`
      INSERT INTO invoices VALUES (100, 0, 0, current_date, '', 'OVERDUE', NULL);
    `);

    await db.exec(migration);

    const result = await db.query<{ overdue_count: number }>(`
      SELECT overdue_count::integer
      FROM rpt_financial_summary(current_date - 2, current_date + 1)
    `);
    expect(result.rows).toEqual([{ overdue_count: 0 }]);
  });
});
