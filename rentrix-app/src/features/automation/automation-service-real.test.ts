import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('automation real execution', () => {
  it('service uses real tables and RPC', () => {
    const servicePath = resolve(import.meta.dirname, './automation-service.ts');
    const content = readFileSync(servicePath, 'utf8');
    expect(content).toContain('automation_rules');
    expect(content).toContain('enqueue_automation_rule_job_atomic');
    expect(content).toContain('automation_runs');
    expect(content).toContain('automation_notifications');
    expect(content).toContain('toggleAutomationRule');
    expect(content).toContain('get_background_job_status');
    expect(content).toContain('cancel_background_job_atomic');
    expect(content).toContain('supabase');
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

  it('automation page is not just local preview', () => {
    const pagePath = resolve(import.meta.dirname, './automation-page.tsx');
    const content = readFileSync(pagePath, 'utf8');
    expect(content).not.toContain('لم يتم تشغيل عامل أتمتة خارجي');
  });

  it('service delegates retry/scheduling to the durable worker instead of browser RPCs', () => {
    const servicePath = resolve(import.meta.dirname, './automation-service.ts');
    const content = readFileSync(servicePath, 'utf8');
    expect(content).not.toContain('retryAutomationRun');
    expect(content).not.toContain('runScheduledAutomationRules');
    expect(content).not.toContain("('retry_automation_run'");
    expect(content).not.toContain("('run_scheduled_automation_rules'");
    expect(content).toContain('getAutomationJobStatus');
    expect(content).toContain('cancelAutomationJob');
  });
});
