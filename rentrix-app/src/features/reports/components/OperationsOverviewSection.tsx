import { useMemo } from 'react';
import {
  ArrowLeft,
  CalendarClock,
  ReceiptText,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import type { ExpenseBreakdownReport } from '@/features/financials/reports/financial-reporting/report-types';
import type { Maintenance } from '@/features/maintenance/maintenance-service';
import type { MaintenanceSummary } from '@/features/maintenance/maintenance-helpers';
import {
  normalizeMaintenancePriority,
  normalizeMaintenanceStatus,
} from '@/lib/maintenanceStatus';
import { formatLatinNumber } from '@/lib/formatters';
import type { ReportDrillHandler } from '../report-route';
import {
  ReportInsightNote,
  ReportList,
  ReportListRow,
  ReportPanel,
  ReportProgress,
  ReportState,
  ReportSummaryStrip,
} from '@/components/ui/report-section-primitives';

type OperationsOverviewProps = Readonly<{
  expenseReport: ExpenseBreakdownReport | undefined;
  maintenanceRows: Maintenance[];
  maintenanceSummary: MaintenanceSummary;
  isLoading: boolean;
  onDrill: ReportDrillHandler;
}>;

/**
 * نظرة تشغيلية — the operations workspace's opening perspective.
 *
 * Financial-safety rule: cost figures from different sources are displayed
 * separately with explicit labels. They are NEVER summed into a single
 * "operating cost" total because maintenance records may already be
 * represented by posted expense records (double-counting risk).
 *
 * UI rule: all interactive controls use canonical MALEK shared components
 * (Button, ReportList, ReportListRow, ReportProgress) — no local
 * re-implementations of shared application patterns.
 */
export function OperationsOverviewSection({
  expenseReport,
  maintenanceRows,
  maintenanceSummary,
  isLoading,
  onDrill,
}: OperationsOverviewProps) {
  const maintenanceRecordedCost = useMemo(
    () => maintenanceRows.reduce((total, row) => total + (row.cost ?? 0), 0),
    [maintenanceRows],
  );

  const openRequests =
    (maintenanceSummary.open ?? 0) + (maintenanceSummary.inProgress ?? 0);
  const totalRequests = maintenanceSummary.total ?? 0;
  const urgentOpenRequests = useMemo(
    () =>
      maintenanceRows.filter((row) => {
        const status = normalizeMaintenanceStatus(row.status);
        return (
          (status === 'open' || status === 'in_progress') &&
          normalizeMaintenancePriority(row.priority) === 'urgent'
        );
      }).length,
    [maintenanceRows],
  );
  const completedRequests = useMemo(
    () =>
      maintenanceRows.filter((row) => {
        const status = normalizeMaintenanceStatus(row.status);
        return status === 'resolved' || status === 'closed';
      }).length,
    [maintenanceRows],
  );
  const actionableRequests = useMemo(
    () =>
      maintenanceRows.filter(
        (row) => normalizeMaintenanceStatus(row.status) !== 'cancelled',
      ).length,
    [maintenanceRows],
  );

  // Urgency ratio is restricted to the active backlog. The summary's `urgent`
  // count spans all rows, including resolved/cancelled records, so it is not a
  // valid numerator for "urgent among open".
  const urgencyRatio =
    openRequests > 0 ? (urgentOpenRequests / openRequests) * 100 : null;

  // Completion ratio excludes cancelled work: cancelled ≠ completed.
  const completionRatio =
    actionableRequests > 0
      ? (completedRequests / actionableRequests) * 100
      : null;

  const topExpenseProperties = useMemo(
    () =>
      [...(expenseReport?.byProperty ?? [])]
        .sort((a, b) => b.total - a.total)
        .slice(0, 3),
    [expenseReport?.byProperty],
  );

  const topExpenseCategories = useMemo(
    () =>
      [...(expenseReport?.byCategory ?? [])]
        .sort((a, b) => b.total - a.total)
        .slice(0, 3),
    [expenseReport?.byCategory],
  );

  const insightBody = (() => {
    if (
      urgentOpenRequests > 0 &&
      openRequests > 0 &&
      urgentOpenRequests / openRequests >= 0.5
    ) {
      return `نصف الطلبات المفتوحة أو أكثر مصنّفة عاجلة (${formatLatinNumber(urgentOpenRequests, 'ar')} من ${formatLatinNumber(openRequests, 'ar')}). راجع جدولة التنفيذ وأولويات الفريق.`;
    }
    if (openRequests > 0 && completionRatio !== null && completionRatio < 40) {
      return 'معدل إنجاز الطلبات منخفض نسبيًا — المتراكم يتزايد. راجع قدرة الفريق أو أولويات التسليم.';
    }
    if (topExpenseProperties.length > 0) {
      const top = topExpenseProperties[0];
      const share =
        expenseReport?.totalExpenses && expenseReport.totalExpenses > 0
          ? (top.total / expenseReport.totalExpenses) * 100
          : 0;
      if (share > 65) {
        return `عقار واحد يتحمل أكثر من ${Math.round(share)}٪ من المصروفات المسجلة. راجع الصيانة والخدمات المرتبطة بهذا العقار.`;
      }
    }
    return 'المؤشرات التشغيلية متوازنة نسبيًا داخل نطاق التقرير. استخدم لوحات التفاصيل للتحقق من حالة كل مصروف.';
  })();

  return (
    <div className="space-y-4">
      <ReportPanel
        title="مؤشرات التكلفة المنفصلة"
        description="كل مؤشر من مصدره المستقل — لا يُجمع تلقائيًا لأن بعض تكاليف الصيانة قد تكون مُرحَّلة ضمن المصروفات المسجلة."
        eyebrow="تكلفة التشغيل"
        icon={ShieldAlert}
        isLoading={isLoading}
      >
        <div className="px-4 pt-3 pb-4 sm:px-5">
          <ReportSummaryStrip
            dataReportSummary="operations-overview"
            items={[
              {
                label: 'المصروفات المسجلة',
                value: formatMoney(expenseReport?.totalExpenses ?? 0),
                detail: 'من سندات المصروفات',
              },
              {
                label: 'تكلفة صيانة في سجلاتها',
                value: formatMoney(maintenanceRecordedCost),
                detail: 'غير مضمونة الترحيل',
                tone: 'warning',
              },
              {
                label: 'طلبات مفتوحة',
                value: formatLatinNumber(openRequests, 'ar'),
                detail: 'مفتوحة أو قيد التنفيذ',
                tone: openRequests > 0 ? 'warning' : 'default',
              },
              urgencyRatio !== null
                ? {
                    label: 'عاجلة من المفتوحة',
                    value: `${formatLatinNumber(Math.round(urgencyRatio), 'ar')}%`,
                    detail: `${formatLatinNumber(urgentOpenRequests, 'ar')} طلب عاجل`,
                    tone:
                      urgencyRatio >= 50
                        ? 'critical'
                        : urgencyRatio >= 25
                          ? 'warning'
                          : 'default',
                  }
                : {
                    label: 'طلبات عاجلة',
                    value: formatLatinNumber(urgentOpenRequests, 'ar'),
                    detail:
                      urgentOpenRequests === 0
                        ? 'لا طلبات عاجلة'
                        : 'بدون طلبات مفتوحة',
                  },
            ]}
          />
        </div>
      </ReportPanel>

      <ReportInsightNote title="قراءة العمليات">
        {insightBody}
      </ReportInsightNote>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportPanel
          title="المصروفات المسجلة"
          description="أعلى العقارات والتصنيفات تكلفةً من سندات المصروفات في النطاق."
          eyebrow="سندات"
          icon={ReceiptText}
          isLoading={isLoading}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDrill('analytics', 'expenses')}
              className="min-h-11 gap-1.5 text-xs font-black text-primary"
            >
              التفاصيل الكاملة
              <ArrowLeft className="size-3.5" aria-hidden="true" />
            </Button>
          }
        >
          {topExpenseProperties.length === 0 ? (
            <div className="p-4">
              <ReportState message="لا توجد مصروفات مسجلة في الفترة." />
            </div>
          ) : (
            <>
              <ReportList>
                {topExpenseProperties.map((row) => (
                  <ReportListRow
                    key={row.propertyId}
                    title={row.propertyTitle ?? 'عقار غير محدد'}
                    subtitle={`${formatLatinNumber(row.count, 'ar')} حركة`}
                    value={<span dir="ltr">{formatMoney(row.total)}</span>}
                    action={
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          onDrill('analytics', 'property_analytics', {
                            propertyId: row.propertyId,
                          })
                        }
                        className="min-h-11 px-2 text-muted-foreground hover:text-primary"
                        aria-label={`عرض تفاصيل ${row.propertyTitle ?? 'عقار غير محدد'}`}
                      >
                        <ArrowLeft className="size-3.5" aria-hidden="true" />
                      </Button>
                    }
                  />
                ))}
              </ReportList>

              {topExpenseCategories.length > 0 && (
                <>
                  <div className="border-t border-border/60 px-4 pb-1 pt-3 sm:px-5">
                    <p className="text-xs font-extrabold text-muted-foreground">
                      أعلى التصنيفات
                    </p>
                  </div>
                  <ReportList>
                    {topExpenseCategories.map((row) => (
                      <ReportListRow
                        key={row.category}
                        title={row.category}
                        subtitle={`${formatLatinNumber(row.count, 'ar')} حركة`}
                        value={<span dir="ltr">{formatMoney(row.total)}</span>}
                      />
                    ))}
                  </ReportList>
                </>
              )}
            </>
          )}
        </ReportPanel>

        <ReportPanel
          title="الصيانة"
          description="حالة الطلبات وتوزيع الأولويات وتكلفة سجلات الصيانة في النطاق."
          eyebrow="أعمال مفتوحة"
          icon={Wrench}
          isLoading={isLoading}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDrill('analytics', 'maintenance_analytics')}
              className="min-h-11 gap-1.5 text-xs font-black text-primary"
            >
              تحليلات الصيانة
              <ArrowLeft className="size-3.5" aria-hidden="true" />
            </Button>
          }
        >
          {totalRequests === 0 ? (
            <div className="p-4">
              <ReportState message="لا توجد طلبات صيانة في نطاق التقرير الحالي." />
            </div>
          ) : (
            <>
              <ReportList>
                {(
                  [
                    ['إجمالي الطلبات', totalRequests],
                    ['مفتوحة', maintenanceSummary.open ?? 0],
                    ['قيد التنفيذ', maintenanceSummary.inProgress ?? 0],
                    ['عاجلة مفتوحة', urgentOpenRequests],
                    ['منجزة', completedRequests],
                  ] as const
                ).map(([label, count]) => (
                  <ReportListRow
                    key={label}
                    title={label}
                    value={
                      <span dir="ltr" className="tabular-nums">
                        {formatLatinNumber(count, 'ar')}
                      </span>
                    }
                  />
                ))}
              </ReportList>

              <div className="space-y-3 p-4 pt-3 sm:px-5">
                {urgencyRatio !== null && (
                  <ReportProgress
                    label="ضغط الأولوية العاجلة"
                    value={urgencyRatio}
                    helper={
                      urgentOpenRequests > 0
                        ? `${formatLatinNumber(urgentOpenRequests, 'ar')} عاجل من ${formatLatinNumber(openRequests, 'ar')} مفتوح`
                        : 'لا طلبات عاجلة في الطلبات المفتوحة'
                    }
                    tone={
                      urgencyRatio >= 50
                        ? 'critical'
                        : urgencyRatio >= 25
                          ? 'warning'
                          : 'good'
                    }
                  />
                )}
                {completionRatio !== null && (
                  <ReportProgress
                    label="معدل إنجاز الطلبات"
                    value={completionRatio}
                    helper={`${formatLatinNumber(completedRequests, 'ar')} منجز من ${formatLatinNumber(actionableRequests, 'ar')} غير ملغى`}
                    tone={
                      completionRatio >= 75
                        ? 'good'
                        : completionRatio >= 40
                          ? 'warning'
                          : 'critical'
                    }
                  />
                )}
              </div>
            </>
          )}
        </ReportPanel>
      </div>

      <ReportPanel
        title="الخدمات والمرافق"
        description="فواتير الخدمات وجهة تحملها والمدفوع منها — تعرض حسب العقار في وجهة الخدمات."
        eyebrow="مرافق"
        icon={CalendarClock}
        isLoading={isLoading}
      >
        <div className="flex items-center justify-between gap-3 p-4 sm:p-5">
          <p className="text-sm font-semibold text-muted-foreground">
            اختر عقارًا من نطاق التقرير لعرض فواتير الخدمات والمرافق وإثباتات
            الدفع.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDrill('analytics', 'services')}
            className="min-h-11 shrink-0 gap-1.5 text-xs font-black text-primary"
          >
            الخدمات والمرافق
            <ArrowLeft className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </ReportPanel>

      <ReportInsightNote title="قاعدة العرض المالي">
        لا تجمع هذه الورشة تكلفة الصيانة مع المصروفات المسجلة في رقم واحد: سجل
        الصيانة قد يكون ممثلًا أصلًا بسند مصروف مرحَّل، والجمع المباشر يعيد
        احتسابه مرتين. عند الحاجة إلى إجمالي تشغيلي معتمد، يُبنى من المصدر
        المحاسبي وليس من واجهة العرض.
      </ReportInsightNote>
    </div>
  );
}
