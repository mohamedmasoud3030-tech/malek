import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  join(
    process.cwd(),
    '..',
    'supabase',
    'migrations',
    '20260729091000_p1_owner_settlement_property_text_compatibility.sql',
  ),
  'utf8',
).toLowerCase();

describe('owner workflows tolerate text property identifiers', () => {
  it('replaces the owner-settlement preview overload with a text property filter', () => {
    expect(migrationSql).toContain('p_property_id text default null');
    expect(migrationSql).toContain('public.calculate_owner_net_payout(uuid, date, date, text)');
    expect(migrationSql).toContain('drop function if exists public.calculate_owner_net_payout(uuid, date, date, uuid);');
  });

  it('keeps owner-settlement property comparisons text-safe and removes uuid casts from the draft path', () => {
    expect(migrationSql).toContain('where p.id::text = p_property_id');
    expect(migrationSql).toContain('c.property_id::text = p_property_id::text');
    expect(migrationSql).toContain('v_property_id\n  ) as c;');
    expect(migrationSql).not.toContain('v_property_id::uuid');
  });

  it('stores owner-agreement property_id through the target column type, not a forced uuid cast', () => {
    expect(migrationSql).toContain('v_property_id public.owner_agreements.property_id%type;');
    expect(migrationSql).toContain('where pr.id::text = v_property_id::text');
    expect(migrationSql).not.toContain("(payload->>'property_id')::uuid");
  });
});
