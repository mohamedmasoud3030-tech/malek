import { Bell, Building2, CalendarClock, CheckCircle2, CreditCard, HandCoins, Landmark, ShieldAlert, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

/**
 * R1 — Dashboard Truth: the alert center consumes server-authoritative COUNTS
 * only. It never receives row datasets and never derives a count by filtering
 * rows in the browser (partial datasets would silently understate priorities).
 *
 * `undefined` means the source failed to load: the Dashboard must say so
 * honestly instead of converting a failed query into a fake zero.
 */
export interface AlertCenterProps {
  expiringContractsCount?: number;
  overdueInvoicesCount?: number;
  urgentMaintenanceCount?: number;
  vacantUnitsCount?: number;
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
  expiringContractsCount,
  overdueInvoicesCount,
  urgentMaintenanceCount,
  vacantUnitsCount,
  unmatchedBankTxCount,
  pendingSettlementsCount,
  integrityWarningsCount,
  className = '',
}: AlertCenterProps) {
  const knownTotal =
    (expiringContractsCount ?? 0) +
    (overdueInvoicesCount ?? 0) +
    (urgentMaintenanceCount ?? 0) +
    (vacantUnitsCount ?? 0) +
    (unmatchedBankTxCount ?? 0) +
    (pendingSettlementsCount ?? 0) +
    (integrityWarningsCount ?? 0);

  const unavailableSources: Array<{ label: string; to: string }> = [];
  if (overdueInvoicesCount === undefined) unavailableSources.push({ label: 'فواتير متأخرة', to: '/arrears' });
  if (expiringContractsCount === undefined) unavailableSources.push({ label: 'عقود تنتهي قريباً', to: '/contracts' });
  if (urgentMaintenanceCount === undefined) unavailableSources.push({ label: 'صيانة عاجلة', to: '/maintenance' });
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
      count: overdueInvoicesCount ?? 0,
      to: '/arrears',
      unavailable: overdueInvoicesCount === undefined,
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
      count: expiringContractsCount ?? 0,
      to: '/contracts',
      unavailable: expiringContractsCount === undefined,
      icon: CalendarClock,
      tone: 'warning',
      critical: true,
      rank: 3,
    },
    {
      label: 'صيانة عاجلة',
      description: 'طلبات عاجلة مفتوحة',
      actionHint: 'راجع الطلبات ذات الأولوية',
      count: urgentMaintenanceCount ?? 0,
      to: '/maintenance',
      unavailable: urgentMaintenanceCount === undefined,
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
      count: vacantUnitsCount ?? 0,
      to: '/units',
      unavailable: vacantUnitsCount === undefined,
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
