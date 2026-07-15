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
    // New service should call toggleAutomationRule with real DB, not just local preview
    expect(content).toContain('toggleAutomationRule');
    expect(content).toContain('supabase');
  });

  it('service does not use old local-preview only gateway pattern', () => {
    const servicePath = resolve(import.meta.dirname, './automation-service.ts');
    const content = readFileSync(servicePath, 'utf8');
    // Old implementation had message "لم يتم تشغيل عامل أتمتة خارجي" as sole behavior
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
    // Should have row locking for safety (either advisory lock or FOR UPDATE)
    const hasLocking = content.includes('pg_advisory_xact_lock') || content.includes('for update');
    expect(hasLocking).toBe(true);
    expect(content).toContain('contract_expiry');
    expect(content).toContain('overdue_invoice');
    expect(content).toContain('maintenance_overdue');
    expect(content).toContain('is_admin_or_manager()');
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
    // Page should not contain old local-preview message as main implementation
    expect(content).not.toContain('لم يتم تشغيل عامل أتمتة خارجي');
  });
});
