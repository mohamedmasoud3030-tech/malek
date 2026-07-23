import { describe, it } from 'vitest';
import { createReplayedDatabase, evidenceDir } from './replay-bootstrap';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

describe('p0 probe: full column dump for fixture tables', () => {
  it('dumps columns', async () => {
    const { db } = await createReplayedDatabase();
    const targets = ['people','journal_entries','payments','receipts','owner_settlements','companies','users','accounts','contracts','units','invoices','expenses','owner_agreements','property_owners','company_members','properties','owners'];
    const out: Record<string, unknown> = {};
    for (const t of targets) {
      const { rows } = await db.query(
        `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [t]);
      out[t] = rows;
    }
    writeFileSync(join(evidenceDir, 'fixture-full-columns.json'), JSON.stringify(out, null, 2));
    console.log('dumped');
  }, 600_000);
});
