import { AlertTriangle, ArrowLeft, Building2, FileText, Wrench } from 'lucide-react';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import { formatLatinNumber } from '@/lib/formatters';
import type { ReportDrillHandler } from '../report-workspaces';
import { ReportPanel, ReportState } from '@/components/ui/report-section-primitives';

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
        detail: overdueAsOf ? `المتأخر حتى ${overdueAsOf}` : 'مبالغ مستحقة غير محصلة',
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
        <div className="divide-y divide-border/60">
          {priorities.map((priority) => {
            const Icon = priority.icon;
            return (
              <button
                key={priority.id}
                type="button"
                onClick={() => onDrill(priority.workspace, priority.view)}
                className="group flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-start transition-colors hover:bg-primary/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:px-5"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-warning/10 text-warning-foreground">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black">{priority.label}</span>
                    <span className="mt-0.5 block truncate text-xs font-semibold text-muted-foreground">{priority.detail}</span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="font-extrabold tabular-nums" dir="ltr">{priority.value}</span>
                  <ArrowLeft className="size-3.5 text-muted-foreground/60 transition-colors group-hover:text-primary rtl:rotate-180" aria-hidden="true" />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </ReportPanel>
  );
}
