import { Building2 } from 'lucide-react';
import { DataTable } from '@/components/ui/data-table';
import { MobileCard } from '@/components/ui/mobile-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate, formatMoney, formatShortId } from '@/features/financials/components/financials-formatters';
import type { RentRollReportRow } from '../../reports-page.helpers';
import { SafeAnchor } from '../common';
import { ReportPanel, ReportState } from '../report-section-primitives';

export function RentRollPanel({
  rows,
  action,
  isLoading,
}: Readonly<{
  rows: RentRollReportRow[];
  action?: React.ReactNode;
  isLoading: boolean;
}>) {
  return (
    <ReportPanel
      title="سجل الإيجارات الجاري"
      description="العقد والمستأجر والعقار والوحدة وقيمة الدفعة والدورة."
      icon={Building2}
      action={action}
      isLoading={isLoading}
    >
      {rows.length === 0 ? (
        <div className="p-4"><ReportState message="لا توجد عقود ضمن البيانات الحالية." /></div>
      ) : (
        <>
          <div className="grid gap-3 p-4 md:hidden">
            {rows.map((row) => (
              <MobileCard
                key={row.contractId}
                title={row.tenantName}
                subtitle={`${row.propertyTitle} · ${row.unitNumber}`}
                badge={<StatusBadge tone={row.statusLabel === 'نشط' ? 'green' : 'gray'}>{row.statusLabel}</StatusBadge>}
                meta={`${row.paymentCycle} · ${formatDate(row.startDate)} — ${formatDate(row.endDate)}`}
                stats={(
                  <div className="flex items-center justify-between gap-2">
                    <SafeAnchor href={`/contracts/${encodeURIComponent(row.contractId)}`} label={formatShortId(row.contractId)} />
                    <span className="font-bold" dir="ltr">{formatMoney(row.rentAmount)}</span>
                  </div>
                )}
              />
            ))}
          </div>

          <div className="hidden px-4 pb-4 md:block">
            <DataTable
              aria-label="جدول عقود الإيجار"
              rows={rows}
              columns={[
                { key: 'contract', header: 'العقد', render: (row) => <SafeAnchor href={`/contracts/${encodeURIComponent(row.contractId)}`} label={formatShortId(row.contractId)} /> },
                { key: 'tenant', header: 'المستأجر', render: (row) => row.tenantName },
                { key: 'property', header: 'العقار/الوحدة', render: (row) => `${row.propertyTitle} · ${row.unitNumber}` },
                { key: 'rent', header: 'الإيجار', render: (row) => <span className="font-bold" dir="ltr">{formatMoney(row.rentAmount)}</span> },
                { key: 'cycle', header: 'الدورة', render: (row) => row.paymentCycle },
                { key: 'status', header: 'الحالة', render: (row) => row.statusLabel },
                { key: 'period', header: 'الفترة', render: (row) => `${formatDate(row.startDate)} — ${formatDate(row.endDate)}` },
              ]}
              keyOf={(row) => row.contractId}
              emptyTitle="لا توجد عقود"
              emptyDescription="لا توجد عقود ضمن البيانات الحالية."
            />
          </div>
        </>
      )}
    </ReportPanel>
  );
}
