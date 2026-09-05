import { useMemo } from 'react';
import { AlarmClock, ArrowLeft, Scale, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { useNavigate } from '@tanstack/react-router';
import {
  formatDate,
  formatMoney,
} from '@/features/financials/components/financials-formatters';
import {
  maintenancePriorityLabels,
  maintenanceStatusLabels,
} from '@/features/maintenance/components/maintenance-list';
import {
  deriveMaintenanceAttention,
  maintenanceAttentionLabels,
  MAINTENANCE_STALLED_AFTER_DAYS,
  summarizeMaintenanceAttention,
  type MaintenanceAttention,
} from '@/features/maintenance/maintenance-attention';
import type { MaintenanceSummary } from '@/features/maintenance/maintenance-helpers';
import type { Maintenance } from '@/features/maintenance/maintenance-service';
import {
  normalizeMaintenancePriority,
  normalizeMaintenanceStatus,
} from '@/lib/maintenanceStatus';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { documentService } from '@/services/documents/DocumentService';
import { runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import {
  toReportDocumentPayload,
  type ReportDocumentData,
} from '@/services/documents/documentPayloadAdapters';
import {
  buildReportCsvFilename,
  getTodayLocalDateString,
} from '../reports-page.helpers';
import {
  ReportColumns,
  ReportInsightNote,
  ReportList,
  ReportListRow,
  ReportPanel,
  ReportProgress,
  ReportState,
  ReportSummaryStrip,
} from '@/components/ui/report-section-primitives';
import { formatLatinNumber } from '@/lib/formatters';
import { ReportDocumentActions } from './report-document-actions';
import type { CsvRow } from '@/lib/csvExport';

const reportMaintenanceStatusTone = {
  open: 'info',
  in_progress: 'warning',
  resolved: 'success',
  closed: 'neutral',
  cancelled: 'neutral',
} as const;

const reportMaintenancePriorityTone = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
} as const;

/** Triage order for the active work list: urgent first, then high → low. */
const priorityTriageWeight = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
} as const;

/** The work list stays a focused queue, not a full register — the operational screen owns the rest. */
const MAINTENANCE_WORK_LIST_LIMIT = 12;

function maintenanceAttentionFlagScore(
  attention: MaintenanceAttention,
): number {
  // Missed schedules outrank generic staleness: a promised visit already failed.
  return (attention.hasMissedSchedule ? 2 : 0) + (attention.isStalled ? 1 : 0);
}

export type MaintenanceReportProps = Readonly<{
  rows: Maintenance[];
  summary: MaintenanceSummary;
  canExportReports: boolean;
  isLoading: boolean;
}>;

/**
 * تحليلات الصيانة — answers one question first: "ما الذي يحتاج انتباهًا
 * تشغيليًا الآن؟". Semantics locked with the maintenance domain:
 *
 * - `cancelled ≠ completed` — completion ratios exclude cancelled requests;
 * - urgent backlog means urgent requests that are actually active
 *   (open / in progress), never the summary's all-history urgent count;
 * - maintenance-recorded cost is its own operational source and is NEVER summed
 *   with posted expenses (a maintenance record may already be represented by a
 *   posted expense — summing would double-count it);
 * - attention flags come from the canonical maintenance-attention derivation,
 *   the same module the maintenance workspace and dashboard use.
 */
