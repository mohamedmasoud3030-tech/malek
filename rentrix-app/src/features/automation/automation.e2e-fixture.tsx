import { BellRing, CalendarClock, MessageSquareText, Settings2, Zap } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

/**
 * Static marketing/demo capture of the automation center — a scripted
 * view of the rules engine chrome. Rendered only behind VITE_E2E.
 */
const fixtureRules = [
  {
    id: 'r-01',
    icon: CalendarClock,
    title: 'تنبيه انتهاء العقود',
    description: 'إشعار تلقائي قبل انتهاء أي عقد بـ 45 يوماً مع قائمة الوحدات المرتبطة.',
    schedule: 'يومياً 8:00 صباحاً',
    channel: 'داخل التطبيق + بريد',
    active: true,
  },
  {
    id: 'r-02',
    icon: MessageSquareText,
    title: 'تذكير دفع الإيجار',
    description: 'رسالة واتساب مهذبة للمستأجر قبل استحقاق الفاتورة بـ 3 أيام.',
    schedule: 'قبل الاستحقاق بـ 3 أيام',
    channel: 'واتساب',
    active: true,
  },
  {
    id: 'r-03',
    icon: BellRing,
    title: 'إشعار المتأخرات الأسبوعي',
    description: 'ملخص أعمار الديون والفواتير المتجاوزة يصل مدير المكتب كل أحد.',
    schedule: 'كل أحد 9:00 صباحاً',
    channel: 'بريد إلكتروني',
    active: true,
  },
  {
    id: 'r-04',
    icon: Zap,
    title: 'تنبيه طلبات الصيانة العاجلة',
    description: 'إشعار فوري عند تسجيل طلب صيانة بأولوية «عاجلة» لفريق المتابعة.',
    schedule: 'فوري',
    channel: 'داخل التطبيق',
    active: true,
  },
  {
    id: 'r-05',
    icon: Settings2,
    title: 'تذكير قراءات العدادات',
    description: 'تذكير شهري بتسجيل قراءات الكهرباء والمياه للوحدات المشتركة.',
    schedule: 'اليوم الأول من كل شهر',
    channel: 'داخل التطبيق',
    active: false,
  },
] as const;

export function AutomationE2EFixture() {
  return (
    <main className="fixed inset-0 z-[200] overflow-y-auto bg-background text-foreground" dir="rtl" data-e2e-automation-workspace>
      <PageLayout dir="rtl" size="wide">
        <PageHeader
          title="مركز الأتمتة والتذكيرات"
          description="قواعد تشغيل جاهزة تراقب العقود والإيجار والصيانة نيابة عنك — فعّلها مرة واحدة وتعمل بصمت كل يوم."
        />

        <div className="grid gap-3 md:grid-cols-2">
          {fixtureRules.map(({ id, icon: Icon, title, description, schedule, channel, active }) => (
            <Card key={id} className={cn('transition hover:-translate-y-0.5 hover:border-primary/25', !active && 'opacity-70')}>
              <CardContent className="flex items-start gap-4 p-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-extrabold">{title}</p>
                    <StatusBadge tone={active ? 'success' : 'neutral'} dot>
                      {active ? 'مفعّلة' : 'متوقفة'}
                    </StatusBadge>
                  </div>
                  <p className="mt-1.5 text-xs leading-6 text-muted-foreground">{description}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-muted-foreground/80">
                    <span>الجدولة: {schedule}</span>
                    <span>القناة: {channel}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </PageLayout>
    </main>
  );
}
