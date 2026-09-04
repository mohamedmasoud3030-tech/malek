/**
 * Shared statement document actions — ONE implementation.
 *
 * The premium report products (Owner Comprehensive Statement / Tenant
 * Statement) and the consolidated statements surface all reach the printed
 * documents through these functions. They never recalculate a figure:
 * tenant payloads come from the authoritative `rpt_tenant_statement` lines
 * and the owner pack reuses the canonical `professional-owner-report`
 * loader chain (rpt_owner_statement + financial position + settlements).
 *
 * Every entry point runs through `runGuardedDocumentAction`, so an
 * incomplete company identity fails closed with the user-safe Arabic
 * readiness message instead of emitting a half-built document.
 */
import type { OwnerStatementReport, TenantStatementReport } from '@/features/financials/reports/financialReportsService';
import type { DocumentCompanySettings } from '@/services/documents/companyIdentity';
import type { OwnerReportPayload } from '@/services/documents/documentPayloads';
import { documentService } from '@/services/documents/DocumentService';
import { DocumentReadinessError, runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import {
  toTenantStatementDocumentPayload,
  type TenantStatementData,
} from '@/services/documents/documentPayloadAdapters';
import { downloadBlob } from '@/lib/tabular-export';
import { buildXlsxBlob } from '@/lib/xlsx-export';
import { loadPremiumOwnerReportPayload } from '../documents/premium-owner-report';

/**
 * A statement is a legal/financial document: without its authoritative
 * snapshot there is nothing truthful to render, so output is refused rather
 * than emitting an empty or partially-populated statement.
 */
export const MISSING_STATEMENT_DATA_MESSAGE =
  'تعذر إصدار الكشف: لا توجد بيانات كشف حساب مُحمَّلة للفترة أو الطرف المحدد. يرجى تحديد النطاق وعرض النتائج أولاً.';

/** Each authoritative line exposes its post-movement running balance; reverse the first movement to recover the opening balance — never hardcode 0. */
export function deriveTenantOpeningBalance(statement: TenantStatementReport): number {
  const firstLine = statement.lines[0];
  if (!firstLine) return statement.finalBalance || 0;
  return (firstLine.balance || 0) - (firstLine.debit || 0) + (firstLine.credit || 0);
}

export function buildTenantStatementDocumentData(
  tenantStatement: TenantStatementReport | null | undefined,
  period: { from?: string; to?: string },
): TenantStatementData | null {
  if (!tenantStatement) return null;
  return {
    tenantName: tenantStatement.tenantName || 'مستأجر غير محدد',
    periodFrom: period.from || tenantStatement.startDate || '—',
    periodTo: period.to || tenantStatement.endDate || '—',
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
}

/** Print or PDF the authoritative tenant statement — one flow for every surface. */
export function runTenantStatementDocumentAction(params: Readonly<{
  isReady: boolean;
  settings: DocumentCompanySettings;
  statement: TenantStatementReport | null | undefined;
  period: { from?: string; to?: string };
}>, mode: 'print' | 'pdf'): Promise<void> {
  return runGuardedDocumentAction({
    isReady: params.isReady,
    operation: async () => {
      const data = buildTenantStatementDocumentData(params.statement, params.period);
      if (!data) throw new DocumentReadinessError(MISSING_STATEMENT_DATA_MESSAGE);
      const payload = toTenantStatementDocumentPayload(data);
      if (mode === 'print') {
        await documentService.printDocument('tenant_statement', { settings: params.settings, payload });
      } else {
        await documentService.downloadDocumentPdf('tenant_statement', { settings: params.settings, payload });
      }
    },
    fallbackMessage: mode === 'print' ? 'تعذرت طباعة الكشف.' : 'تعذر تنزيل ملف PDF.',
  });
}

/** Share the generated tenant-statement PDF file — the same document output as download. */
export async function buildTenantStatementPdfFile(params: Readonly<{
  settings: DocumentCompanySettings;
  statement: TenantStatementReport | null | undefined;
  period: { from?: string; to?: string };
}>): Promise<File> {
  const data = buildTenantStatementDocumentData(params.statement, params.period);
  if (!data) throw new DocumentReadinessError(MISSING_STATEMENT_DATA_MESSAGE);
  return documentService.buildDocumentPdfFile('tenant_statement', {
    settings: params.settings,
    payload: toTenantStatementDocumentPayload(data),
  });
}

export function downloadTenantStatementExcel(statement: TenantStatementReport | null | undefined, contractId?: string | null): void {
  if (!statement) return;
  const rows = statement.lines.map((line) => [
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
    `tenant-statement-${contractId || 'statement'}.xlsx`,
  );
}

/**
 * Owner-statement Excel rows. Financial truth: opening/closing running
 * balance is NOT available from an authoritative read source
 * (rpt_owner_statement does not expose one) — the column is omitted entirely
 * rather than carrying a fabricated cumulative figure.
 */
export function ownerStatementExcelRows(statement: OwnerStatementReport): readonly (readonly (string | number)[])[] {
  return statement.transactions.map((transaction) => [
    transaction.date || '—',
    transaction.type === 'receipt' ? 'تحصيل' : transaction.type === 'expense' ? 'مصروف' : transaction.type === 'settlement' ? 'تسوية / صرف' : 'حركة مالية',
    transaction.propertyName || 'غير محدد',
    transaction.details || 'حركة مالية',
    transaction.gross || 0,
    transaction.deduction || 0,
    transaction.net || 0,
  ] as const);
}

export function downloadOwnerStatementExcel(statement: OwnerStatementReport | null | undefined, ownerId?: string | null): void {
  if (!statement) return;
  downloadBlob(
    buildXlsxBlob({
      name: 'كشف المالك',
      headers: ['التاريخ', 'نوع الحركة', 'العقار', 'البيان', 'الإجمالي', 'الاستقطاع', 'صافي الحركة'],
      rows: ownerStatementExcelRows(statement) as readonly (readonly string[])[],
    }),
    `owner-statement-${ownerId || 'statement'}.xlsx`,
  );
}

/** Print or PDF the flagship owner pack (professional Owner Report). */
export function runOwnerReportDocumentAction(params: Readonly<{
  isReady: boolean;
  settings: DocumentCompanySettings;
  ownerId: string | null | undefined;
  statement: OwnerStatementReport | null | undefined;
  period: { from?: string; to?: string; propertyId?: string | null };
  payload?: OwnerReportPayload | null;
}>, mode: 'print' | 'pdf'): Promise<void> {
  return runGuardedDocumentAction({
    isReady: params.isReady,
    operation: async () => {
      if (!params.ownerId) {
        throw new DocumentReadinessError('تعذر إصدار كشف المالك التفصيلي: لم يتم تحديد المالك. اختر مالكًا من فلاتر التقرير أولاً.');
      }
      if (!params.statement) {
        throw new DocumentReadinessError('تعذر إصدار كشف المالك التفصيلي: لا توجد بيانات كشف مالك معتمدة للفترة أو النطاق المحدد.');
      }
      if (params.statement.error) {
        throw new DocumentReadinessError('تعذر إصدار كشف المالك التفصيلي: كشف المالك المحمّل يحتوي على خطأ في المصدر المعتمد.');
      }
      const payload = params.payload ?? await loadPremiumOwnerReportPayload({
        ownerId: params.ownerId,
        from: params.period.from || params.statement.periodFrom || '—',
        to: params.period.to || params.statement.periodTo || '—',
        propertyId: params.period.propertyId || null,
        statement: params.statement,
      });
      if (mode === 'print') {
        await documentService.printDocument('owner_report', { settings: params.settings, payload });
      } else {
        await documentService.downloadDocumentPdf('owner_report', { settings: params.settings, payload });
      }
    },
    fallbackMessage: mode === 'print'
      ? 'تعذرت طباعة كشف المالك التفصيلي.'
      : 'تعذر تنزيل كشف المالك التفصيلي كملف PDF.',
  });
}

/** Share the generated owner-pack PDF file — the same document output as download. */
export async function buildOwnerReportPdfFile(params: Readonly<{
  settings: DocumentCompanySettings;
  ownerId: string;
  statement: OwnerStatementReport;
  period: { from?: string; to?: string; propertyId?: string | null };
  payload?: OwnerReportPayload | null;
}>): Promise<File> {
  const payload = params.payload ?? await loadPremiumOwnerReportPayload({
    ownerId: params.ownerId,
    from: params.period.from || params.statement.periodFrom || '—',
    to: params.period.to || params.statement.periodTo || '—',
    propertyId: params.period.propertyId || null,
    statement: params.statement,
  });
  return documentService.buildDocumentPdfFile('owner_report', {
    settings: params.settings,
    payload,
  });
}
