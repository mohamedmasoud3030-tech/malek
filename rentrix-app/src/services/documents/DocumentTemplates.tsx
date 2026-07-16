/**
 * Document Templates - RTL-Ready Enterprise Document Engine for Rentrix
 * Supports: Contract, Invoice, Receipt, Owner Statement, Tenant Statement, Financial Reports
 */

import { numberToArabicWords, OMR_CURRENCY_CONFIG } from '@/lib/numberToArabicWords';
import { DocumentRenderer } from './DocumentRenderer';
import type { UnifiedDocumentModel } from './types';

export interface ContractDocumentData {
  contractId: string;
  contractNumber: string;
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

function formatMoney(amount: number, currency = 'ر.ع'): string {
  return `${amount.toLocaleString('ar-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${currency}`;
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

// Unified model builder functions to prevent duplicate templates code
function buildContractModel(data: ContractDocumentData, settings: DocumentSettings): UnifiedDocumentModel {
  return {
    type: 'contract',
    fileName: `contract-${data.contractNumber}`,
    header: {
      companyName: settings.company.name || 'رينتريكس لإدارة العقارات',
      companyAddress: settings.company.address ?? 'سلطنة عمان - مسقط',
      companyPhone: settings.company.phone ?? '+968 24000000',
      title: `عقد إيجار رقم ${data.contractNumber}`,
      documentNo: data.contractNumber,
      dateLabel: 'تاريخ بداية العقد',
      dateValue: formatDate(data.startDate),
    },
    kpis: [
      { label: 'المستأجر', value: data.tenantName },
      { label: 'رقم الهوية / السجل', value: data.tenantNationalId || '—' },
      { label: 'رقم الهاتف', value: data.tenantPhone || '—' },
      { label: 'العقار والوحدة', value: `${data.propertyName} / ${data.unitNumber}` },
      { label: 'فترة العقد', value: `${formatDate(data.startDate)} إلى ${formatDate(data.endDate)}` },
      { label: 'قيمة الإيجار', value: formatMoney(data.rentAmount, settings.currencySymbol) },
      { label: 'دورة السداد', value: data.paymentCycle },
    ],
    tables: [
      {
        title: 'تفاصيل وأحكام العقد',
        columns: ['البند', 'التفاصيل والاشتراطات'],
        rows: [
          ['قيمة الإيجار بالإرقام', formatMoney(data.rentAmount, settings.currencySymbol)],
          ['قيمة الإيجار بالحروف (تفقيط)', numberToArabicWords(data.rentAmount, OMR_CURRENCY_CONFIG)],
          ['دورة الدفع المسجلة', data.paymentCycle],
          ['ملاحظات العقد', data.notes || 'لا توجد شروط إضافية'],
        ],
      },
    ],
    footer: {
      signatures: ['owner', 'tenant', 'accountant', 'general_manager'],
      companyStampLabel: settings.company.name,
      metadata: `رقم العقد: ${data.contractNumber} | العقار: ${data.propertyName}`,
    },
  };
}

function buildInvoiceModel(data: InvoiceDocumentData, settings: DocumentSettings): UnifiedDocumentModel {
  return {
    type: 'invoice',
    fileName: `invoice-${data.invoiceNumber}`,
    header: {
      companyName: settings.company.name || 'رينتريكس لإدارة العقارات',
      companyAddress: settings.company.address ?? 'سلطنة عمان - مسقط',
      companyPhone: settings.company.phone ?? '+968 24000000',
      title: `فاتورة مطالبة مالية رقم ${data.invoiceNumber}`,
      documentNo: data.invoiceNumber,
      dateLabel: 'تاريخ الإصدار',
      dateValue: formatDate(data.issueDate),
    },
    kpis: [
      { label: 'اسم المستأجر', value: data.tenantName },
      { label: 'العقار والوحدة', value: `${data.propertyName} / ${data.unitNumber}` },
      { label: 'تاريخ الاستحقاق', value: formatDate(data.dueDate) },
      { label: 'وصف المطالبة', value: data.description },
    ],
    tables: [
      {
        title: 'تفاصيل المطالبة المالية',
        columns: ['البيان / تفاصيل الخدمات', 'المبلغ'],
        rows: [
          [data.description, formatMoney(data.amount, settings.currencySymbol)],
          ...(data.vatAmount
            ? [['ضريبة القيمة المضافة', formatMoney(data.vatAmount, settings.currencySymbol)]]
            : []),
        ],
        totals: ['إجمالي المستحق السداد', formatMoney(data.totalAmount, settings.currencySymbol)],
      },
    ],
    footer: {
      signatures: ['accountant', 'general_manager'],
      companyStampLabel: settings.company.name,
      metadata: `فاتورة رقم: ${data.invoiceNumber} | ${settings.company.name}`,
    },
  };
}

function buildReceiptModel(data: ReceiptDocumentData, settings: DocumentSettings): UnifiedDocumentModel {
  const amountWords = numberToArabicWords(data.amount, OMR_CURRENCY_CONFIG);
  return {
    type: 'receipt',
    fileName: `receipt-${data.receiptNumber}`,
    header: {
      companyName: settings.company.name || 'رينتريكس لإدارة العقارات',
      companyAddress: settings.company.address ?? 'سلطنة عمان - مسقط',
      companyPhone: settings.company.phone ?? '+968 24000000',
      title: `إيصال استلام نقدية / سداد رقم ${data.receiptNumber}`,
      documentNo: data.receiptNumber,
      dateLabel: 'تاريخ الاستلام',
      dateValue: formatDate(data.paymentDate),
    },
    kpis: [
      { label: 'استلمنا من الفاضل / الفاضلة', value: data.tenantName },
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
          ['المبلغ المستلم رقماً', formatMoney(data.amount, settings.currencySymbol)],
          ['المبلغ المستلم بالحروف', amountWords],
          ['ذلك عن / مقابل', data.notes || `سداد الفاتورة رقم ${data.invoiceNumber}`],
        ],
        totals: ['المبلغ الإجمالي المقبوض', formatMoney(data.amount, settings.currencySymbol)],
      },
    ],
    footer: {
      signatures: ['tenant', 'accountant', 'general_manager'],
      companyStampLabel: settings.company.name,
      metadata: `إيصال استلام رقم: ${data.receiptNumber} | ${settings.company.name}`,
    },
  };
}

