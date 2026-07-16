import { AlertCircle, Clock, Flame, Printer, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate } from '@/features/financials/components/financials-formatters';
import {
  maintenancePriorityLabels,
  maintenancePriorityTone,
  maintenanceStatusLabels,
  maintenanceStatusTone,
} from '@/features/maintenance/components/maintenance-list';
import type { MaintenanceSummary } from '@/features/maintenance/maintenance-helpers';
import type { Maintenance } from '@/features/maintenance/maintenance-service';
import { DocumentTemplates, type DocumentSettings } from '@/services/documents/DocumentTemplates';
import { getTodayLocalDateString } from '../reports-page.helpers';
import {
  ReportColumns,
  ReportInsightNote,
  ReportList,
  ReportListRow,
  ReportPanel,
  ReportProgress,
  ReportState,
} from './report-section-primitives';

const defaultSettings: DocumentSettings = {
  company: {
    name: 'رينتريكس لإدارة العقارات',
    address: 'سلطنة عمان - مسقط',
    phone: '+968 24000000',
  },
  currency: 'OMR',
  currencySymbol: 'ر.ع',
};

export type MaintenanceReportProps = Readonly<{
  rows: Maintenance[];
  summary: MaintenanceSummary;
  isLoading: boolean;
}>;

export function MaintenanceReportSection({ rows, summary, isLoading }: MaintenanceReportProps) {
  const activeRows = rows.filter((row) => row.status === 'open' || row.status === 'in_progress');
  const visibleActiveRows = activeRows.slice(0, 12);
  const completedCount = rows.filter((row) => row.status === 'resolved' || row.status === 'closed').length;
  const assignedCount = activeRows.filter((row) => Boolean(row.technician_name || row.assigned_to)).length;
  const scheduledCount = activeRows.filter((row) => Boolean(row.scheduled_date)).length;
  const completionRate = summary.total > 0 ? (completedCount / summary.total) * 100 : 0;
  const assignmentCoverage = activeRows.length > 0 ? (assignedCount / activeRows.length) * 100 : 100;
  const schedulingCoverage = activeRows.length > 0 ? (scheduledCount / activeRows.length) * 100 : 100;
  const urgentActiveCount = activeRows.filter((row) => row.priority === 'urgent').length;

  const handlePrintMaintenanceReport = () => {
    const todayStr = getTodayLocalDateString();
    DocumentTemplates.renderReportPdf(
      {
        reportTitle: 'كشف تحليل طلبات الصيانة التشغيلية',
        reportType: 'Maintenance_Operations_Report',
        periodFrom: todayStr,
        periodTo: todayStr,
        sections: [
          {
            title: 'ملخص مؤشرات طلبات الصيانة حسب الحالة والأولوية',
            rows: [
              { label: 'إجمالي طلبات الصيانة المسجلة', value: `${summary.total} طلب` },
              { label: 'الطلبات المفتوحة', value: `${summary.open} طلب` },
              { label: 'الطلبات قيد التنفيذ', value: `${summary.inProgress} طلب` },
              { label: 'الطلبات المكتملة', value: `${completedCount} طلب` },
              { label: 'الطلبات العاجلة النشطة', value: `${urgentActiveCount} طلب` },
              { label: 'تغطية الإسناد', value: `${Math.round(assignmentCoverage)}%` },
              { label: 'تغطية الجدولة', value: `${Math.round(schedulingCoverage)}%` },
            ],
            totals: ['إجمالي الطلبات الفعالة', `${activeRows.length} طلب صيانة`],
          },
          {
            title: 'طلبات الصيانة الفعالة',
            rows: activeRows.map((row) => ({
              label: row.title ?? 'طلب صيانة',
              value: `الحالة: ${maintenanceStatusLabels[row.status as keyof typeof maintenanceStatusLabels] ?? row.status} | الأولوية: ${maintenancePriorityLabels[row.priority as keyof typeof maintenancePriorityLabels] ?? row.priority} | المسؤول: ${row.technician_name || row.assigned_to || 'غير مسند'} | الموعد: ${row.scheduled_date || 'غير مجدول'}`,
            })),
          },
        ],
        totalSummary: `إجمالي البلاغات: ${summary.total} | المكتمل: ${completedCount} | الفعال: ${activeRows.length} | العاجل الفعال: ${urgentActiveCount}`,
      },
      defaultSettings,
    );
  };

  return (
    <div className="space-y-4">
      <ResponsiveCardGrid>
        <KpiCard label="إجمالي البلاغات" value={summary.total.toLocaleString('ar')} icon={Wrench} sub={`${completedCount.toLocaleString('ar')} طلبات مكتملة`} />
        <KpiCard label="طلبات مفتوحة" value={summary.open.toLocaleString('ar')} icon={AlertCircle} sub="تحتاج بدء المتابعة" />
        <KpiCard label="قيد التنفيذ" value={summary.inProgress.toLocaleString('ar')} icon={Clock} sub={`${assignedCount.toLocaleString('ar')} طلبات مسندة`} />
        <KpiCard label="عاجلة ونشطة" value={urgentActiveCount.toLocaleString('ar')} icon={Flame} sub="أولوية تدخل فوري" />
      </ResponsiveCardGrid>

      <div className="grid gap-3 sm:grid-cols-3">
        <ReportProgress
          label="معدل الإغلاق"
          value={completionRate}
          helper={`${completedCount.toLocaleString('ar')} من ${summary.total.toLocaleString('ar')} بلاغات`}
          tone={completionRate >= 75 ? 'good' : completionRate >= 50 ? 'warning' : 'critical'}
        />
        <ReportProgress
          label="تغطية الإسناد"
          value={assignmentCoverage}
          helper={`${assignedCount.toLocaleString('ar')} من ${activeRows.length.toLocaleString('ar')} طلبات فعالة`}
          tone={assignmentCoverage >= 90 ? 'good' : assignmentCoverage >= 70 ? 'warning' : 'critical'}
        />
        <ReportProgress
          label="تغطية الجدولة"
          value={schedulingCoverage}
          helper={`${scheduledCount.toLocaleString('ar')} من ${activeRows.length.toLocaleString('ar')} طلبات فعالة`}
          tone={schedulingCoverage >= 85 ? 'good' : schedulingCoverage >= 60 ? 'warning' : 'critical'}
        />
      </div>

      <ReportColumns>
        <ReportPanel
          title="طلبات الصيانة الفعالة"
          description="الطلبات المفتوحة وقيد التنفيذ مرتبة من السجل الحقيقي، مع المسؤول والموعد والأولوية."
          eyebrow="قائمة العمل"
          icon={Wrench}
          action={(
            <Button variant="outline" size="sm" onClick={handlePrintMaintenanceReport} className="min-h-10 gap-1.5 text-xs">
              <Printer className="size-3.5" aria-hidden="true" />
              طباعة A4
            </Button>
          )}
          isLoading={isLoading}
        >
          {visibleActiveRows.length === 0 ? (
            <div className="p-4"><ReportState title="لا توجد طلبات فعالة" message="جميع طلبات الصيانة مغلقة أو محلولة حاليًا." /></div>
          ) : (
            <ReportList>
              {visibleActiveRows.map((row) => (
                <ReportListRow
                  key={row.id}
                  title={row.title ?? 'طلب صيانة'}
                  subtitle={`${row.created_at ? formatDate(row.created_at) : '—'} · ${row.technician_name || row.assigned_to || 'غير مسند'} · ${row.scheduled_date ? `موعد ${formatDate(row.scheduled_date)}` : 'غير مجدول'}`}
                  meta={(
                    <StatusBadge tone={maintenancePriorityTone[row.priority as keyof typeof maintenancePriorityTone] ?? 'gray'}>
                      {maintenancePriorityLabels[row.priority as keyof typeof maintenancePriorityLabels] ?? row.priority}
                    </StatusBadge>
                  )}
                  value={(
                    <StatusBadge tone={maintenanceStatusTone[row.status as keyof typeof maintenanceStatusTone] ?? 'gray'}>
                      {maintenanceStatusLabels[row.status as keyof typeof maintenanceStatusLabels] ?? row.status}
                    </StatusBadge>
                  )}
                />
              ))}
            </ReportList>
          )}
        </ReportPanel>

        <div className="space-y-4">
          <ReportInsightNote title="قراءة التشغيل">
            {urgentActiveCount > 0
              ? `يوجد ${urgentActiveCount.toLocaleString('ar')} طلبات عاجلة فعالة؛ راجع الإسناد والجدولة قبل الطلبات العادية.`
              : assignmentCoverage < 90
                ? 'بعض الطلبات الفعالة غير مسندة لمسؤول؛ إكمال الإسناد سيجعل المتابعة والمساءلة أوضح.'
                : schedulingCoverage < 85
                  ? 'الإسناد جيد لكن الجدولة غير مكتملة؛ حدّد مواعيد التنفيذ للطلبات الفعالة.'
                  : 'تغطية الإسناد والجدولة جيدة ولا توجد طلبات عاجلة غير محسومة.'}
          </ReportInsightNote>

          <ReportPanel
            title="توزيع الحالات"
            description="صورة سريعة للرصيد التشغيلي لطلبات الصيانة."
            eyebrow="حالة المحفظة"
            icon={Clock}
            isLoading={isLoading}
          >
            <ReportList>
              <ReportListRow title="مفتوحة" subtitle="لم يبدأ التنفيذ بعد" value={summary.open.toLocaleString('ar')} />
              <ReportListRow title="قيد التنفيذ" subtitle="يعمل عليها الفريق حاليًا" value={summary.inProgress.toLocaleString('ar')} />
              <ReportListRow title="مكتملة" subtitle="محلولة أو مغلقة" value={completedCount.toLocaleString('ar')} />
              <ReportListRow title="عاجلة فعالة" subtitle="أولوية تدخل مباشر" value={urgentActiveCount.toLocaleString('ar')} />
            </ReportList>
          </ReportPanel>
        </div>
      </ReportColumns>
    </div>
  );
}
