import { AlertCircle, Clock, Flame, Printer, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { DocumentTemplates, type DocumentSettings } from '@/services/documents/DocumentTemplates';
import { getTodayLocalDateString } from '../reports-page.helpers';
import { ReportCard } from './common';

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
  summary: {
    total: number;
    open: number;
    inProgress: number;
    urgent: number;
  };
  isLoading: boolean;
}>;

export function MaintenanceReportSection({ summary, isLoading }: MaintenanceReportProps) {
  const handlePrintMaintenanceReport = () => {
    const todayStr = getTodayLocalDateString();
    DocumentTemplates.renderReportPdf(
      {
        reportTitle: 'كشف تحليل طلبات وتكاليف الصيانة التشغيلية',
        reportType: 'Maintenance_Operations_Report',
        periodFrom: todayStr,
        periodTo: todayStr,
        sections: [
          {
            title: 'ملخص مؤشرات طلبات الصيانة حسب الحالة والأولوية',
            rows: [
              { label: 'إجمالي طلبات الصيانة المسجلة', value: `${summary.total} طلب` },
              { label: 'الطلبات المفتوحة (تحتاج متابعة)', value: `${summary.open} طلب` },
              { label: 'الطلبات قيد التنفيذ (تحت الصيانة)', value: `${summary.inProgress} طلب` },
              { label: 'الطلبات العاجلة (أولوية طارئة)', value: `${summary.urgent} طلب` },
            ],
            totals: ['إجمالي الطلبات الفعالة', `${summary.total} طلب صيانة`],
          },
        ],
        totalSummary: `إجمالي بلاغات الصيانة: ${summary.total} | طلبات مفتوحة وقيد العمل: ${summary.open + summary.inProgress}`,
      },
      defaultSettings,
    );
  };

  return (
    <ReportCard
      title="تحليل ورصد أعمال الصيانة التشغيلية"
      description="مؤشرات بلاغات الصيانة، الحالات المفتوحة، والأولويات الفورية مع التكاليف المرتبطة."
      action={
        <Button variant="outline" size="sm" onClick={handlePrintMaintenanceReport} className="min-h-9 gap-1.5 text-xs font-bold">
          <Printer className="size-3.5 text-primary" aria-hidden="true" />
          طباعة تقرير الصيانة A4
        </Button>
      }
      isLoading={isLoading}
    >
      <ResponsiveCardGrid className="p-4" desktopColumns={4}>
        <KpiCard label="إجمالي البلاغات" value={summary.total.toLocaleString('ar')} icon={Wrench} accent="primary" sub="كل الطلبات" />
        <KpiCard label="طلبات مفتوحة" value={summary.open.toLocaleString('ar')} icon={AlertCircle} accent="sky" sub="تحتاج بدء المتابعة" />
        <KpiCard label="قيد التنفيذ" value={summary.inProgress.toLocaleString('ar')} icon={Clock} accent="amber" sub="يعمل عليها الفريق" />
        <KpiCard label="طلبات عاجلة" value={summary.urgent.toLocaleString('ar')} icon={Flame} accent="rose" sub="أولوية طارئة" />
      </ResponsiveCardGrid>
    </ReportCard>
  );
}
