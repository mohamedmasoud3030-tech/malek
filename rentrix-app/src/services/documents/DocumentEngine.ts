import type { Contract, Expense, Invoice, Person, Property, Receipt, Unit } from '@/types/domain';
import { getCurrencySymbol, getCurrencyWordConfig, numberToArabicWords } from '@/lib/numberToArabicWords';
import { TableGenerator } from './TableGenerator';
import type { DocumentCompanyIdentity, DocumentRequest, SignatureRole, UnifiedDocumentModel } from './types';

/**
 * Company identity is a required input, never a fallback. Every document
 * builder reads real values from this object (sourced from `company_settings`
 * via `useCompanySettingsContract()`); there is no built-in company name,
 * address, phone, or currency anywhere in this file. If the caller has not
 * loaded settings yet, `DocumentEngine.build` throws instead of rendering
 * placeholder branding.
 */
export type DocumentSettings = { company: DocumentCompanyIdentity };

type AppLikeDb = {
  settings: DocumentSettings;
  contracts: Contract[];
  tenants: Person[];
  units: Unit[];
  properties: Property[];
  receipts?: Receipt[];
};

export type OwnerStatementDataPayload = {
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
};

export type TenantStatementDataPayload = {
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
};

export type TrialBalancePayload = {
  trial: {
    lines: Array<{ no: string; name: string; debit: number; credit: number }>;
    totalDebit: number;
    totalCredit: number;
  };
  endDate: string;
};

export type IncomeStatementPayload = {
  pnlData: {
    totalRevenue: number;
    totalExpense: number;
    netIncome: number;
    revenues: Array<{ label: string; amount: number }>;
    expenses: Array<{ label: string; amount: number }>;
  };
  dateRange: string;
};

export type BalanceSheetPayload = {
  data: {
    assets: Array<{ label: string; amount: number }>;
    liabilities: Array<{ label: string; amount: number }>;
    equity: Array<{ label: string; amount: number }>;
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
  };
  date: string;
};

/**
 * Thrown when a document is requested without a usable company identity.
 * Callers (page components) should catch this and show a clear Arabic
 * message instead of letting a document render with placeholder branding.
 */
export class MissingCompanyIdentityError extends Error {
  constructor() {
    super('لا يمكن إنشاء المستند: بيانات هوية الشركة غير مكتملة. يرجى إكمال بيانات الشركة في الإعدادات أولاً.');
    this.name = 'MissingCompanyIdentityError';
  }
}

const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString('ar-OM') : '-');

function assertCompanyIdentity(settings: DocumentSettings): DocumentCompanyIdentity {
  const company = settings?.company;
  if (!company || !company.companyName?.trim() || !company.defaultCurrency?.trim()) {
    throw new MissingCompanyIdentityError();
  }
  return company;
}

const currencyOf = (s: DocumentSettings) => getCurrencySymbol(assertCompanyIdentity(s).defaultCurrency);
const wordsOf = (amount: number, s: DocumentSettings) =>
  numberToArabicWords(amount, getCurrencyWordConfig(assertCompanyIdentity(s).defaultCurrency));

const toMoney = (value: number, s: DocumentSettings) =>
  `${Number.isFinite(value) ? value.toLocaleString('ar-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : '0.000'} ${currencyOf(s)}`;

const baseHeader = (s: DocumentSettings, title: string, dateValue?: string, documentNo?: string) => {
  const company = assertCompanyIdentity(s);
  return {
    companyName: company.companyName,
    companyAddress: company.address ?? null,
    companyPhone: company.phone ?? null,
    companyEmail: company.email ?? null,
    companyLogoUrl: company.logoUrl ?? null,
    companyTaxNumber: company.taxNumber ?? null,
    companyRegistrationNumber: company.registrationNumber ?? null,
    title,
    documentNo,
    dateLabel: 'التاريخ',
    dateValue,
    currency: currencyOf(s),
  };
};

const formatDocumentValue = (value: unknown): string => {
  if (value == null) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '—' : value.toLocaleDateString('ar-OM');
  if (Array.isArray(value) || typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '—';
    }
  }
  return '—';
};

const kpi = (label: string, value: unknown) => ({ label, value: formatDocumentValue(value) });

/**
 * The stamp/footer label must not claim the document carries a real
 * approval unless real signature/approval data exists on the model. The
 * caller is responsible for only requesting a stamp label when a real
 * company stamp identity is available; this helper never invents wording
 * like "معتمد آلياً" that implies an automated approval took place.
 */
