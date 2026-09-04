import { useMemo, useState } from 'react';
import { ClipboardList, FileText, ReceiptText, UserRound } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { PreviewFacts, type PreviewFactRow } from '@/components/ui/quick-preview';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate, formatMoney } from '@/features/financials/components/financials-formatters';
import type { OverdueInvoiceReportRow } from '@/features/financials/reports/financialReportsService';
import { formatLatinNumber } from '@/lib/formatters';
import { buildReportCsvFilename, downloadCsv } from '../reports-page.helpers';
import { ReportInsightNote, ReportList, ReportListRow, ReportPanel, ReportState, ReportSummaryStrip } from '@/components/ui/report-section-primitives';
import { getAgingLabel } from './overdue/overdue-invoices-panel';

const FOLLOW_UP_QUEUE_LIMIT = 20;

function followUpRiskScore(row: OverdueInvoiceReportRow): number {
  // Highest remaining value first, then oldest debt — deterministic, no AI.
  return row.remainingAmount * 1000 + row.daysOverdue;
}

/**
 * Deterministic action tier: age decides urgency, the risk-score order
 * decides position inside a tier. Presentation only — no financial figure is
 * produced here.
 */
export function getFollowUpTier(daysOverdue: number): { label: string; tone: 'danger' | 'warning' | 'neutral' } {
  if (daysOverdue > 90) return { label: 'تصعيد فوري', tone: 'danger' };
  if (daysOverdue > 60) return { label: 'متابعة عاجلة', tone: 'warning' };
  return { label: getAgingLabel(daysOverdue), tone: 'neutral' };
}

/**
 * Read-only follow-up queue inside the collections workspace — answers "what
 * should I act on first?". The reports center identifies the action; the
 * operational workspaces perform it — every row hands off to the
 * invoice/contract/tenant screens through the same dialog-navigate drill
 * pattern used by the arrears panel. No mutation, no status change, no
 * note-writing lives here.
 *
 * Semantic contract: every figure in this surface is scoped to the displayed
 * queue (top {FOLLOW_UP_QUEUE_LIMIT} by risk). It never presents a queue sum
 * as the authoritative total overdue — that executive figure belongs to the
 * Overdue report's arrears summary.
 */
