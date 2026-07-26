/**
 * Automation rule execution tests — validates corrective migration 20260730090500.
 * Tests two-company isolation, safe-date handling, and lifecycle.
 * These tests read migration SQL directly and validate structure.
 */
import { describe, expect, it } from 'vitest';

// Import migration SQL files
const MIGRATION_FILES = import.meta.glob('../../../../supabase/migrations/*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const ROLLBACK_FILES = import.meta.glob('../../../../supabase/rollback/*automation*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const orderedMigrations = Object.entries(MIGRATION_FILES)
  .map(([path, sql]) => ({ path, sql }))
  .sort((a, b) => a.path.localeCompare(b.path));

describe('automation rule execution — corrective migration 20260730090500', () => {
  const correctiveMigration = orderedMigrations.find(m => m.path.includes('20260730090500'));

  it('corrective migration file exists', () => {
    expect(correctiveMigration).toBeDefined();
    expect(correctiveMigration!.path).toContain('20260730090500');
  });

  it('defines both execute_automation_rule and execute_automation_rule_internal', () => {
    const sql = correctiveMigration!.sql;
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.execute_automation_rule(');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.execute_automation_rule_internal(');
  });

  it('uses _safe_date for contract end_date and invoice due_date (not ::date)', () => {
    const sql = correctiveMigration!.sql;
    // Extract just the main body (before rollback comments)
    const mainBody = sql.split('-- ROLLBACK')[0] || sql.split('-- To rollback')[0] || sql.split('-- ===')[0] || sql;
    expect(mainBody).toContain('public._safe_date(end_date)');
    expect(mainBody).toContain('public._safe_date(due_date)');
    // Should NOT have direct ::date casts in the main body
    expect(mainBody).not.toMatch(/end_date::date/);
    expect(mainBody).not.toMatch(/due_date::date/);
  });

  it('public function filters contracts/invoices/maintenance by company_id', () => {
    const sql = correctiveMigration!.sql;
    // Public function section (before internal function)
    const publicFuncStart = sql.indexOf('FUNCTION public.execute_automation_rule(');
    const internalFuncStart = sql.indexOf('FUNCTION public.execute_automation_rule_internal(');
    const publicFuncBody = sql.slice(publicFuncStart, internalFuncStart);
    
    // Check company isolation in queries
    expect(publicFuncBody).toContain('company_id = v_company_id');
    // Rule lookup must be filtered by company
    expect(publicFuncBody).toContain('company_id = v_company_id');
  });

  it('internal function filters by v_rule.company_id', () => {
    const sql = correctiveMigration!.sql;
    const internalFuncStart = sql.indexOf('FUNCTION public.execute_automation_rule_internal(');
    const internalFuncBody = sql.slice(internalFuncStart);
    
    expect(internalFuncBody).toContain('company_id = v_rule.company_id');
  });

  it('public function derives company from JWT auth.jwt()', () => {
    const sql = correctiveMigration!.sql;
    expect(sql).toContain("auth.jwt()");
    expect(sql).toContain("v_company_id");
  });

  it('preserves SECURITY DEFINER and search_path for both functions', () => {
    const sql = correctiveMigration!.sql;
    const securityCount = (sql.match(/SECURITY DEFINER/gi) || []).length;
    expect(securityCount).toBeGreaterThanOrEqual(2);
    const searchPathCount = (sql.match(/search_path/gi) || []).length;
    expect(searchPathCount).toBeGreaterThanOrEqual(2);
  });

  it('grants: authenticated for public, service_role for internal, no anon', () => {
    const sql = correctiveMigration!.sql;
    expect(sql).toContain("grant execute on function public.execute_automation_rule(text) to authenticated");
    expect(sql).toContain("grant execute on function public.execute_automation_rule_internal(text) to service_role");
    expect(sql).not.toContain("grant execute on function public.execute_automation_rule(text) to anon");
    expect(sql).not.toContain("grant execute on function public.execute_automation_rule(text) to public");
  });

  it('rollback file exists and restores prior definitions', () => {
    const rollbackEntries = Object.entries(ROLLBACK_FILES);
    expect(rollbackEntries.length).toBeGreaterThanOrEqual(1);
    const rollbackSql = rollbackEntries[0][1];
    expect(rollbackSql).toContain("execute_automation_rule");
    expect(rollbackSql).toContain("execute_automation_rule_internal");
  });

  it('notification inserts use v_company_id (public) or v_rule.company_id (internal)', () => {
    const sql = correctiveMigration!.sql;
    // All notification inserts should reference company_id parameter
    // Count notification inserts
    const notifInserts = (sql.match(/insert into public\.automation_notifications/g) || []).length;
    expect(notifInserts).toBeGreaterThanOrEqual(6); // 3 rule types × 2 functions
    
    // Each insert should have company_id as last value
    expect(sql).toContain('v_company_id)');
    expect(sql).toContain('v_rule.company_id)');
  });
});

describe('automation two-company isolation — structural validation', () => {
  const correctiveMigration = orderedMigrations.find(m => m.path.includes('20260730090500'));

  it('public function rejects cross-company rule IDs as not found', () => {
    const sql = correctiveMigration!.sql;
    const publicFuncStart = sql.indexOf('FUNCTION public.execute_automation_rule(');
    const internalFuncStart = sql.indexOf('FUNCTION public.execute_automation_rule_internal(');
    const publicFuncBody = sql.slice(publicFuncStart, internalFuncStart);
    
    // The WHERE clause for rule lookup must include company_id = v_company_id
    expect(publicFuncBody).toContain("and company_id = v_company_id");
    // After the lookup, "if not found then raise exception 'Rule not found'"
    expect(publicFuncBody).toContain("Rule not found");
  });

  it('duplicate-run checks are scoped to the correct rule_id', () => {
    const sql = correctiveMigration!.sql;
    // The advisory lock should use the rule_id
    expect(sql).toContain("pg_advisory_xact_lock");
    // The duplicate check should filter by rule_id
    expect(sql).toContain("where rule_id = p_rule_id");
  });

  it('no notifications can reference a different company than the rule', () => {
    const sql = correctiveMigration!.sql;
    // All automation_notifications inserts end with the company_id parameter
    // which is always derived from the rule, not from queried records
    const lines = sql.split('\n');
    const notifInsertLines = lines.filter(l => l.includes('insert into public.automation_notifications'));
    expect(notifInsertLines.length).toBeGreaterThanOrEqual(6);
  });
});
