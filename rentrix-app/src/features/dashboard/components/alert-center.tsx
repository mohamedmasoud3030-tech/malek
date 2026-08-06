import { Bell, Building2, CalendarClock, CheckCircle2, CreditCard, HandCoins, Landmark, ShieldAlert, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import type { ContractListItem } from '@/features/contracts/services/contractService';

export interface AlertCenterProps {
  expiringContracts: ContractListItem[];
  overdueInvoices: Array<{
    id: string;
    amount: number;
    paid_amount?: number;
    due_date: string;
    tenant_name?: string | null;
    invoice_number?: string | null;
  }>;
  urgentMaintenance: Array<{
    id: string;
    title: string | null;
    priority: string | null;
    property_id?: string | null;
    unit_id?: string | null;
    property_title?: string;
    unit_number?: string;
  }>;
  vacantUnitsCount?: number;
  /**
   * Auxiliary counts come from independent queries. `undefined` means the
   * source failed to load: the Dashboard must say so honestly instead of
   * converting a failed query into a fake zero.
   */
  unmatchedBankTxCount?: number;
  pendingSettlementsCount?: number;
  integrityWarningsCount?: number;
  className?: string;
}

type PriorityTone = 'danger' | 'warning' | 'success' | 'info' | 'neutral';

type PriorityItem = Readonly<{
  label: string;
  description: string;
  actionHint: string;
  count: number;
  to: string;
  unavailable: boolean;
  icon: LucideIcon;
  tone: PriorityTone;
  critical: boolean;
  rank: number;
}>;

function getDaysUntil(date: string): number {
  const target = new Date(`${date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function priorityStatusLabel(priority: Pick<PriorityItem, 'unavailable' | 'count'>) {
  return priority.unavailable ? 'غير متاح' : priority.count;
}

function PriorityRow({ priority, secondary = false }: { priority: PriorityItem; secondary?: boolean }) {
  const Icon = priority.icon;
  return (
    <Link
      key={priority.to}
      to={priority.to}
      className={cn('dashboard-priority-row', secondary && 'dashboard-priority-row--secondary')}
      data-dashboard-priority-link={secondary ? undefined : true}
      data-dashboard-priority-secondary-link={secondary ? true : undefined}
      data-tone={priority.tone}
      aria-label={`${priority.label} — ${priority.unavailable ? 'غير متاح' : `${priority.count} حالة`} — ${priority.actionHint}`}
    >
      <span className="dashboard-priority-row__icon" aria-hidden="true">
        <Icon className="size-4" />
      </span>
      <span className="dashboard-priority-row__content">
        <span className="dashboard-priority-row__title">{priority.label}</span>
        <span className="dashboard-priority-row__hint">
          {priority.unavailable ? 'تعذر تحميل العدد الآن — افتح الصفحة للتحقق' : priority.actionHint}
        </span>
      </span>
      <StatusBadge tone={priority.unavailable ? 'neutral' : priority.tone}>{priorityStatusLabel(priority)}</StatusBadge>
    </Link>
  );
}

export function AlertCenter({
  expiringContracts,
  overdueInvoices,
  urgentMaintenance,
  vacantUnitsCount = 0,
  unmatchedBankTxCount,
  pendingSettlementsCount,
  integrityWarningsCount,
  className = '',
}: AlertCenterProps) {
  const contractCount = expiringContracts.filter((c) => {
    const days = getDaysUntil(c.end_date);
    return days >= 0 && days <= 30;
  }).length;
  const overdueCount = overdueInvoices.length;
  const maintenanceCount = urgentMaintenance.filter(
    (r) => r.priority === 'urgent' || r.priority === 'high',
  ).length;
  const knownTotal =
    contractCount +
    overdueCount +
    maintenanceCount +
    vacantUnitsCount +
    (unmatchedBankTxCount ?? 0) +
    (pendingSettlementsCount ?? 0) +
    (integrityWarningsCount ?? 0);

  const unavailableSources: Array<{ label: string; to: string }> = [];
  if (unmatchedBankTxCount === undefined) unavailableSources.push({ label: 'حركات بنكية معلقة', to: '/bank-reconciliation' });
  if (pendingSettlementsCount === undefined) unavailableSources.push({ label: 'تسويات ملاك جاهزة', to: '/owner-settlements' });
  if (integrityWarningsCount === undefined) unavailableSources.push({ label: 'تنبيهات سلامة البيانات', to: '/data-integrity' });

  const hasUnavailable = unavailableSources.length > 0;

  if (knownTotal === 0 && !hasUnavailable) {
    return (
      <section className={cn('dashboard-priority-panel dashboard-priority-panel--clear', className)} aria-label="الأولوية الآن">
        <div className="dashboard-priority-clear">
          <span className="dashboard-priority-clear__icon" aria-hidden="true">
            <CheckCircle2 className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-success">لا توجد أعمال عاجلة</h2>
            <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">انتقل إلى المؤشرات لمراجعة الأداء الحالي.</p>
          </div>
        </div>
      </section>
    );
  }

  const priorities: PriorityItem[] = [
    {
      label: 'فواتير متأخرة',
      description: 'متأخرات تحصيل مفتوحة',
      actionHint: 'ابدأ متابعة التحصيل',
      count: overdueCount,
      to: '/arrears',
      unavailable: false,
      icon: CreditCard,
      tone: 'danger',
      critical: true,
      rank: 1,
    },
    {
      label: 'تنبيهات سلامة البيانات',
      description: 'فحوص تطابق تحتاج مراجعة',
      actionHint: 'صحح السجلات المتأثرة',
      count: integrityWarningsCount ?? 0,
      unavailable: integrityWarningsCount === undefined,
      to: '/data-integrity',
      icon: ShieldAlert,
      tone: 'danger',
      critical: true,
      rank: 2,
    },
    {
      label: 'عقود تنتهي قريباً',
      description: 'نافذة الثلاثين يوماً',
      actionHint: 'راجع التجديد أو الإخلاء',
      count: contractCount,
      to: '/contracts',
      unavailable: false,
      icon: CalendarClock,
      tone: 'warning',
      critical: true,
      rank: 3,
    },
    {
      label: 'صيانة عاجلة',
      description: 'طلبات عالية أو عاجلة',
      actionHint: 'راجع الطلبات ذات الأولوية',
      count: maintenanceCount,
      to: '/maintenance',
      unavailable: false,
      icon: Wrench,
      tone: 'warning',
      critical: true,
      rank: 4,
    },
    {
      label: 'تسويات ملاك جاهزة',
      description: 'اعتماد أو صرف منتظر',
      actionHint: 'أكمل الاعتماد أو الصرف',
      count: pendingSettlementsCount ?? 0,
      unavailable: pendingSettlementsCount === undefined,
      to: '/owner-settlements',
      icon: HandCoins,
      tone: 'warning',
      critical: false,
      rank: 5,
    },
    {
      label: 'حركات بنكية معلقة',
      description: 'بنود كشف غير مطابقة',
      actionHint: 'طابق الحركات البنكية',
      count: unmatchedBankTxCount ?? 0,
      unavailable: unmatchedBankTxCount === undefined,
      to: '/bank-reconciliation',
      icon: Landmark,
      tone: 'warning',
      critical: false,
      rank: 6,
    },
    {
      label: 'وحدات شاغرة',
      description: 'فرص إعادة التأجير',
      actionHint: 'راجع جاهزية التأجير',
      count: vacantUnitsCount,
      to: '/units',
      unavailable: false,
      icon: Building2,
      tone: 'info',
      critical: false,
      rank: 7,
    },
  ];

  const activePriorities = priorities
    .filter((priority) => priority.count > 0 || priority.unavailable)
    .sort((a, b) => {
      if (a.critical !== b.critical) return a.critical ? -1 : 1;
      if (a.unavailable !== b.unavailable) return a.unavailable ? -1 : 1;
      return a.rank - b.rank;
    });
  const immediatePriorities = activePriorities.filter((priority) => priority.critical);
  const extraPriorities = activePriorities.filter((priority) => !priority.critical);
  const visibleExtraPriorities = immediatePriorities.length < 4 ? extraPriorities.slice(0, 4 - immediatePriorities.length) : [];
  const visiblePriorities = [...immediatePriorities, ...visibleExtraPriorities];
  const deferredPriorities = extraPriorities.slice(visibleExtraPriorities.length);

  return (
    <section className={cn('dashboard-priority-panel', className)} aria-label="الأولوية الآن" data-dashboard-priority-panel>
      <div className="dashboard-priority-summary">
        <div className="dashboard-priority-summary__icon" aria-hidden="true">
          <Bell className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="dashboard-priority-summary__title">الأولوية الآن</h2>
            {knownTotal > 0 ? <StatusBadge tone="danger">{knownTotal} متابعة</StatusBadge> : null}
          </div>
          <p className="dashboard-priority-summary__copy">
            {knownTotal > 0 ? `${knownTotal} حالة تحتاج قراراً أو متابعة` : 'لا توجد حالات عاجلة معروفة حالياً'}
            {hasUnavailable ? ' — بعض المؤشرات غير متاحة الآن' : ''}
          </p>
        </div>
      </div>

      <div className="dashboard-priority-list" role="list">
        {visiblePriorities.map((priority) => (
          <div key={priority.to} role="listitem">
            <PriorityRow priority={priority} />
          </div>
        ))}
      </div>

      {deferredPriorities.length > 0 ? (
        <details className="dashboard-priority-disclosure">
          <summary>عرض الكل ({deferredPriorities.length})</summary>
          <div className="dashboard-priority-list dashboard-priority-list--deferred" role="list">
            {deferredPriorities.map((priority) => (
              <div key={priority.to} role="listitem">
                <PriorityRow priority={priority} secondary />
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
