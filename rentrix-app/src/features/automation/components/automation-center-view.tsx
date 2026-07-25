import { BellRing, CalendarClock, Mail, MessageCircle, PauseCircle, PlayCircle, Smartphone, Wrench, RefreshCw, AlertTriangle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { MobileCard } from '@/components/ui/mobile-card';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { AsyncContentState } from '@/components/async-content-state';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { listAutomationRules, toggleAutomationRule, executeAutomationRule, listAutomationRuns, listAutomationNotifications } from '../automation-service';
import { automationTemplatePreviews } from '../automation-catalog';
import type { AutomationChannel } from '../types';

const channelLabel: Record<AutomationChannel, string> = {
  whatsapp: 'واتساب',
  email: 'بريد إلكتروني',
  in_app: 'داخل النظام',
  sms: 'رسالة نصية',
};

const channelIcon: Record<AutomationChannel, typeof MessageCircle> = {
  whatsapp: MessageCircle,
  email: Mail,
  in_app: BellRing,
  sms: Smartphone,
};

type StatusFilter = 'all' | 'enabled' | 'disabled';

function mapRuleTypeToCategory(type: string) {
  switch (type) {
    case 'contract_expiry':
      return 'العقود';
    case 'overdue_invoice':
    case 'payment_reminder':
      return 'الإيجار';
    case 'maintenance_overdue':
      return 'الصيانة';
    case 'large_payment_alert':
      return 'التحصيل';
    default:
      return 'عام';
  }
}

export function AutomationCenterView() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const queryClient = useQueryClient();

  const rulesQuery = useQuery({ queryKey: ['automation-rules'], queryFn: listAutomationRules });
  const runsQuery = useQuery({ queryKey: ['automation-runs'], queryFn: () => listAutomationRuns(10) });
  const notificationsQuery = useQuery({ queryKey: ['automation-notifications'], queryFn: () => listAutomationNotifications(20) });

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => toggleAutomationRule(id, enabled),
    onSuccess: () => {
      toast.success('تم تحديث حالة القاعدة');
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'فشل تحديث القاعدة'),
  });

  const executeMut = useMutation({
    mutationFn: (ruleId: string) => executeAutomationRule(ruleId),
    onSuccess: (result) => {
      toast.success(`تم التنفيذ: ${result.processed} عنصر، ${result.notifications} إشعار`);
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      queryClient.invalidateQueries({ queryKey: ['automation-runs'] });
      queryClient.invalidateQueries({ queryKey: ['automation-notifications'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'فشل التنفيذ'),
  });

  const rules = rulesQuery.data ?? [];

  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'enabled') return r.is_enabled;
      if (statusFilter === 'disabled') return !r.is_enabled;
      return true;
    });
  }, [rules, statusFilter]);

  const counts = useMemo(() => {
    return { all: rules.length, enabled: rules.filter((r) => r.is_enabled).length, disabled: rules.filter((r) => !r.is_enabled).length };
  }, [rules]);

  return (
    <section className="space-y-5" dir="rtl">
      <h2 className="sr-only">مركز الأتمتة</h2>
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-base font-bold tracking-tight">قواعد الأتمتة</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              قواعد محفوظة في قاعدة البيانات مع سجل تشغيل وإشعارات داخل النظام ومنع تكرار.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="success" dot>{counts.enabled} مفعّل</StatusBadge>
            <StatusBadge tone="warning" dot>{counts.disabled} متوقف</StatusBadge>
            <StatusBadge tone="neutral" dot>{counts.all} الكل</StatusBadge>
          </div>
        </div>
        <ResponsiveCardGrid>
          <KpiCard
            label="قواعد العقود"
            value={String(rules.filter((rule) => rule.rule_type === 'contract_expiry').length)}
            icon={CalendarClock}
            accent="primary"
          />
          <KpiCard
            label="قواعد الإيجار"
            value={String(rules.filter((rule) => rule.rule_type === 'overdue_invoice').length)}
            icon={MessageCircle}
            accent="amber"
          />
          <KpiCard
            label="إجمالي التشغيلات"
            value={String(runsQuery.data?.length ?? 0)}
            icon={Mail}
            accent="sky"
          />
          <KpiCard
            label="إشعارات النظام"
            value={String(notificationsQuery.data?.length ?? 0)}
            icon={Wrench}
            accent="emerald"
          />
        </ResponsiveCardGrid>
      </div>

      <FilterTabs
        value={statusFilter}
        onChange={(value) => setStatusFilter(value as StatusFilter)}
        options={[
          { value: 'all', label: 'الكل', count: counts.all },
          { value: 'enabled', label: 'مفعّل', count: counts.enabled },
          { value: 'disabled', label: 'متوقف', count: counts.disabled },
        ]}
      />

      <AsyncContentState
        status={rulesQuery.isLoading ? 'loading' : rulesQuery.isError ? 'error' : filteredRules.length === 0 ? 'empty' : 'ready'}
        error={rulesQuery.error as Error}
        errorTitle="تعذر تحميل قواعد الأتمتة"
        errorAction={<Button onClick={() => rulesQuery.refetch()}>إعادة المحاولة</Button>}
        emptyTitle="لا توجد قواعد أتمتة"
        emptyDescription="سيتم إنشاء القواعد الافتراضية تلقائياً عند تطبيق الترحيلات."
      >
        <div className="grid gap-3 md:hidden">
          {filteredRules.map((rule) => (
            <MobileCard
              key={rule.id}
              title={rule.name}
              subtitle={rule.description || ''}
              badge={<StatusBadge tone={rule.is_enabled ? 'success' : 'warning'}>{rule.is_enabled ? 'مفعّل' : 'متوقف'}</StatusBadge>}
              meta={
                <div className="space-y-1 text-xs">
                  <p>النوع: {mapRuleTypeToCategory(rule.rule_type)}</p>
                  <p>آخر تشغيل: {rule.last_run_at ? new Date(rule.last_run_at).toLocaleString('ar-OM') : 'لم يشغل بعد'}</p>
                  <p>النتيجة: {rule.last_run_result || '—'}</p>
                </div>
              }
              actions={
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" className="min-h-11" onClick={() => toggleMut.mutate({ id: rule.id, enabled: !rule.is_enabled })} disabled={toggleMut.isPending}>
                    {rule.is_enabled ? (
                      <>
                        <PauseCircle className="me-2 size-4" />
                        إيقاف
                      </>
                    ) : (
                      <>
                        <PlayCircle className="me-2 size-4" />
                        تفعيل
                      </>
                    )}
                  </Button>
                  <Button variant="outline" className="min-h-11" onClick={() => executeMut.mutate(rule.id)} disabled={executeMut.isPending}>
                    <RefreshCw className="me-2 size-4" />
                    تشغيل الآن
                  </Button>
                </div>
              }
            />
          ))}
        </div>

        <div className="hidden gap-3 md:grid">
          {filteredRules.map((rule) => (
            <Card key={rule.id} className="border-border/70">
              <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-black">{rule.name}</h3>
                    <StatusBadge tone={rule.is_enabled ? 'success' : 'warning'}>{rule.is_enabled ? 'مفعّل' : 'متوقف'}</StatusBadge>
                    <Badge variant="outline">{mapRuleTypeToCategory(rule.rule_type)}</Badge>
                    {rule.last_run_status && <Badge variant="outline">{rule.last_run_status}</Badge>}
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{rule.description}</p>
                  <div className="flex flex-wrap gap-3 text-xs font-bold text-muted-foreground">
                    <span>آخر تشغيل: {rule.last_run_at ? new Date(rule.last_run_at).toLocaleString('ar-OM') : '—'}</span>
                    <span>النتيجة: {rule.last_run_result || '—'}</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="secondary" onClick={() => toggleMut.mutate({ id: rule.id, enabled: !rule.is_enabled })} disabled={toggleMut.isPending}>
                    {rule.is_enabled ? (
                      <>
                        <PauseCircle className="me-2 size-4" />
                        إيقاف
                      </>
                    ) : (
                      <>
                        <PlayCircle className="me-2 size-4" />
                        تفعيل
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => executeMut.mutate(rule.id)} disabled={executeMut.isPending}>
                    <RefreshCw className="me-2 size-4" />
                    تشغيل الآن
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </AsyncContentState>

      <section className="space-y-3">
        <SectionHeader title="سجل التشغيلات" description="آخر 10 عمليات تشغيل مع عدد العناصر المعالجة والأخطاء." />
        <Card>
          <CardContent className="p-4 space-y-2">
            {(runsQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">لا يوجد سجل تشغيل بعد. شغل قاعدة للبدء.</p>
            ) : (
              (runsQuery.data ?? []).map((run) => (
                <div key={run.id} className="flex justify-between items-center rounded-xl border p-3 text-sm">
                  <div>
                    <p className="font-bold">{run.job_name}</p>
                    <p className="text-xs text-muted-foreground">
                      بدء: {new Date(Number(run.started_at)).toLocaleString('ar-OM')} · معالجة: {run.items_processed} · فشل: {run.items_failed}
                    </p>
                  </div>
                  <StatusBadge tone={run.status === 'success' ? 'success' : run.status === 'failed' ? 'danger' : 'warning'}>{run.status}</StatusBadge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionHeader title="إشعارات النظام" description="الإشعارات التي أنشأتها قواعد الأتمتة داخل النظام فقط، دون إرسال خارجي." />
        <Card>
          <CardContent className="p-4 space-y-2">
            {(notificationsQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">لا توجد إشعارات. تشغيل قواعد العقود المنتهية أو الفواتير المتأخرة سيُنشئ إشعارات.</p>
            ) : (
              (notificationsQuery.data ?? []).map((notif) => (
                <div key={notif.id} className="rounded-xl border p-3 space-y-1">
                  <div className="flex justify-between">
                    <p className="font-bold text-sm">{notif.title}</p>
                    <span className="text-xs text-muted-foreground">{new Date(notif.created_at).toLocaleString('ar-OM')}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{notif.body}</p>
                  {notif.related_entity_type && <p className="text-xs">مرتبط: {notif.related_entity_type} {notif.related_entity_id?.slice(0, 8)}</p>}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionHeader title="قوالب الإشعارات" description="قوالب قابلة للتوسعة - لا يتم إرسال رسائل خارجية بدون إعداد مزود واضح." />
        <div className="grid gap-3 md:grid-cols-2">
          {automationTemplatePreviews.map((template) => {
            const Icon = channelIcon[template.channel as AutomationChannel] || MessageCircle;
            return (
              <Card key={template.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Icon className="size-4 text-primary" />
                    {template.title}
                  </CardTitle>
                  <CardDescription>{channelLabel[template.channel as AutomationChannel]}</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap rounded-2xl bg-muted/50 p-3 text-xs font-bold leading-6 text-muted-foreground">{template.body}</pre>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <Card className="border-warning/40 bg-warning/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-warning">
            <AlertTriangle className="size-5" />
            ملاحظات الأمان
          </CardTitle>
          <CardDescription>
            لا يتم إرسال رسائل واتساب/بريد/ SMS خارجية فعلياً من هذا المركز بدون إعداد مزود. النظام يسجل إشعارات داخل النظام فقط ويسجل runs/logs مع منع تكرار عبر قفل الصفوف. لإضافة إرسال خارجي: اضبط متغيرات المزود في Edge Function منفصلة.
          </CardDescription>
        </CardHeader>
      </Card>
    </section>
  );
}
