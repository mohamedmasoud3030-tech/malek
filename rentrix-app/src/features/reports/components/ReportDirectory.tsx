import {
  ArrowLeft,
  Building2,
  FileText,
  Receipt,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ReportSectionId } from '../reports-page.sections';
import type { ReportViewId } from '../reports-section-model';

type ReportGroup = Readonly<{
  id: 'finance' | 'leases' | 'owners' | 'tenants' | 'properties' | 'control';
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  section: ReportSectionId;
  view: ReportViewId;
  matches: readonly ReportViewId[];
  items: readonly string[];
}>;

const reportGroups: readonly ReportGroup[] = [
  {
    id: 'finance',
    title: 'المالية والتحصيل',
    description: 'التحصيل، المتأخرات، المصروفات وملخص الأداء المالي للفترة.',
    icon: Receipt,
    section: 'analytics',
    view: 'collections',
    matches: ['overview', 'collections', 'overdue', 'expenses'],
    items: ['التحصيل', 'المتأخرات', 'المصروفات', 'ملخص الأداء'],
  },
  {
    id: 'leases',
    title: 'العقود والإيجارات',
    description: 'الإشغال، العقود النشطة والقريبة من الانتهاء والوحدات الشاغرة.',
    icon: FileText,
    section: 'analytics',
    view: 'occupancy',
    matches: ['occupancy'],
    items: ['الإشغال', 'العقود النشطة', 'قرب الانتهاء', 'الوحدات الشاغرة'],
  },
  {
    id: 'owners',
    title: 'الملاك',
    description: 'كشف المالك، الحركة، الاستقطاعات وصافي المستحق للفترة.',
    icon: UsersRound,
    section: 'statements',
    view: '',
    matches: [],
    items: ['كشف المالك', 'الحركة', 'الاستقطاعات', 'صافي المستحق'],
  },
  {
    id: 'tenants',
    title: 'المستأجرون',
    description: 'كشف المستأجر، الفواتير، الرصيد والحركات المرتبطة بالعقد.',
    icon: UserRound,
    section: 'statements',
    view: '',
    matches: [],
    items: ['كشف المستأجر', 'الفواتير', 'الرصيد', 'الحركات'],
  },
  {
    id: 'properties',
    title: 'العقارات والوحدات',
    description: 'أداء العقار، الإشغال والمصروفات التشغيلية عبر النطاق المحدد.',
    icon: Building2,
    section: 'analytics',
    view: 'property_analytics',
    matches: ['property_analytics'],
    items: ['أداء العقار', 'الإشغال', 'الوحدات', 'المصروفات'],
  },
  {
    id: 'control',
    title: 'الرقابة والمطابقة',
    description: 'ميزان المراجعة، الأستاذ العام، التسويات والرقابة المحاسبية.',
    icon: ShieldCheck,
    section: 'accounting',
    view: 'accounting_reports',
    matches: ['accounting_reports', 'general_ledger', 'deferred_revenue'],
    items: ['ميزان المراجعة', 'الأستاذ العام', 'القوائم', 'التسويات'],
  },
];

type ReportDirectoryProps = Readonly<{
  activeSection: ReportSectionId;
  activeView: ReportViewId;
  scope?: Readonly<{
    ownerId?: string;
    tenantId?: string;
    contractId?: string;
  }>;
  onOpen: (section: ReportSectionId, view: ReportViewId) => void;
}>;

export function ReportDirectory({ activeSection, activeView, scope, onOpen }: ReportDirectoryProps) {
  return (
    <section aria-labelledby="report-directory-title" className="space-y-3" data-report-directory>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="report-directory-title" className="text-lg font-black sm:text-xl">مكتبة التقارير</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            اختر نوع التقرير أولاً، ثم استخدم نطاق التقرير للتفاصيل. الملخصات تبقى خفيفة؛ البيانات الكاملة هنا.
          </p>
        </div>
        <p className="text-sm font-semibold text-muted-foreground">6 مجموعات رئيسية</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {reportGroups.map((group) => {
          const Icon = group.icon;
          const isOwnerStatement = group.id === 'owners' && activeSection === 'statements' && Boolean(scope?.ownerId);
          const isTenantStatement = group.id === 'tenants' && activeSection === 'statements' && !scope?.ownerId && Boolean(scope?.tenantId || scope?.contractId);
          const isRegularActive = group.section === activeSection && group.matches.includes(activeView);
          const isActive = isOwnerStatement || isTenantStatement || isRegularActive;

          return (
            <article
              key={group.id}
              className={cn(
                'flex min-h-[12rem] flex-col rounded-2xl border bg-card p-4 shadow-card transition-[border-color,box-shadow,transform] sm:p-5',
                'hover:-translate-y-0.5 hover:shadow-md',
                isActive ? 'border-primary/50 ring-1 ring-primary/15' : 'border-border/70',
              )}
              data-report-group={group.id}
              data-active={isActive ? 'true' : undefined}
            >
              <div className="flex items-start justify-between gap-3">
                <span className={cn(
                  'grid size-11 shrink-0 place-items-center rounded-xl',
                  isActive ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary',
                )}>
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                {isActive ? (
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">مفتوح الآن</span>
                ) : null}
              </div>

              <div className="mt-4 flex-1">
                <h3 className="text-base font-black">{group.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{group.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5" aria-label={`محتويات ${group.title}`}>
                  {group.items.map((item) => (
                    <span key={item} className="rounded-lg border border-border/70 bg-muted/35 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <Button
                type="button"
                variant={isActive ? 'secondary' : 'outline'}
                className="mt-4 min-h-11 w-full justify-between"
                onClick={() => onOpen(group.section, group.view)}
              >
                <span>{isActive ? 'التقرير مفتوح' : 'فتح المجموعة'}</span>
                <ArrowLeft className="size-4" aria-hidden="true" />
              </Button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
