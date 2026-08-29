/**
 * Command center — unified "needs attention" queue.
 *
 * Today previously split attention across several cards, forcing the office
 * owner to interpret each one separately. This module merges the EXISTING
 * authoritative signals into one ranked queue:
 *
 * - overdue invoices / urgent maintenance / expiring contracts: bounded queue
 *   rows from the server read model (rpt_dashboard_snapshot) — presentation
 *   context, with the server counts remaining authoritative;
 * - long vacancy: the shared vacancy derivation (complete units read);
 * - utility obligations / maintenance follow-up: their shared derivations
 *   over complete paged reads;
 * - owner settlements and bank exceptions: snapshot KPI counts.
 *
 * Nothing is counted here from capped datasets, and no business rule is
 * re-decided: severity thresholds below are presentation ranking only.
 */
import type { DashboardSnapshot } from './dashboard-snapshot';
import type { MaintenanceFollowUpSignal } from './maintenance-follow-up-signal';
import type { UtilityObligationsSignal } from './utility-obligations-signal';
import type { VacancyAnalytics } from '@/features/units/vacancy-analytics';

export type NeedsAttentionSeverity = 'danger' | 'warning' | 'info';

export type NeedsAttentionItem = Readonly<{
  /** Stable render key. */
  key: string;
  severity: NeedsAttentionSeverity;
  /** Age used for ranking inside a severity; 0 when age does not apply. */
  ageDays: number;
  title: string;
  meta: string;
  /** Router path of the owning workspace. */
  to: string;
  /** Set for items that open a contract dossier through the modal route. */
  contractId?: string;
}>;

export type NeedsAttentionSignal = Readonly<{
  items: readonly NeedsAttentionItem[];
  /** Every merged item, before any presentation cap. */
  totalCount: number;
  /** False when one or more contributing reads were unavailable. */
  isComplete: boolean;
}>;

export const EMPTY_NEEDS_ATTENTION_SIGNAL: NeedsAttentionSignal = {
  items: [],
  totalCount: 0,
  isComplete: true,
};

/** A vacancy older than this joins the queue — the re-letting risk window. */
export const NEEDS_ATTENTION_VACANCY_DAYS = 60;

const severityRank: Record<NeedsAttentionSeverity, number> = {
  danger: 0,
  warning: 1,
  info: 2,
};

function formatQueueLocation(propertyTitle: string | null, unitNumber: string | null) {
  const property = propertyTitle ?? 'عقار غير محدد';
  return unitNumber ? `${property} / وحدة ${unitNumber}` : property;
}

