/**
 * Document Templates - RTL-Ready Enterprise Document Engine for Rentrix
 * Supports: Contract, Invoice, Receipt, Owner Statement, Tenant Statement, Financial Reports
 *
 * Every function here requires real company identity (`DocumentSettings.company`)
 * sourced from `company_settings` — there is no fallback company name, address,
 * phone, or currency anywhere in this file. Each document type exposes a
 * `print*` and a `download*Pdf` pair; `print*` opens a scoped A4 preview and
 * triggers the browser print dialog, `download*Pdf` saves a real PDF file.
 * Neither is implemented as a wrapper around `window.print`.
 */

import { getCurrencySymbol, getCurrencyWordConfig, numberToArabicWords } from '@/lib/numberToArabicWords';
import { DocumentRenderer, DocumentRenderError } from './DocumentRenderer';
import type { UnifiedDocumentModel } from './types';

export interface ContractDocumentData {
  contractId: string;
  contractNumber: string;
  contractStatus?: 'draft' | 'active' | 'expired' | 'terminated';
  tenantName: string;
  tenantPhone: string;
  tenantEmail: string;
  tenantNationalId: string;
  propertyName: string;
  unitNumber: string;
  unitFloor?: string;
  ownerName: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  paymentCycle: string;
  vatRate?: number;
  notes?: string;
}

export interface InvoiceDocumentData {
  invoiceNumber: string;
  tenantName: string;
  propertyName: string;
  unitNumber: string;
  description: string;
  amount: number;
  vatAmount?: number;
  totalAmount: number;
  dueDate: string;
  issueDate: string;
}

export interface ReceiptDocumentData {
  receiptNumber: string;
  paymentDate: string;
  tenantName: string;
  propertyName: string;
  unitNumber: string;
  invoiceNumber: string;
  amount: number;
  paymentMethod: string;
  reference?: string;
  collectedBy?: string;
  notes?: string;
}

export interface OwnerStatementData {
  ownerName: string;
  ownerPhone?: string;
  periodFrom: string;
  periodTo: string;
  propertyTitle: string;
  totalRent: number;
  totalExpenses: number;
  totalCommission: number;
  netAmount: number;
  transactions: Array<{
    date: string;
    type: string;
    description: string;
    amount: number;
  }>;
}

export interface TenantStatementData {
  tenantName: string;
  tenantPhone?: string;
  periodFrom: string;
  periodTo: string;
  propertyTitle: string;
  unitNumber: string;
  openingBalance: number;
  totalInvoiced: number;
  totalPaid: number;
  closingBalance: number;
  lines: Array<{
    date: string;
    type: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
}

export interface ReportDocumentData {
  reportTitle: string;
  reportType: string;
  periodFrom: string;
  periodTo: string;
  sections: Array<{
    title: string;
    rows: Array<{ label: string; value: string | number }>;
    totals?: string[];
  }>;
  totalSummary?: string;
}

export interface CompanyInfo {
  name: string;
  legalName?: string;
  taxNumber?: string;
  registrationNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
  logoUrl?: string;
  vatRegistrationNumber?: string;
}

export interface DocumentSettings {
  company: CompanyInfo;
  currency: string;
  currencySymbol?: string;
  locale?: string;
  invoicePrefix?: string;
  contractPrefix?: string;
  receiptPrefix?: string;
}

/** Thrown by every render* function when required company identity is missing. */
export class MissingDocumentSettingsError extends Error {
  constructor() {
    super('تعذر إنشاء المستند: بيانات هوية الشركة غير مكتملة. يرجى إكمال اسم الشركة والعملة في إعدادات الشركة أولاً.');
    this.name = 'MissingDocumentSettingsError';
  }
}

function assertSettings(settings: DocumentSettings): void {
  if (!settings?.company?.name?.trim() || !settings?.currency?.trim()) {
    throw new MissingDocumentSettingsError();
  }
}

function currencySymbolOf(settings: DocumentSettings): string {
  return settings.currencySymbol || getCurrencySymbol(settings.currency);
}

function amountToWords(amount: number, settings: DocumentSettings): string {
  return numberToArabicWords(amount, getCurrencyWordConfig(settings.currency));
}

function formatMoney(amount: number, settings: DocumentSettings): string {
  const symbol = currencySymbolOf(settings);
  return `${amount.toLocaleString('ar-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${symbol}`;
}

function formatDate(dateStr: string, locale = 'ar-OM'): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length < 3) return dateStr;
  const [year, month, day] = parts;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * A contract is only described as "تنفيذي" / "ساري المفعول" when its real
 * status says so. Draft, expired, and terminated contracts get an honest
 * title instead of always claiming to be executed.
 */