function buildOwnerStatementModel(data: OwnerStatementData, settings: DocumentSettings): UnifiedDocumentModel {
  return {
    type: 'owner_statement',
    fileName: `owner-statement-${data.ownerName}`,
    header: {
      companyName: settings.company.name || 'رينتريكس لإدارة العقارات',
      companyAddress: settings.company.address ?? 'سلطنة عمان - مسقط',
      companyPhone: settings.company.phone ?? '+968 24000000',
      title: `كشف حساب مالك - ${data.ownerName}`,
      documentNo: data.ownerName,
      dateLabel: 'فترة الكشف',
      dateValue: `${formatDate(data.periodFrom)} - ${formatDate(data.periodTo)}`,
    },
    kpis: [
      { label: 'اسم المالك', value: data.ownerName },
      { label: 'العقار', value: data.propertyTitle },
      { label: 'إجمالي الإيجارات', value: formatMoney(data.totalRent, settings.currencySymbol) },
      { label: 'إجمالي المصروفات', value: formatMoney(data.totalExpenses, settings.currencySymbol) },
      { label: 'عمولة إدارة الأملاك', value: formatMoney(data.totalCommission, settings.currencySymbol) },
      { label: 'صافي المستحق للمالك', value: formatMoney(data.netAmount, settings.currencySymbol) },
    ],
    tables: [
      {
        title: 'سجل الحركة المالية للفترة المحددة',
        columns: ['التاريخ', 'نوع الحركة', 'البيان / التفاصيل', 'المبلغ'],
        rows: data.transactions.map((t) => [
          t.date,
          t.type,
          t.description,
          formatMoney(t.amount, settings.currencySymbol),
        ]),
        totals: ['صافي الرصيد المستحق', '', '', formatMoney(data.netAmount, settings.currencySymbol)],
      },
    ],
    footer: {
      signatures: ['accountant', 'general_manager'],
      companyStampLabel: settings.company.name,
      metadata: `كشف حساب مالك: ${data.ownerName} | ${settings.company.name}`,
    },
  };
}

