import { AlertTriangle, CalendarRange, Landmark, ReceiptText, Scale, WalletCards } from 'lucide-react';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import type { CashFlowReport } from '@/features/accounting/reports/accountingReportsFacade';
import type { VatReturnReport } from '@/features/financials/reports/financial-statements-service';
import { ReportColumns, ReportPanel, ReportPanelSkeleton, ReportSummaryStrip } from '@/components/ui/report-section-primitives';
import { formatLatinNumber } from '@/lib/formatters';

export function OfficeSummaryPanel({
  invoiced,
  collections,
  expenses,
  outstanding,
  invoicesCount,
  paymentsCount,
  expensesCount,
}: Readonly<{
  invoiced: number;
  collections: number;
  expenses: number;
  outstanding: number;
  invoicesCount: number;
  paymentsCount: number;
  expensesCount: number;
}>) {
  return (
    <ReportPanel
      title="ملخص حركة المكتب"
      description="الفواتير والتحصيلات والمصروفات والرصيد داخل الفترة؛ ملخص تشغيلي وليس قائمة دخل أو تدفق نقدي."
      icon={Landmark}
    >
      <div className="p-4">
        <ReportSummaryStrip
          dataReportSummary="office-movement"
          items={[
            { label: 'فواتير الفترة', value: formatMoney(invoiced), detail: `${formatLatinNumber(invoicesCount, 'ar')} فواتير` },
            { label: 'تحصيلات الفترة', value: formatMoney(collections), detail: `${formatLatinNumber(paymentsCount, 'ar')} مدفوعات` },
            { label: 'مصروفات الفترة', value: formatMoney(expenses), detail: `${formatLatinNumber(expensesCount, 'ar')} مصروفات` },
            { label: 'الرصيد المستحق', value: formatMoney(outstanding), detail: 'المتبقي غير المسدد ضمن الفترة' },
          ]}
        />
      </div>
    </ReportPanel>
  );
}

export function RegulatorySummaryPanels({
  cashFlow,
  cashFlowError,
  isCashFlowLoading,
  vatReturn,
  isLoading,
}: Readonly<{
  cashFlow: CashFlowReport | undefined;
  cashFlowError: unknown;
  isCashFlowLoading: boolean;
  vatReturn: VatReturnReport | undefined;
  isLoading: boolean;
}>) {
  return (
    <ReportColumns>
      <ReportPanel
        title="التدفق النقدي من الأستاذ العام"
        description="حركة النقدية والبنوك 1111/1120 من القيود المرحّلة، مع رصيد افتتاحي وختامي وفحص اتزان. هذا هو مسار Cash Flow المحاسبي؛ المقارنة التشغيلية بين التحصيل والمصروفات منفصلة."
        icon={WalletCards}
        action={cashFlow ? (
          <StatusBadge tone={cashFlow.isBalanced ? 'success' : 'danger'}>
            {cashFlow.isBalanced ? 'متوازن' : 'غير متوازن'}
          </StatusBadge>
        ) : undefined}
      >
        {isCashFlowLoading ? (
          <ReportPanelSkeleton />
        ) : cashFlowError ? (
          <div className="flex items-start gap-2 p-4 text-sm font-semibold text-destructive" role="alert">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            تعذر تحميل التدفق النقدي من الأستاذ العام. لا يتم عرض تقدير بديل من التحصيلات والمصروفات.
          </div>
        ) : !cashFlow ? (
          <div className="p-4 text-sm text-muted-foreground">
            لا توجد نتيجة تدفق نقدي محاسبية للفترة المحددة. راجع الفترة والقيود المرحّلة ثم أعد المحاولة.
          </div>
        ) : (
          <ResponsiveCardGrid className="p-4" gap="sm">
            <KpiCard label="الرصيد الافتتاحي" value={formatMoney(cashFlow.openingCash)} icon={WalletCards} compact />
            <KpiCard label="التشغيل" value={formatMoney(cashFlow.operating)} icon={WalletCards} compact />
            <KpiCard label="الاستثمار" value={formatMoney(cashFlow.investing)} icon={Scale} compact />
            <KpiCard label="التمويل" value={formatMoney(cashFlow.financing)} icon={Scale} compact />
            <KpiCard label="غير مصنف" value={formatMoney(cashFlow.unclassified)} icon={AlertTriangle} compact />
            <KpiCard label="صافي التغير" value={formatMoney(cashFlow.totalChange)} icon={CalendarRange} compact />
            <KpiCard label="الرصيد الختامي" value={formatMoney(cashFlow.closingCash)} icon={WalletCards} compact />
            <KpiCard
              label="فرق الاتزان"
              value={formatMoney(cashFlow.variance)}
              icon={Scale}
              sub={cashFlow.isBalanced ? 'الافتتاحي + الحركة = الختامي' : 'يحتاج مراجعة قبل الاعتماد'}
              compact
            />
          </ResponsiveCardGrid>
        )}
      </ReportPanel>

      <ReportPanel title="ملخص ضريبة القيمة المضافة" description="الوعاء الضريبي والضريبة والفواتير من التقرير الضريبي المعتمد؛ لا يُعاد تصنيف تحصيلات المالك كإيراد مكتب." icon={Scale}>
        {isLoading ? (
          <ReportPanelSkeleton />
        ) : (
          <ResponsiveCardGrid className="p-4" gap="sm">
            <KpiCard label="الوعاء الخاضع للضريبة" value={formatMoney(vatReturn?.totalSalesAmount ?? 0)} icon={ReceiptText} compact />
            <KpiCard label="إجمالي الضريبة" value={formatMoney(vatReturn?.totalTaxAmount ?? 0)} icon={Scale} compact />
            <KpiCard label="عدد الفواتير" value={formatLatinNumber((vatReturn?.invoiceCount ?? 0), 'ar')} icon={ReceiptText} compact />
            <KpiCard label="الفترة" value={vatReturn?.period.from ? 'محددة' : '—'} icon={CalendarRange} sub={vatReturn?.period.from && vatReturn.period.to ? `${vatReturn.period.from} — ${vatReturn.period.to}` : 'لا توجد فترة'} compact />
          </ResponsiveCardGrid>
        )}
      </ReportPanel>
    </ReportColumns>
  );
}
