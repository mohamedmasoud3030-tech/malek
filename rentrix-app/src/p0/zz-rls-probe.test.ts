import { describe, it, expect } from 'vitest';
import { createReplayedDatabase, evidenceDir } from './replay-bootstrap';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

describe('p0 rls probe', () => {
  it('dumps policies for financial core tables', async () => {
    const { db } = await createReplayedDatabase();
    const { rows } = await db.query(
      "SELECT tablename, policyname, permissive, roles, cmd, coalesce(qual,'') AS qual, coalesce(with_check,'') AS with_check FROM pg_policies WHERE schemaname='public' AND tablename IN ('payments','expenses','invoices','contracts','owner_settlements','owners','properties','owner_agreements','journal_entries','accounts','receipts','receipt_allocations') ORDER BY tablename, policyname",
      [],
    );
    writeFileSync(join(evidenceDir, 'rls-policy-dump.json'), JSON.stringify(rows, null, 2));
    console.log('dumped', rows.length, 'policies');
    expect(rows.length).toBeGreaterThan(0);
  }, 600_000);
});