function buildTenantStatementModel(data: TenantStatementData, settings: DocumentSettings): UnifiedDocumentModel {
  return {
    type: 'tenant_statement',
    fileName: `tenant-statement-${data.tenantName}`,
    header: {
      companyName: settings.company.name || 'رينتريكس لإدارة العقارات',
      companyAddress: settings.company.address ?? 'سلطنة عمان - مسقط',
      companyPhone: settings.company.phone ?? '+968 24000000',
      title: `كشف حساب مستأجر - ${data.tenantName}`,
      documentNo: data.tenantName,
      dateLabel: 'فترة الكشف',
      dateValue: `${formatDate(data.periodFrom)} - ${formatDate(data.periodTo)}`,
    },
    kpis: [
      { label: 'اسم المستأجر', value: data.tenantName },
      { label: 'العقار والوحدة', value: `${data.propertyTitle} / ${data.unitNumber}` },
      { label: 'الرصيد الافتتاحي', value: formatMoney(data.openingBalance, settings.currencySymbol) },
      { label: 'إجمالي الفواتير والمطالبات', value: formatMoney(data.totalInvoiced, settings.currencySymbol) },
      { label: 'إجمالي السدادات والمقبوضات', value: formatMoney(data.totalPaid, settings.currencySymbol) },
      { label: 'الرصيد النهائي المستحق', value: formatMoney(data.closingBalance, settings.currencySymbol) },
    ],
    tables: [
      {
        title: 'دفتر حركة حساب المستأجر والذمم الجارية',
        columns: ['التاريخ', 'النوع', 'البيان', 'مدين (مطالبة)', 'دائن (سداد)', 'الرصيد الجاري'],
        rows: data.lines.map((l) => [
          l.date,
          l.type,
          l.description,
          formatMoney(l.debit, settings.currencySymbol),
          formatMoney(l.credit, settings.currencySymbol),
          formatMoney(l.balance, settings.currencySymbol),
        ]),
        totals: ['إجمالي الرصيد المستحق الواجب السداد', '', '', '', '', formatMoney(data.closingBalance, settings.currencySymbol)],
      },
    ],
    footer: {
      signatures: ['tenant', 'accountant', 'general_manager'],
      companyStampLabel: settings.company.name,
      metadata: `كشف حساب مستأجر: ${data.tenantName} | ${settings.company.name}`,
    },
  };
}

function buildReportModel(data: ReportDocumentData, settings: DocumentSettings): UnifiedDocumentModel {
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
      companyName: settings.company.name || 'رينتريكس لإدارة العقارات',
      companyAddress: settings.company.address ?? 'سلطنة عمان - مسقط',
      companyPhone: settings.company.phone ?? '+968 24000000',
      title: data.reportTitle,
      documentNo: data.reportType,
      dateLabel: 'فترة التقرير',
      dateValue: `${formatDate(data.periodFrom)} - ${formatDate(data.periodTo)}`,
    },
    kpis: data.totalSummary ? [{ label: 'الملخص المالي والتشغيلي', value: data.totalSummary }] : [],
    tables,
    footer: {
      signatures: ['accountant', 'general_manager'],
      companyStampLabel: settings.company.name,
      metadata: `${data.reportTitle} | ${settings.company.name}`,
    },
  };
}

