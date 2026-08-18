import { AlertTriangle, BellRing, CalendarClock, ExternalLink, Mail, MessageCircle, PauseCircle, PlayCircle, RefreshCw, Smartphone, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AsyncContentState } from '@/components/async-content-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  executeAutomationRule,
  listAutomationNotifications,
  listAutomationRules,
  listAutomationRuns,
  toggleAutomationRule,
} from '../automation-service';
import { automationTemplatePreviews } from '../automation-catalog';
import { buildTemplateWhatsAppDemoUrl } from '../automation-whatsapp';
import type { AutomationChannel } from '../types';
import { formatLatinDateTime } from '@/lib/formatters';

type AutomationRule = Awaited<ReturnType<typeof listAutomationRules>>[number];
type AutomationRun = Awaited<ReturnType<typeof listAutomationRuns>>[number];
type AutomationNotification = Awaited<ReturnType<typeof listAutomationNotifications>>[number];
type StatusFilter = 'all' | 'enabled' | 'disabled';

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

function automationRunStatusTone(status: string): 'success' | 'danger' | 'warning' {
  if (status === 'success') return 'success';
  if (status === 'failed') return 'danger';
  return 'warning';
}

function mapRuleTypeToCategory(type: string) {
  switch (type) {
    case 'contract_expiry': return 'العقود';
    case 'overdue_invoice':
    case 'payment_reminder': return 'الإيجار';
    case 'maintenance_overdue': return 'الصيانة';
    case 'large_payment_alert': return 'التحصيل';
    default: return 'عام';
  }
}

