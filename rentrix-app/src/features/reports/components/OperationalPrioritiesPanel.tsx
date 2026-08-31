import { AlertTriangle, Building2, FileText, Wrench } from 'lucide-react';
import { formatDate, formatMoney } from '@/features/financials/components/financials-formatters';
import { formatLatinNumber } from '@/lib/formatters';
import type { ReportDrillHandler } from '../report-workspaces';
import {
  ReportDrillAction,
  ReportList,
  ReportListRow,
  ReportPanel,
  ReportState,
} from '@/components/ui/report-section-primitives';

type OperationalPrioritiesPanelProps = Readonly<{
  overdueTotal: number;
  overdueAsOf?: string;
  vacantUnits: number;
  expiringContracts: number;
  openMaintenance: number;
  isLoading: boolean;
  onDrill: ReportDrillHandler;
}>;

type Priority = Readonly<{
  id: string;
  label: string;
  detail: string;
  value: string;
  icon: typeof AlertTriangle;
  workspace: Parameters<ReportDrillHandler>[0];
  view?: Parameters<ReportDrillHandler>[1];
}>;

/**
 * A compact action queue for the office owner. It deliberately turns existing
 * report signals into explicit next destinations without recomputing any
 * financial metric or implying that a notification/action was performed.
 */
export function OperationalPrioritiesPanel({
  overdueTotal,
  overdueAsOf,
  vacantUnits,
  expiringContracts,
  openMaintenance,
  isLoading,
  onDrill,
}: OperationalPrioritiesPanelProps) {
  const priorityCandidates: Array<Priority | null> = [
    overdueTotal > 0
      ? {
        id: 'overdue',
        label: 'رتّب متابعة المتأخرات',
        detail: overdueAsOf ? `تجاوز تاريخ الاستحقاق حتى ${formatDate(overdueAsOf)}` : 'مبالغ تجاوزت تاريخ استحقاقها',
        value: formatMoney(overdueTotal),
        icon: AlertTriangle,
        workspace: 'collections',
        view: 'follow_up',
      }
      : null,
    vacantUnits > 0
      ? {
        id: 'vacancy',
        label: 'تابع الوحدات الشاغرة',
        detail: 'وحدات تحتاج تأجيرًا أو قرار تسويق',
        value: formatLatinNumber(vacantUnits, 'ar'),
        icon: Building2,
        workspace: 'leasing',
        view: 'occupancy',
      }
      : null,
    expiringContracts > 0
      ? {
        id: 'renewals',
        label: 'ابدأ قرارات التجديد',
        detail: 'عقود تنتهي خلال 60 يومًا',
        value: formatLatinNumber(expiringContracts, 'ar'),
        icon: FileText,
        workspace: 'leasing',
        view: 'expiring',
      }
      : null,
    openMaintenance > 0
      ? {
        id: 'maintenance',
        label: 'أغلق أعمال الصيانة المفتوحة',
        detail: 'طلبات مفتوحة أو قيد التنفيذ',
        value: formatLatinNumber(openMaintenance, 'ar'),
        icon: Wrench,
        workspace: 'operations',
        view: 'maintenance_analytics',
      }
      : null,
  ];
  const priorities = priorityCandidates.filter((priority): priority is Priority => priority !== null);

  return (
    <ReportPanel
      title="أولويات العمل الآن"
      description="ترتيب مباشر لما يحتاج قرارًا أو متابعة — افتح كل أولوية في سجلها التشغيلي."
      eyebrow="قائمة تنفيذ"
      icon={AlertTriangle}
      isLoading={isLoading}
    >
      {priorities.length === 0 ? (
        <div className="p-4 sm:p-5">
          <ReportState message="لا توجد أولويات تشغيلية حرجة داخل نطاق التقرير الحالي." />
        </div>
      ) : (
        <ReportList>
          {priorities.map((priority) => {
            const Icon = priority.icon;
            return (
              <ReportListRow
                key={priority.id}
                title={(
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-warning/10 text-warning-foreground">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 break-words">{priority.label}</span>
                  </span>
                )}
                subtitle={priority.detail}
                value={<span dir="ltr">{priority.value}</span>}
                action={(
                  <ReportDrillAction
                    label="فتح"
                    variant="ghost"
                    ariaLabel={priority.label}
                    onClick={() => onDrill(priority.workspace, priority.view)}
                  />
                )}
              />
            );
          })}
        </ReportList>
      )}
    </ReportPanel>
  );
}