const footer = (signatures: SignatureRole[], metadata?: string | null) => ({
  signatures,
  companyStampLabel: null,
  metadata: metadata ?? null,
});

const fileName = (prefix: string, id: string | null, fallback: string) => `${prefix}_${id || fallback}`;

const resolveContractContext = (db: AppLikeDb, contractId: string | null) => {
  const contract = db.contracts.find((c) => c.id === contractId);
  const tenant = contract ? db.tenants.find((t) => t.id === contract.tenant_id) : null;
  const unit = contract ? db.units.find((u) => u.id === contract.unit_id) : null;
  const property = unit ? db.properties.find((p) => p.id === unit.property_id) : null;
  return { contract, tenant, unit, property };
};

/**
 * A contract is only "تنفيذي" (executed/in-force) once real activation
 * data marks it as such. We label strictly from `contract.status` instead
 * of assuming every printed contract is executed.
 */
const contractStatusTitle = (status: Contract['status']): string => {
  switch (status) {
    case 'active':
      return 'عقد إيجار ساري المفعول';
    case 'draft':
      return 'مسودة عقد إيجار (غير موقّع)';
    case 'expired':
      return 'عقد إيجار منتهي';
    case 'terminated':
      return 'عقد إيجار مفسوخ';
    default:
      return 'عقد إيجار';
  }
};

class DocumentEngine {
  build(request: DocumentRequest): UnifiedDocumentModel {
    switch (request.type) {
      case 'invoice':
        return this.buildInvoice(request.payload as { invoice: Invoice; db: AppLikeDb });
      case 'contract':
        return this.buildContract(request.payload as { contract: Contract; db: AppLikeDb });
      case 'receipt':
        return this.buildReceipt(request.payload as { receipt: Receipt; db: AppLikeDb });
      case 'expense_voucher':
      case 'payment':
        return this.buildExpense(request.payload as { expense: Expense; db: AppLikeDb });
      case 'owner_statement':
        return this.buildOwnerStatement(request.payload as { data: OwnerStatementDataPayload; db: AppLikeDb });
      case 'tenant_statement':
        return this.buildTenantStatement(request.payload as { data: TenantStatementDataPayload; db: AppLikeDb });
      case 'trial_balance':
        return this.buildTrialBalance(request.payload as TrialBalancePayload & { db: AppLikeDb });
      case 'income_statement':
        return this.buildIncomeStatement(request.payload as IncomeStatementPayload & { db: AppLikeDb });
      case 'balance_sheet':
        return this.buildBalanceSheet(request.payload as BalanceSheetPayload & { db: AppLikeDb });
      default:
        throw new Error(`Unsupported document type: ${request.type}`);
    }
  }

  private buildInvoice({ invoice, db }: { invoice: Invoice; db: AppLikeDb }): UnifiedDocumentModel {
    const { tenant, unit, property } = resolveContractContext(db, invoice.contract_id);
    const total = invoice.amount || 0;
    const paid = invoice.paid_amount || 0;
    const remaining = Math.max(0, total - paid);

    return {
      type: 'invoice',
      header: baseHeader(db.settings, 'فاتورة مطالبة مالية', fmtDate(invoice.due_date), invoice.id.slice(0, 8)),
      kpis: [
        kpi('المستأجر', tenant?.full_name),
        kpi('العقار / الوحدة', `${property?.title || '—'} / ${unit?.unit_number || '—'}`),
        kpi('تاريخ الاستحقاق', fmtDate(invoice.due_date)),
        kpi('حالة السداد', invoice.status === 'PAID' ? 'مدفوعة بالكامل' : invoice.status === 'PARTIALLY_PAID' ? 'مدفوعة جزئياً' : 'مستحقة السداد'),
      ],
      tables: [
        TableGenerator.build(
          ['البيان / تفاصيل المطالبة', 'المبلغ'],
          [
            ['قيمة الإيجار المستحق', toMoney(invoice.amount || 0, db.settings)],
            ['إجمالي المدفوع حتى تاريخه', toMoney(paid, db.settings)],
            ['المبلغ المتبقي واجب السداد', toMoney(remaining, db.settings)],
          ],
          ['المبلغ الإجمالي المطلوب', toMoney(total, db.settings)],
        ),
      ],
      footer: footer(['tenant', 'accountant', 'general_manager'], `فاتورة رقم: ${invoice.id.slice(0, 8)}`),
      fileName: fileName('invoice', invoice.id.slice(0, 8), invoice.id),
    };
  }

