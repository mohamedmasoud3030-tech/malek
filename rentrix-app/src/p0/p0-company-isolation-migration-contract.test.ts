/**
 * P0 — Migration contract for 20260724120000_p0_company_isolation_reports_rls.sql
 * and its rollback supabase/rollback/20260724_rollback_p0_company_isolation.sql.
 *
 * Static, fast assertions that pin the approved P0 fix set (F-RPT / F-RLS /
 * F-AGMT / F-SET) and its non-destructive invariants. Behavioral verification
 * lives in p0-multi-tenant-isolation.test.ts (isolated PGlite replay).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION = '20260724120000_p0_company_isolation_reports_rls.sql';
const ROLLBACK = '20260724_rollback_p0_company_isolation.sql';

const sql = readFileSync(join(process.cwd(), '..', 'supabase', 'migrations', MIGRATION), 'utf8');
const rollback = readFileSync(join(process.cwd(), '..', 'supabase', 'rollback', ROLLBACK), 'utf8');
const stripComments = (t: string) =>
  t
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('--'))
    .join('\n');
const lower = sql.toLowerCase();
const lowerStmts = stripComments(lower);
const rollbackLower = rollback.toLowerCase();
const rollbackLowerStmts = stripComments(rollbackLower);

const REPORT_RPCS = [
  'rpt_cash_flow',
  'rpt_dashboard_overview',
  'rpt_daily_collection',
  'rpt_vat_return',
  'rpt_financial_summary',
  'rpt_trial_balance',
  'rpt_income_statement',
  'rpt_balance_sheet',
  'rpt_owner_statement',
  'rpt_tenant_statement',
  'rpt_aged_receivables',
  'rpt_overdue_invoices',
  'rpt_rent_roll',
] as const;

const count = (haystack: string, needle: RegExp) => (haystack.match(needle) ?? []).length;

describe('p0 company isolation migration contract', () => {
  it('is transactional and strictly non-destructive (zero destructive migrations policy)', () => {
    expect(lower).toContain('begin;');
    expect(lower.trimEnd().endsWith('commit;')).toBe(true);
    expect(lowerStmts).not.toMatch(/\bdrop\s+table\b/);
    expect(lowerStmts).not.toMatch(/\bdrop\s+column\b/);
    expect(lowerStmts).not.toMatch(/\btruncate\b/);
    expect(lowerStmts).not.toMatch(/\bdelete\s+from\b/);
    // drop policy if exists is the only permitted DROP (idempotent re-apply).
    expect(count(lowerStmts, /\bdrop\s+(?!policy\b)/g)).toBe(0);
  });

  it('derives the caller company server-side via a strict helper (F-RPT foundation)', () => {
    expect(lower).toContain('create or replace function public.require_company_id()');
    expect(lower).toContain("company context is required (no company_id claim in jwt).");
    expect(lower).toContain('revoke all on function public.require_company_id() from public, anon;');
    expect(lower).toContain('grant execute on function public.require_company_id() to authenticated, service_role;');
  });

  it.each(REPORT_RPCS)('%s is re-created in this migration and company-filtered (F-RPT)', (name) => {
    expect(count(lower, new RegExp(`create or replace function public\\.${name}\\(`, 'g'))).toBe(1);
  });

  it('every report source table is filtered by the caller company', () => {
    // SECURITY DEFINER reports pin the derived v_company_id …
    expect(count(lower, /v_company_id uuid := public\.require_company_id\(\)/g)).toBeGreaterThanOrEqual(8);
    expect(count(lower, /company_id = v_company_id/g)).toBeGreaterThanOrEqual(20);
    // … and SQL-language / invoker reports filter inline on current_company_id().
    expect(count(lower, /company_id = public\.current_company_id\(\)/g)).toBeGreaterThanOrEqual(10);
  });

  it('pins search_path on the helper and keeps definer reports hardened', () => {
    const helper = lower.slice(lower.indexOf('create or replace function public.require_company_id()'));
    expect(helper).toContain("set search_path to 'public', 'pg_temp'");
    expect(count(lower, /security definer/g)).toBeGreaterThanOrEqual(9);
  });

  it('adds exactly 56 restrictive tenant policies + enables RLS (F-RLS)', () => {
    expect(count(lower, /create policy p0_tenant_isolation on /g)).toBe(56);
    expect(count(lower, / as restrictive/g)).toBe(56);
    expect(count(lower, /enable row level security/g)).toBe(56);
    expect(count(lower, /using \(company_id = public\.current_company_id\(\)\)/g)).toBe(55);
    expect(count(lower, /with check \(company_id = public\.current_company_id\(\)\)/g)).toBe(55);
  });

  it('gives companies a self-scoped policy instead of the generic one', () => {
    expect(lower).toContain('create policy p0_tenant_isolation on public.companies as restrictive');
    expect(lower).toContain('using (id = public.current_company_id())');
  });

  it('stamps company_id via column defaults on 55 tenant tables (F-RLS write path)', () => {
    expect(count(lower, /alter column company_id set default public\.current_company_id\(\)/g)).toBe(55);
  });

  it('backfills owner_agreements.company_id from owners with FK + index (F-AGMT)', () => {
    expect(lower).toContain('alter table public.owner_agreements add column if not exists company_id uuid;');
    expect(lower).toMatch(/update public\.owner_agreements oa\s+set company_id = o\.company_id\s+from public\.owners o/);
    expect(lower).toContain('references public.companies(id)');
    expect(lower).toContain('create index if not exists owner_agreements_company_id_idx on public.owner_agreements (company_id);');
  });

  it('rejects cross-company settlement targets (F-SET, finding T7)', () => {
    expect(lower).toContain('create or replace function public.create_owner_settlement_draft_atomic(p_payload jsonb)');
    expect(lower).toContain('settlement target owner is not in your company.');
    expect(lower).toContain('settlement target property is not in your company.');
    // Amounts semantics untouched in P0 — P1 scope: still trusts client amounts.
    expect(lower).not.toContain('calculate_owner_net_payout');
  });

  it('does not widen the REVOKE/GRANT baseline (no anon/public grants added)', () => {
    expect(lower).not.toMatch(/grant\s+\w+[^;]*\bto\s+anon\b/);
    expect(lower).not.toMatch(/grant\s+\w+[^;]*\bto\s+public\b/);
  });

  it('never silences the existing role guard on the settlement draft rpc', () => {
    expect(lower).toContain('admin or manager role is required to create owner settlements.');
  });
});

describe('p0 company isolation rollback contract', () => {
  it('drops every P0 policy and default, restores all 14 pre-P0 bodies, stays non-destructive', () => {
    expect(count(rollbackLower, /drop policy if exists p0_tenant_isolation on /g)).toBe(56);
    expect(count(rollbackLower, /alter column company_id drop default/g)).toBe(55);
    for (const name of [...REPORT_RPCS, 'create_owner_settlement_draft_atomic']) {
      expect(count(rollbackLower, new RegExp(`create or replace function public\\.${name}\\(`, 'g'))).toBe(1);
    }
    expect(rollbackLowerStmts).not.toMatch(/\bdrop\s+table\b/);
    // DROPs are permitted ONLY for objects the P0 migration itself created:
    // the helper function and the owner_agreements.company_id column (+FK/index).
    expect(rollbackLower).toContain('drop function if exists public.require_company_id();');
    expect(count(rollbackLowerStmts, /\bdrop\s+function\b/g)).toBe(1);
    expect(rollbackLower).toContain('alter table public.owner_agreements drop constraint if exists owner_agreements_company_id_fkey;');
    expect(rollbackLower).toContain('drop index if exists public.owner_agreements_company_id_idx;');
    expect(rollbackLower).toContain('alter table public.owner_agreements drop column if exists company_id;');
    expect(count(rollbackLowerStmts, /\bdrop\s+column\b/g)).toBe(1);
    // Restored bodies must be the pre-P0 text (no P0 helper calls inside them).
    expect(rollbackLower).not.toContain('v_company_id uuid := public.require_company_id()');
  });

  it('restored pre-P0 settlement body has NO F-SET guard (documents the reopened T7 risk)', () => {
    const restored = rollbackLower.slice(rollbackLower.indexOf('create or replace function public.create_owner_settlement_draft_atomic'));
    expect(restored).not.toContain('settlement target owner is not in your company.');
    expect(rollbackLower).toMatch(/warning: running this re-opens/);
  });
});
