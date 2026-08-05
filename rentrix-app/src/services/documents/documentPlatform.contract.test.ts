/**
 * Document platform contract lock (characterization tests).
 *
 * These tests lock the *externally visible* contracts of the document,
 * print, and PDF platform so the canonical-engine refactor can proceed
 * without silently changing truthfulness, identity, or output behavior:
 *
 *  - every supported document type builds a UnifiedDocumentModel that
 *    echoes the *real* company identity (never a platform brand name);
 *  - missing company identity always raises a visible Arabic error
 *    instead of rendering placeholder branding;
 *  - status wording stays truthful (draft contracts are drafts, paid
 *    invoices are paid, unbalanced trial balances are unbalanced);
 *  - OMR money keeps 3-decimal precision everywhere it is rendered;
 *  - every user-controlled string is HTML-escaped before print HTML;
 *  - `print` and `downloadPdf` stay two distinct service operations.
 *
 * The inventory behind these contracts lives in the platform PR
 * description (document type → caller → builder → paths → coverage).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./DocumentController', () => ({
  DocumentController: {
    print: vi.fn(async () => undefined),
    downloadPdf: vi.fn(async () => undefined),
  },
}));

import { DocumentController } from './DocumentController';
import { documentEngine, MissingCompanyIdentityError } from './DocumentEngine';
import { documentService, getDocumentCapability, listDocumentCapabilities } from './DocumentService';
import { collectDocumentTextChunks, escapeDocumentHtml } from './DocumentRenderer';
import type { Contract, Expense, Invoice, Person, Property, Receipt, Unit } from '@/types/domain';

const identity = { companyName: 'شركة الأفق لإدارة الأملاك', defaultCurrency: 'OMR' };

const db = {
  settings: { company: identity },
  contracts: [
    {
      id: '11111111-2222-3333-4444-555555555555',
      tenant_id: 'tenant-1',
      unit_id: 'unit-1',
      property_id: 'property-1',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      rent_amount: 1200,
      payment_cycle: 'monthly',
      status: 'active',
      notes: null,
    } as unknown as Contract,
  ],
  tenants: [{ id: 'tenant-1', full_name: 'أحمد بن سالم الحارثي' } as unknown as Person],
  units: [{ id: 'unit-1', property_id: 'property-1', unit_number: 'B-12' } as unknown as Unit],
  properties: [{ id: 'property-1', title: 'برج الياسمين السكني' } as unknown as Property],
};

const dbPayload = { db } as const;
const statementData = {
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

const tenantStatementData = {
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

const trialBalancePayload = {
  trial: {
    lines: [{ no: '1111', name: 'الصندوق', debit: 500.5, credit: 0 }],
    totalDebit: 500.5,
    totalCredit: 0,
  },
  endDate: '2026-07-31',
};

const incomeStatementPayload = {
  pnlData: {
    totalRevenue: 1200,
    totalExpense: 160,
    netIncome: 1040,
    revenues: [{ label: 'إيرادات الإيجار', amount: 1200 }],
    expenses: [{ label: 'صيانة', amount: 160 }],
  },
  dateRange: '2026-07-01 - 2026-07-31',
};

const balanceSheetPayload = {
  data: {
    assets: [{ label: 'النقدية', amount: 1000 }],
    liabilities: [{ label: 'ذمم دائنة', amount: 200 }],
    equity: [{ label: 'رأس المال', amount: 800 }],
    totalAssets: 1000,
    totalLiabilities: 200,
    totalEquity: 800,
  },
  date: '2026-07-31',
};

function buildEachSupportedType() {
  return {
    invoice: documentEngine.build({
      type: 'invoice',
      payload: {
        invoice: {
          id: 'inv-1',
          contract_id: db.contracts[0].id,
          issue_date: '2026-07-01',
          due_date: '2026-07-31',
          amount: 1200,
          paid_amount: 1200,
          status: 'PAID',
          notes: null,
        } as unknown as Invoice,
        ...dbPayload,
      },
    }),
    contract: documentEngine.build({ type: 'contract', payload: { contract: db.contracts[0], ...dbPayload } }),
    receipt: documentEngine.build({
      type: 'receipt',
      payload: {
        receipt: {
          id: 'rec-1',
          amount: 1200,
          payment_date: '2026-07-25',
          payment_method: 'bank_transfer',
          reference_number: 'TRX-9982',
          notes: null,
          invoices: [{ contract_id: db.contracts[0].id }],
        } as unknown as Receipt,
        ...dbPayload,
      },
    }),
    expense_voucher: documentEngine.build({
      type: 'expense_voucher',
      payload: {
        expense: {
          id: 'exp-1',
          property_id: 'property-1',
          category: 'صيانة',
          amount: 160.25,
          expense_date: '2026-07-15',
          description: 'إصلاح مضخة المياه الرئيسية',
        } as unknown as Expense,
        ...dbPayload,
      },
    }),
    owner_statement: documentEngine.build({ type: 'owner_statement', payload: { data: statementData, ...dbPayload } }),
    tenant_statement: documentEngine.build({ type: 'tenant_statement', payload: { data: tenantStatementData, ...dbPayload } }),
    trial_balance: documentEngine.build({ type: 'trial_balance', payload: { ...trialBalancePayload, ...dbPayload } }),
    income_statement: documentEngine.build({ type: 'income_statement', payload: { ...incomeStatementPayload, ...dbPayload } }),
    balance_sheet: documentEngine.build({ type: 'balance_sheet', payload: { ...balanceSheetPayload, ...dbPayload } }),
  } as const;
}

describe('document platform contracts — inventory lock', () => {
  it('every supported document type builds a model carrying the real company identity', () => {
    const models = buildEachSupportedType();
    for (const [type, model] of Object.entries(models)) {
      expect(model.header.companyName, `${type} must echo real company name`).toBe(identity.companyName);
      expect(model.header.companyName, `${type} must never substitute the platform brand`).not.toBe('MALEK');
      expect(model.header.title.trim().length, `${type} needs a title`).toBeGreaterThan(0);
      expect(model.fileName.trim().length, `${type} needs a file name`).toBeGreaterThan(0);
    }
  });

  it('every document type refuses to render when company identity is incomplete', () => {
    const emptyDb = { ...db, settings: { company: { companyName: '', defaultCurrency: '' } } };
    const attempts: Array<() => unknown> = [
      () => documentEngine.build({ type: 'invoice', payload: { invoice: { id: 'i', contract_id: db.contracts[0].id } as unknown as Invoice, db: emptyDb } }),
      () => documentEngine.build({ type: 'contract', payload: { contract: db.contracts[0], db: emptyDb } }),
      () => documentEngine.build({ type: 'receipt', payload: { receipt: { id: 'r', amount: 1 } as unknown as Receipt, db: emptyDb } }),
      () => documentEngine.build({ type: 'expense_voucher', payload: { expense: { id: 'e' } as unknown as Expense, db: emptyDb } }),
      () => documentEngine.build({ type: 'owner_statement', payload: { data: statementData, db: emptyDb } }),
      () => documentEngine.build({ type: 'tenant_statement', payload: { data: tenantStatementData, db: emptyDb } }),
      () => documentEngine.build({ type: 'trial_balance', payload: { ...trialBalancePayload, db: emptyDb } }),
      () => documentEngine.build({ type: 'income_statement', payload: { ...incomeStatementPayload, db: emptyDb } }),
      () => documentEngine.build({ type: 'balance_sheet', payload: { ...balanceSheetPayload, db: emptyDb } }),
    ];

    for (const attempt of attempts) {
      expect(attempt).toThrow(MissingCompanyIdentityError);
      expect(attempt).toThrow(/بيانات هوية الشركة غير مكتملة/);
    }
  });

  it('status wording stays truthful for contracts, invoices, and trial balance', () => {
    const draftContract = { ...db.contracts[0], status: 'draft' } as Contract;
    const expiredContract = { ...db.contracts[0], status: 'expired' } as Contract;
    const terminatedContract = { ...db.contracts[0], status: 'terminated' } as Contract;

    const draft = documentEngine.build({ type: 'contract', payload: { contract: draftContract, db } });
    expect(draft.header.title).toContain('مسودة');
    expect(draft.header.title).toContain('غير موقّع');

    expect(documentEngine.build({ type: 'contract', payload: { contract: expiredContract, db } }).header.title).toContain('منتهي');
    expect(documentEngine.build({ type: 'contract', payload: { contract: terminatedContract, db } }).header.title).toContain('مفسوخ');

    const paidInvoice = buildEachSupportedType().invoice;
    expect(paidInvoice.kpis.find((kpi) => kpi.label === 'حالة السداد')?.value).toBe('مدفوعة بالكامل');

    const unbalanced = documentEngine.build({ type: 'trial_balance', payload: { ...trialBalancePayload, db } });
    expect(unbalanced.kpis.find((kpi) => kpi.label === 'حالة التوازن المحاسبي')?.value).toBe('غير متوازن');
  });

  it('money keeps three-decimal OMR precision and clean negative rendering', () => {
    const receiptModel = documentEngine.build({
      type: 'receipt',
      payload: {
        receipt: { id: 'rec-2', amount: 1200.5, payment_date: '2026-07-25', payment_method: 'cash', reference_number: null, notes: null } as unknown as Receipt,
        db,
      },
    });
    expect(receiptModel.tables[0].rows.flat().join(' ')).toContain('1,200.500 ر.ع');
    expect(receiptModel.tables[0].totals?.join(' ')).toContain('1,200.500 ر.ع');

    const expenseModel = documentEngine.build({
      type: 'expense_voucher',
      payload: {
        expense: { id: 'exp-neg', property_id: null, category: 'تسوية', amount: -35.75, expense_date: '2026-07-16', description: null } as unknown as Expense,
        db,
      },
    });
    expect(expenseModel.tables[0].rows.flat().join(' ')).toMatch(/-?35\.750 ر\.ع/);
  });

  it('escapes hostile user input before it can reach print HTML', () => {
    const xss = `<img src=x onerror=alert(1)><script>alert("2")</script>`;
    const hostileModel = documentEngine.build({
      type: 'expense_voucher',
      payload: {
        expense: { id: 'exp-xss', property_id: null, category: xss, amount: 1, expense_date: '2026-07-16', description: xss } as unknown as Expense,
        db,
      },
    });

    for (const chunk of collectDocumentTextChunks(hostileModel)) {
      const escaped = escapeDocumentHtml(chunk);
      expect(escaped).not.toContain('<script>');
      expect(escaped).not.toContain('<img');
      expect(escaped.includes('<') ? escaped.includes('&lt;') : true).toBe(true);
    }
    // The raw model keeps original text; neutralization is the renderer's duty.
    expect(collectDocumentTextChunks(hostileModel).some((chunk) => chunk.includes('<script>'))).toBe(true);
    expect(escapeDocumentHtml(xss)).not.toMatch(/<script|<img/);
  });

  it('receipt uses the real business reference when one exists', () => {
    const receiptModel = documentEngine.build({
      type: 'receipt',
      payload: {
        receipt: {
          id: 'rec-3',
          amount: 50,
          payment_date: '2026-07-25',
          payment_method: 'check',
          reference_number: 'CHK-4451',
          notes: null,
        } as unknown as Receipt,
        db,
      },
    });
    expect(receiptModel.kpis.find((kpi) => kpi.label === 'رقم المرجع / الشيك')?.value).toBe('CHK-4451');
  });
});

describe('document service boundary — capability and path contracts', () => {
  beforeEach(() => {
    vi.mocked(DocumentController.print).mockClear();
    vi.mocked(DocumentController.downloadPdf).mockClear();
  });

  it('exposes one capability entry per supported document type', () => {
    const capabilities = listDocumentCapabilities();
    expect(new Set(capabilities.map((capability) => capability.type)).size).toBe(capabilities.length);
    for (const capability of capabilities) {
      expect(capability.templateAvailable).toBe(true);
      expect(capability.externalProviderRequired).toBe(false);
    }
    // The generic report is a first-class capability: real callers (reports
    // sections, deposits clearance, maintenance and utilities workspaces)
    // already print/export it through the compatibility adapters.
    expect(getDocumentCapability('generic_report')).toEqual({
      type: 'generic_report',
      templateAvailable: true,
      externalProviderRequired: false,
    });
    expect(getDocumentCapability('not_a_document')).toBeUndefined();
  });

  it('keeps print and downloadPdf as two distinct operations', async () => {
    const request = { type: 'invoice', payload: { marker: true } };

    await documentService.print(request);
    expect(DocumentController.print).toHaveBeenCalledTimes(1);
    expect(DocumentController.downloadPdf).not.toHaveBeenCalled();

    await documentService.downloadPdf(request);
    expect(DocumentController.downloadPdf).toHaveBeenCalledTimes(1);
    expect(DocumentController.print).toHaveBeenCalledTimes(1);
  });

  it('rejects unsupported document types before touching the renderer', async () => {
    await expect(documentService.print({ type: 'not_a_document', payload: {} })).rejects.toThrow(/Unsupported document type/);
    await expect(documentService.downloadPdf({ type: 'not_a_document', payload: {} })).rejects.toThrow(/Unsupported document type/);
    expect(DocumentController.print).not.toHaveBeenCalled();
    expect(DocumentController.downloadPdf).not.toHaveBeenCalled();
  });
});