  private buildContract({ contract, db }: { contract: Contract; db: AppLikeDb }): UnifiedDocumentModel {
    const tenant = db.tenants.find((t) => t.id === contract.tenant_id);
    const unit = db.units.find((u) => u.id === contract.unit_id);
    const property = unit ? db.properties.find((p) => p.id === unit.property_id) : null;

    return {
      type: 'contract',
      header: baseHeader(db.settings, contractStatusTitle(contract.status), fmtDate(contract.start_date), contract.id.slice(0, 8)),
      kpis: [
        kpi('اسم المستأجر', tenant?.full_name),
        kpi('رقم الهوية / السجل', tenant?.national_id || '—'),
        kpi('العقار والوحدة', `${property?.title || '—'} / ${unit?.unit_number || '—'}`),
        kpi('تاريخ بداية العقد', fmtDate(contract.start_date)),
        kpi('تاريخ نهاية العقد', fmtDate(contract.end_date)),
        kpi('حالة العقد', contract.status === 'active' ? 'ساري المفعول' : contract.status),
      ],
      tables: [
        TableGenerator.build(
          ['بند العقد', 'التفاصيل المالية والقانونية'],
          [
            ['قيمة الإيجار المتفق عليها', toMoney(contract.rent_amount || 0, db.settings)],
            ['دورة ودفعات السداد', String(contract.payment_cycle || '—')],
            ['المبلغ بالحروف', wordsOf(contract.rent_amount || 0, db.settings)],
            ['ملاحظات وأحكام خاصة', contract.notes || 'لا يوجد'],
          ],
        ),
      ],
      footer: footer(['owner', 'tenant', 'accountant', 'general_manager'], `رقم العقد: ${contract.id.slice(0, 8)}`),
      fileName: fileName('contract', contract.id.slice(0, 8), contract.id),
    };
  }

  private buildReceipt({ receipt, db }: { receipt: Receipt; db: AppLikeDb }): UnifiedDocumentModel {
    const invoice = receipt.invoices?.[0];
    const { tenant, unit, property } = invoice
      ? resolveContractContext(db, invoice.contract_id)
      : { tenant: undefined, unit: undefined, property: undefined };

    const amountInWords = wordsOf(receipt.amount || 0, db.settings);
    const receiptNo = receipt.id.slice(0, 8);

    return {
      type: 'receipt',
      header: baseHeader(db.settings, 'إيصال استلام نقدية / سداد', fmtDate(receipt.payment_date), receiptNo),
      kpis: [
        kpi('استلمنا من الفاضل / الفاضلة', tenant?.full_name || 'غير محدد'),
        kpi('العقار والوحدة', property ? `${property.title} / ${unit?.unit_number || '—'}` : '—'),
        kpi('طريقة السداد', receipt.payment_method === 'cash' ? 'نقداً' : receipt.payment_method === 'bank_transfer' ? 'تحويل بنكي' : receipt.payment_method === 'check' ? 'شيك' : receipt.payment_method),
        kpi('رقم المرجع / الشيك', receipt.reference_number || '—'),
      ],
      tables: [
        TableGenerator.build(
          ['البند', 'المبلغ والمعلومات التفصيلية'],
          [
            ['المبلغ المستلم رقماً', toMoney(receipt.amount || 0, db.settings)],
            ['المبلغ المستلم بالحروف', amountInWords],
            ['ذلك عن / مقابل', receipt.notes || `سداد دفعة إيجارية مرتبطة بالإيصال ${receiptNo}`],
          ],
          ['إجمالي المقبوضات', toMoney(receipt.amount || 0, db.settings)],
        ),
      ],
      footer: footer(['tenant', 'accountant', 'general_manager'], `إيصال استلام رقم: ${receiptNo}`),
      fileName: fileName('receipt', receiptNo, receipt.id),
    };
  }

