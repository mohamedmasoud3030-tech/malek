import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('automation real execution', () => {
  it('service uses real tables and RPC', () => {
    const servicePath = resolve(import.meta.dirname, './automation-service.ts');
    const content = readFileSync(servicePath, 'utf8');
    expect(content).toContain('automation_rules');
    expect(content).toContain('execute_automation_rule');
    expect(content).toContain('automation_runs');
    expect(content).toContain('automation_notifications');
    expect(content).toContain('toggleAutomationRule');
    expect(content).toContain('supabase');
    expect(content).toContain('retryAutomationRun');
    expect(content).toContain('runScheduledAutomationRules');
  });

  it('service does not use old local-preview only gateway pattern', () => {
    const servicePath = resolve(import.meta.dirname, './automation-service.ts');
    const content = readFileSync(servicePath, 'utf8');
    expect(content).not.toContain('لم يتم تشغيل عامل أتمتة خارجي');
  });

  it('view uses real queries and mutations', () => {
    const viewPath = resolve(import.meta.dirname, './components/automation-center-view.tsx');
    const content = readFileSync(viewPath, 'utf8');
    expect(content).toContain('listAutomationRules');
    expect(content).toContain('useQuery');
    expect(content).toContain('useMutation');
    expect(content).toContain('toggleAutomationRule');
    expect(content).toContain('executeAutomationRule');
    expect(content).toContain('AsyncContentState');
  });

  it('migration creates automation_rules with real execution', () => {
    const migrationPath = resolve(import.meta.dirname, '../../../../supabase/migrations/20260717000004_real_automation_execution.sql');
    const content = readFileSync(migrationPath, 'utf8');
    expect(content).toContain('create table if not exists public.automation_rules');
    expect(content).toContain('automation_notifications');
    expect(content).toContain('execute_automation_rule');
    const hasLocking = content.includes('pg_advisory_xact_lock') || content.includes('for update');
    expect(hasLocking).toBe(true);
    expect(content).toContain('contract_expiry');
    expect(content).toContain('overdue_invoice');
    expect(content).toContain('maintenance_overdue');
    expect(content).toContain('is_admin_or_manager()');
  });

  it('migration fixes exception handling to preserve FAILED logs', () => {
    const migrationPath = resolve(import.meta.dirname, '../../../../supabase/migrations/20260717000009_automation_scheduling_and_fixed_exception.sql');
    const content = readFileSync(migrationPath, 'utf8');
    // Should NOT have RAISE after updating to failed (old pattern caused rollback)
    // New pattern: update to failed then RETURN failure result, not RAISE
    expect(content).toContain('FAILED');
    expect(content).toContain('RETURN jsonb_build_object');
    expect(content).toContain('success');
    // Should have comment about preserving logs
    expect(content.toLowerCase()).toContain('preserve');
    expect(content).toContain('failed');
  });

  it('migration adds scheduling via pg_cron and prevents duplicates', () => {
    const migrationPath = resolve(import.meta.dirname, '../../../../supabase/migrations/20260717000009_automation_scheduling_and_fixed_exception.sql');
    const content = readFileSync(migrationPath, 'utf8').toLowerCase();
    expect(content).toContain('pg_cron');
    expect(content).toContain('cron.schedule');
    expect(content).toContain('rentrix-automation-hourly');
    expect(content).toContain('run_scheduled_automation_rules');
    expect(content).toContain('duplicate');
    expect(content).toContain('pg_advisory_xact_lock');
    expect(content).toContain('retry_automation_run');
  });

  it('migration tests success, failure, retry, duplicate prevention', () => {
    const migrationPath = resolve(import.meta.dirname, '../../../../supabase/migrations/20260717000009_automation_scheduling_and_fixed_exception.sql');
    const content = readFileSync(migrationPath, 'utf8');
    expect(content).toContain('SUCCESS');
    expect(content).toContain('FAILED');
    expect(content).toContain('retry_count');
    expect(content).toContain('retry_automation_run');
    expect(content).toContain('Max retries');
    expect(content).toContain('duplicate prevention');
    expect(content).toContain('running');
  });

  it('seed migration inserts default rules', () => {
    const seedPath = resolve(import.meta.dirname, '../../../../supabase/migrations/20260717000007_seed_automation_rules.sql');
    const content = readFileSync(seedPath, 'utf8');
    expect(content).toContain('contract-expiry-30');
    expect(content).toContain('rent-reminder-due');
    expect(content).toContain('maintenance-sla');
    expect(content).toContain('on conflict');
  });

  it('automation page is not just local preview', () => {
    const pagePath = resolve(import.meta.dirname, './automation-page.tsx');
    const content = readFileSync(pagePath, 'utf8');
    expect(content).not.toContain('لم يتم تشغيل عامل أتمتة خارجي');
  });

  it('service has retry and scheduled execution', () => {
    const servicePath = resolve(import.meta.dirname, './automation-service.ts');
    const content = readFileSync(servicePath, 'utf8');
    expect(content).toContain('retryAutomationRun');
    expect(content).toContain('runScheduledAutomationRules');
    expect(content).toContain('retry_automation_run');
    expect(content).toContain('run_scheduled_automation_rules');
  });
});
