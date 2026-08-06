/**
 * DocumentTemplates — compatibility adapters (thin by design).
 *
 * Historically this module contained a second, full set of document
 * builders that duplicated `DocumentEngine`. That duplication is gone:
 * these functions now only translate their historical data interfaces into
 * the canonical payloads of `documentPayloads.ts` and call the single
 * public boundary — `documentService`. Every exported name and data
 * interface is preserved so existing callers keep working during the
 * caller-migration phase; the adapters themselves are removed once all
 * callers move to the canonical typed API.
 *
 * Truthfulness preserved at this layer:
 *  - company identity is asserted through the canonical contract (no
 *    fallback brand name, address, phone, or currency);
 *  - historical `id.slice(0, 8)` "document numbers" are dropped by
 *    `deriveHonestReference` — only real references are shown;
 *  - print and PDF remain two distinct renderer operations.
 */
import {
  assertDocumentCompanySettings,
  MissingDocumentSettingsError,
  type DocumentCompanySettings,
} from './companyIdentity';
import { documentService } from './DocumentService';
import { DocumentRenderError } from './DocumentRenderer';
import {
  toBalanceSheetDocumentPayload,
  toContractDocumentPayload,
  toIncomeStatementDocumentPayload,
  toInvoiceDocumentPayload,
  toOwnerStatementDocumentPayload,
  toReceiptDocumentPayload,
  toReportDocumentPayload,
  toTenantStatementDocumentPayload,
  toTrialBalanceDocumentPayload,
} from './documentPayloadAdapters';

export {
  toBalanceSheetDocumentPayload,
  toContractDocumentPayload,
  toIncomeStatementDocumentPayload,
  toInvoiceDocumentPayload,
  toOwnerStatementDocumentPayload,
  toReceiptDocumentPayload,
  toReportDocumentPayload,
  toTenantStatementDocumentPayload,
  toTrialBalanceDocumentPayload,
} from './documentPayloadAdapters';

import type {
  BalanceSheetDocumentData,
  CompanyInfo,
  ContractDocumentData,
  DocumentSettings,
  IncomeStatementDocumentData,
  InvoiceDocumentData,
  OwnerStatementData,
  ReportDocumentData,
  ReceiptDocumentData,
  TenantStatementData,
  TrialBalanceDocumentData,
} from './documentCompatibilityTypes';

export type {
  BalanceSheetDocumentData,
  CompanyInfo,
  ContractDocumentData,
  DocumentSettings,
  IncomeStatementDocumentData,
  InvoiceDocumentData,
  OwnerStatementData,
  ReportDocumentData,
  ReceiptDocumentData,
  TenantStatementData,
  TrialBalanceDocumentData,
} from './documentCompatibilityTypes';

export { MissingDocumentSettingsError };

/** Adapts the compatibility settings shape into the canonical contract (asserted). */
export function toCanonicalDocumentSettings(settings: DocumentSettings): DocumentCompanySettings {
  return assertDocumentCompanySettings({
    companyName: settings?.company?.name ?? '',
    legalName: settings?.company?.legalName ?? null,
    taxNumber: settings?.company?.taxNumber ?? null,
    registrationNumber: settings?.company?.registrationNumber ?? null,
    phone: settings?.company?.phone ?? null,
    email: settings?.company?.email ?? null,
    address: settings?.company?.address ?? null,
    logoUrl: settings?.company?.logoUrl ?? null,
    currency: settings?.currency ?? '',
    currencySymbol: settings?.currencySymbol ?? null,
    documentPrefixes: {
      invoice: settings?.invoicePrefix ?? null,
      contract: settings?.contractPrefix ?? null,
      receipt: settings?.receiptPrefix ?? null,
    },
  });
}

async function runOrThrow(operation: () => Promise<void>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof DocumentRenderError || error instanceof MissingDocumentSettingsError) throw error;
    throw new DocumentRenderError('تعذر تنفيذ العملية على المستند. يرجى إعادة المحاولة.', error);
  }
}

export function printContractDocument(data: ContractDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.printDocument('contract', { settings: toCanonicalDocumentSettings(settings), payload: toContractDocumentPayload(data) }));
}
export function downloadContractPdf(data: ContractDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.downloadDocumentPdf('contract', { settings: toCanonicalDocumentSettings(settings), payload: toContractDocumentPayload(data) }));
}