  private buildExpense({ expense, db }: { expense: Expense; db: AppLikeDb }): UnifiedDocumentModel {
    const property = db.properties.find((p) => p.id === expense.property_id);

    return {
      type: 'expense_voucher',
      header: baseHeader(db.settings, 'سند صرف مصروفات', fmtDate(expense.expense_date), expense.id.slice(0, 8)),
      kpis: [
        kpi('تصنيف المصروف', expense.category),
        kpi('العقار المرتبط', property?.title || 'مصروفات تشغيلية عامة'),
        kpi('تاريخ الصرف', fmtDate(expense.expense_date)),
      ],
      tables: [
        TableGenerator.build(
          ['بيان المصروف', 'القيمة المالية'],
          [
            ['المبلغ المصروف', toMoney(expense.amount || 0, db.settings)],
            ['المبلغ بالحروف', wordsOf(expense.amount || 0, db.settings)],
            ['شرح وتفاصيل المصروف', expense.description || '—'],
          ],
        ),
      ],
      footer: footer(['accountant', 'general_manager'], `سند صرف رقم: ${expense.id.slice(0, 8)}`),
      fileName: fileName('expense', expense.id.slice(0, 8), expense.id),
    };
  }

  private buildOwnerStatement({ data, db }: { data: OwnerStatementDataPayload; db: AppLikeDb }): UnifiedDocumentModel {
    return {
      type: 'owner_statement',
      header: baseHeader(db.settings, `كشف حساب مالك - ${data.ownerName}`, `${fmtDate(data.periodFrom)} - ${fmtDate(data.periodTo)}`, data.ownerName),
      kpis: [
        kpi('اسم المالك', data.ownerName),
        kpi('العقار', data.propertyTitle),
        kpi('إجمالي الإيجارات المقبوضة', toMoney(data.totalRent, db.settings)),
        kpi('إجمالي المصروفات والاستقطاعات', toMoney(data.totalExpenses, db.settings)),
        kpi('عمولة إدارة الأملاك', toMoney(data.totalCommission, db.settings)),
        kpi('صافي المستحق للمالك', toMoney(data.netAmount, db.settings)),
      ],
      tables: [
        TableGenerator.build(
          ['التاريخ', 'نوع الحركة', 'البيان / التفاصيل', 'المبلغ'],
          data.transactions.map((t) => [
            t.date,
            t.type,
            t.description,
            toMoney(t.amount, db.settings),
          ]),
          ['صافي المبلغ النهائي المستحق للمالك', '', '', toMoney(data.netAmount, db.settings)],
        ),
      ],
      footer: footer(['accountant', 'general_manager'], `كشف حساب مالك: ${data.ownerName}`),
      fileName: fileName('owner_statement', data.ownerName, 'statement'),
    };
  }

  private buildTenantStatement({ data, db }: { data: TenantStatementDataPayload; db: AppLikeDb }): UnifiedDocumentModel {
    return {
      type: 'tenant_statement',
      header: baseHeader(db.settings, `كشف حساب مستأجر - ${data.tenantName}`, `${fmtDate(data.periodFrom)} - ${fmtDate(data.periodTo)}`, data.tenantName),
      kpis: [
        kpi('اسم المستأجر', data.tenantName),
        kpi('العقار والوحدة', `${data.propertyTitle} / ${data.unitNumber}`),
        kpi('الرصيد الافتتاحي', toMoney(data.openingBalance, db.settings)),
        kpi('إجمالي المطالبات / الفواتير', toMoney(data.totalInvoiced, db.settings)),
        kpi('إجمالي المسدد / المقبوضات', toMoney(data.totalPaid, db.settings)),
        kpi('الرصيد النهائي المستحق', toMoney(data.closingBalance, db.settings)),
      ],
      tables: [
        TableGenerator.build(
          ['التاريخ', 'النوع', 'البيان', 'مدين (مطالبة)', 'دائن (سداد)', 'الرصيد المتبقي'],
          data.lines.map((l) => [
            l.date,
            l.type,
            l.description,
            toMoney(l.debit, db.settings),
            toMoney(l.credit, db.settings),
            toMoney(l.balance, db.settings),
          ]),
          ['إجمالي الذمم والمال المتبقي', '', '', '', '', toMoney(data.closingBalance, db.settings)],
        ),
      ],
      footer: footer(['tenant', 'accountant', 'general_manager'], `كشف حساب مستأجر: ${data.tenantName}`),
      fileName: fileName('tenant_statement', data.tenantName, 'statement'),
    };
  }

