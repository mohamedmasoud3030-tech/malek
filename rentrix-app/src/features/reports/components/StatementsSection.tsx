import type { OwnerStatementReport, TenantStatementReport } from '@/features/financials/reports/financialReportsService';
import {
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
import { OfficeSummaryPanel, RegulatorySummaryPanels } from './statements/statement-summary-panels';

export function StatementsSection({
  financialSummary,
  vatReturn,
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
  financialSummary: NonNullable<ReturnType<typeof useFinancialPeriodSummaryReport>['data']> | undefined;
  vatReturn: NonNullable<ReturnType<typeof useVatReturnReport>['data']> | undefined;
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
  const showTenant = focus === 'all' || focus === 'tenant';
  const showOwner = focus === 'all' || focus === 'owner';
  const showFinancial = focus === 'all' || focus === 'financial';
  const showPartyDocumentControls = focus === 'all';
  const glCashFlowQuery = useAuthoritativeGlCashFlow(filters?.from, filters?.to, showFinancial);

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
      {showPartyDocumentControls && !isDocumentSettingsReady && (showTenant || showOwner) ? <DocumentReadinessNotice /> : null}
      {(showTenant || showOwner) ? (
        <ReportColumns>
          {showTenant ? (
            <TenantStatementPanel
              selectedContractId={selectedContractId}
              statement={tenantStatement}
              error={tenantStatementError}
              isLoading={isTenantStatementLoading}
              outputActions={showPartyDocumentControls ? {
                onPrint: handlePrintTenantStatement,
                onDownloadPdf: handleDownloadTenantStatement,
                onDownloadExcel: handleDownloadTenantExcel,
                disabled: !isDocumentSettingsReady,
              } : undefined}
            />
          ) : null}
          {showOwner ? (
            <OwnerStatementPanel
              selectedOwnerId={selectedOwnerId}
              statement={ownerStatement}
              error={ownerStatementError}
              isLoading={isOwnerStatementLoading}
              period={{ from: filters?.from, to: filters?.to, propertyId: filters?.propertyId }}
              outputActions={showPartyDocumentControls ? {
                onPrint: handlePrintProfessionalOwnerReport,
                onDownloadPdf: handleDownloadProfessionalOwnerReport,
                onDownloadExcel: handleDownloadOwnerExcel,
                disabled: !isDocumentSettingsReady,
              } : undefined}
            />
          ) : null}
        </ReportColumns>
      ) : null}

      {showFinancial ? (
        <>
          <OfficeSummaryPanel
            invoiced={financialSummary?.invoiced ?? 0}
            collections={financialSummary?.paid ?? 0}
            expenses={financialSummary?.expenses ?? 0}
            outstanding={financialSummary?.outstanding ?? 0}
            invoicesCount={financialSummary?.invoicesCount ?? 0}
            paymentsCount={financialSummary?.paymentsCount ?? 0}
            expensesCount={financialSummary?.expensesCount ?? 0}
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