export function buildNeedsAttentionSignal(params: {
  snapshot: DashboardSnapshot | undefined;
  vacancyAnalytics: VacancyAnalytics | undefined;
  utilityObligations: UtilityObligationsSignal;
  maintenanceFollowUp: MaintenanceFollowUpSignal;
  isComplete?: boolean;
}): NeedsAttentionSignal {
  const { snapshot, vacancyAnalytics, utilityObligations, maintenanceFollowUp, isComplete = true } = params;
  if (!snapshot) return { ...EMPTY_NEEDS_ATTENTION_SIGNAL, isComplete: false };

  const items: NeedsAttentionItem[] = [];

  // 1) Overdue invoices — the collection queue, most overdue first (server order).
  for (const row of snapshot.queues.overdueInvoices) {
    items.push({
      key: `overdue-${row.invoiceId}`,
      severity: 'danger',
      ageDays: row.daysOverdue,
      title: row.tenantName ?? 'مستأجر غير محدد',
      meta: `فاتورة متأخرة ${row.daysOverdue} يوم · ${formatQueueLocation(row.propertyTitle, row.unitNumber)}`,
      to: '/arrears',
    });
  }

  // 2) Urgent maintenance — reported emergencies still open.
  for (const row of snapshot.queues.urgentMaintenance) {
    items.push({
      key: `urgent-maintenance-${row.id}`,
      severity: 'danger',
      ageDays: 0,
      title: row.title || 'طلب صيانة عاجل',
      meta: `صيانة عاجلة · ${formatQueueLocation(row.propertyTitle, row.unitNumber)}`,
      to: '/maintenance',
    });
  }

  // 3) Contracts nearing expiry — the renewal decision window.
  for (const row of snapshot.queues.expiringContracts) {
    items.push({
      key: `expiring-${row.id}`,
      severity: row.daysRemaining <= 7 ? 'danger' : 'warning',
      ageDays: Math.max(0, 30 - row.daysRemaining),
      title: row.tenantName ?? 'مستأجر غير محدد',
      meta: `عقد ينتهي خلال ${row.daysRemaining} يوم · ${formatQueueLocation(row.propertyTitle, row.unitNumber)}`,
      to: '/contracts',
      contractId: row.id,
    });
  }

  // 4) Vacancies aging past the re-letting window.
  const longVacancies = (vacancyAnalytics?.vacantRows ?? []).filter(
    (row) => row.daysVacant >= NEEDS_ATTENTION_VACANCY_DAYS,
  );
  for (const row of longVacancies) {
    items.push({
      key: `vacant-${row.unitId}`,
      severity: 'warning',
      ageDays: row.daysVacant,
      title: `وحدة ${row.unitNumber}`,
      meta: `شاغرة منذ ${row.daysVacant} يوم · ${row.propertyTitle}`,
      to: '/units',
    });
  }

  // 5) Stalled maintenance follow-up (one aggregate item, oldest first).
  if (maintenanceFollowUp.actionableCount > 0) {
    items.push({
      key: 'maintenance-follow-up',
      severity: 'warning',
      ageDays: maintenanceFollowUp.oldestOpenAgeDays ?? 0,
      title: `${maintenanceFollowUp.actionableCount} طلب صيانة يحتاج متابعة`,
      meta: maintenanceFollowUp.stalledCount > 0
        ? `${maintenanceFollowUp.stalledCount} متوقف عن التقدم`
        : 'طلبات تجاوزت مواعيدها أو بانتظار الإغلاق',
      to: '/maintenance',
    });
  }

  // 6) Utility obligations — late claims rank above imminently due ones.
  if (utilityObligations.summary.overdueCount > 0) {
    items.push({
      key: 'utilities-overdue',
      severity: 'danger',
      ageDays: utilityObligations.rows[0]?.urgency === 'overdue' ? utilityObligations.rows[0].daysOverdue : 0,
      title: `${utilityObligations.summary.overdueCount} فاتورة مرافق متأخرة`,
      meta: 'سداد المرافق المتأخرة مطلوب الآن',
      to: '/utilities',
    });
  }
  if (utilityObligations.summary.dueSoonCount > 0) {
    items.push({
      key: 'utilities-due-soon',
      severity: 'warning',
      ageDays: 0,
      title: `${utilityObligations.summary.dueSoonCount} فاتورة مرافق تستحق قريباً`,
      meta: 'راجع المطالبة والمسؤول عن السداد',
      to: '/utilities',
    });
  }

  // 7) Owner settlements waiting on the office.
  if (snapshot.ownerFunds.settlementsApproved > 0) {
    items.push({
      key: 'owner-settlements-approved',
      severity: 'warning',
      ageDays: 0,
      title: `${snapshot.ownerFunds.settlementsApproved} تسوية ملاك معتمدة بانتظار الصرف`,
      meta: 'أكمل الصرف من تسويات الملاك',
      to: '/owner-settlements',
    });
  }
  if (snapshot.ownerFunds.settlementsDraft > 0) {
    items.push({
      key: 'owner-settlements-draft',
      severity: 'info',
      ageDays: 0,
      title: `${snapshot.ownerFunds.settlementsDraft} تسوية ملاك بانتظار الاعتماد`,
      meta: 'راجع المسودة واعتمدها',
      to: '/owner-settlements',
    });
  }

  // 8) Bank lines waiting for matching.
  if (snapshot.exceptions.unmatchedBankLines > 0) {
    items.push({
      key: 'bank-reconciliation',
      severity: 'warning',
      ageDays: 0,
      title: `${snapshot.exceptions.unmatchedBankLines} حركة بنكية غير مطابقة`,
      meta: 'طابق حركات كشف البنك',
      to: '/bank-reconciliation',
    });
  }

  items.sort((a, b) => {
    if (severityRank[a.severity] !== severityRank[b.severity]) return severityRank[a.severity] - severityRank[b.severity];
    if (a.ageDays !== b.ageDays) return b.ageDays - a.ageDays;
    return a.title.localeCompare(b.title, 'ar');
  });

  return { items, totalCount: items.length, isComplete };
}
