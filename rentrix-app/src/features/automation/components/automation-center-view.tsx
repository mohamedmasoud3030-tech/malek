import {
  BellRing,
  CalendarClock,
  Mail,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  Settings2,
  Smartphone,
  Wrench,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { MobileCard } from '@/components/ui/mobile-card';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { automationRulesCatalog, automationTemplatePreviews } from '../automation-catalog';
import type { AutomationChannel, AutomationRule, AutomationStatus } from '../types';

const channelLabel: Record<AutomationChannel, string> = {
  whatsapp: 'واتساب',
  email: 'بريد إلكتروني',
  in_app: 'داخل النظام',
  sms: 'رسالة نصية',
};

const statusLabel: Record<AutomationStatus, string> = {
  active: 'مفعّل',
  paused: 'متوقف',
  draft: 'مسودة',
};

const statusTone: Record<AutomationStatus, 'success' | 'warning' | 'neutral'> = {
  active: 'success',
  paused: 'warning',
  draft: 'neutral',
};

const categoryLabel: Record<AutomationRule['category'], string> = {
  contracts: 'العقود',
  rent: 'الإيجار',
  owners: 'الملاك',
  maintenance: 'الصيانة',
  collections: 'التحصيل',
};

const channelIcon: Record<AutomationChannel, typeof MessageCircle> = {
  whatsapp: MessageCircle,
  email: Mail,
  in_app: BellRing,
  sms: Smartphone,
};

type StatusFilter = 'all' | AutomationStatus;

export function AutomationCenterView() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [localStatus, setLocalStatus] = useState<Record<string, AutomationStatus>>(() =>
    Object.fromEntries(automationRulesCatalog.map((rule) => [rule.id, rule.status])),
  );

  const rules = useMemo(() => {
    return automationRulesCatalog
      .map((rule) => ({ ...rule, status: localStatus[rule.id] ?? rule.status }))
      .filter((rule) => (statusFilter === 'all' ? true : rule.status === statusFilter));
  }, [localStatus, statusFilter]);

  const counts = useMemo(() => {
    const all = automationRulesCatalog.map((rule) => localStatus[rule.id] ?? rule.status);
    return {
      all: all.length,
      active: all.filter((status) => status === 'active').length,
      paused: all.filter((status) => status === 'paused').length,
      draft: all.filter((status) => status === 'draft').length,
    };
  }, [localStatus]);

  const toggleRule = (rule: AutomationRule) => {
    setLocalStatus((current) => {
      const currentStatus = current[rule.id] ?? rule.status;
      if (currentStatus === 'draft') {
        return { ...current, [rule.id]: 'active' };
      }
      return {
        ...current,
        [rule.id]: currentStatus === 'active' ? 'paused' : 'active',
      };
    });
  };

  return (
    <section className="space-y-5">
      <Card className="border-primary/10 bg-gradient-to-l from-primary/10 via-card to-card">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="size-5" />
              مركز الأتمتة
            </CardTitle>
            <CardDescription>
              إدارة تذكيرات العقود والإيجار وتقارير الملاك وتنبيهات الصيانة. الواجهة جاهزة للربط مع محرك المهام لاحقاً دون تغيير تجربة المستخدم.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="success" dot>
              {counts.active} مفعّل
            </Badge>
            <Badge variant="warning" dot>
              {counts.paused} متوقف
            </Badge>
            <Badge variant="outline" dot>
              {counts.draft} مسودة
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard icon={CalendarClock} label="تذكيرات العقود" value="2" />
          <SummaryCard icon={MessageCircle} label="تذكيرات الإيجار" value="2" />
          <SummaryCard icon={Mail} label="تقارير الملاك" value="1" />
          <SummaryCard icon={Wrench} label="تنبيهات الصيانة" value="1" />
        </CardContent>
      </Card>

      <FilterTabs
        value={statusFilter}
        onChange={(value) => setStatusFilter(value as StatusFilter)}
        options={[
          { value: 'all', label: 'الكل', count: counts.all },
          { value: 'active', label: 'مفعّل', count: counts.active },
          { value: 'paused', label: 'متوقف', count: counts.paused },
          { value: 'draft', label: 'مسودة', count: counts.draft },
        ]}
      />

      <div className="grid gap-3 md:hidden">
        {rules.map((rule) => {
          const Icon = channelIcon[rule.channel];
          return (
            <MobileCard
              key={rule.id}
              title={rule.name}
              subtitle={rule.description}
              badge={<StatusBadge tone={statusTone[rule.status]}>{statusLabel[rule.status]}</StatusBadge>}
              meta={
                <div className="space-y-1">
                  <p className="flex items-center gap-1.5">
                    <Icon className="size-3.5" />
                    {channelLabel[rule.channel]} · {categoryLabel[rule.category]}
                  </p>
                  <p>المشغّل: {rule.triggerLabel}</p>
                  <p>الجمهور: {rule.audienceLabel}</p>
                </div>
              }
              actions={
                <Button variant="secondary" className="min-h-11" onClick={() => toggleRule(rule)}>
                  {rule.status === 'active' ? (
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
              }
            />
          );
        })}
      </div>

      <div className="hidden gap-3 md:grid">
        {rules.map((rule) => {
          const Icon = channelIcon[rule.channel];
          return (
            <Card key={rule.id} className="border-border/70">
              <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-black">{rule.name}</h3>
                    <StatusBadge tone={statusTone[rule.status]}>{statusLabel[rule.status]}</StatusBadge>
                    <Badge variant="outline">{categoryLabel[rule.category]}</Badge>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{rule.description}</p>
                  <div className="flex flex-wrap gap-3 text-xs font-bold text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Icon className="size-3.5" />
                      {channelLabel[rule.channel]}
                    </span>
                    <span>المشغّل: {rule.triggerLabel}</span>
                    <span>الجمهور: {rule.audienceLabel}</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="secondary" onClick={() => toggleRule(rule)}>
                    {rule.status === 'active' ? (
                      <>
                        <PauseCircle className="me-2 size-4" />
                        إيقاف مؤقت
                      </>
                    ) : (
                      <>
                        <PlayCircle className="me-2 size-4" />
                        تفعيل القاعدة
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <section className="space-y-3">
        <SectionHeader
          title="قوالب الإشعارات"
          description="قوالب قابلة للتوسعة — لا يتم إرسال رسائل خارجية من هذه الشاشة مباشرة."
        />
        <div className="grid gap-3 md:grid-cols-2">
          {automationTemplatePreviews.map((template) => {
            const Icon = channelIcon[template.channel];
            return (
              <Card key={template.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Icon className="size-4 text-primary" />
                    {template.title}
                  </CardTitle>
                  <CardDescription>{channelLabel[template.channel]}</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap rounded-2xl bg-muted/50 p-3 text-xs font-bold leading-6 text-muted-foreground">
                    {template.body}
                  </pre>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </section>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: Readonly<{ icon: typeof CalendarClock; label: string; value: string }>) {
  return (
    <div className="rounded-2xl border bg-background/70 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <p className="text-xs font-bold">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}
