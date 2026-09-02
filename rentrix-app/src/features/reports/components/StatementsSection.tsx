import type { DailyCollectionReportRow, OwnerStatementReport, TenantStatementReport } from '@/features/financials/reports/financialReportsService';
import {
  useAgedReceivablesReport,
  useExpenseBreakdownReport,
  useFinancialPeriodSummaryReport,
  useVatReturnReport,
} from '@/features/financials/reports/useFinancialReports';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { DocumentReadinessNotice } from '@/features/settings/components/document-readiness-notice';
import { useAuthoritativeGlCashFlow } from '../accounting-report-authority';
import {
  downloadOwnerStatementExcel,
  downloadTenantStatementExcel,
  runOwnerReportDocumentAction,
  runTenantStatementDocumentAction,
} from '../premium/statement-report-actions';
import type { StatementProductFocus } from '../report-products';
import { ReportColumns } from '@/components/ui/report-section-primitives';
import { OwnerStatementPanel, TenantStatementPanel } from './statements/statement-account-panels';
import { OfficeSummaryPanel, RegulatorySummaryPanels, StatementSelectionStrip } from './statements/statement-summary-panels';

type ReceiptRow = Readonly<{
  id: string;
  receipt_number: string;
  payment_date: string;
  amount: number;
  tenant_name: string | null;
}>;

export function StatementsSection({
  agedReport,
  receiptRows,
  financialSummary,
  expenseBreakdown,
  vatReturn,
  dailyRows,
  tenantStatement,
  ownerStatement,
  selectedContractId,
  selectedOwnerId,
  tenantStatementError,
  ownerStatementError,
  isTenantStatementLoading,
  isOwnerStatementLoading,
  isLoading,
  filters,
  focus = 'all',
}: Readonly<{
  agedReport: NonNullable<ReturnType<typeof useAgedReceivablesReport>['data']> | undefined;
  receiptRows: ReceiptRow[];
  financialSummary: NonNullable<ReturnType<typeof useFinancialPeriodSummaryReport>['data']> | undefined;
  expenseBreakdown: NonNullable<ReturnType<typeof useExpenseBreakdownReport>['data']> | undefined;
  vatReturn: NonNullable<ReturnType<typeof useVatReturnReport>['data']> | undefined;
  dailyRows: DailyCollectionReportRow[];
  tenantStatement: TenantStatementReport | undefined;
  ownerStatement: OwnerStatementReport | undefined;
  selectedContractId: string;
  selectedOwnerId: string;
  tenantStatementError: unknown;
  ownerStatementError: unknown;
  isTenantStatementLoading: boolean;
  isOwnerStatementLoading: boolean;
  isLoading: boolean;
  filters?: { from: string; to: string; propertyId?: string; ownerId?: string };
  focus?: StatementProductFocus;
}>) {
  const tenantRows = (agedReport?.rows ?? []).slice(0, 6);
  const ownerMovementRows = (expenseBreakdown?.byProperty ?? []).slice(0, 6);
  const totalCollections = dailyRows.reduce((total, row) => total + row.totalPaid, 0);
  const glCashFlowQuery = useAuthoritativeGlCashFlow(filters?.from, filters?.to);
  const showTenant = focus === 'all' || focus === 'tenant';
  const showOwner = focus === 'all' || focus === 'owner';
  const showFinancial = focus === 'all' || focus === 'financial';

  const { companySettings: documentSettings, isReady: isDocumentSettingsReady } = useDocumentSettings();

  // The premium catalog and this consolidated surface share ONE document
  // action implementation (features/reports/premium/statement-report-actions)
  // so printed output can never drift between entry points.
  const handlePrintTenantStatement = () => runTenantStatementDocumentAction({
    isReady: isDocumentSettingsReady,
    settings: documentSettings,
    statement: tenantStatement,
    period: { from: filters?.from, to: filters?.to },
  }, 'print');

  const handleDownloadTenantStatement = () => runTenantStatementDocumentAction({
    isReady: isDocumentSettingsReady,
    settings: documentSettings,
    statement: tenantStatement,
    period: { from: filters?.from, to: filters?.to },
  }, 'pdf');

  const handleDownloadTenantExcel = () => downloadTenantStatementExcel(tenantStatement, selectedContractId);

  const handlePrintProfessionalOwnerReport = () => runOwnerReportDocumentAction({
    isReady: isDocumentSettingsReady,
    settings: documentSettings,
    ownerId: selectedOwnerId,
    statement: ownerStatement,
    period: { from: filters?.from, to: filters?.to, propertyId: filters?.propertyId },
  }, 'print');

  const handleDownloadProfessionalOwnerReport = () => runOwnerReportDocumentAction({
    isReady: isDocumentSettingsReady,
    settings: documentSettings,
    ownerId: selectedOwnerId,
    statement: ownerStatement,
    period: { from: filters?.from, to: filters?.to, propertyId: filters?.propertyId },
  }, 'pdf');

  const handleDownloadOwnerExcel = () => downloadOwnerStatementExcel(ownerStatement, selectedOwnerId);

  return (
    <div className="space-y-4">
      {!isDocumentSettingsReady && (showTenant || showOwner) ? <DocumentReadinessNotice /> : null}
      {(showTenant || showOwner) ? (
        <StatementSelectionStrip
          selectedContractId={selectedContractId}
          selectedOwnerId={selectedOwnerId}
          from={filters?.from}
          to={filters?.to}
          isDocumentReady={isDocumentSettingsReady}
        />
      ) : null}

      {(showTenant || showOwner) ? (
        <ReportColumns>
          {showTenant ? (
            <TenantStatementPanel
              selectedContractId={selectedContractId}
              statement={tenantStatement}
              error={tenantStatementError}
              isLoading={isTenantStatementLoading}
              fallbackRows={tenantRows}
              receipts={receiptRows}
              onPrint={handlePrintTenantStatement}
              onDownloadPdf={handleDownloadTenantStatement}
              onDownloadExcel={handleDownloadTenantExcel}
              actionsDisabled={!isDocumentSettingsReady}
            />
          ) : null}
          {showOwner ? (
            <OwnerStatementPanel
              selectedOwnerId={selectedOwnerId}
              statement={ownerStatement}
              error={ownerStatementError}
              isLoading={isOwnerStatementLoading}
              fallbackRows={ownerMovementRows}
              onPrint={handlePrintProfessionalOwnerReport}
              onDownloadPdf={handleDownloadProfessionalOwnerReport}
              onDownloadExcel={handleDownloadOwnerExcel}
              actionsDisabled={!isDocumentSettingsReady}
            />
          ) : null}
        </ReportColumns>
      ) : null}

      {showFinancial ? (
        <>
          <OfficeSummaryPanel
            invoiced={financialSummary?.invoiced ?? 0}
            collections={totalCollections}
            expenses={financialSummary?.expenses ?? 0}
            outstanding={financialSummary?.outstanding ?? 0}
            invoicesCount={financialSummary?.invoicesCount ?? 0}
            paymentsCount={financialSummary?.paymentsCount ?? 0}
            expensesCount={financialSummary?.expensesCount ?? 0}
            receiptsCount={receiptRows.length}
          />

          <RegulatorySummaryPanels
            cashFlow={glCashFlowQuery.data}
            cashFlowError={glCashFlowQuery.error}
            isCashFlowLoading={glCashFlowQuery.isLoading}
            vatReturn={vatReturn}
            isLoading={isLoading}
          />
        </>
      ) : null}
    </div>
  );
}
