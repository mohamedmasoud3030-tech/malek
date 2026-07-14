import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    '..',
    'supabase',
    'migrations',
    '20260715000005_post_qa_reversal_entries.sql',
  ),
  'utf8',
).toLowerCase();

describe('QA reversal posting migration', () => {
  it('treats an absent QA graph as a valid no-op', () => {
    expect(migration).toContain('if v_related_count = 0 then');
    expect(migration).toContain('qa journal reversal graph is absent');
  });

  it('normalizes mixed identifier layouts and rejects partial graphs', () => {
    expect(migration).toContain('source_id::text = v_src_id');
    expect(migration).toContain('entity_id::text = v_ent_id');
    expect(migration).toContain('v_target_count <> 4 or v_related_count <> 4');
    expect(migration).toContain('expected exactly four isolated target rows');
  });

  it('posts exactly two validated draft reversals and verifies balance', () => {
    expect(migration).toContain('get diagnostics v_updated_count = row_count');
    expect(migration).toContain('if v_updated_count <> 2 then');
    expect(migration).toContain('if v_total_debit <> v_total_credit then');
  });

  it('writes audit evidence only when rows were updated', () => {
    expect(migration).toContain('if v_updated_count = 2 then');
    expect(migration).toContain("'post_qa_reversal_entries'");
  });
});
