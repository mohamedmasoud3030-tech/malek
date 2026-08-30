import { useMemo } from 'react';
import { ArrowLeft, CalendarClock, ReceiptText, ShieldAlert, Wrench } from 'lucide-react';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import type { ExpenseBreakdownReport } from '@/features/financials/reports/financial-reporting/report-types';
import type { Maintenance } from '@/features/maintenance/maintenance-service';
import type { MaintenanceSummary } from '@/features/maintenance/maintenance-helpers';
import { formatLatinNumber } from '@/lib/formatters';
import type { ReportDrillHandler } from '../report-workspaces';
import { ReportInsightNote, ReportPanel, ReportState, ReportSummaryStrip } from './report-section-primitives';

type OperationsOverviewProps = Readonly<{
  expenseReport: ExpenseBreakdownReport | undefined;
  maintenanceRows: Maintenance[];
  maintenanceSummary: MaintenanceSummary;
  isLoading: boolean;
  onDrill: ReportDrillHandler;
}>;

/**
 * نظرة تشغيلية — the operations workspace's opening perspective. Per the
 * financial-safety rule, cost figures from different sources are displayed
 * separately with explicit labels; they are NEVER summed into a single
 * "operating cost" total, because maintenance records may already be
 * represented by posted expense records.
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
  const openRequests = (maintenanceSummary.open ?? 0) + (maintenanceSummary.inProgress ?? 0);
  const topExpenseProperties = useMemo(
    () => [...(expenseReport?.byProperty ?? [])].sort((a, b) => b.total - a.total).slice(0, 3),
    [expenseReport?.byProperty],
  );

  return (
    <div className="space-y-4">
      <ReportPanel
        title="مؤشرات التكلفة المنفصلة"
        description="كل مؤشر من مصدره المستقل — لا يُجمع تلقائيًا لأن بعض تكاليف الصيانة قد تكون مُرحَّلة ضمن المصروفات المسجلة."
        eyebrow="تكلفة التشغيل"
        icon={ShieldAlert}
        isLoading={isLoading}
      >
        <div className="px-4 pt-3 sm:px-5">
          <ReportSummaryStrip
            dataReportSummary="operations-overview"
            items={[
              { label: 'المصروفات المسجلة', value: formatMoney(expenseReport?.totalExpenses ?? 0), detail: 'من سندات المصروفات' },
              { label: 'تكلفة صيانة في سجلات الصيانة', value: formatMoney(maintenanceRecordedCost), detail: 'غير مضمونة الترحيل', tone: 'warning' },
              { label: 'طلبات صيانة مفتوحة', value: formatLatinNumber(openRequests, 'ar'), detail: 'مفتوحة أو قيد التنفيذ' },
              { label: 'الخدمات والمرافق', value: 'حسب العقار', detail: 'تُعرض في وجهة الخدمات', tone: 'warning' },
            ]}
          />
        </div>
      </ReportPanel>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportPanel
          title="المصروفات المسجلة"
          description="مصروفات الفترة حسب التصنيف والعقار من سندات المصروفات."
          eyebrow="سندات"
          icon={ReceiptText}
          isLoading={isLoading}
          action={(
            <button
              type="button"
              onClick={() => onDrill('operations', 'expenses')}
              className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-border/70 px-2.5 text-xs font-black text-primary transition-colors hover:bg-primary/[0.025]"
            >
              التفاصيل الكاملة
              <ArrowLeft className="size-3.5" aria-hidden="true" />
            </button>
          )}
        >
          <div className="space-y-3 p-4 sm:p-5">
            {topExpenseProperties.length === 0 ? (
              <ReportState message="لا توجد مصروفات مسجلة في الفترة." />
            ) : (
              <div className="divide-y divide-border/60 rounded-xl border border-border/70">
                {topExpenseProperties.map((row) => (
                  <button
                    key={row.propertyId}
                    type="button"
                    onClick={() => onDrill('properties', undefined, { propertyId: row.propertyId })}
                    className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2.5 text-start transition-colors hover:bg-muted/25"
                  >
                    <span className="min-w-0 truncate text-sm font-bold">{row.propertyTitle ?? 'عقار غير محدد'}</span>
                    <span className="shrink-0 text-sm font-extrabold tabular-nums" dir="ltr">{formatMoney(row.total)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </ReportPanel>

        <ReportPanel
          title="الصيانة"
          description="حالة الطلبات المفتوحة وتكلفة سجلات الصيانة."
          eyebrow="أعمال مفتوحة"
          icon={Wrench}
          isLoading={isLoading}
          action={(
            <button
              type="button"
              onClick={() => onDrill('operations', 'maintenance_analytics')}
              className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-border/70 px-2.5 text-xs font-black text-primary transition-colors hover:bg-primary/[0.025]"
            >
              تحليلات الصيانة
              <ArrowLeft className="size-3.5" aria-hidden="true" />
            </button>
          )}
        >
          <div className="space-y-3 p-4 sm:p-5">
            <dl className="grid grid-cols-2 gap-3">
              {[
                ['إجمالي الطلبات', String(maintenanceSummary.total ?? 0)],
                ['مفتوحة', String(maintenanceSummary.open ?? 0)],
                ['قيد التنفيذ', String(maintenanceSummary.inProgress ?? 0)],
                ['عاجلة', String(maintenanceSummary.urgent ?? 0)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border/70 bg-muted/20 p-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 font-extrabold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
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
          <p className="text-sm font-semibold text-muted-foreground">اختر عقارًا من نطاق التقرير لعرض فواتير الخدمات والمرافق وإثباتات الدفع.</p>
          <button
            type="button"
            onClick={() => onDrill('operations', 'services')}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-border/70 px-2.5 text-xs font-black text-primary transition-colors hover:bg-primary/[0.025]"
          >
            الخدمات والمرافق
            <ArrowLeft className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </ReportPanel>

      <ReportInsightNote title="قاعدة العرض المالي">
        لا تجمع هذه الورشة تكلفة الصيانة مع المصروفات المسجلة في رقم واحد: سجل الصيانة قد يكون ممثلًا أصلًا بسند مصروف مرحَّل، والجمع المباشر يعيد احتسابه مرتين. عند الحاجة إلى إجمالي تشغيلي معتمد، يُبنى من المصدر المحاسبي وليس من واجهة العرض.
      </ReportInsightNote>
    </div>
  );
}
