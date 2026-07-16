import type { DailyCollectionReportRow, OwnerStatementReport, TenantStatementReport } from '@/features/financials/reports/financialReportsService';
import {
  useAgedReceivablesReport,
  useCashFlowStatementReport,
  useExpenseBreakdownReport,
  useFinancialPeriodSummaryReport,
  useVatReturnReport,
} from '@/features/financials/reports/useFinancialReports';
import { DocumentTemplates, type DocumentSettings } from '@/services/documents/DocumentTemplates';
import { ReportColumns } from './report-section-primitives';
import { OwnerStatementPanel, TenantStatementPanel } from './statements/statement-account-panels';
import { OfficeSummaryPanel, RegulatorySummaryPanels, StatementSelectionStrip } from './statements/statement-summary-panels';

const defaultDocumentSettings: DocumentSettings = {
  company: {
    name: 'رينتريكس لإدارة العقارات',
    address: 'سلطنة عمان - مسقط',
    phone: '+968 24000000',
  },
  currency: 'OMR',
  currencySymbol: 'ر.ع',
};

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
  cashFlowStatement,
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
}: Readonly<{
  agedReport: NonNullable<ReturnType<typeof useAgedReceivablesReport>['data']> | undefined;
  receiptRows: ReceiptRow[];
  financialSummary: NonNullable<ReturnType<typeof useFinancialPeriodSummaryReport>['data']> | undefined;
  expenseBreakdown: NonNullable<ReturnType<typeof useExpenseBreakdownReport>['data']> | undefined;
  cashFlowStatement: NonNullable<ReturnType<typeof useCashFlowStatementReport>['data']> | undefined;
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
  filters?: { from: string; to: string };
}>) {
  const tenantRows = (agedReport?.rows ?? []).slice(0, 6);
  const ownerMovementRows = (expenseBreakdown?.byProperty ?? []).slice(0, 6);
  const totalCollections = dailyRows.reduce((total, row) => total + row.totalPaid, 0);

  const handlePrintTenantStatement = () => {
    if (!tenantStatement) return;
    DocumentTemplates.renderTenantStatementPdf(
      {
        tenantName: tenantStatement.tenantName || 'مستأجر غير محدد',
        periodFrom: filters?.from || '—',
        periodTo: filters?.to || '—',
        propertyTitle: tenantStatement.propertyName || 'عقار غير محدد',
        unitNumber: tenantStatement.unitName || '—',
        openingBalance: 0,
        totalInvoiced: tenantStatement.lines.reduce((total, line) => total + (line.debit || 0), 0),
        totalPaid: tenantStatement.lines.reduce((total, line) => total + (line.credit || 0), 0),
        closingBalance: tenantStatement.finalBalance || 0,
        lines: tenantStatement.lines.map((line) => ({
          date: line.date || '—',
          type: line.type || 'حركة',
          description: line.description || 'حركة حساب',
          debit: line.debit || 0,
          credit: line.credit || 0,
          balance: line.debit - line.credit,
        })),
      },
      defaultDocumentSettings,
    );
  };

  const handlePrintOwnerStatement = () => {
    if (!ownerStatement) return;
    DocumentTemplates.renderOwnerStatementPdf(
      {
        ownerName: ownerStatement.ownerName || 'مالك غير محدد',
        periodFrom: filters?.from || '—',
        periodTo: filters?.to || '—',
        propertyTitle: 'كافة العقارات المدارة',
        totalRent: ownerStatement.totalGross || 0,
        totalExpenses: ownerStatement.totalDeductions || 0,
        totalCommission: 0,
        netAmount: ownerStatement.totalNet || 0,
        transactions: ownerStatement.transactions.map((transaction) => ({
          date: transaction.date || '—',
          type: transaction.type || 'حركة',
          description: transaction.details || 'حركة مالية',
          amount: transaction.net || 0,
        })),
      },
      defaultDocumentSettings,
    );
  };

  return (
    <div className="space-y-4">
      <StatementSelectionStrip
        selectedContractId={selectedContractId}
        selectedOwnerId={selectedOwnerId}
        from={filters?.from}
        to={filters?.to}
      />

      <ReportColumns>
        <TenantStatementPanel
          selectedContractId={selectedContractId}
          statement={tenantStatement}
          error={tenantStatementError}
          isLoading={isTenantStatementLoading}
          fallbackRows={tenantRows}
          receipts={receiptRows}
          onPrint={handlePrintTenantStatement}
        />
        <OwnerStatementPanel
          selectedOwnerId={selectedOwnerId}
          statement={ownerStatement}
          error={ownerStatementError}
          isLoading={isOwnerStatementLoading}
          fallbackRows={ownerMovementRows}
          onPrint={handlePrintOwnerStatement}
        />
      </ReportColumns>

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

      <RegulatorySummaryPanels cashFlow={cashFlowStatement} vatReturn={vatReturn} isLoading={isLoading} />
    </div>
  );
}