function formatAutomationDate(value: string | number | null | undefined) {
  if (value == null || value === '') return '—';
  const date = typeof value === 'number' || /^\d+$/.test(String(value))
    ? new Date(Number(value))
    : new Date(String(value));
  return Number.isNaN(date.getTime()) ? '—' : formatLatinDateTime(date, 'ar');
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
      void queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'فشل تحديث القاعدة'),
  });

  const executeMut = useMutation({
    mutationFn: (ruleId: string) => executeAutomationRule(ruleId),
    onSuccess: (result) => {
      toast.success(`تم التنفيذ: ${result.processed} عنصر، ${result.notifications} إشعار`);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['automation-rules'] }),
        queryClient.invalidateQueries({ queryKey: ['automation-runs'] }),
        queryClient.invalidateQueries({ queryKey: ['automation-notifications'] }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'فشل التنفيذ'),
  });

  const rules = rulesQuery.data ?? [];
  const runs = runsQuery.data ?? [];
  const notifications = notificationsQuery.data ?? [];
  const filteredRules = useMemo(
    () => rules.filter((rule) => statusFilter === 'all' || (statusFilter === 'enabled' ? rule.is_enabled : !rule.is_enabled)),
    [rules, statusFilter],
  );
  const counts = useMemo(() => ({
    all: rules.length,
    enabled: rules.filter((rule) => rule.is_enabled).length,
    disabled: rules.filter((rule) => !rule.is_enabled).length,
  }), [rules]);

  const ruleActions = (rule: AutomationRule) => (
    <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <Button variant="secondary" disabled={toggleMut.isPending} onClick={() => toggleMut.mutate({ id: rule.id, enabled: !rule.is_enabled })}>
        {rule.is_enabled ? <PauseCircle className="size-4" /> : <PlayCircle className="size-4" />}
        {rule.is_enabled ? 'إيقاف' : 'تفعيل'}
      </Button>
      <Button variant="outline" disabled={executeMut.isPending} onClick={() => executeMut.mutate(rule.id)}>
        <RefreshCw className="size-4" />تشغيل الآن
      </Button>
    </div>
  );

  const ruleColumns: ColumnDef<AutomationRule>[] = [
    {
      key: 'rule', priority: 'identity' as const,
      header: 'القاعدة',
      render: (rule) => <div><p className="font-bold">{rule.name}</p><p className="max-w-lg truncate text-xs text-muted-foreground">{rule.description || '—'}</p></div>,
    },
    { key: 'category', priority: 'secondary' as const, header: 'الفئة', render: (rule) => <Badge variant="outline">{mapRuleTypeToCategory(rule.rule_type)}</Badge> },
    { key: 'last_run', priority: 'detail' as const, header: 'آخر تشغيل', render: (rule) => formatAutomationDate(rule.last_run_at) },
    { key: 'result', priority: 'detail' as const, header: 'النتيجة', render: (rule) => rule.last_run_result || '—' },
    { key: 'status', priority: 'primary' as const, header: 'الحالة', render: (rule) => <StatusBadge tone={rule.is_enabled ? 'success' : 'warning'}>{rule.is_enabled ? 'مفعّل' : 'متوقف'}</StatusBadge> },
    { key: 'actions', priority: 'actions' as const, header: 'إجراءات', render: ruleActions },
  ];

  const runColumns: ColumnDef<AutomationRun>[] = [
    { key: 'job', priority: 'identity' as const, header: 'التشغيل', render: (run) => <span className="font-bold">{run.job_name}</span> },
    { key: 'started', priority: 'secondary' as const, header: 'وقت البدء', render: (run) => formatAutomationDate(run.started_at) },
    { key: 'processed', priority: 'detail' as const, header: 'تمت معالجته', render: (run) => run.items_processed },
    { key: 'failed', priority: 'secondary' as const, header: 'فشل', render: (run) => <span className={run.items_failed > 0 ? 'font-bold text-destructive' : undefined}>{run.items_failed}</span> },
    { key: 'status', priority: 'primary' as const, header: 'الحالة', render: (run) => <StatusBadge tone={automationRunStatusTone(run.status)}>{run.status}</StatusBadge> },
  ];

  const notificationColumns: ColumnDef<AutomationNotification>[] = [
    { key: 'title', priority: 'identity' as const, header: 'الإشعار', render: (notification) => <div><p className="font-bold">{notification.title}</p><p className="max-w-xl truncate text-xs text-muted-foreground">{notification.body}</p></div> },
    { key: 'created', priority: 'secondary' as const, header: 'التاريخ', render: (notification) => formatAutomationDate(notification.created_at) },
    {
      key: 'related', priority: 'detail' as const,
      header: 'السياق',
      render: (notification) => notification.related_entity_type ? `مرتبط بـ ${notification.related_entity_type}` : 'عام',
    },
  ];

  return (
    <section className="space-y-5" dir="rtl">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-base font-bold tracking-tight">مركز الأتمتة</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">قواعد محفوظة في قاعدة البيانات مع سجل تشغيل وإشعارات داخل النظام ومنع تكرار.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="success" dot>{counts.enabled} مفعّل</StatusBadge>
            <StatusBadge tone="warning" dot>{counts.disabled} متوقف</StatusBadge>
            <StatusBadge tone="neutral" dot>{counts.all} الكل</StatusBadge>
          </div>
        </div>
        <ResponsiveCardGrid>
          <KpiCard label="قواعد العقود" value={rules.filter((rule) => rule.rule_type === 'contract_expiry').length} icon={CalendarClock} accent="primary" />
          <KpiCard label="قواعد الإيجار" value={rules.filter((rule) => rule.rule_type === 'overdue_invoice').length} icon={MessageCircle} accent="amber" />
          <KpiCard label="إجمالي التشغيلات" value={runs.length} icon={Mail} accent="sky" />
          <KpiCard label="إشعارات النظام" value={notifications.length} icon={Wrench} accent="emerald" />
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
        error={rulesQuery.error}
        errorTitle="تعذر تحميل قواعد الأتمتة"
        errorAction={<Button onClick={() => rulesQuery.refetch()}>إعادة المحاولة</Button>}
        emptyTitle="لا توجد قواعد أتمتة"
        emptyDescription="لا توجد قواعد مطابقة للحالة الحالية."
      >
        <EntityTable
          aria-label="جدول قواعد الأتمتة"
          rows={filteredRules}
          columns={ruleColumns}
          keyOf={(rule) => rule.id}
          mobileVisibleSecondaryKey="status"
        />
      </AsyncContentState>

      <section className="space-y-3">
        <SectionHeader title="سجل التشغيلات" description="آخر عمليات التشغيل وعدد العناصر المعالجة والأخطاء." />
        <AsyncContentState
          status={runsQuery.isLoading ? 'loading' : runsQuery.isError ? 'error' : runs.length === 0 ? 'empty' : 'ready'}
          error={runsQuery.error}
          errorTitle="تعذر تحميل سجل التشغيل"
          errorAction={<Button onClick={() => runsQuery.refetch()}>إعادة المحاولة</Button>}
          emptyTitle="لا يوجد سجل تشغيل بعد"
          emptyDescription="شغّل قاعدة أتمتة لبدء تسجيل التشغيلات."
        >
          <EntityTable aria-label="جدول تشغيلات الأتمتة" rows={runs} columns={runColumns} keyOf={(run) => run.id} mobileVisibleSecondaryKey="status" emptyTitle="لا يوجد سجل تشغيل" />
        </AsyncContentState>
      </section>

      <section className="space-y-3">
        <SectionHeader title="إشعارات النظام" description="الإشعارات التي أنشأتها قواعد الأتمتة داخل النظام دون إظهار معرفات تقنية." />
        <AsyncContentState
          status={notificationsQuery.isLoading ? 'loading' : notificationsQuery.isError ? 'error' : notifications.length === 0 ? 'empty' : 'ready'}
          error={notificationsQuery.error}
          errorTitle="تعذر تحميل إشعارات الأتمتة"
          errorAction={<Button onClick={() => notificationsQuery.refetch()}>إعادة المحاولة</Button>}
          emptyTitle="لا توجد إشعارات"
          emptyDescription="ستظهر إشعارات القواعد هنا بعد تشغيلها."
        >
          <EntityTable aria-label="جدول إشعارات الأتمتة" rows={notifications} columns={notificationColumns} keyOf={(notification) => notification.id} mobileVisibleSecondaryKey="status" emptyTitle="لا توجد إشعارات" />
        </AsyncContentState>
      </section>

      <section className="space-y-3">
        <SectionHeader title="قوالب الإشعارات" description="قوالب معاينة قابلة للتوسعة؛ لا يتم إرسال رسائل خارجية بدون مزود مهيأ." />
        <div className="grid gap-3 md:grid-cols-2">
          {automationTemplatePreviews.map((template) => {
            const Icon = channelIcon[template.channel as AutomationChannel] || MessageCircle;
            const whatsappPreviewUrl = buildTemplateWhatsAppDemoUrl(template);
            return (
              <Card key={template.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm"><Icon className="size-4 text-primary" />{template.title}</CardTitle>
                  <CardDescription>{channelLabel[template.channel as AutomationChannel]}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <pre className="whitespace-pre-wrap rounded-2xl bg-muted/50 p-3 text-xs font-bold leading-6 text-muted-foreground">{template.body}</pre>
                  {whatsappPreviewUrl ? (
                    <Button type="button" variant="secondary" size="sm" asChild>
                      <a href={whatsappPreviewUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4" />معاينة واتساب</a>
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <Card className="border-warning/40 bg-warning/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-warning"><AlertTriangle className="size-5" />ملاحظات الأمان</CardTitle>
          <CardDescription>لا يتم إرسال واتساب أو بريد أو SMS خارجياً من هذا المركز بدون إعداد مزود. التشغيل الحالي يسجل إشعارات داخل النظام وسجل تشغيل فقط.</CardDescription>
        </CardHeader>
      </Card>
    </section>
  );
}
