import { CalendarRange, Landmark, ReceiptText, Scale, WalletCards } from 'lucide-react';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import type { CashFlowStatementReport, VatReturnReport } from '@/features/financials/reports/financial-statements-service';
import { ReportColumns, ReportPanel, ReportPanelSkeleton } from '../report-section-primitives';

export function StatementSelectionStrip({
  selectedContractId,
  selectedOwnerId,
  from,
  to,
}: Readonly<{
  selectedContractId: string;
  selectedOwnerId: string;
  from?: string;
  to?: string;
}>) {
  return (
    <section className="grid gap-2 rounded-xl border border-border/70 bg-muted/20 p-3 sm:grid-cols-3" aria-label="حالة اختيار الكشوف">
      <SelectionItem label="كشف المستأجر" value={selectedContractId ? 'عقد محدد' : 'اختر عقدًا'} ready={Boolean(selectedContractId)} />
      <SelectionItem label="كشف المالك" value={selectedOwnerId ? 'مالك محدد' : 'اختر مالكًا'} ready={Boolean(selectedOwnerId)} />
      <SelectionItem label="فترة الكشف" value={`${from || '—'} إلى ${to || '—'}`} ready />
    </section>
  );
}

function SelectionItem({ label, value, ready }: Readonly<{ label: string; value: string; ready: boolean }>) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-background px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-sm font-bold">{value}</p>
      </div>
      <StatusBadge tone={ready ? 'success' : 'neutral'}>{ready ? 'جاهز' : 'مطلوب'}</StatusBadge>
    </div>
  );
}

export function OfficeSummaryPanel({
  invoiced,
  collections,
  expenses,
  outstanding,
  invoicesCount,
  paymentsCount,
  expensesCount,
  receiptsCount,
}: Readonly<{
  invoiced: number;
  collections: number;
  expenses: number;
  outstanding: number;
  invoicesCount: number;
  paymentsCount: number;
  expensesCount: number;
  receiptsCount: number;
}>) {
  return (
    <ReportPanel
      title="ملخص حركة المكتب"
      description="الفواتير والتحصيلات والمصروفات والرصيد داخل الفترة."
      icon={Landmark}
    >
      <ResponsiveCardGrid className="p-4" gap="sm">
        <KpiCard label="فواتير الفترة" value={formatMoney(invoiced)} icon={ReceiptText} sub={`${invoicesCount.toLocaleString('ar')} فواتير`} compact />
        <KpiCard label="تحصيلات الفترة" value={formatMoney(collections)} icon={WalletCards} sub={`${paymentsCount.toLocaleString('ar')} مدفوعات`} compact />
        <KpiCard label="مصروفات الفترة" value={formatMoney(expenses)} icon={WalletCards} sub={`${expensesCount.toLocaleString('ar')} مصروفات`} compact />
        <KpiCard label="الرصيد المستحق" value={formatMoney(outstanding)} icon={Scale} sub={`${receiptsCount.toLocaleString('ar')} إيصالات`} compact />
      </ResponsiveCardGrid>
    </ReportPanel>
  );
}

export function RegulatorySummaryPanels({
  cashFlow,
  vatReturn,
  isLoading,
}: Readonly<{
  cashFlow: CashFlowStatementReport | undefined;
  vatReturn: VatReturnReport | undefined;
  isLoading: boolean;
}>) {
  return (
    <ReportColumns>
      <ReportPanel title="التدفق النقدي" description="قراءة مباشرة من تقرير التدفق للفترة." icon={WalletCards}>
        {isLoading ? (
          <ReportPanelSkeleton />
        ) : (
          <ResponsiveCardGrid className="p-4" gap="sm">
            <KpiCard label="المقبوضات" value={formatMoney(cashFlow?.operating.receipts ?? 0)} icon={WalletCards} compact />
            <KpiCard label="المصروفات" value={formatMoney(cashFlow?.operating.expenses ?? 0)} icon={WalletCards} compact />
            <KpiCard label="صافي التشغيل" value={formatMoney(cashFlow?.operating.netOperating ?? 0)} icon={Scale} compact />
            <KpiCard label="صافي التغير" value={formatMoney(cashFlow?.netChange ?? 0)} icon={CalendarRange} compact />
          </ResponsiveCardGrid>
        )}
      </ReportPanel>

      <ReportPanel title="ملخص ضريبة القيمة المضافة" description="المبيعات والضريبة والفواتير من التقرير المعتمد." icon={Scale}>
        {isLoading ? (
          <ReportPanelSkeleton />
        ) : (
          <ResponsiveCardGrid className="p-4" gap="sm">
            <KpiCard label="المبيعات الخاضعة" value={formatMoney(vatReturn?.totalSalesAmount ?? 0)} icon={ReceiptText} compact />
            <KpiCard label="إجمالي الضريبة" value={formatMoney(vatReturn?.totalTaxAmount ?? 0)} icon={Scale} compact />
            <KpiCard label="عدد الفواتير" value={(vatReturn?.invoiceCount ?? 0).toLocaleString('ar')} icon={ReceiptText} compact />
            <KpiCard label="الفترة" value={vatReturn?.period.from ? 'محددة' : '—'} icon={CalendarRange} sub={vatReturn?.period.from && vatReturn.period.to ? `${vatReturn.period.from} — ${vatReturn.period.to}` : 'لا توجد فترة'} compact />
          </ResponsiveCardGrid>
        )}
      </ReportPanel>
    </ReportColumns>
  );
}
