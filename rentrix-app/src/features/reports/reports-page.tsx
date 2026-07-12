import { useMemo, useState } from 'react';
import { BarChart3, FileSpreadsheet, ReceiptText, SlidersHorizontal, WalletCards } from 'lucide-react';
import { PageLayout } from '@/components/layout/page-layout';
import { PageHeader } from '@/components/layout/page-header';
import { AccessDenied } from '@/components/layout/access-denied';
import { Card, CardContent } from '@/components/ui/card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { SectionTabPanel, SectionTabs } from '@/components/ui/section-tabs';
import { canAccess, financialOperationPermissions } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { useContracts } from '@/features/contracts/useContracts';
import { useOwners } from '@/features/owners/useOwners';
import { getErrorMessage } from '@/features/financials/components/financials-formatters';
import { useReceipts } from '@/features/financials/receipts/useReceipts';
import {
  useAgedReceivablesReport,
  useBalanceSheetReport,
  useCashFlowStatementReport,
  useDailyCollectionReport,
  useExpenseBreakdownReport,
  useFinancialCashflowReport,
  useFinancialPeriodSummaryReport,
  useIncomeStatementReport,
  useOverdueInvoicesReport,
  useOwnerStatementReport,
  useTenantStatementReport,
  useTrialBalanceReport,
  useVatReturnReport,
} from '@/features/financials/reports/useFinancialReports';
import { useCostCenters } from '@/features/settings/useCostCenters';
import { useAllUnits } from '@/features/units/use-units';
import { AccountingReportsSection } from './components/AccountingReportsSection';
import { CollectionsSection } from './components/CollectionsSection';
import { ExpensesSection } from './components/ExpensesSection';
import { FiltersPanel } from './components/FiltersPanel';
import { OccupancySection } from './components/OccupancySection';
import { OverdueSection } from './components/OverdueSection';
import { OverviewSection } from './components/OverviewSection';
import { ReportsHero } from './components/ReportsHero';
import { StatementsSection } from './components/StatementsSection';
import {
  buildExpiringContractsRows,
  buildOccupancyRows,
  buildPaymentsTrendRows,
  buildRentRollRows,
  contractStatusLabels,
  getCurrentMonthFilters,
  getTodayLocalDateString,
  isWithinDateRange,
  latestReceiptLimit,
  usePropertyTitles,
} from './reports-page.helpers';
import { reportSections, type ReportSectionId } from './reports-page.sections';

export { escapeCsvValue } from '@/lib/csvExport';
export { buildReportCsvFilename, getTodayLocalDateString, toDateInputValue } from './reports-page.helpers';

