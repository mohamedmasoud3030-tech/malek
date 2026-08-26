import { getCurrencyWordConfig, numberToArabicWords } from '@/lib/numberToArabicWords';
import { formatMoney as formatCurrencyMoney, normalizeCurrency } from '@/lib/formatters';
import { documentService } from '@/services/documents/DocumentService';
import { toReportDocumentPayload, type ReportDocumentData } from '@/services/documents/documentPayloadAdapters';
import { runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import { getTodayLocalDateString } from '@/features/financials/financials-date-utils';
import { formatDepositContractReference } from './deposit-contract-options';
import type { DepositRecord } from './deposit-service';

export function buildDepositClearanceDocument(
  deposit: DepositRecord,
  currencyCode: string,
  currencyLabel: string,
) {
  const printableAmount = deposit.remaining_amount > 0 ? deposit.remaining_amount : deposit.deposit_amount;
  const tafqeet = numberToArabicWords(printableAmount, getCurrencyWordConfig(currencyCode));
  const contractReference = formatDepositContractReference(deposit);
  return {
    reportTitle: 'سند تسوية ومخالصة مبلغ التأمين',
    reportType: 'Tenant_Security_Deposit_Clearance',
    periodFrom: deposit.received_date,
    periodTo: getTodayLocalDateString(),
    sections: [
      {
        title: 'بيانات الوديعة',
        rows: [
          { label: 'العقد', value: contractReference },
          { label: 'مبلغ التأمين الأصلي', value: `${deposit.deposit_amount} ${currencyLabel}` },
          { label: 'الخصومات', value: `${deposit.deducted_amount} ${currencyLabel}` },
          { label: 'المسترد', value: `${deposit.refunded_amount} ${currencyLabel}` },
          { label: 'المتبقي', value: `${deposit.remaining_amount} ${currencyLabel}` },
          { label: 'تفقيط المتبقي', value: tafqeet },
        ],
        totals: ['الصافي', `${deposit.remaining_amount} ${currencyLabel}`],
      },
    ],
    totalSummary: `تاريخ المخالصة: ${getTodayLocalDateString()}`,
  };
}

export function createDepositDocumentActions(params: {
  isReady: boolean;
  companySettings: { currency: string; currencySymbol?: string } & Record<string, unknown>;
  currencyCode: string;
  currencyLabel: string;
}) {
  const { isReady, companySettings, currencyCode, currencyLabel } = params;

  const handlePrint = (deposit: DepositRecord) => {
    void runGuardedDocumentAction({
      isReady,
      operation: () => {
        const report = buildDepositClearanceDocument(deposit, currencyCode, currencyLabel) satisfies ReportDocumentData;
        return documentService.printDocument('generic_report', {
          settings: companySettings as never,
          payload: toReportDocumentPayload(report),
        });
      },
      fallbackMessage: 'تعذرت طباعة سند تسوية الوديعة.',
    });
  };

  const handleDownloadPdf = (deposit: DepositRecord) => {
    void runGuardedDocumentAction({
      isReady,
      operation: () => {
        const report = buildDepositClearanceDocument(deposit, currencyCode, currencyLabel) satisfies ReportDocumentData;
        return documentService.downloadDocumentPdf('generic_report', {
          settings: companySettings as never,
          payload: toReportDocumentPayload(report),
        });
      },
      fallbackMessage: 'تعذر تنزيل سند تسوية الوديعة كملف PDF.',
    });
  };

  return { handlePrint, handleDownloadPdf, buildDepositClearanceDocument };
}