function contractTitle(data: ContractDocumentData): string {
  switch (data.contractStatus) {
    case 'draft':
      return `مسودة عقد إيجار (غير موقّع) رقم ${data.contractNumber}`;
    case 'expired':
      return `عقد إيجار منتهي رقم ${data.contractNumber}`;
    case 'terminated':
      return `عقد إيجار مفسوخ رقم ${data.contractNumber}`;
    case 'active':
      return `عقد إيجار ساري المفعول رقم ${data.contractNumber}`;
    default:
      return `عقد إيجار رقم ${data.contractNumber}`;
  }
}

function buildContractModel(data: ContractDocumentData, settings: DocumentSettings): UnifiedDocumentModel {
  assertSettings(settings);
  return {
    type: 'contract',
    fileName: `contract-${data.contractNumber}`,
    header: {
      companyName: settings.company.name,
      companyAddress: settings.company.address ?? null,
      companyPhone: settings.company.phone ?? null,
      companyEmail: settings.company.email ?? null,
      companyLogoUrl: settings.company.logoUrl ?? null,
      companyTaxNumber: settings.company.taxNumber ?? null,
      companyRegistrationNumber: settings.company.registrationNumber ?? null,
      title: contractTitle(data),
      documentNo: data.contractNumber,
      dateLabel: 'تاريخ بداية العقد',
      dateValue: formatDate(data.startDate),
      currency: currencySymbolOf(settings),
    },
    kpis: [
      { label: 'المستأجر', value: data.tenantName },
      { label: 'رقم الهوية / السجل', value: data.tenantNationalId || '—' },
      { label: 'رقم الهاتف', value: data.tenantPhone || '—' },
      { label: 'العقار والوحدة', value: `${data.propertyName} / ${data.unitNumber}` },
      { label: 'فترة العقد', value: `${formatDate(data.startDate)} إلى ${formatDate(data.endDate)}` },
      { label: 'قيمة الإيجار', value: formatMoney(data.rentAmount, settings) },
      { label: 'دورة السداد', value: data.paymentCycle },
    ],
    tables: [
      {
        title: 'تفاصيل وأحكام العقد',
        columns: ['البند', 'التفاصيل والاشتراطات'],
        rows: [
          ['قيمة الإيجار بالإرقام', formatMoney(data.rentAmount, settings)],
          ['قيمة الإيجار بالحروف (تفقيط)', amountToWords(data.rentAmount, settings)],
          ['دورة الدفع المسجلة', data.paymentCycle],
          ['ملاحظات العقد', data.notes || 'لا توجد شروط إضافية'],
        ],
      },
    ],
    footer: {
      signatures: ['owner', 'tenant', 'accountant', 'general_manager'],
      companyStampLabel: null,
      metadata: `رقم العقد: ${data.contractNumber} | العقار: ${data.propertyName}`,
    },
  };
}

