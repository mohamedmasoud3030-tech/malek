/**
 * Automation rule execution structural tests.
 *
 * The database was intentionally squashed into the 202609 canonical
 * bootstrap. These tests validate the current canonical SQL contract instead
 * of requiring the deleted 20260730090500 artifact to still exist.
 */
import { describe, expect, it } from 'vitest';

const MIGRATION_FILES = import.meta.glob('../../../../supabase/migrations/*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const ROLLBACK_FILES = import.meta.glob('../../../../supabase/rollback/*automation*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const orderedMigrations = Object.entries(MIGRATION_FILES)
  .map(([path, sql]) => ({ path, sql }))
  .sort((a, b) => a.path.localeCompare(b.path));
const canonicalSql = orderedMigrations.map(({ sql }) => sql).join('\n');

describe('automation rule execution — canonical database contract', () => {
  it('canonical migration set exists and contains the automation authority', () => {
    expect(orderedMigrations.length).toBeGreaterThan(0);
    expect(canonicalSql).toContain('FUNCTION public.execute_automation_rule(');
    expect(canonicalSql).toContain('FUNCTION public.execute_automation_rule_internal(');
  });

  it('uses _safe_date for contract end_date and invoice due_date (not ::date)', () => {
    expect(canonicalSql).toContain('public._safe_date(end_date)');
    expect(canonicalSql).toContain('public._safe_date(due_date)');
    expect(canonicalSql).not.toMatch(/end_date::date/);
    expect(canonicalSql).not.toMatch(/due_date::date/);
  });

  it('public function filters contracts/invoices/maintenance by company_id', () => {
    const publicFuncStart = canonicalSql.indexOf('FUNCTION public.execute_automation_rule(');
    const internalFuncStart = canonicalSql.indexOf('FUNCTION public.execute_automation_rule_internal(');
    const publicFuncBody = canonicalSql.slice(publicFuncStart, internalFuncStart);
    expect(publicFuncStart).toBeGreaterThanOrEqual(0);
    expect(internalFuncStart).toBeGreaterThan(publicFuncStart);
    expect(publicFuncBody).toContain('company_id = v_company_id');
  });

  it('internal function filters by v_rule.company_id', () => {
    const internalFuncStart = canonicalSql.indexOf('FUNCTION public.execute_automation_rule_internal(');
    expect(internalFuncStart).toBeGreaterThanOrEqual(0);
    expect(canonicalSql.slice(internalFuncStart)).toContain('company_id = v_rule.company_id');
  });

  it('public function derives company from JWT auth.jwt()', () => {
    expect(canonicalSql).toContain('auth.jwt()');
    expect(canonicalSql).toContain('v_company_id');
  });

  it('preserves SECURITY DEFINER and search_path for the automation authority', () => {
    expect((canonicalSql.match(/SECURITY DEFINER/gi) || []).length).toBeGreaterThanOrEqual(2);
    expect((canonicalSql.match(/search_path/gi) || []).length).toBeGreaterThanOrEqual(2);
  });

  it('grants authenticated for public execution, service_role for internal, and not anon', () => {
    expect(canonicalSql).toContain('grant execute on function public.execute_automation_rule(text) to authenticated');
    expect(canonicalSql).toContain('grant execute on function public.execute_automation_rule_internal(text) to service_role');
    expect(canonicalSql).not.toContain('grant execute on function public.execute_automation_rule(text) to anon');
    expect(canonicalSql).not.toContain('grant execute on function public.execute_automation_rule(text) to public');
  });

  it('rollback fixture remains available as historical recovery documentation', () => {
    const rollbackEntries = Object.entries(ROLLBACK_FILES);
    expect(rollbackEntries.length).toBeGreaterThanOrEqual(1);
    const rollbackSql = rollbackEntries.map(([, sql]) => sql).join('\n');
    expect(rollbackSql).toContain('execute_automation_rule');
    expect(rollbackSql).toContain('execute_automation_rule_internal');
  });

  it('notification inserts remain company-scoped', () => {
    const notifInserts = (canonicalSql.match(/insert into public\.automation_notifications/gi) || []).length;
    expect(notifInserts).toBeGreaterThanOrEqual(2);
    expect(canonicalSql).toContain('v_company_id)');
    expect(canonicalSql).toContain('v_rule.company_id)');
  });
});

describe('automation two-company isolation — canonical structural validation', () => {
  it('public function rejects cross-company rule IDs as not found', () => {
    const publicFuncStart = canonicalSql.indexOf('FUNCTION public.execute_automation_rule(');
    const internalFuncStart = canonicalSql.indexOf('FUNCTION public.execute_automation_rule_internal(');
    const publicFuncBody = canonicalSql.slice(publicFuncStart, internalFuncStart);
    expect(publicFuncBody).toContain('and company_id = v_company_id');
    expect(publicFuncBody).toContain('Rule not found');
  });

  it('duplicate-run checks are scoped to rule_id', () => {
    expect(canonicalSql).toContain('pg_advisory_xact_lock');
    expect(canonicalSql).toContain('where rule_id = p_rule_id');
  });

  it('notification writes derive company from the rule authority', () => {
    expect(canonicalSql).toContain('v_company_id)');
    expect(canonicalSql).toContain('v_rule.company_id)');
  });
});
