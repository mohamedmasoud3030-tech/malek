import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnifiedDocumentModel } from './types';

vi.mock('./DocumentRenderer', () => {
  class DocumentRenderError extends Error {
    constructor(message: string, public readonly cause?: unknown) {
      super(message);
      this.name = 'DocumentRenderError';
    }
  }

  return {
    DocumentRenderError,
    DocumentRenderer: {
      printDocument: vi.fn(async () => undefined),
      downloadDocumentPdf: vi.fn(async () => undefined),
    },
  };
});

const settings = {
  company: {
    name: 'Rentrix LLC',
    address: 'Sohar, Oman',
    phone: '+968 0000 0000',
    email: 'ops@rentrix.test',
    taxNumber: 'VAT-100',
    registrationNumber: 'CR-200',
  },
  currency: 'OMR',
  currencySymbol: 'ر.ع',
};

async function renderer() {
  return (await import('./DocumentRenderer')).DocumentRenderer as {
    printDocument: ReturnType<typeof vi.fn>;
    downloadDocumentPdf: ReturnType<typeof vi.fn>;
  };
}

async function templates() {
  return import('./DocumentTemplates');
}

function lastPrintedModel(mock: ReturnType<typeof vi.fn>): UnifiedDocumentModel {
  return mock.mock.calls.at(-1)?.[0] as UnifiedDocumentModel;
}

describe('DocumentTemplates print/PDF pairs', () => {
  beforeEach(async () => {
    const r = await renderer();
    r.printDocument.mockClear();
    r.downloadDocumentPdf.mockClear();
  });

  it('routes print and PDF through distinct renderer methods with real document content', async () => {
    const t = await templates();
    const r = await renderer();

    await t.printInvoiceDocument({
      invoiceNumber: 'INV-100',
      tenantName: 'أحمد علي',
      propertyName: 'برج صحار',
      unitNumber: 'A-1',
      description: 'إيجار شهر يوليو',
      amount: 100,
      vatAmount: 5,
      totalAmount: 105,
      issueDate: '2026-07-01',
      dueDate: '2026-07-31',
    }, settings);
    expect(r.printDocument).toHaveBeenCalledTimes(1);
    expect(r.downloadDocumentPdf).not.toHaveBeenCalled();
    const invoiceModel = lastPrintedModel(r.printDocument);
    expect(invoiceModel.fileName).toBe('invoice-INV-100');
    expect(invoiceModel.header.companyName).toBe('Rentrix LLC');
    expect(invoiceModel.header.title).toContain('فاتورة');
    expect(invoiceModel.kpis.map((kpi) => kpi.value)).toEqual(expect.arrayContaining(['أحمد علي', 'برج صحار / A-1']));
    expect(invoiceModel.tables[0].rows.flat()).toEqual(expect.arrayContaining(['إيجار شهر يوليو', '100.000 ر.ع', '5.000 ر.ع']));

    await t.downloadInvoicePdf({
      invoiceNumber: 'INV-100',
      tenantName: 'أحمد علي',
      propertyName: 'برج صحار',
      unitNumber: 'A-1',
      description: 'إيجار شهر يوليو',
      amount: 100,
      vatAmount: 5,
      totalAmount: 105,
      issueDate: '2026-07-01',
      dueDate: '2026-07-31',
    }, settings);
    expect(r.downloadDocumentPdf).toHaveBeenCalledTimes(1);
    expect(lastPrintedModel(r.downloadDocumentPdf).fileName).toBe('invoice-INV-100');
  });

  it('builds contract, receipt, owner statement, tenant statement, and report models with required print/PDF actions', async () => {
    const t = await templates();
    const r = await renderer();

    await t.printContractDocument({
      contractId: 'contract-1',
      contractNumber: 'CON-1',
      contractStatus: 'active',
      tenantName: 'سالم',
      tenantPhone: '9000',
      tenantEmail: 'tenant@example.test',
      tenantNationalId: 'ID-1',
      propertyName: 'برج صحار',
      unitNumber: 'A-1',
      ownerName: 'مالك',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmount: 500,
      paymentCycle: 'monthly',
      notes: 'شرط خاص',
    }, settings);
    expect(lastPrintedModel(r.printDocument).header.title).toContain('ساري المفعول');
    expect(lastPrintedModel(r.printDocument).footer.signatures).toEqual(['owner', 'tenant', 'accountant', 'general_manager']);

    await t.downloadReceiptPdf({
      receiptNumber: 'REC-1',
      paymentDate: '2026-07-25',
      tenantName: 'سالم',
      propertyName: 'برج صحار',
      unitNumber: 'A-1',
      invoiceNumber: 'INV-1',
      amount: 250,
      paymentMethod: 'تحويل بنكي',
      reference: 'TRX-1',
    }, settings);
    expect(lastPrintedModel(r.downloadDocumentPdf).header.title).toContain('إيصال');
    expect(lastPrintedModel(r.downloadDocumentPdf).tables[0].totals).toEqual(['المبلغ الإجمالي المقبوض', '250.000 ر.ع']);

    await t.printOwnerStatementDocument({
      ownerName: 'مالك العقار',
      periodFrom: '2026-07-01',
      periodTo: '2026-07-31',
      propertyTitle: 'برج صحار',
      totalRent: 1000,
      totalExpenses: 100,
      totalCommission: 50,
      netAmount: 850,
      transactions: [{ date: '2026-07-10', type: 'تحصيل', description: 'إيجار', amount: 1000 }],
    }, settings);
    expect(lastPrintedModel(r.printDocument).header.title).toContain('كشف حساب مالك');

    await t.downloadTenantStatementPdf({
      tenantName: 'مستأجر',
      periodFrom: '2026-07-01',
      periodTo: '2026-07-31',
      propertyTitle: 'برج صحار',
      unitNumber: 'A-1',
      openingBalance: 0,
      totalInvoiced: 500,
      totalPaid: 250,
      closingBalance: 250,
      lines: [{ date: '2026-07-01', type: 'فاتورة', description: 'إيجار', debit: 500, credit: 0, balance: 500 }],
    }, settings);
    expect(lastPrintedModel(r.downloadDocumentPdf).header.title).toContain('كشف حساب مستأجر');

    await t.printReportDocument({
      reportTitle: 'تقرير تجريبي',
      reportType: 'QA_Report',
      periodFrom: '2026-07-01',
      periodTo: '2026-07-31',
      sections: [{ title: 'الملخص', rows: [{ label: 'الإجمالي', value: '100 ر.ع' }], totals: ['الإجمالي', '100 ر.ع'] }],
      totalSummary: 'جاهز',
    }, settings);
    expect(lastPrintedModel(r.printDocument).header.title).toBe('تقرير تجريبي');
    expect(lastPrintedModel(r.printDocument).tables[0].title).toBe('الملخص');
  });

  it('blocks every document operation when real company settings are missing', async () => {
    const t = await templates();
    const r = await renderer();

    await expect(t.printReportDocument({
      reportTitle: 'تقرير',
      reportType: 'Missing_Settings',
      periodFrom: '2026-07-01',
      periodTo: '2026-07-31',
      sections: [{ title: 'x', rows: [] }],
    }, { company: { name: '' }, currency: '' })).rejects.toThrow(/بيانات هوية الشركة غير مكتملة/);
    expect(r.printDocument).not.toHaveBeenCalled();
    expect(r.downloadDocumentPdf).not.toHaveBeenCalled();
  });
});