  private buildTrialBalance({ trial, endDate, db }: TrialBalancePayload & { db: AppLikeDb }): UnifiedDocumentModel {
    return {
      type: 'trial_balance',
      header: baseHeader(db.settings, 'قائمة ميزان المراجعة المحاسبي', fmtDate(endDate)),
      kpis: [
        kpi('إجمالي الحركة المدينة', toMoney(trial.totalDebit, db.settings)),
        kpi('إجمالي الحركة الدائنة', toMoney(trial.totalCredit, db.settings)),
        kpi('حالة التوازن المحاسبي', trial.totalDebit === trial.totalCredit ? 'متوازن' : 'غير متوازن'),
      ],
      tables: [
        TableGenerator.build(
          ['رقم الحساب', 'اسم الحساب المحاسبي', `مدين (${currencyOf(db.settings)})`, `دائن (${currencyOf(db.settings)})`],
          trial.lines.map((l) => [l.no, l.name, toMoney(l.debit, db.settings), toMoney(l.credit, db.settings)]),
          ['الإجمالي العام', '', toMoney(trial.totalDebit, db.settings), toMoney(trial.totalCredit, db.settings)],
        ),
      ],
      footer: footer(['accountant', 'general_manager'], 'قائمة ميزان المراجعة المحاسبي'),
      fileName: fileName('trial_balance', endDate, 'report'),
    };
  }

  private buildIncomeStatement({ pnlData, dateRange, db }: IncomeStatementPayload & { db: AppLikeDb }): UnifiedDocumentModel {
    return {
      type: 'income_statement',
      header: baseHeader(db.settings, 'تقرير قائمة الدخل والربحية', dateRange),
      kpis: [
        kpi('إجمالي الإيرادات التشغيلية', toMoney(pnlData.totalRevenue, db.settings)),
        kpi('إجمالي المصروفات والنفقات', toMoney(pnlData.totalExpense, db.settings)),
        kpi('صافي أرباح / خسائر الفترة', toMoney(pnlData.netIncome, db.settings)),
      ],
      tables: [
        TableGenerator.build(
          ['بند الإيرادات', `المبلغ (${currencyOf(db.settings)})`],
          pnlData.revenues.map((r) => [r.label, toMoney(r.amount, db.settings)]),
          ['إجمالي الإيرادات', toMoney(pnlData.totalRevenue, db.settings)],
        ),
        TableGenerator.build(
          ['بند المصروفات', `المبلغ (${currencyOf(db.settings)})`],
          pnlData.expenses.map((e) => [e.label, toMoney(e.amount, db.settings)]),
          ['إجمالي المصروفات', toMoney(pnlData.totalExpense, db.settings)],
        ),
      ],
      footer: footer(['accountant', 'general_manager'], 'تقرير قائمة الدخل والربحية'),
      fileName: fileName('income_statement', dateRange, 'report'),
    };
  }

  private buildBalanceSheet({ data, date, db }: BalanceSheetPayload & { db: AppLikeDb }): UnifiedDocumentModel {
    return {
      type: 'balance_sheet',
      header: baseHeader(db.settings, 'قائمة المركز المالي والميزانية العمومية', fmtDate(date)),
      kpis: [
        kpi('إجمالي الأصول', toMoney(data.totalAssets, db.settings)),
        kpi('إجمالي الالتزامات', toMoney(data.totalLiabilities, db.settings)),
        kpi('إجمالي حقوق الملكية', toMoney(data.totalEquity, db.settings)),
      ],
      tables: [
        TableGenerator.build(
          ['الأصول (الموجودات)', `القيمة (${currencyOf(db.settings)})`],
          data.assets.map((a) => [a.label, toMoney(a.amount, db.settings)]),
          ['إجمالي الأصول', toMoney(data.totalAssets, db.settings)],
        ),
        TableGenerator.build(
          ['الالتزامات وحقوق الملكية', `القيمة (${currencyOf(db.settings)})`],
          [
            ...data.liabilities.map((l) => [l.label, toMoney(l.amount, db.settings)]),
            ...data.equity.map((eq) => [eq.label, toMoney(eq.amount, db.settings)]),
          ],
          ['إجمالي الالتزامات وحقوق الملكية', toMoney(data.totalLiabilities + data.totalEquity, db.settings)],
        ),
      ],
      footer: footer(['accountant', 'general_manager'], 'قائمة المركز المالي والميزانية العمومية'),
      fileName: fileName('balance_sheet', date, 'report'),
    };
  }
}

export const documentEngine = new DocumentEngine();