export function MaintenanceReportSection({
  rows,
  summary,
  canExportReports,
  isLoading,
}: MaintenanceReportProps) {
  const navigate = useNavigate();
  const todayStr = getTodayLocalDateString();

  const activeRows = useMemo(
    () =>
      rows.filter((row) => {
        const status = normalizeMaintenanceStatus(row.status);
        return status === 'open' || status === 'in_progress';
      }),
    [rows],
  );
  const completedCount = useMemo(
    () =>
      rows.filter((row) => {
        const status = normalizeMaintenanceStatus(row.status);
        return status === 'resolved' || status === 'closed';
      }).length,
    [rows],
  );
  // Cancelled work is a decision, not a delivery — it is counted and shown, but
  // never folded into "completed" nor into the completion denominator.
  const cancelledCount = useMemo(
    () =>
      rows.filter(
        (row) => normalizeMaintenanceStatus(row.status) === 'cancelled',
      ).length,
    [rows],
  );
  const actionableCount = rows.length - cancelledCount;
  // No invented 0%: with nothing actionable the ratio is meaningless, not zero.
  const completionRate =
    actionableCount > 0 ? (completedCount / actionableCount) * 100 : null;

  const assignedCount = activeRows.filter((row) =>
    Boolean(row.technician_name || row.assigned_to),
  ).length;
  const scheduledCount = activeRows.filter((row) =>
    Boolean(row.scheduled_date),
  ).length;
  const assignmentCoverage =
    activeRows.length > 0 ? (assignedCount / activeRows.length) * 100 : 100;
  const schedulingCoverage =
    activeRows.length > 0 ? (scheduledCount / activeRows.length) * 100 : 100;
  const urgentActiveCount = activeRows.filter(
    (row) => normalizeMaintenancePriority(row.priority) === 'urgent',
  ).length;

  // "Urgent backlog" pressure reads against the active backlog only.
  const urgentActiveRatio =
    activeRows.length > 0
      ? (urgentActiveCount / activeRows.length) * 100
      : null;

  // Maintenance-recorded cost: its own operational source, displayed separately.
  const maintenanceRecordedCost = useMemo(
    () => rows.reduce((total, row) => total + (row.cost ?? 0), 0),
    [rows],
  );

  const attentionSummary = useMemo(
    () => summarizeMaintenanceAttention(rows, todayStr),
    [rows, todayStr],
  );
  const attentionByRequestId = useMemo(() => {
    const map = new Map<string, MaintenanceAttention>();
    for (const row of rows)
      map.set(row.id, deriveMaintenanceAttention(row, todayStr));
    return map;
  }, [rows, todayStr]);

  const triagedActiveRows = useMemo(() => {
    return [...activeRows]
      .sort((a, b) => {
        const priorityA = normalizeMaintenancePriority(a.priority);
        const priorityB = normalizeMaintenancePriority(b.priority);
        if (priorityA !== priorityB)
          return (
            priorityTriageWeight[priorityA] - priorityTriageWeight[priorityB]
          );
        const attentionA = attentionByRequestId.get(a.id);
        const attentionB = attentionByRequestId.get(b.id);
        const scoreA = attentionA
          ? maintenanceAttentionFlagScore(attentionA)
          : 0;
        const scoreB = attentionB
          ? maintenanceAttentionFlagScore(attentionB)
          : 0;
        if (scoreA !== scoreB) return scoreB - scoreA;
        const ageA = attentionA?.ageDays ?? -1;
        const ageB = attentionB?.ageDays ?? -1;
        if (ageA !== ageB) return ageB - ageA;
        return a.id.localeCompare(b.id);
      })
      .slice(0, MAINTENANCE_WORK_LIST_LIMIT);
  }, [activeRows, attentionByRequestId]);

  const flaggedRows = useMemo(
    () =>
      rows.filter(
        (row) => (attentionByRequestId.get(row.id)?.flags.length ?? 0) > 0,
      ),
    [rows, attentionByRequestId],
  );

  const priorityDistribution = useMemo(
    () =>
      (['urgent', 'high', 'medium', 'low'] as const).map((priority) => ({
        priority,
        count: activeRows.filter(
          (row) => normalizeMaintenancePriority(row.priority) === priority,
        ).length,
      })),
    [activeRows],
  );

  const {
    companySettings: documentSettings,
    isReady: isDocumentSettingsReady,
  } = useDocumentSettings();

  const buildMaintenanceReportData = (): ReportDocumentData => {
    return {
      reportTitle: 'كشف تحليل طلبات الصيانة التشغيلية',
      reportType: 'Maintenance_Operations_Report',
      periodFrom: todayStr,
      periodTo: todayStr,
      sections: [
        {
          title: 'ملخص مؤشرات طلبات الصيانة حسب الحالة والأولوية',
          rows: [
            {
              label: 'إجمالي طلبات الصيانة المسجلة',
              value: `${summary.total} طلب`,
            },
            { label: 'الطلبات المفتوحة', value: `${summary.open} طلب` },
            {
              label: 'الطلبات قيد التنفيذ',
              value: `${summary.inProgress} طلب`,
            },
            { label: 'الطلبات المكتملة', value: `${completedCount} طلب` },
            {
              label: 'الطلبات الملغاة (غير محسومة — لا تدخل الإنجاز)',
              value: `${cancelledCount} طلب`,
            },
            {
              label: 'الطلبات العاجلة النشطة',
              value: `${urgentActiveCount} طلب`,
            },
            {
              label:
                'متوقفة عن التقدم (أكثر من ' +
                MAINTENANCE_STALLED_AFTER_DAYS +
                ' أيام بلا حركة)',
              value: `${attentionSummary.stalled} طلب`,
            },
            {
              label: 'منجزة تقنيًا ولم تُغلق',
              value: `${attentionSummary.awaitingClosure} طلب`,
            },
            {
              label: 'تجاوزت موعد الزيارة المجدول',
              value: `${attentionSummary.scheduleMissed} طلب`,
            },
            {
              label: 'تغطية الإسناد',
              value: `${Math.round(assignmentCoverage)}%`,
            },
            {
              label: 'تغطية الجدولة',
              value: `${Math.round(schedulingCoverage)}%`,
            },
            {
              label:
                'تكلفة مسجلة في سجلات الصيانة (مصدر مستقل عن المصروفات المرحّلة)',
              value: formatMoney(maintenanceRecordedCost),
            },
          ],
          totals: ['إجمالي الطلبات الفعالة', `${activeRows.length} طلب صيانة`],
        },
        {
          title:
            'طلبات تحتاج انتباهًا الآن (متوقفة أو بانتظار الإغلاق أو فات موعدها)',
          columns: [
            'عنوان الطلب',
            'الحالة',
            'الأولوية',
            'سبب المتابعة',
            'عمر الطلب (يوم)',
          ],
          rows: flaggedRows.map((row) => {
            const attention = attentionByRequestId.get(row.id);
            return [
              row.title ?? 'طلب صيانة',
              maintenanceStatusLabels[normalizeMaintenanceStatus(row.status)],
              maintenancePriorityLabels[
                normalizeMaintenancePriority(row.priority)
              ],
              (attention?.flags ?? [])
                .map((flag) => maintenanceAttentionLabels[flag])
                .join(' · ') || '—',
              attention?.ageDays !== null && attention?.ageDays !== undefined
                ? String(attention.ageDays)
                : '—',
            ];
          }),
        },
        {
          title: 'طلبات الصيانة الفعالة',
          columns: [
            'عنوان الطلب',
            'الحالة',
            'الأولوية',
            'المسؤول',
            'الموعد المجدول',
          ],
          rows: activeRows.map((row) => [
            row.title ?? 'طلب صيانة',
            maintenanceStatusLabels[normalizeMaintenanceStatus(row.status)],
            maintenancePriorityLabels[
              normalizeMaintenancePriority(row.priority)
            ],
            row.technician_name || row.assigned_to || 'غير مسند',
            row.scheduled_date || 'غير مجدول',
          ]),
        },
      ],
      totalSummary: `إجمالي البلاغات: ${summary.total} | المكتمل: ${completedCount} | الملغى: ${cancelledCount} | الفعال: ${activeRows.length} | العاجل الفعال: ${urgentActiveCount} | تكلفة سجلات الصيانة (مصدر مستقل): ${formatMoney(maintenanceRecordedCost)}`,
    };
  };

  const handlePrintMaintenanceReport = async () => {
    await runGuardedDocumentAction({
      isReady: isDocumentSettingsReady,
      operation: () =>
        documentService.printDocument('generic_report', {
          settings: documentSettings,
          payload: toReportDocumentPayload(buildMaintenanceReportData()),
        }),
      fallbackMessage: 'تعذرت طباعة التقرير.',
    });
  };

  const handleDownloadMaintenanceReport = async () => {
    await runGuardedDocumentAction({
      isReady: isDocumentSettingsReady,
      operation: () =>
        documentService.downloadDocumentPdf('generic_report', {
          settings: documentSettings,
          payload: toReportDocumentPayload(buildMaintenanceReportData()),
        }),
      fallbackMessage: 'تعذر تنزيل ملف PDF.',
    });
  };

  const workListCsvRows: CsvRow[] = triagedActiveRows.map((row) => {
    const attention = attentionByRequestId.get(row.id);
    return {
      title: row.title ?? 'طلب صيانة',
      status: maintenanceStatusLabels[normalizeMaintenanceStatus(row.status)],
      priority:
        maintenancePriorityLabels[normalizeMaintenancePriority(row.priority)],
      assignee: row.technician_name || row.assigned_to || 'غير مسند',
      requestDate: row.request_date || row.created_at || '',
      scheduledDate: row.scheduled_date || '',
      ageDays: attention?.ageDays ?? '',
      attentionFlags: (attention?.flags ?? [])
        .map((flag) => maintenanceAttentionLabels[flag])
        .join(' · '),
      recordedCost: row.cost ?? 0,
    };
  });

  const workListActions = canExportReports ? (
    <ReportDocumentActions
      className="flex flex-wrap gap-2"
      reportLabel="تحليلات الصيانة التشغيلية"
      reportShareTarget={{
        reportId: 'portfolio-property-performance',
        view: 'maintenance',
        filters: {
          from: todayStr,
          to: todayStr,
          asOf: todayStr,
          propertyId: '',
          unitId: '',
          tenantId: '',
          ownerId: '',
          contractId: '',
        },
      }}
      reportShareSummary={`إجمالي البلاغات: ${summary.total} | فعالة: ${activeRows.length} | عاجل فعال: ${urgentActiveCount}`}
      onPrint={handlePrintMaintenanceReport}
      onDownloadPdf={handleDownloadMaintenanceReport}
      csv={{
        filename: buildReportCsvFilename('maintenance-worklist'),
        rows: workListCsvRows,
      }}
    />
  ) : undefined;

  const openRequestInMaintenanceScreen = (row: Maintenance) => {
    void navigate({
      to: '/maintenance',
      search: { section: 'maintenance', requestId: row.id },
    });
  };

  return (
    <div className="space-y-3">
      <ReportSummaryStrip
        dataReportSummary="maintenance"
        items={[
          {
            label: 'إجمالي البلاغات',
            value: formatLatinNumber(summary.total, 'ar'),
            detail: `${formatLatinNumber(completedCount, 'ar')} مكتملة`,
          },
          {
            label: 'طلبات مفتوحة',
            value: formatLatinNumber(summary.open, 'ar'),
            detail: 'لم يبدأ تنفيذها',
            tone: summary.open > 0 ? 'warning' : undefined,
          },
          {
            label: 'قيد التنفيذ',
            value: formatLatinNumber(summary.inProgress, 'ar'),
            detail: `${formatLatinNumber(assignedCount, 'ar')} مسندة`,
          },
          {
            label: 'عاجلة نشطة',
            value: formatLatinNumber(urgentActiveCount, 'ar'),
            detail: 'أولوية تدخل فوري',
            tone: urgentActiveCount > 0 ? 'critical' : undefined,
          },
          {
            label: 'تكلفة سجلات الصيانة',
            value: formatMoney(maintenanceRecordedCost),
            detail: 'مصدر مستقل عن المصروفات',
            tone: 'warning',
          },
        ]}
      />

      <ReportInsightNote title="قراءة التشغيل">
        {urgentActiveCount > 0
          ? `يوجد ${formatLatinNumber(urgentActiveCount, 'ar')} طلبات عاجلة فعالة${urgentActiveRatio !== null ? ` (${Math.round(urgentActiveRatio)}% من الحمل الفعال)` : ''}؛ راجع الإسناد والجدولة قبل الطلبات العادية.`
          : attentionSummary.stalled + attentionSummary.scheduleMissed > 0
            ? `عدة طلبات توقفت عن التقدم أو تجاوزت مواعيد زياراتها (${formatLatinNumber(attentionSummary.stalled + attentionSummary.scheduleMissed, 'ar')} حالة)؛ أعِد جدولتها أو أغلقها صراحة قبل فتح أعمال جديدة.`
            : attentionSummary.awaitingClosure > 0
              ? `${formatLatinNumber(attentionSummary.awaitingClosure, 'ar')} طلبات منجزة تقنيًا ولم تُغلق؛ الإغلاق التشغيلي هو ما يحسم التكلفة والمساءلة.`
              : assignmentCoverage < 90
                ? 'بعض الطلبات الفعالة غير مسندة لمسؤول؛ إكمال الإسناد سيجعل المتابعة والمساءلة أوضح.'
                : schedulingCoverage < 85
                  ? 'الإسناد جيد لكن الجدولة غير مكتملة؛ حدّد مواعيد التنفيذ للطلبات الفعالة.'
                  : 'تغطية الإسناد والجدولة جيدة ولا توجد طلبات عاجلة أو متوقفة غير محسومة.'}
      </ReportInsightNote>

      <div className="grid gap-3 sm:grid-cols-3">
        {completionRate !== null ? (
          <ReportProgress
            label="معدل الإنجاز"
            value={completionRate}
            helper={`${formatLatinNumber(completedCount, 'ar')} منجز من ${formatLatinNumber(actionableCount, 'ar')} غير ملغى`}
            tone={
              completionRate >= 75
                ? 'good'
                : completionRate >= 40
                  ? 'warning'
                  : 'critical'
            }
          />
        ) : (
          <ReportState
            title="معدل الإنجاز غير متاح"
            message="لا توجد طلبات غير ملغاة في النطاق، لذلك لا تُعرض نسبة إنجاز مفترضة."
          />
        )}
        <ReportProgress
          label="تغطية الإسناد"
          value={assignmentCoverage}
          helper={`${formatLatinNumber(assignedCount, 'ar')} من ${formatLatinNumber(activeRows.length, 'ar')} طلبات فعالة`}
          tone={
            assignmentCoverage >= 90
              ? 'good'
              : assignmentCoverage >= 70
                ? 'warning'
                : 'critical'
          }
        />
        <ReportProgress
          label="تغطية الجدولة"
          value={schedulingCoverage}
          helper={`${formatLatinNumber(scheduledCount, 'ar')} من ${formatLatinNumber(activeRows.length, 'ar')} طلبات فعالة`}
          tone={
            schedulingCoverage >= 85
              ? 'good'
              : schedulingCoverage >= 60
                ? 'warning'
                : 'critical'
          }
        />
      </div>

      <ReportColumns>
        <ReportPanel
          title="طلبات الصيانة الفعالة"
          description={`أعلى ${formatLatinNumber(Math.min(MAINTENANCE_WORK_LIST_LIMIT, activeRows.length), 'ar')} من ${formatLatinNumber(activeRows.length, 'ar')} طلب فعّال — مرتبة بالأولوية ثم أقدمها وأكثرها تعثرًا. القائمة تحدد المتابعة وشاشة الصيانة تنفذها.`}
          eyebrow="قائمة العمل"
          icon={Wrench}
          action={workListActions}
          isLoading={isLoading}
        >
          {triagedActiveRows.length === 0 ? (
            <div className="p-4">
              <ReportState
                title="لا توجد طلبات فعالة"
                message="جميع طلبات الصيانة مغلقة أو محلولة حاليًا."
              />
            </div>
          ) : (
            <ReportList>
              {triagedActiveRows.map((row) => {
                const attention = attentionByRequestId.get(row.id);
                const priority = normalizeMaintenancePriority(row.priority);
                const status = normalizeMaintenanceStatus(row.status);
                const reportedDay = row.request_date ?? row.created_at;
                const scheduleLabel = row.scheduled_date
                  ? attention?.hasMissedSchedule
                    ? `فات موعد ${formatDate(row.scheduled_date)}`
                    : `موعد ${formatDate(row.scheduled_date)}`
                  : 'غير مجدول';
                return (
                  <ReportListRow
                    key={row.id}
                    title={row.title ?? 'طلب صيانة'}
                    subtitle={`${reportedDay ? `بلاغ ${formatDate(reportedDay)}` : 'تاريخ بلاغ غير مسجل'} · ${row.technician_name || row.assigned_to || 'غير مسند'} · ${scheduleLabel}${attention?.ageDays ? ` · منذ ${formatLatinNumber(attention.ageDays, 'ar')} يوم` : ''}`}
                    meta={
                      <span className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge
                          tone={reportMaintenancePriorityTone[priority]}
                        >
                          {maintenancePriorityLabels[priority]}
                        </StatusBadge>
                        {(attention?.flags ?? []).map((flag) => (
                          <StatusBadge
                            key={flag}
                            tone={
                              flag === 'awaiting_closure' ? 'info' : 'warning'
                            }
                          >
                            {maintenanceAttentionLabels[flag]}
                          </StatusBadge>
                        ))}
                      </span>
                    }
                    value={
                      <StatusBadge tone={reportMaintenanceStatusTone[status]}>
                        {maintenanceStatusLabels[status]}
                      </StatusBadge>
                    }
                    action={
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openRequestInMaintenanceScreen(row)}
                        className="min-h-11 gap-1.5 text-xs"
                        aria-label={`فتح الطلب ${row.title ?? 'بدون عنوان'} في شاشة الصيانة`}
                      >
                        فتح الطلب
                        <ArrowLeft className="size-3.5" aria-hidden="true" />
                      </Button>
                    }
                  />
                );
              })}
            </ReportList>
          )}
        </ReportPanel>

        <div className="space-y-4">
          <ReportPanel
            title="يحتاج انتباهًا الآن"
            description="حالات توقفت عن التقدم أو بانتظار الإغلاق أو تجاوزت موعدها — من نفس اشتقاق المتابعة المعتمد في شاشة الصيانة."
            eyebrow="أولوية المتابعة"
            icon={AlarmClock}
            isLoading={isLoading}
          >
            {attentionSummary.needingAttention === 0 ? (
              <div className="p-4">
                <ReportState
                  title="لا توجد حالات متعثرة"
                  message="كل الطلبات تتحرك أو مغلقة، ولا يوجد موعد زيارة فائت."
                />
              </div>
            ) : (
              <ReportList>
                <ReportListRow
                  title="متوقفة عن التقدم"
                  subtitle={`مفتوحة أو قيد التنفيذ لأكثر من ${formatLatinNumber(MAINTENANCE_STALLED_AFTER_DAYS, 'ar')} أيام`}
                  value={
                    <span
                      className={
                        attentionSummary.stalled > 0
                          ? 'text-warning'
                          : undefined
                      }
                    >
                      {formatLatinNumber(attentionSummary.stalled, 'ar')}
                    </span>
                  }
                />
                <ReportListRow
                  title="بانتظار الإغلاق"
                  subtitle="العمل منجز تقنيًا والإغلاق التشغيلي لم يتم"
                  value={
                    <span
                      className={
                        attentionSummary.awaitingClosure > 0
                          ? 'text-warning'
                          : undefined
                      }
                    >
                      {formatLatinNumber(
                        attentionSummary.awaitingClosure,
                        'ar',
                      )}
                    </span>
                  }
                />
                <ReportListRow
                  title="تجاوزت موعد الزيارة"
                  subtitle="الموعد المجدول مضى والطلب لم يكتمل"
                  value={
                    <span
                      className={
                        attentionSummary.scheduleMissed > 0
                          ? 'text-warning'
                          : undefined
                      }
                    >
                      {formatLatinNumber(attentionSummary.scheduleMissed, 'ar')}
                    </span>
                  }
                />
                <ReportListRow
                  title="أقدم طلب فعّال"
                  subtitle="الأمد المفتوح الحالي بالأيام"
                  value={
                    <span dir="ltr">
                      {formatLatinNumber(
                        attentionSummary.oldestOpenAgeDays,
                        'ar',
                      )}
                    </span>
                  }
                />
              </ReportList>
            )}
          </ReportPanel>

          <ReportPanel
            title="توزيع الحالات والأولويات"
            description="صورة سريعة للرصيد التشغيلي: الحالات تجمع إلى إجمالي البلاغات، والأولويات على الحمل الفعال."
            eyebrow="حالة المحفظة"
            icon={Scale}
            isLoading={isLoading}
          >
            <ReportList>
              <ReportListRow
                title="مفتوحة"
                subtitle="لم يبدأ تنفيذها بعد"
                value={formatLatinNumber(summary.open, 'ar')}
              />
              <ReportListRow
                title="قيد التنفيذ"
                subtitle="يعمل عليها الفريق حاليًا"
                value={formatLatinNumber(summary.inProgress, 'ar')}
              />
              <ReportListRow
                title="مكتملة"
                subtitle="منجزة أو مغلقة"
                value={formatLatinNumber(completedCount, 'ar')}
              />
              <ReportListRow
                title="ملغاة"
                subtitle="قرار إلغاء — لا تُحسب منجزة ولا تدخل معدل الإنجاز"
                value={formatLatinNumber(cancelledCount, 'ar')}
              />
            </ReportList>
            {activeRows.length > 0 && (
              <>
                <div className="border-t border-border/60 px-4 pb-1 pt-3 sm:px-5">
                  <p className="text-xs font-extrabold text-muted-foreground">
                    أولويات الحمل الفعال
                  </p>
                </div>
                <ReportList>
                  {priorityDistribution.map(({ priority, count }) => (
                    <ReportListRow
                      key={priority}
                      title={
                        <span className="flex items-center gap-2">
                          <StatusBadge
                            tone={reportMaintenancePriorityTone[priority]}
                          >
                            {maintenancePriorityLabels[priority]}
                          </StatusBadge>
                        </span>
                      }
                      subtitle={
                        priority === 'urgent'
                          ? 'على الطلبات المفتوحة وقيد التنفيذ'
                          : undefined
                      }
                      value={formatLatinNumber(count, 'ar')}
                    />
                  ))}
                </ReportList>
              </>
            )}
          </ReportPanel>

          <ReportInsightNote title="قاعدة التكلفة">
            تكلفة سجلات الصيانة تُعرض من مصدرها المستقل ولا تُجمع مع المصروفات
            المرحّلة: طلب الصيانة قد يكون ممثلًا أصلًا بسند مصروف، والجمع
            المباشر يعيد احتسابه مرتين. الإجمالي المعتمد يُبنى من المصدر
            المحاسبي.
          </ReportInsightNote>
        </div>
      </ReportColumns>
    </div>
  );
}
