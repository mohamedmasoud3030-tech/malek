import { useState } from 'react';
import { AlertTriangle, Building2, FileText, ReceiptText, UserRound } from 'lucide-react';
import { useDialogNavigate } from '@/app/router/background-location';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate, formatInvoiceStatusLabel, formatMoney } from '@/features/financials/components/financials-formatters';
import type { OverdueInvoiceReportRow } from '@/features/financials/reports/financialReportsService';
import { ReportPanel, ReportState } from '../report-section-primitives';
import { formatLatinNumber } from '@/lib/formatters';

export function getAgingLabel(daysOverdue: number) {
  if (daysOverdue > 90) return 'أكثر من 90 يوم';
  if (daysOverdue > 60) return '61–90 يوم';
  if (daysOverdue > 30) return '31–60 يوم';
  return '1–30 يوم';
}

export function OverdueInvoicesPanel({ rows, action, isLoading }: Readonly<{ rows: OverdueInvoiceReportRow[]; action?: React.ReactNode; isLoading: boolean }>) {
  const [selected, setSelected] = useState<OverdueInvoiceReportRow | null>(null);
  const dialogNavigate = useDialogNavigate();
  const openTarget = (target: { to: string; params?: Record<string, string>; search?: Record<string, unknown> }) => {
    setSelected(null);
    dialogNavigate(target);
  };
  const columns: ColumnDef<OverdueInvoiceReportRow>[] = [
    { key: 'invoice', header: 'الفاتورة', priority: 'identity', render: (row) => <Button variant="link" className="min-h-11 px-1 font-black" onClick={() => setSelected(row)}>{row.invoiceReference ?? 'فاتورة بلا مرجع'}</Button> },
    { key: 'tenant', header: 'المستأجر', priority: 'primary', render: (row) => row.tenantName ?? 'غير محدد' },
    { key: 'property_unit', header: 'العقار / الوحدة', priority: 'primary', render: (row) => [row.propertyTitle, row.unitNumber ? `وحدة ${row.unitNumber}` : null].filter(Boolean).join(' · ') || 'غير محدد' },
    { key: 'contract', header: 'العقد', priority: 'secondary', render: (row) => row.contractReference ?? 'عقد بلا مرجع' },
    { key: 'due', header: 'الاستحقاق', priority: 'secondary', render: (row) => formatDate(row.dueDate) },
    { key: 'aging', header: 'التعتيق', priority: 'primary', render: (row) => <StatusBadge tone={row.daysOverdue > 90 ? 'warning' : 'neutral'}>{getAgingLabel(row.daysOverdue)}</StatusBadge> },
    { key: 'days', header: 'أيام التأخير', priority: 'detail', render: (row) => `${formatLatinNumber(row.daysOverdue, 'ar')} يوم` },
    { key: 'gross', header: 'الأصلي', priority: 'detail', render: (row) => <span dir="ltr">{formatMoney(row.amount)}</span> },
    { key: 'paid', header: 'المدفوع', priority: 'detail', render: (row) => <span dir="ltr">{formatMoney(row.paidAmount)}</span> },
    { key: 'remaining', header: 'المتبقي', priority: 'secondary', render: (row) => <span dir="ltr" className="font-black text-destructive">{formatMoney(row.remainingAmount)}</span> },
    { key: 'status', header: 'الحالة', priority: 'detail', render: (row) => <StatusBadge tone="neutral">{formatInvoiceStatusLabel(row.status)}</StatusBadge> },
    { key: 'actions', header: 'إجراء', priority: 'actions', render: (row) => <Button variant="secondary" className="min-h-11" onClick={() => setSelected(row)}>عرض</Button> },
  ];

  return (
    <ReportPanel title="تحليل المتأخرات" description="سجل تحليلي يربط المستأجر والعقار والوحدة والعقد والفاتورة بالتعتيق وإجراء تحصيل قابل للتنفيذ." icon={AlertTriangle} action={action} isLoading={isLoading}>
      {rows.length === 0 ? <div className="p-4"><ReportState message="لا توجد فواتير متأخرة حسب تاريخ التقرير." /></div> : <div className="p-3 sm:p-4"><EntityTable aria-label="جدول تحليل المتأخرات" rows={rows} columns={columns} keyOf={(row) => row.invoiceId} mobileVisibleSecondaryKey="remaining" onRowClick={(row) => setSelected(row)} /></div>}
      <EntityPreviewDialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }} title={selected ? `تفاصيل المتأخرات — ${selected.invoiceReference ?? 'فاتورة مسجلة'}` : 'تفاصيل المتأخرات'} description="Drill-down سياقي إلى السجلات الأصلية بدون فقد سياق التقرير.">
        {selected ? (
          <div className="space-y-4">
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ['المستأجر', selected.tenantName ?? 'غير محدد'],
                ['العقار', selected.propertyTitle ?? 'غير محدد'],
                ['الوحدة', selected.unitNumber ?? 'غير محددة'],
                ['العقد', selected.contractReference ?? 'عقد بلا مرجع'],
                ['الفاتورة', selected.invoiceReference ?? 'فاتورة بلا مرجع'],
                ['الاستحقاق', formatDate(selected.dueDate)],
                ['أيام التأخير', `${selected.daysOverdue} يوم`],
                ['المبلغ الأصلي', formatMoney(selected.amount)],
                ['المدفوع', formatMoney(selected.paidAmount)],
                ['المتبقي', formatMoney(selected.remainingAmount)],
                ['التعتيق', getAgingLabel(selected.daysOverdue)],
              ].map(([label, value]) => <div key={label} className="rounded-xl border border-border/70 bg-muted/20 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-bold">{value}</dd></div>)}
            </dl>

            <div className="rounded-xl border border-border/70 p-4">
              <p className="font-bold">السجلات المرتبطة</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selected.tenantId ? <Button variant="secondary" onClick={() => openTarget({ to: '/tenants/$tenantId', params: { tenantId: selected.tenantId! } })}><UserRound className="me-1 size-4" />المستأجر</Button> : null}
                {selected.propertyId ? <Button variant="secondary" onClick={() => openTarget({ to: '/properties/$propertyId', params: { propertyId: selected.propertyId! } })}><Building2 className="me-1 size-4" />العقار</Button> : null}
                {selected.propertyId && selected.unitId ? <Button variant="secondary" onClick={() => openTarget({ to: '/properties/$propertyId/units/$unitId', params: { propertyId: selected.propertyId!, unitId: selected.unitId! } })}>الوحدة</Button> : null}
                <Button variant="secondary" onClick={() => openTarget({ to: '/contracts/$contractId', params: { contractId: selected.contractId } })}><FileText className="me-1 size-4" />العقد</Button>
                <Button variant="secondary" onClick={() => openTarget({ to: '/invoices', search: { invoiceId: selected.invoiceId } })}><ReceiptText className="me-1 size-4" />الفاتورة</Button>
              </div>
            </div>

            <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm leading-6">
              <p className="font-bold">الإجراء التالي</p>
              <p className="mt-1 text-muted-foreground">ابدأ تحصيل هذه الفاتورة من سجل الفواتير التشغيلي. لا نعرض سبب تأخير أو آخر تحصيل أو Timeline لأن مصدر التقرير الحالي لا يوفرها بصورة موثوقة.</p>
              <Button className="mt-3" onClick={() => openTarget({ to: '/invoices', search: { invoiceId: selected.invoiceId, collect: 1 } })}>بدء التحصيل</Button>
            </div>
          </div>
        ) : null}
      </EntityPreviewDialog>
    </ReportPanel>
  );
}