function buildInvoiceModel(data: InvoiceDocumentData, settings: DocumentSettings): UnifiedDocumentModel {
  assertSettings(settings);
  return {
    type: 'invoice',
    fileName: `invoice-${data.invoiceNumber}`,
    header: {
      companyName: settings.company.name,
      companyAddress: settings.company.address ?? null,
      companyPhone: settings.company.phone ?? null,
      companyEmail: settings.company.email ?? null,
      companyLogoUrl: settings.company.logoUrl ?? null,
      companyTaxNumber: settings.company.taxNumber ?? null,
      companyRegistrationNumber: settings.company.registrationNumber ?? null,
      title: `فاتورة مطالبة مالية رقم ${data.invoiceNumber}`,
      documentNo: data.invoiceNumber,
      dateLabel: 'تاريخ الإصدار',
      dateValue: formatDate(data.issueDate),
      currency: currencySymbolOf(settings),
    },
    kpis: [
      { label: 'اسم المستأجر', value: data.tenantName },
      { label: 'العقار والوحدة', value: `${data.propertyName} / ${data.unitNumber}` },
      { label: 'تاريخ الاستحقاق', value: formatDate(data.dueDate) },
      { label: 'وصف المطالبة', value: data.description },
      { label: 'المبلغ تفقيطاً', value: amountToWords(data.totalAmount, settings) },
    ],
    tables: [
      {
        title: 'تفاصيل المطالبة المالية',
        columns: ['البيان / تفاصيل الخدمات', 'المبلغ'],
        rows: [
          [data.description, formatMoney(data.amount, settings)],
          ...(data.vatAmount ? [['ضريبة القيمة المضافة', formatMoney(data.vatAmount, settings)]] : []),
        ],
        totals: ['إجمالي المستحق السداد', formatMoney(data.totalAmount, settings)],
      },
    ],
    footer: {
      signatures: ['accountant', 'general_manager'],
      companyStampLabel: null,
      metadata: `فاتورة رقم: ${data.invoiceNumber}`,
    },
  };
}

function buildReceiptModel(data: ReceiptDocumentData, settings: DocumentSettings): UnifiedDocumentModel {
  assertSettings(settings);
  const amountWords = amountToWords(data.amount, settings);

  return {
    type: 'receipt',
    fileName: `receipt-${data.receiptNumber}`,
    header: {
      companyName: settings.company.name,
      companyAddress: settings.company.address ?? null,
      companyPhone: settings.company.phone ?? null,
      companyEmail: settings.company.email ?? null,
      companyLogoUrl: settings.company.logoUrl ?? null,
      companyTaxNumber: settings.company.taxNumber ?? null,
      companyRegistrationNumber: settings.company.registrationNumber ?? null,
      title: `إيصال استلام نقدية / سداد رقم ${data.receiptNumber}`,
      documentNo: data.receiptNumber,
      dateLabel: 'تاريخ الاستلام',
      dateValue: formatDate(data.paymentDate),
      currency: currencySymbolOf(settings),
    },
    kpis: [
      { label: 'استلمنا من الفاضل', value: data.tenantName },
      { label: 'العقار والوحدة', value: `${data.propertyName} / ${data.unitNumber}` },
      { label: 'طريقة السداد', value: data.paymentMethod },
      ...(data.reference ? [{ label: 'رقم المرجع / الشيك', value: data.reference }] : []),
      ...(data.collectedBy ? [{ label: 'مستلم المبلغ', value: data.collectedBy }] : []),
    ],
    tables: [
      {
        title: 'تفاصيل المقبوضات',
        columns: ['البند والبيان', 'المبلغ بالتفصيل'],
        rows: [
          ['المبلغ المستلم رقماً', formatMoney(data.amount, settings)],
          ['المبلغ المستلم بالحروف (تفقيط)', amountWords],
          ['ذلك عن / مقابل', data.notes || `سداد الفاتورة رقم ${data.invoiceNumber}`],
        ],
        totals: ['المبلغ الإجمالي المقبوض', formatMoney(data.amount, settings)],
      },
    ],
    footer: {
      signatures: ['tenant', 'accountant', 'general_manager'],
      companyStampLabel: null,
      metadata: `إيصال استلام رقم: ${data.receiptNumber}`,
    },
  };
}

