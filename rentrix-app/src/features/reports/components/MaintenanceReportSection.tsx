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
import { ReportList, ReportListRow, ReportPanel, ReportState } from './report-section-primitives';

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
  const activeRows = rows.filter((row) => row.status === 'open' || row.status === 'in_progress').slice(0, 12);

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
              { label: 'الطلبات العاجلة', value: `${summary.urgent} طلب` },
            ],
            totals: ['إجمالي الطلبات الفعالة', `${summary.open + summary.inProgress} طلب صيانة`],
          },
          {
            title: 'طلبات الصيانة الفعالة',
            rows: activeRows.map((row) => ({
              label: row.title,
              value: `الحالة: ${maintenanceStatusLabels[row.status as keyof typeof maintenanceStatusLabels] ?? row.status} | الأولوية: ${maintenancePriorityLabels[row.priority as keyof typeof maintenancePriorityLabels] ?? row.priority} | التاريخ: ${row.created_at}`,
            })),
          },
        ],
        totalSummary: `إجمالي بلاغات الصيانة: ${summary.total} | طلبات مفتوحة وقيد العمل: ${summary.open + summary.inProgress}`,
      },
      defaultSettings,
    );
  };

  return (
    <div className="space-y-4">
      <ResponsiveCardGrid>
        <KpiCard label="إجمالي البلاغات" value={summary.total.toLocaleString('ar')} icon={Wrench} sub="من سجل الصيانة الحقيقي" />
        <KpiCard label="طلبات مفتوحة" value={summary.open.toLocaleString('ar')} icon={AlertCircle} sub="تحتاج بدء المتابعة" />
        <KpiCard label="قيد التنفيذ" value={summary.inProgress.toLocaleString('ar')} icon={Clock} sub="يعمل عليها الفريق" />
        <KpiCard label="طلبات عاجلة" value={summary.urgent.toLocaleString('ar')} icon={Flame} sub="أولوية طارئة" />
      </ResponsiveCardGrid>

      <ReportPanel
        title="طلبات الصيانة الفعالة"
        description="الطلبات المفتوحة وقيد التنفيذ من سجل الصيانة، بدون تقديرات أو نسب افتراضية."
        icon={Wrench}
        action={(
          <Button variant="outline" size="sm" onClick={handlePrintMaintenanceReport} className="min-h-10 gap-1.5 text-xs">
            <Printer className="size-3.5" aria-hidden="true" />
            طباعة A4
          </Button>
        )}
        isLoading={isLoading}
      >
        {activeRows.length === 0 ? (
          <div className="p-4"><ReportState message="لا توجد طلبات صيانة مفتوحة أو قيد التنفيذ." /></div>
        ) : (
          <ReportList>
            {activeRows.map((row) => (
              <ReportListRow
                key={row.id}
                title={row.title}
                subtitle={`${formatDate(row.created_at)} · ${row.technician_name || row.assigned_to || 'غير مسند'}`}
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
    </div>
  );
}