export function FollowUpSection({
  rows,
  canExportReports,
  isLoading,
}: Readonly<{
  rows: OverdueInvoiceReportRow[];
  canExportReports: boolean;
  isLoading: boolean;
}>) {
  const [selected, setSelected] = useState<OverdueInvoiceReportRow | null>(null);
  const navigate = useNavigate();

  const queue = useMemo(
    () =>
      [...rows]
        .sort((a, b) => followUpRiskScore(b) - followUpRiskScore(a))
        .slice(0, FOLLOW_UP_QUEUE_LIMIT),
    [rows],
  );

  // Work-queue scope figures for prioritisation context only.
  const queueValue = queue.reduce((total, row) => total + row.remainingAmount, 0);
  const escalationCount = queue.filter((row) => row.daysOverdue > 90).length;
  const oldestDays = queue.reduce((oldest, row) => Math.max(oldest, row.daysOverdue), 0);
  const firstInQueue = queue[0];

  const openTarget = (target: { to: string; params?: Record<string, string>; search?: Record<string, unknown> }) => {
    setSelected(null);
    void navigate(target as never);
  };

  const exportAction = canExportReports ? (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className="min-h-11 shrink-0 gap-2 text-xs"
      onClick={() => downloadCsv(
        buildReportCsvFilename('follow-up-queue'),
        queue.map((row, index) => ({
          rank: index + 1,
          tenant: row.tenantName ?? '',
          phone: row.tenantPhone ?? '',
          property: row.propertyTitle ?? '',
          unit: row.unitNumber ?? '',
          contract: row.contractReference ?? '',
          invoice: row.invoiceReference ?? row.shortInvoiceId,
          dueDate: row.dueDate,
          daysOverdue: row.daysOverdue,
          remaining: row.remainingAmount,
          tier: getFollowUpTier(row.daysOverdue).label,
        })),
      )}
      disabled={queue.length === 0}
    >
      <FileText className="size-4" aria-hidden="true" />
      CSV
    </Button>
  ) : undefined;

  return (
    <div className="space-y-3">
      {queue.length > 0 ? (
        <ReportSummaryStrip
          dataReportSummary="follow-up"
          items={[
            {
              label: 'بنود قائمة العمل',
              value: formatLatinNumber(queue.length, 'ar'),
              detail: rows.length > queue.length
                ? `أعلى ${formatLatinNumber(FOLLOW_UP_QUEUE_LIMIT, 'ar')} من ${formatLatinNumber(rows.length, 'ar')} فاتورة متأخرة`
                : 'كل الفواتير المتأخرة ضمن القائمة',
            },
            {
              label: 'قيمة القائمة المعروضة',
              value: formatMoney(queueValue),
              detail: 'نطاق قائمة العمل — ليست إجمالي المتأخرات',
            },
            {
              label: 'تصعيد فوري',
              value: formatLatinNumber(escalationCount, 'ar'),
              detail: 'تجاوزت 90 يومًا',
              tone: escalationCount > 0 ? 'critical' : 'good',
            },
            {
              label: 'أقدم دين في القائمة',
              value: `${formatLatinNumber(oldestDays, 'ar')} يوم`,
              detail: 'العمر الأقصى المعروض',
            },
          ]}
        />
      ) : null}

      {firstInQueue ? (
        <ReportInsightNote title="ابدأ من هنا">
          {`${firstInQueue.tenantName ?? 'مستأجر غير محدد'} — ${formatMoney(firstInQueue.remainingAmount)} متأخرة منذ ${formatLatinNumber(firstInQueue.daysOverdue, 'ar')} يوم.`}
          {escalationCount > 0
            ? ` ${formatLatinNumber(escalationCount, 'ar')} من بنود القائمة تجاوزت 90 يومًا وتحتاج تصعيدًا قبل بقية المتابعة.`
            : ' لا توجد بنود تجاوزت 90 يومًا في القائمة الحالية؛ التزم بترتيب القيمة ثم العمر.'}
        </ReportInsightNote>
      ) : null}

      <ReportPanel
        title="قائمة المتابعة"
        description="مرتبة حسب الخطر والقيمة: من عليه أعلى مبلغ متأخر وأقدمه. التقارير تحدد الإجراء، وشاشات التشغيل تنفذه."
        eyebrow="متابعة تنفيذية"
        icon={ClipboardList}
        action={exportAction}
        isLoading={isLoading}
      >
        {queue.length === 0 ? (
          <div className="p-4">
            <ReportState message="لا توجد متأخرات تحتاج متابعة ضمن النطاق المحدد." />
          </div>
        ) : (
          <ReportList>
            {queue.map((row, index) => {
              const tier = getFollowUpTier(row.daysOverdue);
              return (
                <ReportListRow
                  key={row.invoiceId}
                  title={(
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-muted text-[11px] font-black tabular-nums" aria-hidden="true">
                        {formatLatinNumber(index + 1, 'ar')}
                      </span>
                      <span>{row.tenantName ?? 'مستأجر غير محدد'}</span>
                    </span>
                  )}
                  subtitle={`${[row.propertyTitle, row.unitNumber ? `وحدة ${row.unitNumber}` : null].filter(Boolean).join(' · ') || 'غير محدد'} · ${row.contractReference ?? 'عقد بلا مرجع'}`}
                  meta={`${formatDate(row.dueDate)} · ${formatLatinNumber(row.daysOverdue, 'ar')} يوم`}
                  value={(
                    <span className="flex items-center gap-2">
                      <StatusBadge tone={tier.tone}>{tier.label}</StatusBadge>
                      <span dir="ltr" className="font-black text-destructive">{formatMoney(row.remainingAmount)}</span>
                    </span>
                  )}
                  action={(
                    <Button variant="secondary" className="min-h-11" onClick={() => setSelected(row)}>
                      متابعة
                    </Button>
                  )}
                />
              );
            })}
          </ReportList>
        )}

        <EntityPreviewDialog
          open={Boolean(selected)}
          onOpenChange={(open) => { if (!open) setSelected(null); }}
          title={selected ? `متابعة تحصيل — ${selected.tenantName ?? 'مستأجر غير محدد'}` : 'متابعة تحصيل'}
          description="الانتقال للسجلات الأصلية يفتح شاشة التشغيل المختصة دون تغيير أي حالة من مركز التقارير."
        >
          {selected ? (
            <div className="space-y-4">
              <PreviewFacts
                rows={[
                  {
                    label: 'العقار / الوحدة',
                    value: [selected.propertyTitle, selected.unitNumber ? `وحدة ${selected.unitNumber}` : null].filter(Boolean).join(' · ') || 'غير محدد',
                  },
                  { label: 'الفاتورة', value: selected.invoiceReference ?? 'فاتورة بلا مرجع' },
                  { label: 'الاستحقاق', value: formatDate(selected.dueDate) },
                  { label: 'أيام التأخير', value: `${formatLatinNumber(selected.daysOverdue, 'ar')} يوم` },
                  { label: 'المتبقي', value: <span dir="ltr">{formatMoney(selected.remainingAmount)}</span> },
                  { label: 'درجة المتابعة', value: getFollowUpTier(selected.daysOverdue).label },
                ] satisfies PreviewFactRow[]}
              />

              <div className="rounded-xl border border-border/70 p-4">
                <p className="font-bold">الإجراءات التشغيلية</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={() => openTarget({ to: '/financials', search: { section: 'collections', view: 'invoices', invoiceId: selected.invoiceId, collect: 1 } })}>
                    <ReceiptText className="me-1 size-4" aria-hidden="true" />
                    بدء التحصيل من الفواتير
                  </Button>
                  {selected.tenantId ? (
                    <Button variant="secondary" onClick={() => openTarget({ to: '/tenants/$tenantId', params: { tenantId: selected.tenantId! } })}>
                      <UserRound className="me-1 size-4" aria-hidden="true" />
                      المستأجر
                    </Button>
                  ) : null}
                  <Button variant="secondary" onClick={() => openTarget({ to: '/contracts/$contractId', params: { contractId: selected.contractId } })}>
                    <FileText className="me-1 size-4" aria-hidden="true" />
                    العقد
                  </Button>
                  <Button variant="secondary" onClick={() => openTarget({ to: '/financials', search: { section: 'collections', view: 'invoices', invoiceId: selected.invoiceId } })}>
                    الفاتورة
                  </Button>
                </div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  لا يتم تسجيل أي اتصال أو وعد سداد من هنا — شاشة الفواتير التشغيلية هي مكان تنفيذ التحصيل.
                </p>
              </div>
            </div>
          ) : null}
        </EntityPreviewDialog>
      </ReportPanel>
    </div>
  );
}
