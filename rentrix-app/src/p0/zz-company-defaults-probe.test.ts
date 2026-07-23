import { describe, it, expect } from 'vitest';
import { createReplayedDatabase, evidenceDir } from './replay-bootstrap';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

describe('p0 probe: company_id defaults + insert triggers (with_check safety)', () => {
  it('dumps defaults and triggers', async () => {
    const { db } = await createReplayedDatabase();
    const { rows: cols } = await db.query(
      "SELECT table_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND column_name='company_id' ORDER BY table_name",
      [],
    );
    const { rows: trgs } = await db.query(
      "SELECT event_object_table AS tbl, trigger_name, action_timing, event_manipulation FROM information_schema.triggers WHERE trigger_schema='public' ORDER BY 1, 3",
      [],
    );
    writeFileSync(join(evidenceDir, 'company-id-surface.json'), JSON.stringify({ companyIdColumns: cols, triggers: trgs }, null, 2));
    console.log('tables with company_id:', cols.length, '| with default:', cols.filter((c: any) => c.column_default).length, '| triggers:', trgs.length);
    expect(cols.length).toBeGreaterThan(0);
  }, 600_000);
});
