import { useMemo, useState } from 'react';
import { ClipboardList, FileText, ReceiptText } from 'lucide-react';
import { useDialogNavigate } from '@/app/router/background-location';
import { Button } from '@/components/ui/button';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate, formatInvoiceStatusLabel, formatMoney } from '@/features/financials/components/financials-formatters';
import type { OverdueInvoiceReportRow } from '@/features/financials/reports/financialReportsService';
import { formatLatinNumber } from '@/lib/formatters';
import { buildReportCsvFilename, downloadCsv } from '../reports-page.helpers';
import { ReportList, ReportListRow, ReportPanel, ReportState } from './report-section-primitives';
import { getAgingLabel } from './overdue/overdue-invoices-panel';

const FOLLOW_UP_QUEUE_LIMIT = 20;

function followUpRiskScore(row: OverdueInvoiceReportRow): number {
  // Highest remaining value first, then oldest debt — deterministic, no AI.
  return row.remainingAmount * 1000 + row.daysOverdue;
}

/**
 * Read-only follow-up queue inside the collections workspace. The reports
 * center identifies the action; the operational workspaces perform it — every
 * row hands off to the invoice/contract/tenant screens through the same
 * dialog-navigate drill pattern used by the arrears panel. No mutation,
 * no status change, no note-writing lives here.
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
  const dialogNavigate = useDialogNavigate();

  const queue = useMemo(
    () =>
      [...rows]
        .sort((a, b) => followUpRiskScore(b) - followUpRiskScore(a))
        .slice(0, FOLLOW_UP_QUEUE_LIMIT),
    [rows],
  );

  const openTarget = (target: { to: string; params?: Record<string, string>; search?: Record<string, unknown> }) => {
    setSelected(null);
    dialogNavigate(target);
  };

  const exportAction = canExportReports ? (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className="min-h-11 shrink-0 gap-2 text-xs"
      onClick={() => downloadCsv(
        buildReportCsvFilename('follow-up-queue'),
        queue.map((row) => ({
          tenant: row.tenantName ?? '',
          property: row.propertyTitle ?? '',
          unit: row.unitNumber ?? '',
          contract: row.contractReference ?? '',
          invoice: row.invoiceReference ?? row.shortInvoiceId,
          dueDate: row.dueDate,
          daysOverdue: row.daysOverdue,
          remaining: row.remainingAmount,
          aging: getAgingLabel(row.daysOverdue),
        })),
      )}
      disabled={queue.length === 0}
    >
      <FileText className="size-4" aria-hidden="true" />
      CSV
    </Button>
  ) : undefined;

  return (
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
          {queue.map((row) => (
            <ReportListRow
              key={row.invoiceId}
              title={row.tenantName ?? 'مستأجر غير محدد'}
              subtitle={`${[row.propertyTitle, row.unitNumber ? `وحدة ${row.unitNumber}` : null].filter(Boolean).join(' · ') || 'غير محدد'} · ${row.contractReference ?? 'عقد بلا مرجع'}`}
              meta={`${formatDate(row.dueDate)} · ${formatLatinNumber(row.daysOverdue, 'ar')} يوم`}
              value={(
                <span className="flex items-center gap-2">
                  <StatusBadge tone={row.daysOverdue > 90 ? 'warning' : 'neutral'}>{getAgingLabel(row.daysOverdue)}</StatusBadge>
                  <span dir="ltr" className="font-black text-destructive">{formatMoney(row.remainingAmount)}</span>
                </span>
              )}
              action={(
                <Button variant="secondary" className="min-h-11" onClick={() => setSelected(row)}>
                  متابعة
                </Button>
              )}
            />
          ))}
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
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                ['العقار / الوحدة', [selected.propertyTitle, selected.unitNumber ? `وحدة ${selected.unitNumber}` : null].filter(Boolean).join(' · ') || 'غير محدد'],
                ['العقد', selected.contractReference ?? 'عقد بلا مرجع'],
                ['الفاتورة', selected.invoiceReference ?? 'فاتورة بلا مرجع'],
                ['الاستحقاق', formatDate(selected.dueDate)],
                ['أيام التأخير', `${formatLatinNumber(selected.daysOverdue, 'ar')} يوم`],
                ['المتبقي', formatMoney(selected.remainingAmount)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border/70 bg-muted/20 p-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 font-bold">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="rounded-xl border border-border/70 p-4">
              <p className="font-bold">الإجراءات التشغيلية</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => openTarget({ to: '/invoices', search: { invoiceId: selected.invoiceId, collect: 1 } })}>
                  <ReceiptText className="me-1 size-4" aria-hidden="true" />
                  بدء التحصيل من الفواتير
                </Button>
                <Button variant="secondary" onClick={() => openTarget({ to: '/contracts/$contractId', params: { contractId: selected.contractId } })}>
                  <FileText className="me-1 size-4" aria-hidden="true" />
                  العقد
                </Button>
                <Button variant="secondary" onClick={() => openTarget({ to: '/invoices', search: { invoiceId: selected.invoiceId } })}>
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
  );
}