export function ReportsPage() {
  const [filters, setFilters] = useState(() => getCurrentMonthFilters());
  const [activeSection, setActiveSection] = useState<ReportSectionId>('overview');
  const { authorization } = useAuth();
  const financialFilters = useMemo(() => ({ dateFrom: filters.from, dateTo: filters.to, costCenterId: filters.costCenterId || undefined }), [filters.costCenterId, filters.from, filters.to]);
  const arrearsFilters = useMemo(() => ({ asOf: filters.asOf }), [filters.asOf]);

  const financialSummaryQuery = useFinancialPeriodSummaryReport(financialFilters);
  const financialCashflowQuery = useFinancialCashflowReport(financialFilters);
  const cashFlowStatementQuery = useCashFlowStatementReport(financialFilters);
  const vatReturnQuery = useVatReturnReport(financialFilters);
  const dailyCollectionQuery = useDailyCollectionReport(financialFilters);
  const expenseBreakdownQuery = useExpenseBreakdownReport(financialFilters);
  const overdueInvoicesQuery = useOverdueInvoicesReport(arrearsFilters);
  const agedReceivablesQuery = useAgedReceivablesReport(arrearsFilters);
  const contractsQuery = useContracts({ status: 'all', page: 1, pageSize: 1000 });
  const ownersQuery = useOwners();
  const tenantStatementQuery = useTenantStatementReport(filters.contractId || undefined);
  const ownerStatementQuery = useOwnerStatementReport(filters.ownerId || undefined, financialFilters);
  const unitsQuery = useAllUnits();
  const trialBalanceQuery = useTrialBalanceReport(filters.asOf);
  const incomeStatementQuery = useIncomeStatementReport(financialFilters);
  const balanceSheetQuery = useBalanceSheetReport(filters.asOf);
  const receiptsQuery = useReceipts({ limit: latestReceiptLimit });
  const costCentersQuery = useCostCenters();
  const propertyTitlesQuery = usePropertyTitles();
  const propertyTitlesById = useMemo(
    () => new Map((propertyTitlesQuery.data ?? []).map((row) => [row.id, row.title] as const)),
    [propertyTitlesQuery.data],
  );

  const contracts = contractsQuery.data?.rows ?? [];
  const rentRollRows = useMemo(() => buildRentRollRows(contracts, contractStatusLabels), [contracts]);
  const occupancyRows = useMemo(() => buildOccupancyRows(unitsQuery.data ?? [], propertyTitlesById), [unitsQuery.data, propertyTitlesById]);
  const expiringRows = useMemo(() => buildExpiringContractsRows(contracts, new Date()), [contracts]);
  const paymentsTrendRows = useMemo(() => buildPaymentsTrendRows({
    dailyCollections: dailyCollectionQuery.data?.rows,
    overdueInvoices: overdueInvoicesQuery.data?.rows,
  }), [dailyCollectionQuery.data?.rows, overdueInvoicesQuery.data?.rows]);
  const receiptRows = useMemo(() => (receiptsQuery.data ?? [])
    .filter((receipt) => isWithinDateRange(receipt.payment_date, filters))
    .map((receipt) => ({
      id: receipt.id,
      receipt_number: receipt.receipt_number,
      payment_date: receipt.payment_date,
      amount: receipt.amount,
      tenant_name: receipt.tenant_name,
    })), [filters, receiptsQuery.data]);

  void paymentsTrendRows;

  const firstError = financialSummaryQuery.error
    ?? financialCashflowQuery.error
    ?? cashFlowStatementQuery.error
    ?? vatReturnQuery.error
    ?? dailyCollectionQuery.error
    ?? expenseBreakdownQuery.error
    ?? overdueInvoicesQuery.error
    ?? agedReceivablesQuery.error
    ?? trialBalanceQuery.error
    ?? incomeStatementQuery.error
    ?? balanceSheetQuery.error
    ?? contractsQuery.error
    ?? ownersQuery.error
    ?? unitsQuery.error
    ?? receiptsQuery.error;

  const today = getTodayLocalDateString();
  const canExportReports = canAccess(authorization, financialOperationPermissions.exportReports);
  const canViewReports = canAccess(authorization, financialOperationPermissions.exportReports);

  if (!canViewReports) {
    return <AccessDenied message="عرض التقارير المالية متاح فقط للمدير أو المسؤول." />;
  }

  return (
    <PageLayout dir="rtl" size="wide" className="space-y-6">
      <PageHeader
        title="مركز التقارير والكشوف"
        description="Workspace واحد للتقارير المالية، التحصيلات، المتأخرات، الإشغال، والكشوف مع نفس مصادر البيانات الحالية."
      />

      <ReportsHero summary={financialSummaryQuery.data} today={today} isLoading={financialSummaryQuery.isLoading} />

      <ResponsiveCardGrid desktopColumns={3}>
        <ReportWorkspaceCue icon={<WalletCards className="size-5" aria-hidden="true" />} title="نطاق موحّد" description="الفترة ومركز التكلفة يطبقان على التقارير المالية دون تغيير طريقة الحساب." />
        <ReportWorkspaceCue icon={<ReceiptText className="size-5" aria-hidden="true" />} title="تحصيلات ومتأخرات" description="التحصيلات من مصدر payments الحالي والمتأخرات من تقارير الذمم الحالية." />
        <ReportWorkspaceCue icon={<FileSpreadsheet className="size-5" aria-hidden="true" />} title="تصدير وقراءة فقط" description="أزرار CSV/PDF/Print تبقى داخل كل قسم ولا تنشئ أي بيانات جديدة." />
      </ResponsiveCardGrid>

      <Card className="overflow-hidden border-primary/10">
        <div className="flex items-center gap-3 border-b border-border/60 bg-muted/25 px-4 py-4 sm:px-6">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <SlidersHorizontal className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-black sm:text-base">فلترة نطاق التقرير</h2>
            <p className="mt-1 text-xs font-bold leading-5 text-muted-foreground">حدد الفترة أو المالك أو العقد ثم راجع النتائج في القسم المطلوب.</p>
          </div>
        </div>
        <CardContent className="p-3 sm:p-5">
          <FiltersPanel
            filters={filters}
            costCenterRows={costCentersQuery.data ?? []}
            ownerRows={ownersQuery.data ?? []}
            contractRows={contracts}
            onChange={setFilters}
            onResetCurrentMonth={() => setFilters(getCurrentMonthFilters())}
          />
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border/60 bg-muted/20 px-4 py-4 sm:px-6">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <BarChart3 className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-black sm:text-base">مركز التقارير</h2>
            <p className="mt-1 text-xs font-bold leading-5 text-muted-foreground">تنقل بين الملخص والتحصيل والمتأخرات والمحاسبة والقوائم بدون ازدحام الصفحة.</p>
          </div>
        </div>
        <div className="no-scrollbar sticky top-0 z-20 overflow-x-auto border-b border-border/60 bg-background/95 px-3 py-3 backdrop-blur sm:px-5">
          <div className="min-w-max">
            <SectionTabs items={reportSections} activeId={activeSection} onChange={setActiveSection} ariaLabel="أقسام التقارير" />
          </div>
        </div>

        <CardContent className="space-y-5 p-3 sm:p-6">
          {firstError ? (
            <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm font-bold leading-6 text-destructive">
              {getErrorMessage(firstError, 'تعذر تحميل بعض التقارير. يمكنك تحديث الصفحة أو إعادة المحاولة بأمان دون تعديل أي بيانات.')}
            </div>
          ) : null}

          <SectionTabPanel id="overview" activeId={activeSection}>
            <OverviewSection summary={financialSummaryQuery.data} cashflowRows={financialCashflowQuery.data?.rows ?? []} canExportReports={canExportReports} isLoading={financialSummaryQuery.isLoading || financialCashflowQuery.isLoading} />
          </SectionTabPanel>
          <SectionTabPanel id="collections" activeId={activeSection}>
            <CollectionsSection rows={dailyCollectionQuery.data?.rows ?? []} receiptRows={receiptRows} rentRollRows={rentRollRows} canExportReports={canExportReports} isLoading={dailyCollectionQuery.isLoading || receiptsQuery.isLoading || contractsQuery.isLoading} />
          </SectionTabPanel>
          <SectionTabPanel id="overdue" activeId={activeSection}>
            <OverdueSection rows={overdueInvoicesQuery.data?.rows ?? []} agedReport={agedReceivablesQuery.data} canExportReports={canExportReports} isLoading={overdueInvoicesQuery.isLoading || agedReceivablesQuery.isLoading} />
          </SectionTabPanel>
          <SectionTabPanel id="expenses" activeId={activeSection}>
            <ExpensesSection report={expenseBreakdownQuery.data} canExportReports={canExportReports} isLoading={expenseBreakdownQuery.isLoading} />
          </SectionTabPanel>
          <SectionTabPanel id="occupancy" activeId={activeSection}>
            <OccupancySection occupancyRows={occupancyRows} expiringRows={expiringRows} isLoading={unitsQuery.isLoading || contractsQuery.isLoading} />
          </SectionTabPanel>
          <SectionTabPanel id="accounting" activeId={activeSection}>
            <AccountingReportsSection
              asOf={filters.asOf}
              from={filters.from}
              to={filters.to}
              trialBalance={trialBalanceQuery.data}
              incomeStatement={incomeStatementQuery.data}
              balanceSheet={balanceSheetQuery.data}
              isTrialBalanceLoading={trialBalanceQuery.isLoading}
              isIncomeStatementLoading={incomeStatementQuery.isLoading}
              isBalanceSheetLoading={balanceSheetQuery.isLoading}
              trialBalanceError={trialBalanceQuery.error}
              incomeStatementError={incomeStatementQuery.error}
              balanceSheetError={balanceSheetQuery.error}
              isLoading={financialSummaryQuery.isLoading || expenseBreakdownQuery.isLoading}
            />
          </SectionTabPanel>
          <SectionTabPanel id="statements" activeId={activeSection}>
            <StatementsSection agedReport={agedReceivablesQuery.data} receiptRows={receiptRows} financialSummary={financialSummaryQuery.data} expenseBreakdown={expenseBreakdownQuery.data} dailyRows={dailyCollectionQuery.data?.rows ?? []} cashFlowStatement={cashFlowStatementQuery.data} vatReturn={vatReturnQuery.data} tenantStatement={tenantStatementQuery.data} ownerStatement={ownerStatementQuery.data} selectedContractId={filters.contractId} selectedOwnerId={filters.ownerId} tenantStatementError={tenantStatementQuery.error} ownerStatementError={ownerStatementQuery.error} isTenantStatementLoading={tenantStatementQuery.isLoading} isOwnerStatementLoading={ownerStatementQuery.isLoading} isLoading={agedReceivablesQuery.isLoading || receiptsQuery.isLoading || financialSummaryQuery.isLoading || expenseBreakdownQuery.isLoading || dailyCollectionQuery.isLoading || cashFlowStatementQuery.isLoading || vatReturnQuery.isLoading} />
          </SectionTabPanel>
        </CardContent>
      </Card>
    </PageLayout>
  );
}

function ReportWorkspaceCue({ icon, title, description }: Readonly<{ icon: React.ReactNode; title: string; description: string }>) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">{icon}</span>
        <div className="min-w-0">
          <p className="font-black">{title}</p>
          <p className="mt-1 text-xs font-bold leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
