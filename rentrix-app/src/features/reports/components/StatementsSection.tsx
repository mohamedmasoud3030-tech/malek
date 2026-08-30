import type { DailyCollectionReportRow, OwnerStatementReport, TenantStatementReport } from '@/features/financials/reports/financialReportsService';
import {
  useAgedReceivablesReport,
  useExpenseBreakdownReport,
  useFinancialPeriodSummaryReport,
  useVatReturnReport,
} from '@/features/financials/reports/useFinancialReports';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { DocumentReadinessNotice } from '@/features/settings/components/document-readiness-notice';
import { downloadBlob } from '@/lib/tabular-export';
import { buildXlsxBlob } from '@/lib/xlsx-export';
import { documentService } from '@/services/documents/DocumentService';
import { DocumentReadinessError, runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import {
  toOwnerStatementDocumentPayload,
  toTenantStatementDocumentPayload,
  type OwnerStatementData,
  type TenantStatementData,
} from '@/services/documents/documentPayloadAdapters';
import { useAuthoritativeGlCashFlow } from '../accounting-report-authority';
import { loadOwnerReportContext, printOwnerReport, downloadOwnerReportPdf } from '../documents/professional-owner-report';
import { ReportColumns } from './report-section-primitives';
import { OwnerStatementPanel, TenantStatementPanel } from './statements/statement-account-panels';
import { OfficeSummaryPanel, RegulatorySummaryPanels, StatementSelectionStrip } from './statements/statement-summary-panels';

/**
 * A statement is a legal/financial document: without its authoritative
 * snapshot there is nothing truthful to render, so output is refused rather
 * than emitting an empty or partially-populated statement.
 */
const MISSING_STATEMENT_DATA_MESSAGE =
  'تعذر إصدار الكشف: لا توجد بيانات كشف حساب مُحمَّلة للفترة أو الطرف المحدد. يرجى تحديد النطاق وعرض النتائج أولاً.';

function deriveTenantOpeningBalance(statement: TenantStatementReport): number {
  const firstLine = statement.lines[0];
  if (!firstLine) return statement.finalBalance || 0;
  // Each authoritative line exposes its post-movement running balance.
  // Reverse the first movement to recover the opening balance; never hardcode 0.
  return (firstLine.balance || 0) - (firstLine.debit || 0) + (firstLine.credit || 0);
}

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
}>) {
  const tenantRows = (agedReport?.rows ?? []).slice(0, 6);
  const ownerMovementRows = (expenseBreakdown?.byProperty ?? []).slice(0, 6);
  const totalCollections = dailyRows.reduce((total, row) => total + row.totalPaid, 0);
  const glCashFlowQuery = useAuthoritativeGlCashFlow(filters?.from, filters?.to);

  const { companySettings: documentSettings, isReady: isDocumentSettingsReady } = useDocumentSettings();

  const buildTenantStatementData = (): TenantStatementData | null => {
    if (!tenantStatement) return null;
    return {
      tenantName: tenantStatement.tenantName || 'مستأجر غير محدد',
      periodFrom: filters?.from || tenantStatement.startDate || '—',
      periodTo: filters?.to || tenantStatement.endDate || '—',
      propertyTitle: tenantStatement.propertyName || 'عقار غير محدد',
      unitNumber: tenantStatement.unitName || '—',
      openingBalance: deriveTenantOpeningBalance(tenantStatement),
      totalInvoiced: tenantStatement.lines.reduce((total, line) => total + (line.debit || 0), 0),
      totalPaid: tenantStatement.lines.reduce((total, line) => total + (line.credit || 0), 0),
      closingBalance: tenantStatement.finalBalance || 0,
      lines: tenantStatement.lines.map((line) => ({
        date: line.date || '—',
        type: line.type === 'invoice' ? 'مطالبة' : line.type === 'receipt' ? 'تحصيل' : 'حركة',
        description: line.description || 'حركة حساب',
        debit: line.debit || 0,
        credit: line.credit || 0,
        balance: line.balance || 0,
      })),
    };
  };

  const handlePrintTenantStatement = async () => {
    await runGuardedDocumentAction({
      isReady: isDocumentSettingsReady,
      operation: async () => {
        const data = buildTenantStatementData();
        if (!data) throw new DocumentReadinessError(MISSING_STATEMENT_DATA_MESSAGE);
        await documentService.printDocument('tenant_statement', { settings: documentSettings, payload: toTenantStatementDocumentPayload(data) });
      },
      fallbackMessage: 'تعذرت طباعة الكشف.',
    });
  };

  const handleDownloadTenantStatement = async () => {
    await runGuardedDocumentAction({
      isReady: isDocumentSettingsReady,
      operation: async () => {
        const data = buildTenantStatementData();
        if (!data) throw new DocumentReadinessError(MISSING_STATEMENT_DATA_MESSAGE);
        await documentService.downloadDocumentPdf('tenant_statement', { settings: documentSettings, payload: toTenantStatementDocumentPayload(data) });
      },
      fallbackMessage: 'تعذر تنزيل ملف PDF.',
    });
  };

  const handleDownloadTenantExcel = () => {
    if (!tenantStatement) return;
    const rows = tenantStatement.lines.map((line) => [
      line.date || '—',
      line.type === 'invoice' ? 'فاتورة / استحقاق' : line.type === 'receipt' ? 'دفعة / إيصال' : line.type === 'credit' ? 'دائن / عكس' : 'حركة حساب',
      line.description || 'حركة حساب',
      line.debit || 0,
      line.credit || 0,
      line.balance || 0,
    ] as const);
    downloadBlob(
      buildXlsxBlob({
        name: 'كشف المستأجر',
        headers: ['التاريخ', 'نوع الحركة', 'البيان / المرجع', 'مدين', 'دائن', 'الرصيد الجاري'],
        rows,
      }),
      `tenant-statement-${selectedContractId || 'statement'}.xlsx`,
    );
  };

  const buildOwnerStatementData = (): OwnerStatementData | null => {
    if (!ownerStatement) return null;
    const totalRent = ownerStatement.transactions.filter((t) => t.type === 'receipt').reduce((sum, t) => sum + (t.gross || 0), 0);
    const totalExpenses = ownerStatement.transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + Math.abs(t.gross || 0), 0);
    const totalCommission = ownerStatement.totalDeductions || 0;

    return {
      ownerName: ownerStatement.ownerName || 'مالك غير محدد',
      periodFrom: filters?.from || ownerStatement.periodFrom || '—',
      periodTo: filters?.to || ownerStatement.periodTo || '—',
      propertyTitle: 'كافة العقارات المدارة',
      totalRent,
      totalExpenses,
      totalCommission,
      netAmount: ownerStatement.totalNet || 0,
      transactions: ownerStatement.transactions.map((transaction) => ({
        date: transaction.date || '—',
        type: transaction.type === 'receipt' ? 'تحصيل' : transaction.type === 'expense' ? 'مصروف' : transaction.type === 'settlement' ? 'تسوية' : 'حركة',
        description: transaction.details || 'حركة مالية',
        amount: transaction.net || 0,
      })),
    };
  };

  const handlePrintOwnerStatement = async () => {
    await runGuardedDocumentAction({
      isReady: isDocumentSettingsReady,
      operation: async () => {
        const data = buildOwnerStatementData();
        if (!data) throw new DocumentReadinessError(MISSING_STATEMENT_DATA_MESSAGE);
        await documentService.printDocument('owner_statement', { settings: documentSettings, payload: toOwnerStatementDocumentPayload(data) });
      },
      fallbackMessage: 'تعذرت طباعة الكشف.',
    });
  };

  const handleDownloadOwnerStatement = async () => {
    await runGuardedDocumentAction({
      isReady: isDocumentSettingsReady,
      operation: async () => {
        const data = buildOwnerStatementData();
        if (!data) throw new DocumentReadinessError(MISSING_STATEMENT_DATA_MESSAGE);
        await documentService.downloadDocumentPdf('owner_statement', { settings: documentSettings, payload: toOwnerStatementDocumentPayload(data) });
      },
      fallbackMessage: 'تعذر تنزيل ملف PDF.',
    });
  };

  const runProfessionalOwnerReport = async (mode: 'print' | 'pdf') => {
    await runGuardedDocumentAction({
      isReady: isDocumentSettingsReady,
      operation: async () => {
        if (!selectedOwnerId) {
          throw new DocumentReadinessError('تعذر إصدار كشف المالك التفصيلي: لم يتم تحديد المالك. اختر مالكًا من فلاتر التقرير أولاً.');
        }
        if (!ownerStatement) {
          throw new DocumentReadinessError('تعذر إصدار كشف المالك التفصيلي: لا توجد بيانات كشف مالك معتمدة للفترة أو النطاق المحدد.');
        }
        if (ownerStatement.error) {
          throw new DocumentReadinessError('تعذر إصدار كشف المالك التفصيلي: كشف المالك المحمّل يحتوي على خطأ في المصدر المعتمد.');
        }
        const context = await loadOwnerReportContext({
          ownerId: selectedOwnerId,
          from: filters?.from || ownerStatement.periodFrom || '—',
          to: filters?.to || ownerStatement.periodTo || '—',
          propertyId: filters?.propertyId || null,
          statement: ownerStatement,
        });
        if (mode === 'print') {
          await printOwnerReport({ settings: documentSettings, context });
        } else {
          await downloadOwnerReportPdf({ settings: documentSettings, context });
        }
      },
      fallbackMessage: mode === 'print'
        ? 'تعذرت طباعة كشف المالك التفصيلي.'
        : 'تعذر تنزيل كشف المالك التفصيلي كملف PDF.',
    });
  };

  const handlePrintProfessionalOwnerReport = () => runProfessionalOwnerReport('print');
  const handleDownloadProfessionalOwnerReport = () => runProfessionalOwnerReport('pdf');

  const handleDownloadOwnerExcel = () => {
    if (!ownerStatement) return;
    let runningBalance = 0;
    const rows = ownerStatement.transactions.map((transaction) => {
      runningBalance += transaction.net || 0;
      return [
        transaction.date || '—',
        transaction.type === 'receipt' ? 'تحصيل' : transaction.type === 'expense' ? 'مصروف' : transaction.type === 'settlement' ? 'تسوية / صرف' : 'حركة مالية',
        transaction.propertyName || 'غير محدد',
        transaction.details || 'حركة مالية',
        transaction.gross || 0,
        transaction.deduction || 0,
        transaction.net || 0,
        runningBalance,
      ] as const;
    });
    downloadBlob(
      buildXlsxBlob({
        name: 'كشف المالك',
        headers: ['التاريخ', 'نوع الحركة', 'العقار', 'البيان', 'الإجمالي', 'الاستقطاع', 'صافي الحركة', 'الرصيد الجاري'],
        rows,
      }),
      `owner-statement-${selectedOwnerId || 'statement'}.xlsx`,
    );
  };

  return (
    <div className="space-y-4">
      {!isDocumentSettingsReady && <DocumentReadinessNotice />}
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
          onDownloadPdf={handleDownloadTenantStatement}
          onDownloadExcel={handleDownloadTenantExcel}
          actionsDisabled={!isDocumentSettingsReady}
        />
        <OwnerStatementPanel
          selectedOwnerId={selectedOwnerId}
          statement={ownerStatement}
          error={ownerStatementError}
          isLoading={isOwnerStatementLoading}
          fallbackRows={ownerMovementRows}
          onPrint={handlePrintOwnerStatement}
          onDownloadPdf={handleDownloadOwnerStatement}
          onDownloadExcel={handleDownloadOwnerExcel}
          onPrintProfessionalReport={handlePrintProfessionalOwnerReport}
          onDownloadProfessionalReportPdf={handleDownloadProfessionalOwnerReport}
          actionsDisabled={!isDocumentSettingsReady}
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

      <RegulatorySummaryPanels
        cashFlow={glCashFlowQuery.data}
        cashFlowError={glCashFlowQuery.error}
        isCashFlowLoading={glCashFlowQuery.isLoading}
        vatReturn={vatReturn}
        isLoading={isLoading}
      />
    </div>
  );
}
