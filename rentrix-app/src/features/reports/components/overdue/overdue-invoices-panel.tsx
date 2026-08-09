import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate, formatInvoiceStatusLabel, formatMoney, formatShortId } from '@/features/financials/components/financials-formatters';
import type { OverdueInvoiceReportRow } from '@/features/financials/reports/financialReportsService';
import { ReportPanel, ReportState } from '../report-section-primitives';
import { formatLatinNumber } from '@/lib/formatters';

export function OverdueInvoicesPanel({ rows, action, isLoading }: Readonly<{ rows: OverdueInvoiceReportRow[]; action?: React.ReactNode; isLoading: boolean }>) {
  const [selected, setSelected] = useState<OverdueInvoiceReportRow | null>(null);
  const columns: ColumnDef<OverdueInvoiceReportRow>[] = [
    { key: 'invoice', header: 'الفاتورة', render: (row) => <Button variant="link" className="min-h-11 px-1 font-black" onClick={() => setSelected(row)}>#{row.shortInvoiceId}</Button> },
    { key: 'tenant', header: 'المتأخر', render: (row) => row.tenantName ?? 'غير محدد' },
    { key: 'property_unit', header: 'العقار / الوحدة', render: (row) => [row.propertyTitle, row.unitNumber ? `وحدة ${row.unitNumber}` : null].filter(Boolean).join(' · ') || 'غير محدد' },
    { key: 'contract', header: 'العقد', render: (row) => formatShortId(row.contractId) },
    { key: 'due', header: 'الاستحقاق', render: (row) => formatDate(row.dueDate) },
    { key: 'days', header: 'أيام التأخير', render: (row) => `${formatLatinNumber(row.daysOverdue, 'ar')} يوم` },
    { key: 'gross', header: 'الأصلي', render: (row) => <span dir="ltr">{formatMoney(row.amount)}</span> },
    { key: 'paid', header: 'المدفوع', render: (row) => <span dir="ltr">{formatMoney(row.paidAmount)}</span> },
    { key: 'remaining', header: 'المتبقي', render: (row) => <span dir="ltr" className="font-black text-destructive">{formatMoney(row.remainingAmount)}</span> },
    { key: 'status', header: 'الحالة', render: (row) => <StatusBadge tone="neutral">{formatInvoiceStatusLabel(row.status)}</StatusBadge> },
    { key: 'actions', header: 'إجراء', render: (row) => <Button variant="secondary" className="min-h-11" onClick={() => setSelected(row)}>عرض</Button> },
  ];
  return <ReportPanel title="تحليل المتأخرات" description="سجل تفصيلي يربط المتأخر بالمستأجر والعقار والوحدة والعقد والفاتورة والقيمة والعمر والإجراء التالي." icon={AlertTriangle} action={action} isLoading={isLoading}>
    {rows.length === 0 ? <div className="p-4"><ReportState message="لا توجد فواتير متأخرة حسب تاريخ التقرير." /></div> : <div className="p-3 sm:p-4"><EntityTable aria-label="جدول تحليل المتأخرات" rows={rows} columns={columns} keyOf={(row) => row.invoiceId} onRowClick={(row) => setSelected(row)} /></div>}
    <EntityPreviewDialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }} title={selected ? `تفاصيل المتأخرات — ${selected.shortInvoiceId}` : 'تفاصيل المتأخرات'} description="Drill-down داخل التقرير دون مغادرة Reports.">
      {selected ? <div className="space-y-4"><dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[['المتأخر', selected.tenantName ?? 'غير محدد'], ['العقار', selected.propertyTitle ?? 'غير محدد'], ['الوحدة', selected.unitNumber ?? 'غير محددة'], ['العقد', formatShortId(selected.contractId)], ['الفاتورة', selected.shortInvoiceId], ['الاستحقاق', formatDate(selected.dueDate)], ['أيام التأخير', `${selected.daysOverdue} يوم`], ['المبلغ الأصلي', formatMoney(selected.amount)], ['المدفوع', formatMoney(selected.paidAmount)], ['المتبقي', formatMoney(selected.remainingAmount)], ['Aging', selected.daysOverdue > 90 ? 'أكثر من 90 يوم' : selected.daysOverdue > 60 ? '61–90 يوم' : selected.daysOverdue > 30 ? '31–60 يوم' : '1–30 يوم']].map(([label, value]) => <div key={label} className="rounded-xl border border-border/70 bg-muted/20 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-bold">{value}</dd></div>)}</dl><div className="rounded-xl border border-dashed p-4 text-sm leading-6 text-muted-foreground"><p className="font-bold text-foreground">الإجراء التالي</p><p className="mt-1">ابدأ التحصيل من واجهة الفواتير التشغيلية؛ لا توجد في مصدر تقرير المتأخرات الحالي بيانات موثوقة عن سبب التأخير أو آخر تحصيل أو Timeline تفصيلي.</p></div></div> : null}
    </EntityPreviewDialog>
  </ReportPanel>;
}