describe('accounting PDF templates', () => {
  beforeEach(async () => {
    const r = await renderer();
    r.printDocument.mockClear();
    r.downloadDocumentPdf.mockClear();
  });

  it('builds dedicated trial balance, income statement, and balance sheet models', async () => {
    const t = await templates();
    const r = await renderer();

    await t.printTrialBalanceDocument({
      asOf: '2026-07-31',
      accounts: [
        { code: '1111', name: 'الصندوق', balanceType: 'debit', balance: 100 },
        { code: '4000', name: 'إيرادات الإيجار', balanceType: 'credit', balance: 100 },
      ],
      totalDebits: 100,
      totalCredits: 100,
      isBalanced: true,
    }, settings);
    expect(lastPrintedModel(r.printDocument).type).toBe('trial_balance');
    expect(lastPrintedModel(r.printDocument).header.title).toBe('ميزان المراجعة');
    expect(lastPrintedModel(r.printDocument).tables[0].columns).toEqual(['رقم الحساب', 'اسم الحساب', 'طبيعة الرصيد', 'مدين', 'دائن']);

    await t.downloadIncomeStatementPdf({
      periodFrom: '2026-07-01',
      periodTo: '2026-07-31',
      revenue: [{ label: 'إيرادات الإيجار', amount: 500 }],
      expenses: [{ label: 'صيانة', amount: 125 }],
      totalRevenue: 500,
      totalExpenses: 125,
      netIncome: 375,
    }, settings);
    expect(lastPrintedModel(r.downloadDocumentPdf).type).toBe('income_statement');
    expect(lastPrintedModel(r.downloadDocumentPdf).header.title).toBe('قائمة الدخل');
    expect(lastPrintedModel(r.downloadDocumentPdf).tables.map((table) => table.title)).toEqual(['الإيرادات', 'المصروفات', 'صافي النتيجة']);

    await t.downloadBalanceSheetPdf({
      asOf: '2026-07-31',
      assets: [{ name: 'النقدية', amount: 1000 }],
      liabilities: [{ name: 'ذمم دائنة', amount: 250 }],
      equity: [{ name: 'رأس المال', amount: 750 }],
      totalAssets: 1000,
      totalLiabilities: 250,
      totalEquity: 750,
    }, settings);
    expect(lastPrintedModel(r.downloadDocumentPdf).type).toBe('balance_sheet');
    expect(lastPrintedModel(r.downloadDocumentPdf).header.title).toBe('قائمة المركز المالي');
    expect(lastPrintedModel(r.downloadDocumentPdf).tables.map((table) => table.title)).toEqual(['الأصول', 'الالتزامات', 'حقوق الملكية']);
  });
});
