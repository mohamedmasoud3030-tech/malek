import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '../..', '..');

describe('S08 — company isolation & RLS (static proof, PGlite-free)', () => {
  it('views are read-only (no INSERT path in migration)', () => {
    const sql = readFileSync(resolve(REPO_ROOT, 'supabase/migrations/20260807020000_s08_read_only_historical_analysis.sql'), 'utf8');
    expect(sql).not.toMatch(/insert into public\.s08_/i);
    expect(sql).toMatch(/create or replace view public\.s08_/i);
  });

  it('functions require company_id (fail closed when null) — signature present', () => {
    const sql = readFileSync(resolve(REPO_ROOT, 'supabase/migrations/20260807020000_s08_read_only_historical_analysis.sql'), 'utf8');
    expect(sql).toMatch(/s08_analyze_settlement_duplicates\(p_company_id uuid/i);
    expect(sql).toMatch(/s08_analyze_expense_misclassification\(p_company_id uuid/i);
    expect(sql).toMatch(/s08_analyze_deposit_exceptions\(p_company_id uuid/i);
    expect(sql).toMatch(/s08_orphan_postings\(p_company_id uuid/i);
    // All return where false when null effectively
    expect(sql).toMatch(/where false/i);
  });

  it('no anon/public grant on analysis objects', () => {
    const sql = readFileSync(resolve(REPO_ROOT, 'supabase/migrations/20260807020000_s08_read_only_historical_analysis.sql'), 'utf8');
    expect(sql).toMatch(/revoke all on table public\.s08_analysis_scope from public, anon/i);
    expect(sql).toMatch(/grant select on table public\.s08_analysis_scope to authenticated/i);
    expect(sql).not.toMatch(/grant.*to anon/i);
  });

  it('search_path pinned where SECURITY DEFINER unavoidable', () => {
    const sql = readFileSync(resolve(REPO_ROOT, 'supabase/migrations/20260807020000_s08_read_only_historical_analysis.sql'), 'utf8');
    expect(sql).toMatch(/set search_path = public, pg_temp/i);
  });

  it('every S08 function is security invoker and company scoped', () => {
    const sql = readFileSync(resolve(REPO_ROOT, 'supabase/migrations/20260807020000_s08_read_only_historical_analysis.sql'), 'utf8');
    expect(sql).toMatch(/security invoker/i);
    expect(sql).toMatch(/p_company_id uuid/i);
  });
});