export const DocumentTemplates = {
  // Print operations (backward compatible with direct window.print triggering)
  renderContractPdf(data: ContractDocumentData, settings: DocumentSettings): void {
    const model = buildContractModel(data, settings);
    DocumentRenderer.printDocument(model);
  },
  renderInvoicePdf(data: InvoiceDocumentData, settings: DocumentSettings): void {
    const model = buildInvoiceModel(data, settings);
    DocumentRenderer.printDocument(model);
  },
  renderReceiptPdf(data: ReceiptDocumentData, settings: DocumentSettings): void {
    const model = buildReceiptModel(data, settings);
    DocumentRenderer.printDocument(model);
  },
  renderOwnerStatementPdf(data: OwnerStatementData, settings: DocumentSettings): void {
    const model = buildOwnerStatementModel(data, settings);
    DocumentRenderer.printDocument(model);
  },
  renderTenantStatementPdf(data: TenantStatementData, settings: DocumentSettings): void {
    const model = buildTenantStatementModel(data, settings);
    DocumentRenderer.printDocument(model);
  },
  renderReportPdf(data: ReportDocumentData, settings: DocumentSettings): void {
    const model = buildReportModel(data, settings);
    DocumentRenderer.printDocument(model);
  },

  // Direct direct print action
  printContract(data: ContractDocumentData, settings: DocumentSettings): void {
    const model = buildContractModel(data, settings);
    DocumentRenderer.printDocument(model);
  },
  printInvoice(data: InvoiceDocumentData, settings: DocumentSettings): void {
    const model = buildInvoiceModel(data, settings);
    DocumentRenderer.printDocument(model);
  },
  printReceipt(data: ReceiptDocumentData, settings: DocumentSettings): void {
    const model = buildReceiptModel(data, settings);
    DocumentRenderer.printDocument(model);
  },
  printOwnerStatement(data: OwnerStatementData, settings: DocumentSettings): void {
    const model = buildOwnerStatementModel(data, settings);
    DocumentRenderer.printDocument(model);
  },
  printTenantStatement(data: TenantStatementData, settings: DocumentSettings): void {
    const model = buildTenantStatementModel(data, settings);
    DocumentRenderer.printDocument(model);
  },
  printReport(data: ReportDocumentData, settings: DocumentSettings): void {
    const model = buildReportModel(data, settings);
    DocumentRenderer.printDocument(model);
  },

  // Pure direct download PDF operations
  async downloadContractPdf(data: ContractDocumentData, settings: DocumentSettings): Promise<void> {
    const model = buildContractModel(data, settings);
    await DocumentRenderer.downloadDocumentPdf(model);
  },
  async downloadInvoicePdf(data: InvoiceDocumentData, settings: DocumentSettings): Promise<void> {
    const model = buildInvoiceModel(data, settings);
    await DocumentRenderer.downloadDocumentPdf(model);
  },
  async downloadReceiptPdf(data: ReceiptDocumentData, settings: DocumentSettings): Promise<void> {
    const model = buildReceiptModel(data, settings);
    await DocumentRenderer.downloadDocumentPdf(model);
  },
  async downloadOwnerStatementPdf(data: OwnerStatementData, settings: DocumentSettings): Promise<void> {
    const model = buildOwnerStatementModel(data, settings);
    await DocumentRenderer.downloadDocumentPdf(model);
  },
  async downloadTenantStatementPdf(data: TenantStatementData, settings: DocumentSettings): Promise<void> {
    const model = buildTenantStatementModel(data, settings);
    await DocumentRenderer.downloadDocumentPdf(model);
  },
  async downloadReportPdf(data: ReportDocumentData, settings: DocumentSettings): Promise<void> {
    const model = buildReportModel(data, settings);
    await DocumentRenderer.downloadDocumentPdf(model);
  },
};

export default DocumentTemplates;
