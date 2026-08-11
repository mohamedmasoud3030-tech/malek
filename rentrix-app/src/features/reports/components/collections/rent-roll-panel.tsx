import { Building2 } from 'lucide-react';
import { DataTable } from '@/components/ui/data-table';
import { formatDate, formatMoney } from '@/features/financials/components/financials-formatters';
import type { RentRollReportRow } from '../../reports-page.helpers';
import { SafeAnchor } from '../common';
import { ReportPanel, ReportState } from '../report-section-primitives';

export function RentRollPanel({ rows, action, isLoading }: Readonly<{ rows: RentRollReportRow[]; action?: React.ReactNode; isLoading: boolean }>) {
  return <ReportPanel title="سجل الإيجارات الجاري" description="العقد والمستأجر والعقار والوحدة وقيمة الدفعة والدورة." icon={Building2} action={action} isLoading={isLoading}>
    {rows.length === 0 ? <div className="p-4"><ReportState message="لا توجد عقود ضمن البيانات الحالية." /></div> : <div className="p-4"><DataTable
      aria-label="جدول عقود الإيجار"
      rows={rows}
      mobileVisibleSecondaryKey="status"
      columns={[
        { key: 'contract', header: 'العقد', priority: 'identity', render: (row) => <SafeAnchor href={`/contracts/${encodeURIComponent(row.contractId)}`} label={row.contractReference ?? 'عقد بلا مرجع'} /> },
        { key: 'tenant', header: 'المستأجر', priority: 'primary', render: (row) => row.tenantName },
        { key: 'property', header: 'العقار/الوحدة', priority: 'primary', render: (row) => `${row.propertyTitle} · ${row.unitNumber}` },
        { key: 'rent', header: 'الإيجار', priority: 'secondary', render: (row) => <span className="font-bold" dir="ltr">{formatMoney(row.rentAmount)}</span> },
        { key: 'cycle', header: 'الدورة', priority: 'secondary', render: (row) => row.paymentCycle },
        { key: 'status', header: 'الحالة', priority: 'detail', render: (row) => row.statusLabel },
        { key: 'period', header: 'الفترة', priority: 'detail', render: (row) => `${formatDate(row.startDate)} — ${formatDate(row.endDate)}` },
      ]}
      keyOf={(row) => row.contractId}
      emptyTitle="لا توجد عقود"
      emptyDescription="لا توجد عقود ضمن البيانات الحالية."
    /></div>}
  </ReportPanel>;
}