function buildOwnerStatementModel(data: OwnerStatementData, settings: DocumentSettings): UnifiedDocumentModel {
  assertSettings(settings);
  return {
    type: 'owner_statement',
    fileName: `owner-statement-${data.ownerName}`,
    header: {
      companyName: settings.company.name,
      companyAddress: settings.company.address ?? null,
      companyPhone: settings.company.phone ?? null,
      companyEmail: settings.company.email ?? null,
      companyLogoUrl: settings.company.logoUrl ?? null,
      companyTaxNumber: settings.company.taxNumber ?? null,
      companyRegistrationNumber: settings.company.registrationNumber ?? null,
      title: `كشف حساب مالك - ${data.ownerName}`,
      documentNo: data.ownerName,
      dateLabel: 'فترة الكشف',
      dateValue: `${formatDate(data.periodFrom)} - ${formatDate(data.periodTo)}`,
      currency: currencySymbolOf(settings),
    },
    kpis: [
      { label: 'اسم المالك', value: data.ownerName },
      { label: 'العقار', value: data.propertyTitle },
      { label: 'إجمالي الإيجارات', value: formatMoney(data.totalRent, settings) },
      { label: 'إجمالي المصروفات', value: formatMoney(data.totalExpenses, settings) },
      { label: 'عمولة إدارة الأملاك', value: formatMoney(data.totalCommission, settings) },
      { label: 'صافي المستحق للمالك', value: formatMoney(data.netAmount, settings) },
      { label: 'صافي المستحق تفقيطاً', value: amountToWords(data.netAmount, settings) },
    ],
    tables: [
      {
        title: 'سجل الحركة المالية للفترة المحددة',
        columns: ['التاريخ', 'نوع الحركة', 'البيان / التفاصيل', 'المبلغ'],
        rows: data.transactions.map((t) => [t.date, t.type, t.description, formatMoney(t.amount, settings)]),
        totals: ['صافي الرصيد المستحق', '', '', formatMoney(data.netAmount, settings)],
      },
    ],
    footer: {
      signatures: ['accountant', 'general_manager'],
      companyStampLabel: null,
      metadata: `كشف حساب مالك: ${data.ownerName}`,
    },
  };
}

function buildTenantStatementModel(data: TenantStatementData, settings: DocumentSettings): UnifiedDocumentModel {
  assertSettings(settings);
  return {
    type: 'tenant_statement',
    fileName: `tenant-statement-${data.tenantName}`,
    header: {
      companyName: settings.company.name,
      companyAddress: settings.company.address ?? null,
      companyPhone: settings.company.phone ?? null,
      companyEmail: settings.company.email ?? null,
      companyLogoUrl: settings.company.logoUrl ?? null,
      companyTaxNumber: settings.company.taxNumber ?? null,
      companyRegistrationNumber: settings.company.registrationNumber ?? null,
      title: `كشف حساب مستأجر - ${data.tenantName}`,
      documentNo: data.tenantName,
      dateLabel: 'فترة الكشف',
      dateValue: `${formatDate(data.periodFrom)} - ${formatDate(data.periodTo)}`,
      currency: currencySymbolOf(settings),
    },
    kpis: [
      { label: 'اسم المستأجر', value: data.tenantName },
      { label: 'العقار والوحدة', value: `${data.propertyTitle} / ${data.unitNumber}` },
      { label: 'الرصيد الافتتاحي', value: formatMoney(data.openingBalance, settings) },
      { label: 'إجمالي الفواتير والمطالبات', value: formatMoney(data.totalInvoiced, settings) },
      { label: 'إجمالي السدادات والمقبوضات', value: formatMoney(data.totalPaid, settings) },
      { label: 'الرصيد المتبقي النهائي', value: formatMoney(data.closingBalance, settings) },
      { label: 'الرصيد تفقيطاً', value: amountToWords(Math.abs(data.closingBalance), settings) },
    ],
    tables: [
      {
        title: 'دفتر حركة حساب المستأجر والذمم الجارية',
        columns: ['التاريخ', 'النوع', 'البيان', 'مدين (مطالبة)', 'دائن (سداد)', 'الرصيد الجاري'],
        rows: data.lines.map((l) => [
          l.date,
          l.type,
          l.description,
          formatMoney(l.debit, settings),
          formatMoney(l.credit, settings),
          formatMoney(l.balance, settings),
        ]),
        totals: ['إجمالي الرصيد المستحق الواجب السداد', '', '', '', '', formatMoney(data.closingBalance, settings)],
      },
    ],
    footer: {
      signatures: ['tenant', 'accountant', 'general_manager'],
      companyStampLabel: null,
      metadata: `كشف حساب مستأجر: ${data.tenantName}`,
    },
  };
}

