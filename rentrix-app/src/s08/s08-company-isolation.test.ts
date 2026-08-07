import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '../..', '..');

describe('S08 — company isolation & RLS (static proof, PGlite-free)', () => {
  it('views are read-only WITH security_invoker and use properties.title', () => {
    const sql = readFileSync(resolve(REPO_ROOT, 'supabase/migrations/20260807020000_s08_read_only_historical_analysis.sql'), 'utf8');
    expect(sql).not.toMatch(/insert into public\.s08_/i);
    expect(sql).toMatch(/create or replace view public\.s08_/i);
    expect(sql).toMatch(/with \(security_invoker = true\)/i);
    expect(sql).toContain('prop.title');
    expect(sql).not.toContain('prop.name');
  });

  it('functions require company_id+period_id mandatory fail-closed', () => {
    const sql = readFileSync(resolve(REPO_ROOT, 'supabase/migrations/20260807020000_s08_read_only_historical_analysis.sql'), 'utf8');
    expect(sql).toMatch(/s08_analyze_settlement_duplicates\(p_company_id uuid, p_period_id uuid\)/i);
    expect(sql).toMatch(/S08_COMPANY_AND_PERIOD_REQUIRED/);
    expect(sql).toMatch(/current_company_id\(\)/);
  });

  it('no anon/public grant on analysis views and EGP currency', () => {
    const sql = readFileSync(resolve(REPO_ROOT, 'supabase/migrations/20260807020000_s08_read_only_historical_analysis.sql'), 'utf8');
    expect(sql).toMatch(/revoke all on table public\.s08_analysis_scope from public, anon/i);
    expect(sql).toMatch(/grant select on table public\.s08_analysis_scope to service_role/i);
    // authenticated should NOT get direct view select (only functions)
    expect(sql).not.toMatch(/grant select on table public\.s08_analysis_scope to authenticated/i);
    expect(sql).toContain("'EGP'");
    expect(sql).not.toMatch(/'OMR'/);
  });

  it('search_path pinned where SECURITY DEFINER unavoidable', () => {
    const sql = readFileSync(resolve(REPO_ROOT, 'supabase/migrations/20260807020000_s08_read_only_historical_analysis.sql'), 'utf8');
    expect(sql).toMatch(/set search_path = public, pg_temp/i);
    expect(sql).toMatch(/with \(security_invoker = true\)/i);
    expect(sql).toContain("'EGP'");
  });

  it('every S08 function is security invoker and company scoped with duplicate group by source_id', () => {
    const sql = readFileSync(resolve(REPO_ROOT, 'supabase/migrations/20260807020000_s08_read_only_historical_analysis.sql'), 'utf8');
    expect(sql).toMatch(/security invoker/i);
    expect(sql).toMatch(/p_company_id uuid/i);
    expect(sql).toMatch(/group by l\.payment_id/i);
    expect(sql).toMatch(/having count\(distinct l\.settlement_id\) > 1/i);
  });
});
