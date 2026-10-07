/**
 * Canonical document platform behavior.
 *
 * These tests protect user-visible truthfulness, identity, precision, output
 * safety, and the print/PDF service boundary through the single typed
 * `buildDocument` contract.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./DocumentController', () => ({
  DocumentController: {
    printDocument: vi.fn(async () => undefined),
    downloadDocumentPdf: vi.fn(async () => undefined),
    buildDocumentPdfFile: vi.fn(async () => new File([], 'x.pdf')),
  },
}));

import { DocumentController } from './DocumentController';
import { documentEngine } from './DocumentEngine';
import { MissingDocumentSettingsError, type DocumentCompanySettings } from './companyIdentity';
import { documentService, getDocumentCapability, listDocumentCapabilities } from './DocumentService';
import { collectDocumentTextChunks, escapeDocumentHtml } from './DocumentRenderer';
import type { CanonicalDocumentPayloadMap, DocumentTypeId } from './documentPayloads';

const settings: DocumentCompanySettings = { companyName: 'شركة الأفق لإدارة الأملاك', currency: 'OMR', currencySymbol: 'ر.ع', documentPrefixes: {} };
const emptySettings: DocumentCompanySettings = { companyName: '', currency: '', documentPrefixes: {} };

const tenantContext = { tenantName: 'أحمد بن سالم الحارثي', propertyTitle: 'برج الياسمين السكني', unitNumber: 'B-12' } as const;

const contractPayload: CanonicalDocumentPayloadMap['contract'] = {
  status: 'active',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  rentAmount: 1200,
  paymentCycle: 'monthly',
  ...tenantContext,
};

const invoicePayload: CanonicalDocumentPayloadMap['invoice'] = {
  issueDate: '2026-07-01',
  dueDate: '2026-07-31',
  amount: 1200,
  paidAmount: 1200,
  status: 'PAID',
  description: 'مطالبة إيجارية مستحقة',
  ...tenantContext,
};

const receiptPayload: CanonicalDocumentPayloadMap['receipt'] = {
  amount: 1200,
  paymentDate: '2026-07-25',
  paymentMethod: 'bank_transfer',
  paymentReference: 'TRX-9982',
  payerName: tenantContext.tenantName,
  propertyTitle: tenantContext.propertyTitle,
  unitNumber: tenantContext.unitNumber,
};

const expensePayload: CanonicalDocumentPayloadMap['expense_voucher'] = {
  date: '2026-07-15',
  category: 'صيانة',
  amount: 160.25,
  description: 'إصلاح مضخة المياه الرئيسية',
  propertyTitle: tenantContext.propertyTitle,
};

const statementData: CanonicalDocumentPayloadMap['owner_statement'] = {
  ownerName: 'مالك العقار',
  periodFrom: '2026-07-01',
  periodTo: '2026-07-31',
  propertyTitle: 'برج الياسمين السكني',
  totalRent: 1200,
  totalExpenses: 100,
  totalCommission: 60,
  netAmount: 1040,
  transactions: [{ date: '2026-07-10', type: 'تحصيل', description: 'إيجار يوليو', amount: 1200 }],
};

const tenantStatementData: CanonicalDocumentPayloadMap['tenant_statement'] = {
  tenantName: 'أحمد بن سالم الحارثي',
  periodFrom: '2026-07-01',
  periodTo: '2026-07-31',
  propertyTitle: 'برج الياسمين السكني',
  unitNumber: 'B-12',
  openingBalance: 0,
  totalInvoiced: 1200,
  totalPaid: 1200,
  closingBalance: 0,
  lines: [{ date: '2026-07-01', type: 'مطالبة', description: 'إيجار يوليو', debit: 1200, credit: 0, balance: 1200 }],
};

const trialBalancePayload: CanonicalDocumentPayloadMap['trial_balance'] = {
  asOf: '2026-07-31',
  lines: [{ no: '1111', name: 'الصندوق', debit: 500.5, credit: 0 }],
  totalDebit: 500.5,
  totalCredit: 0,
};

const incomeStatementPayload: CanonicalDocumentPayloadMap['income_statement'] = {
  dateRangeLabel: '2026-07-01 - 2026-07-31',
  revenues: [{ label: 'إيرادات الإيجار', amount: 1200 }],
  expenses: [{ label: 'صيانة', amount: 160 }],
  totalRevenue: 1200,
  totalExpense: 160,
  netIncome: 1040,
};

const balanceSheetPayload: CanonicalDocumentPayloadMap['balance_sheet'] = {
  asOf: '2026-07-31',
  assets: [{ label: 'النقدية', amount: 1000 }],
  liabilities: [{ label: 'ذمم دائنة', amount: 200 }],
  equity: [{ label: 'رأس المال', amount: 800 }],
  totalAssets: 1000,
  totalLiabilities: 200,
  totalEquity: 800,
};

const corePayloads = {
  invoice: invoicePayload,
  contract: contractPayload,
  receipt: receiptPayload,
  expense_voucher: expensePayload,
  owner_statement: statementData,
  tenant_statement: tenantStatementData,
  trial_balance: trialBalancePayload,
  income_statement: incomeStatementPayload,
  balance_sheet: balanceSheetPayload,
} as const satisfies Partial<CanonicalDocumentPayloadMap>;

type CorePayloadType = keyof typeof corePayloads;

function build<T extends CorePayloadType>(type: T, payload: CanonicalDocumentPayloadMap[T], companySettings: DocumentCompanySettings = settings) {
  return documentEngine.buildDocument(type as DocumentTypeId, { settings: companySettings, payload } as never);
}

function buildEachSupportedType() {
  return Object.fromEntries(
    (Object.keys(corePayloads) as CorePayloadType[]).map((type) => [type, build(type, corePayloads[type])]),
  ) as Record<CorePayloadType, ReturnType<typeof build>>;
}

describe('document platform behavior', () => {
  it('every supported document type builds a model carrying the real company identity', () => {
    const models = buildEachSupportedType();
    for (const [type, model] of Object.entries(models)) {
      expect(model.header.companyName, `${type} must echo real company name`).toBe(settings.companyName);
      expect(model.header.companyName, `${type} must never substitute the platform brand`).not.toBe('MALEK');
      expect(model.header.title.trim().length, `${type} needs a title`).toBeGreaterThan(0);
      expect(model.fileName.trim().length, `${type} needs a file name`).toBeGreaterThan(0);
    }
  });

  it('every document type refuses to render when company identity is incomplete', () => {
    for (const type of Object.keys(corePayloads) as CorePayloadType[]) {
      const attempt = () => build(type, corePayloads[type], emptySettings);
      expect(attempt, type).toThrow(MissingDocumentSettingsError);
      expect(attempt, type).toThrow(/بيانات هوية الشركة غير مكتملة/);
    }
  });

  it('status wording stays truthful for contracts, invoices, and trial balance', () => {
    const draft = build('contract', { ...contractPayload, status: 'draft' });
    expect(draft.header.title).toContain('مسودة');
    expect(draft.header.title).toContain('غير موقّع');

    expect(build('contract', { ...contractPayload, status: 'expired' }).header.title).toContain('منتهي');
    expect(build('contract', { ...contractPayload, status: 'terminated' }).header.title).toContain('مفسوخ');

    const paidInvoice = buildEachSupportedType().invoice;
    expect(paidInvoice.kpis.find((kpi) => kpi.label === 'حالة السداد')?.value).toBe('مدفوعة بالكامل');

    const unbalanced = build('trial_balance', trialBalancePayload);
    expect(unbalanced.kpis.find((kpi) => kpi.label === 'حالة التوازن المحاسبي')?.value).toBe('غير متوازن');
  });

  it('money keeps three-decimal OMR precision and clean negative rendering', () => {
    const receiptModel = build('receipt', { amount: 1200.5, paymentDate: '2026-07-25', paymentMethod: 'cash' });
    expect(receiptModel.tables[0].rows.flat().join(' ')).toContain('1,200.500 ر.ع');
    expect(receiptModel.tables[0].totals?.join(' ')).toContain('1,200.500 ر.ع');

    const expenseModel = build('expense_voucher', { category: 'تسوية', amount: -35.75, date: '2026-07-16' });
    expect(expenseModel.tables[0].rows.flat().join(' ')).toMatch(/-?35\.750 ر\.ع/);
  });

  it('escapes hostile user input before it can reach print HTML', () => {
    const xss = `<img src=x onerror=alert(1)><script>alert("2")</script>`;
    const hostileModel = build('expense_voucher', { category: xss, amount: 1, date: '2026-07-16', description: xss });

    for (const chunk of collectDocumentTextChunks(hostileModel)) {
      const escaped = escapeDocumentHtml(chunk);
      expect(escaped).not.toContain('<script>');
      expect(escaped).not.toContain('<img');
      expect(escaped.includes('<') ? escaped.includes('&lt;') : true).toBe(true);
    }
    expect(collectDocumentTextChunks(hostileModel).some((chunk) => chunk.includes('<script>'))).toBe(true);
    expect(escapeDocumentHtml(xss)).not.toMatch(/<script|<img/);
  });

  it('receipt shows the physical payment reference and the real receipt number only when they exist', () => {
    const receiptModel = build('receipt', { reference: 'REC-2026-0007', amount: 50, paymentDate: '2026-07-25', paymentMethod: 'check', paymentReference: 'CHK-4451' });
    expect(receiptModel.kpis.find((kpi) => kpi.label === 'رقم المرجع / الشيك')?.value).toBe('CHK-4451');
    expect(receiptModel.header.documentNo).toBe('REC-2026-0007');

    const unnumbered = build('receipt', { amount: 50, paymentDate: '2026-07-25', paymentMethod: 'cash' });
    expect(unnumbered.header.documentNo).toBeNull();
  });
});

describe('document service boundary', () => {
  beforeEach(() => {
    vi.mocked(DocumentController.printDocument).mockClear();
    vi.mocked(DocumentController.downloadDocumentPdf).mockClear();
  });

  it('exposes one capability entry per supported document type', () => {
    const capabilities = listDocumentCapabilities();
    expect(new Set(capabilities.map((capability) => capability.type)).size).toBe(capabilities.length);
    for (const capability of capabilities) {
      expect(capability.templateAvailable).toBe(true);
      expect(capability.externalProviderRequired).toBe(false);
    }
    expect(getDocumentCapability('generic_report')).toEqual({
      type: 'generic_report',
      templateAvailable: true,
      externalProviderRequired: false,
    });
    expect(getDocumentCapability('not_a_document')).toBeUndefined();
  });

  it('keeps printDocument and downloadDocumentPdf as two distinct operations', async () => {
    const input = { settings, payload: invoicePayload };

    await documentService.printDocument('invoice', input);
    expect(DocumentController.printDocument).toHaveBeenCalledTimes(1);
    expect(DocumentController.downloadDocumentPdf).not.toHaveBeenCalled();

    await documentService.downloadDocumentPdf('invoice', input);
    expect(DocumentController.downloadDocumentPdf).toHaveBeenCalledTimes(1);
    expect(DocumentController.printDocument).toHaveBeenCalledTimes(1);
  });

  it('rejects unsupported document types before touching the renderer', async () => {
    const unsupported = 'not_a_document' as DocumentTypeId;
    const input = { settings, payload: {} } as never;
    await expect(documentService.printDocument(unsupported, input)).rejects.toThrow(/Unsupported document type/);
    await expect(documentService.downloadDocumentPdf(unsupported, input)).rejects.toThrow(/Unsupported document type/);
    expect(DocumentController.printDocument).not.toHaveBeenCalled();
    expect(DocumentController.downloadDocumentPdf).not.toHaveBeenCalled();
  });
});