function buildReportModel(data: ReportDocumentData, settings: DocumentSettings): UnifiedDocumentModel {
  assertSettings(settings);
  const tables = data.sections.map((section) => ({
    title: section.title,
    columns: section.rows.map((row) => row.label),
    rows: [section.rows.map((row) => String(row.value))],
    totals: section.totals,
  }));

  return {
    type: 'report',
    fileName: `report-${data.reportType}-${toLocalDateString(new Date())}`,
    header: {
      companyName: settings.company.name,
      companyAddress: settings.company.address ?? null,
      companyPhone: settings.company.phone ?? null,
      companyEmail: settings.company.email ?? null,
      companyLogoUrl: settings.company.logoUrl ?? null,
      companyTaxNumber: settings.company.taxNumber ?? null,
      companyRegistrationNumber: settings.company.registrationNumber ?? null,
      title: data.reportTitle,
      documentNo: data.reportType,
      dateLabel: 'فترة التقرير',
      dateValue: `${formatDate(data.periodFrom)} - ${formatDate(data.periodTo)}`,
      currency: currencySymbolOf(settings),
    },
    kpis: data.totalSummary ? [{ label: 'الملخص المالي والتشغيلي', value: data.totalSummary }] : [],
    tables,
    footer: {
      signatures: ['accountant', 'general_manager'],
      companyStampLabel: null,
      metadata: data.reportTitle,
    },
  };
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
  return runOrThrow(() => DocumentRenderer.printDocument(buildContractModel(data, settings)));
}
export function downloadContractPdf(data: ContractDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => DocumentRenderer.downloadDocumentPdf(buildContractModel(data, settings)));
}

export function printInvoiceDocument(data: InvoiceDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => DocumentRenderer.printDocument(buildInvoiceModel(data, settings)));
}
export function downloadInvoicePdf(data: InvoiceDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => DocumentRenderer.downloadDocumentPdf(buildInvoiceModel(data, settings)));
}

export function printReceiptDocument(data: ReceiptDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => DocumentRenderer.printDocument(buildReceiptModel(data, settings)));
}
export function downloadReceiptPdf(data: ReceiptDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => DocumentRenderer.downloadDocumentPdf(buildReceiptModel(data, settings)));
}

export function printOwnerStatementDocument(data: OwnerStatementData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => DocumentRenderer.printDocument(buildOwnerStatementModel(data, settings)));
}
export function downloadOwnerStatementPdf(data: OwnerStatementData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => DocumentRenderer.downloadDocumentPdf(buildOwnerStatementModel(data, settings)));
}

export function printTenantStatementDocument(data: TenantStatementData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => DocumentRenderer.printDocument(buildTenantStatementModel(data, settings)));
}
export function downloadTenantStatementPdf(data: TenantStatementData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => DocumentRenderer.downloadDocumentPdf(buildTenantStatementModel(data, settings)));
}

export function printReportDocument(data: ReportDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => DocumentRenderer.printDocument(buildReportModel(data, settings)));
}
export function downloadReportPdf(data: ReportDocumentData, settings: DocumentSettings): Promise<void> {
  return runOrThrow(() => DocumentRenderer.downloadDocumentPdf(buildReportModel(data, settings)));
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
  printReportDocument,
  downloadReportPdf,
};

export default DocumentTemplates;