export function printInvoiceDocument(data: InvoiceDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.printDocument('invoice', { settings: toCanonicalDocumentSettings(settings), payload: toInvoiceDocumentPayload(data) }));
}
export function downloadInvoicePdf(data: InvoiceDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.downloadDocumentPdf('invoice', { settings: toCanonicalDocumentSettings(settings), payload: toInvoiceDocumentPayload(data) }));
}

export function printReceiptDocument(data: ReceiptDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.printDocument('receipt', { settings: toCanonicalDocumentSettings(settings), payload: toReceiptDocumentPayload(data) }));
}
export function downloadReceiptPdf(data: ReceiptDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.downloadDocumentPdf('receipt', { settings: toCanonicalDocumentSettings(settings), payload: toReceiptDocumentPayload(data) }));
}

export function printOwnerStatementDocument(data: OwnerStatementData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.printDocument('owner_statement', { settings: toCanonicalDocumentSettings(settings), payload: toOwnerStatementDocumentPayload(data) }));
}
export function downloadOwnerStatementPdf(data: OwnerStatementData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.downloadDocumentPdf('owner_statement', { settings: toCanonicalDocumentSettings(settings), payload: toOwnerStatementDocumentPayload(data) }));
}

export function printTenantStatementDocument(data: TenantStatementData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.printDocument('tenant_statement', { settings: toCanonicalDocumentSettings(settings), payload: toTenantStatementDocumentPayload(data) }));
}
export function downloadTenantStatementPdf(data: TenantStatementData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.downloadDocumentPdf('tenant_statement', { settings: toCanonicalDocumentSettings(settings), payload: toTenantStatementDocumentPayload(data) }));
}

export function printTrialBalanceDocument(data: TrialBalanceDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.printDocument('trial_balance', { settings: toCanonicalDocumentSettings(settings), payload: toTrialBalanceDocumentPayload(data) }));
}
export function downloadTrialBalancePdf(data: TrialBalanceDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.downloadDocumentPdf('trial_balance', { settings: toCanonicalDocumentSettings(settings), payload: toTrialBalanceDocumentPayload(data) }));
}

export function printIncomeStatementDocument(data: IncomeStatementDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.printDocument('income_statement', { settings: toCanonicalDocumentSettings(settings), payload: toIncomeStatementDocumentPayload(data) }));
}
export function downloadIncomeStatementPdf(data: IncomeStatementDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.downloadDocumentPdf('income_statement', { settings: toCanonicalDocumentSettings(settings), payload: toIncomeStatementDocumentPayload(data) }));
}

export function printBalanceSheetDocument(data: BalanceSheetDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.printDocument('balance_sheet', { settings: toCanonicalDocumentSettings(settings), payload: toBalanceSheetDocumentPayload(data) }));
}
export function downloadBalanceSheetPdf(data: BalanceSheetDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.downloadDocumentPdf('balance_sheet', { settings: toCanonicalDocumentSettings(settings), payload: toBalanceSheetDocumentPayload(data) }));
}

export function printReportDocument(data: ReportDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.printDocument('generic_report', { settings: toCanonicalDocumentSettings(settings), payload: toReportDocumentPayload(data) }));
}
export function downloadReportPdf(data: ReportDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => documentService.downloadDocumentPdf('generic_report', { settings: toCanonicalDocumentSettings(settings), payload: toReportDocumentPayload(data) }));
}

export const DocumentTemplates = {
  printContractDocument,
  downloadContractPdf,
  printInvoiceDocument,
  downloadInvoicePdf,
  printReceiptDocument,
  downloadReceiptPdf,
  printOwnerStatementDocument,
  downloadOwnerStatementPdf,
  printTenantStatementDocument,
  downloadTenantStatementPdf,
  printTrialBalanceDocument,
  downloadTrialBalancePdf,
  printIncomeStatementDocument,
  downloadIncomeStatementPdf,
  printBalanceSheetDocument,
  downloadBalanceSheetPdf,
  printReportDocument,
  downloadReportPdf,
};

export default DocumentTemplates;
