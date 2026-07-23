import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createReplayedDatabase, evidenceDir } from './replay-bootstrap';

/**
 * Captures the PRE-FIX relrowsesecurity / relforcerowsecurity state for every
 * public table. The P0 rollback uses this to restore the exact prior RLS
 * enablement instead of blindly toggling it.
 */
describe('p0 rls enablement probe', () => {
  it('dumps relrowsecurity for all public tables (pre-fix replay)', async () => {
    const { db } = await createReplayedDatabase();
    const { rows } = await db.query(
      `SELECT c.relname AS tablename, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY 1`,
      [],
    );
    writeFileSync(join(evidenceDir, 'rls-enabled-prefix.json'), JSON.stringify(rows, null, 2));
    console.log('dumped', rows.length, 'tables');
    expect(rows.length).toBeGreaterThan(50);
  }, 600_000);
});
