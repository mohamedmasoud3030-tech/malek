/**
 * Document Templates - RTL-Ready Document Templates for Rentrix
 * Supports: Contract, Invoice, Receipt, Owner Statement, Reports
 */

import type { UnifiedDocumentModel } from './types';
import { DocumentRenderer } from './DocumentRenderer';

// ============================================================
// Document Templates Library
// ============================================================

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
}

export interface OwnerStatementData {
  ownerName: string;
  ownerPhone: string;
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

// ============================================================
// Company Settings Interface
// ============================================================

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

// ============================================================
// RTL Template Renderer
// ============================================================

function formatMoney(amount: number, currency = 'ر.ع'): string {
  return `${amount.toLocaleString('ar-OM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function formatDate(dateStr: string, locale = 'ar-OM'): string {
  // Parse date string in local timezone to avoid UTC offset issues
  const parts = dateStr.split('T')[0].split('-');
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

// ============================================================
// Contract PDF Template
// ============================================================

export function renderContractPdf(data: ContractDocumentData, settings: DocumentSettings): void {
  const model: UnifiedDocumentModel = {
    type: 'contract',
    fileName: `contract-${data.contractNumber}`,
    header: {
      companyName: settings.company.name,
      companyAddress: settings.company.address ?? '',
      companyPhone: settings.company.phone ?? '',
      title: `عقد إيجار رقم ${data.contractNumber}`,
      documentNo: data.contractNumber,
      dateLabel: 'تاريخ الإصدار',
      dateValue: formatDate(data.startDate),
    },
    kpis: [
      { label: 'المستأجر', value: data.tenantName },
      { label: 'رقم الوحدة', value: `${data.propertyName} / ${data.unitNumber}` },
      { label: 'رقم الهوية', value: data.tenantNationalId },
      { label: 'رقم الهاتف', value: data.tenantPhone },
      { label: 'البريد الإلكتروني', value: data.tenantEmail || '—' },
      { label: 'مدة العقد', value: `${formatDate(data.startDate)} - ${formatDate(data.endDate)}` },
      { label: 'قيمة الإيجار', value: formatMoney(data.rentAmount, settings.currencySymbol) },
      { label: 'دورة السداد', value: data.paymentCycle },
      ...(data.vatRate ? [{ label: 'ضريبة القيمة المضافة', value: `${data.vatRate}%` }] : []),
    ],
    tables: [],
    footer: {
      signatures: ['tenant', 'owner', 'accountant', 'general_manager'],
      companyStampLabel: settings.company.name,
      metadata: `رقم العقد: ${data.contractNumber} | العقار: ${data.propertyName}`,
    },
  };

  DocumentRenderer.renderToPDF(model);
}

// ============================================================
// Invoice PDF Template
// ============================================================

export function renderInvoicePdf(data: InvoiceDocumentData, settings: DocumentSettings): void {
  const model: UnifiedDocumentModel = {
    type: 'invoice',
    fileName: `invoice-${data.invoiceNumber}`,
    header: {
      companyName: settings.company.name,
      companyAddress: settings.company.address ?? '',
      companyPhone: settings.company.phone ?? '',
      title: `فاتورة رقم ${data.invoiceNumber}`,
      documentNo: data.invoiceNumber,
      dateLabel: 'تاريخ الإصدار',
      dateValue: formatDate(data.issueDate),
    },
    kpis: [
      { label: 'اسم المستأجر', value: data.tenantName },
      { label: 'العقار', value: data.propertyName },
      { label: 'الوحدة', value: data.unitNumber },
      { label: 'الوصف', value: data.description },
      { label: 'تاريخ الاستحقاق', value: formatDate(data.dueDate) },
    ],
    tables: [
      {
        title: 'تفاصيل الفاتورة',
        columns: ['البيان', 'المبلغ'],
        rows: [
          [data.description, formatMoney(data.amount, settings.currencySymbol)],
          ...(data.vatAmount
            ? [['ضريبة القيمة المضافة', formatMoney(data.vatAmount, settings.currencySymbol)]]
            : []),
        ],
        totals: ['الإجمالي', formatMoney(data.totalAmount, settings.currencySymbol)],
      },
    ],
    footer: {
      signatures: ['accountant', 'general_manager'],
      companyStampLabel: settings.company.name,
      metadata: `فاتورة رقم: ${data.invoiceNumber} | ${settings.company.name}`,
    },
  };

  DocumentRenderer.renderToPDF(model);
}

// ============================================================
// Receipt PDF Template
// ============================================================

export function renderReceiptPdf(data: ReceiptDocumentData, settings: DocumentSettings): void {
  const model: UnifiedDocumentModel = {
    type: 'receipt',
    fileName: `receipt-${data.receiptNumber}`,
    header: {
      companyName: settings.company.name,
      companyAddress: settings.company.address ?? '',
      companyPhone: settings.company.phone ?? '',
      title: `إيصال استلام رقم ${data.receiptNumber}`,
      documentNo: data.receiptNumber,
      dateLabel: 'تاريخ الدفع',
      dateValue: formatDate(data.paymentDate),
    },
    kpis: [
      { label: 'المستأجر', value: data.tenantName },
      { label: 'العقار', value: data.propertyName },
      { label: 'الوحدة', value: data.unitNumber },
      { label: 'رقم الفاتورة', value: data.invoiceNumber },
      { label: 'طريقة الدفع', value: data.paymentMethod },
      ...(data.reference ? [{ label: 'المرجع', value: data.reference }] : []),
      ...(data.collectedBy ? [{ label: 'استلم من', value: data.collectedBy }] : []),
    ],
    tables: [
      {
        title: 'تفاصيل الدفع',
        columns: ['البيان', 'المبلغ'],
        rows: [[data.invoiceNumber, formatMoney(data.amount, settings.currencySymbol)]],
        totals: ['المبلغ المدفوع', formatMoney(data.amount, settings.currencySymbol)],
      },
    ],
    footer: {
      signatures: ['accountant', 'general_manager'],
      companyStampLabel: settings.company.name,
      metadata: `إيصال رقم: ${data.receiptNumber} | ${settings.company.name}`,
    },
  };

  DocumentRenderer.renderToPDF(model);
}

// ============================================================
// Owner Statement PDF Template
// ============================================================

export function renderOwnerStatementPdf(data: OwnerStatementData, settings: DocumentSettings): void {
  const model: UnifiedDocumentModel = {
    type: 'owner_statement',
    fileName: `owner-statement-${data.ownerName}`,
    header: {
      companyName: settings.company.name,
      companyAddress: settings.company.address ?? '',
      companyPhone: settings.company.phone ?? '',
      title: `كشف حساب مالك - ${data.ownerName}`,
      documentNo: data.ownerName,
      dateLabel: 'الفترة',
      dateValue: `${formatDate(data.periodFrom)} - ${formatDate(data.periodTo)}`,
    },
    kpis: [
      { label: 'اسم المالك', value: data.ownerName },
      { label: 'رقم الهاتف', value: data.ownerPhone || '—' },
      { label: 'العقار', value: data.propertyTitle },
      { label: 'إجمالي الإيجارات', value: formatMoney(data.totalRent, settings.currencySymbol) },
      { label: 'إجمالي المصروفات', value: formatMoney(data.totalExpenses, settings.currencySymbol) },
      { label: 'العمولة', value: formatMoney(data.totalCommission, settings.currencySymbol) },
    ],
    tables: [
      {
        title: 'كشف الحركة المالية',
        columns: ['التاريخ', 'النوع', 'الوصف', 'المبلغ'],
        rows: data.transactions.map((t) => [
          t.date,
          t.type,
          t.description,
          formatMoney(t.amount, settings.currencySymbol),
        ]),
        totals: ['صافي المستحق', '', '', formatMoney(data.netAmount, settings.currencySymbol)],
      },
    ],
    footer: {
      signatures: ['accountant', 'general_manager'],
      companyStampLabel: settings.company.name,
      metadata: `كشف حساب مالك: ${data.ownerName} | ${settings.company.name}`,
    },
  };

  DocumentRenderer.renderToPDF(model);
}

// ============================================================
// Report PDF Template
// ============================================================

export function renderReportPdf(data: ReportDocumentData, settings: DocumentSettings): void {
  const tables = data.sections.map((section) => ({
    title: section.title,
    columns: section.rows.map((row) => row.label),
    rows: [section.rows.map((row) => String(row.value))],
    totals: section.totals,
  }));

  const model: UnifiedDocumentModel = {
    type: 'report',
    fileName: `report-${data.reportType}-${toLocalDateString(new Date())}`,
    header: {
      companyName: settings.company.name,
      companyAddress: settings.company.address ?? '',
      companyPhone: settings.company.phone ?? '',
      title: data.reportTitle,
      documentNo: data.reportType,
      dateLabel: 'الفترة',
      dateValue: `${formatDate(data.periodFrom)} - ${formatDate(data.periodTo)}`,
    },
    kpis: data.totalSummary ? [{ label: 'الملخص', value: data.totalSummary }] : [],
    tables,
    footer: {
      signatures: ['accountant', 'general_manager'],
      companyStampLabel: settings.company.name,
      metadata: `${data.reportTitle} | ${settings.company.name}`,
    },
  };

  DocumentRenderer.renderToPDF(model);
}

// ============================================================
// Export All Document Templates
// ============================================================

export const DocumentTemplates = {
  renderContractPdf,
  renderInvoicePdf,
  renderReceiptPdf,
  renderOwnerStatementPdf,
  renderReportPdf,
};

export default DocumentTemplates;
