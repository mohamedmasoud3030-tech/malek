import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import { env } from '@/lib/env';

export type AutomationRuleType = 'contract_expiry' | 'overdue_invoice' | 'maintenance_overdue' | 'payment_reminder' | 'large_payment_alert' | 'unit_status' | 'custom';

export type AutomationRuleRecord = {
  id: string;
  name: string;
  description: string | null;
  rule_type: AutomationRuleType;
  is_enabled: boolean;
  config: Record<string, unknown>;
  schedule_cron?: string | null;
  schedule_interval_hours?: number | null;
  last_run_at?: string | null;
  last_run_status?: string | null;
  last_run_result?: string | null;
  created_at: string;
  updated_at: string;
};

export type AutomationRun = {
  id: string;
  rule_id: string | null;
  job_name: string;
  status: string;
  started_at: number;
  completed_at?: number | null;
  items_processed: number;
  items_failed: number;
  error_message?: string | null;
  actions_taken?: unknown;
  retry_count: number;
};

export type AutomationNotification = {
  id: string;
  rule_id: string | null;
  job_id?: string | null;
  run_id?: string | null;
  type: string;
  title: string;
  body: string;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  is_read: boolean;
  created_at: string;
};

export async function listAutomationRules(): Promise<AutomationRuleRecord[]> {
  const { data, error } = await (supabase as any).from('automation_rules').select('*').is('deleted_at', null).order('created_at', { ascending: true });
  if (error) handleSupabaseError(error, 'تعذر تحميل قواعد الأتمتة');
  return (data ?? []) as AutomationRuleRecord[];
}

export async function toggleAutomationRule(id: string, isEnabled: boolean): Promise<AutomationRuleRecord> {
  const { data, error } = await (supabase as any).from('automation_rules').update({ is_enabled: isEnabled, updated_at: new Date().toISOString() } as any).eq('id', id).select('*').single();
  if (error) handleSupabaseError(error, 'تعذر تحديث حالة القاعدة');
  if (!data) throw new Error('القاعدة غير موجودة');
  return data as AutomationRuleRecord;
}

export async function executeAutomationRule(ruleId: string): Promise<{ success: boolean; run_id: string; processed: number; failed: number; notifications: number }> {
  const { data, error } = await (supabase.rpc as any)('execute_automation_rule', { p_rule_id: ruleId });
  if (error) handleSupabaseError(error, 'فشل تنفيذ قاعدة الأتمتة');
  return data as any;
}

export async function listAutomationRuns(limit = 20): Promise<AutomationRun[]> {
  const { data, error } = await (supabase as any).from('automation_runs').select('*').order('started_at', { ascending: false }).limit(limit);
  if (error) handleSupabaseError(error, 'تعذر تحميل سجل تشغيل الأتمتة');
  return (data ?? []) as AutomationRun[];
}

export async function listAutomationNotifications(limit = 50, unreadOnly = false): Promise<AutomationNotification[]> {
  let query = (supabase as any).from('automation_notifications').select('*').order('created_at', { ascending: false }).limit(limit);
  if (unreadOnly) query = query.eq('is_read', false);
  const { data, error } = await (query as any);
  if (error) handleSupabaseError(error, 'تعذر تحميل إشعارات الأتمتة');
  return (data ?? []) as AutomationNotification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await ((supabase as any).from('automation_notifications').update({ is_read: true } as any).eq('id', id) as any);
  if (error) handleSupabaseError(error, 'تعذر تحديث حالة الإشعار');
}

export async function retryAutomationRun(runId: string): Promise<any> {
  const { data, error } = await (supabase.rpc as any)('retry_automation_run', { p_run_id: runId });
  if (error) handleSupabaseError(error, 'فشل إعادة محاولة تشغيل الأتمتة');
  return data;
}

export async function runScheduledAutomationRules(): Promise<any> {
  const { data, error } = await (supabase.rpc as any)('run_scheduled_automation_rules');
  if (error) handleSupabaseError(error, 'فشل تشغيل الأتمتة المجدولة');
  return data;
}

// Legacy gateway compatibility for old tests
export type AutomationCommand = Readonly<{ ruleId: string; status: 'active' | 'paused' | 'draft'; requestedBy?: string }>;
export type AutomationCommandResult = Readonly<{ accepted: boolean; provider: 'local-preview' | 'automation-worker'; message: string }>;

export const localAutomationGateway = {
  async updateRule(command: AutomationCommand): Promise<AutomationCommandResult> {
    if (!env.isConfigured) {
      return { accepted: false, provider: 'automation-worker', message: 'Supabase environment is not configured' };
    }

    try {
      const isEnabled = command.status === 'active';
      await toggleAutomationRule(command.ruleId, isEnabled);
      return { accepted: true, provider: 'automation-worker', message: `تم ${isEnabled ? 'تفعيل' : 'إيقاف'} القاعدة بنجاح` };
    } catch (e) {
      return { accepted: false, provider: 'automation-worker', message: e instanceof Error ? e.message : 'فشل تحديث القاعدة' };
    }
  },
  previewRule(_rule?: any) {
    return { accepted: true, provider: 'local-preview' as const, message: 'معاينة القاعدة' };
  },
};
