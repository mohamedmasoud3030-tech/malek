import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock,
}));

type QueryLogEntry = { table: string; method: string; args: unknown[] };
type TableResponses = Partial<Record<'invoices' | 'payments' | 'contracts' | 'expenses' | 'properties' | 'people' | 'units', unknown[]>>;

function createQueryBuilder(table: string, responses: TableResponses, log: QueryLogEntry[]) {
  const builder = {
    select: vi.fn((...args: unknown[]) => {
      log.push({ table, method: 'select', args });
      return builder;
    }),
    is: vi.fn((...args: unknown[]) => {
      log.push({ table, method: 'is', args });
      return builder;
    }),
    gte: vi.fn((...args: unknown[]) => {
      log.push({ table, method: 'gte', args });
      return builder;
    }),
    lte: vi.fn((...args: unknown[]) => {
      log.push({ table, method: 'lte', args });
      return builder;
    }),
    eq: vi.fn((...args: unknown[]) => {
      log.push({ table, method: 'eq', args });
      return builder;
    }),
    in: vi.fn((...args: unknown[]) => {
      log.push({ table, method: 'in', args });
      return builder;
    }),
    returns: vi.fn(async () => {
      log.push({ table, method: 'returns', args: [] });
      return { data: responses[table as keyof TableResponses] ?? [], error: null };
    }),
  };
  return builder;
}

function mockSupabaseTables(responses: TableResponses) {
  const log: QueryLogEntry[] = [];
  supabaseMock.from.mockImplementation((table: keyof TableResponses) => createQueryBuilder(table, responses, log));
  return log;
}


type ReportInvoiceFixture = Readonly<{ amount: number; paid_amount: number }>;
type ReportPaymentFixture = Readonly<{ amount: number; payment_date: string; payment_method: 'cash' | 'bank_transfer' | 'card' }>;
type ReportExpenseFixture = Readonly<{ amount: number }>;

function createReportInvoiceFixture(overrides: Partial<ReportInvoiceFixture> = {}): ReportInvoiceFixture {
  return { amount: 1000, paid_amount: 0, ...overrides };
}

function createReportPaymentFixture(overrides: Partial<ReportPaymentFixture> = {}): ReportPaymentFixture {
  return { amount: 300, payment_date: '2026-05-01', payment_method: 'cash', ...overrides };
}

function createReportExpenseFixture(amount: number): ReportExpenseFixture {
  return { amount };
}

describe('financialReportsService aggregation helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters invoices by date range, status, context, and deleted_at', async () => {
    const { filterInvoicesForReport } = await import('./financialReportsService');
    const invoices = [
      {
        id: 'inv_in_range',
        contract_id: 'contract_1',
        issue_date: '2026-05-10',
        due_date: '2026-05-30',
        amount: 100,
        paid_amount: 25,
        status: 'partial' as const,
        deleted_at: null,
        contracts: { id: 'contract_1', property_id: 'property_1', tenant_id: 'tenant_1' },
      },
      {
        id: 'inv_deleted',
        contract_id: 'contract_1',
        issue_date: '2026-05-11',
        due_date: '2026-05-30',
        amount: 100,
        paid_amount: 0,
        status: 'partial' as const,
        deleted_at: '2026-05-12',
        contracts: { id: 'contract_1', property_id: 'property_1', tenant_id: 'tenant_1' },
      },
      {
        id: 'inv_wrong_date',
        contract_id: 'contract_1',
        issue_date: '2026-06-01',
        due_date: '2026-06-30',
        amount: 100,
        paid_amount: 0,
        status: 'partial' as const,
        deleted_at: null,
        contracts: { id: 'contract_1', property_id: 'property_1', tenant_id: 'tenant_1' },
      },
      {
        id: 'inv_wrong_property',
        contract_id: 'contract_2',
        issue_date: '2026-05-12',
        due_date: '2026-05-30',
        amount: 100,
        paid_amount: 0,
        status: 'partial' as const,
        deleted_at: null,
        contracts: { id: 'contract_2', property_id: 'property_2', tenant_id: 'tenant_1' },
      },
    ];

    expect(filterInvoicesForReport(invoices, {
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
      propertyId: 'property_1',
      tenantId: 'tenant_1',
      status: 'partial',
    }).map((invoice) => invoice.id)).toEqual(['inv_in_range']);
  });

  it('uses financialMath helpers to safely aggregate invoice, payment, and expense values', async () => {
    const {
      summarizeInvoiceTotals,
      summarizePaymentTotals,
      summarizeExpenseTotals,
      summarizeOutstandingBalance,
    } = await import('./financialReportsService');

    expect(summarizeInvoiceTotals([
      { amount: '100' as unknown as number, paid_amount: '20' as unknown as number },
      { amount: Number.NaN, paid_amount: Number.POSITIVE_INFINITY },
      { amount: 50, paid_amount: 80 },
    ])).toEqual({ totalAmount: 150, totalPaid: 100, totalOutstanding: 80, invoicesCount: 3 });
    expect(summarizePaymentTotals([{ amount: 25 }, { amount: 'bad' as unknown as number }, { amount: '30.5' as unknown as number }])).toEqual({
      totalPaid: 55.5,
      paymentsCount: 3,
    });
    expect(summarizeExpenseTotals([{ amount: 10 }, { amount: null as unknown as number }])).toEqual({ totalExpenses: 10, expensesCount: 2 });
    expect(summarizeOutstandingBalance([
      { amount: 100, paid_amount: 40 },
      { amount: 50, paid_amount: 75 },
    ])).toEqual({ totalOutstanding: 60, invoicesCount: 1 });
  });


  it('groups daily collections by payment date and payment method with safe numeric totals', async () => {
    const { summarizeDailyCollectionReport } = await import('./financialReportsService');

    expect(summarizeDailyCollectionReport([
      { amount: '100' as unknown as number, payment_date: '2026-05-02', payment_method: 'cash' },
      { amount: 50, payment_date: '2026-05-01', payment_method: 'bank_transfer' },
      { amount: 'bad' as unknown as number, payment_date: '2026-05-01', payment_method: 'card' },
      { amount: 25.5, payment_date: '2026-05-02', payment_method: 'check' },
      { amount: 10, payment_date: '2026-05-02', payment_method: 'other' },
    ])).toEqual({
      rows: [
        {
          paymentDate: '2026-05-01',
          totalPaid: 50,
          paymentsCount: 2,
          methodTotals: { cash: 0, bank_transfer: 50, card: 0, check: 0, other: 0 },
        },
        {
          paymentDate: '2026-05-02',
          totalPaid: 135.5,
          paymentsCount: 3,
          methodTotals: { cash: 100, bank_transfer: 0, card: 0, check: 25.5, other: 10 },
        },
      ],
      grandTotal: 185.5,
      paymentsCount: 5,
      methodTotals: { cash: 100, bank_transfer: 50, card: 0, check: 25.5, other: 10 },
    });
  });

  it('builds a financial period summary without dashboard-only metrics or accounting net profit', async () => {
    const { summarizeFinancialPeriodSummaryReport } = await import('./financialReportsService');

    expect(summarizeFinancialPeriodSummaryReport({
      invoiceTotals: { totalAmount: 700, totalPaid: 0, totalOutstanding: 225, invoicesCount: 4 },
      paymentTotals: { totalPaid: '300.75' as unknown as number, paymentsCount: 3 },
      outstandingBalance: { totalOutstanding: 225, invoicesCount: 2 },
      expenseTotals: { totalExpenses: '125.25' as unknown as number, expensesCount: 5 },
    })).toEqual({
      invoiced: 700,
      paid: 300.75,
      outstanding: 225,
      expenses: 125.25,
      netCash: 175.5,
      invoicesCount: 4,
      paymentsCount: 3,
      expensesCount: 5,
    });
  });

  it('groups financial cashflow rows by month from canonical payment and expense rows', async () => {
    const { summarizeFinancialCashflowReport } = await import('./financialReportsService');

    expect(summarizeFinancialCashflowReport({
      payments: [
        { amount: '100' as unknown as number, payment_date: '2026-05-02' },
        { amount: 50, payment_date: '2026-05-20' },
        { amount: 25, payment_date: '2026-06-01' },
      ],
      expenses: [
        { amount: 20, expense_date: '2026-05-03' },
        { amount: 'bad' as unknown as number, expense_date: '2026-05-04' },
        { amount: '30.5' as unknown as number, expense_date: '2026-06-15' },
      ],
    })).toEqual({
      rows: [
        { month: '2026-05', revenue: 150, expenses: 20 },
        { month: '2026-06', revenue: 25, expenses: 30.5 },
      ],
      totalRevenue: 175,
      totalExpenses: 50.5,
    });
  });

  it('normalizes cash flow and VAT RPC payloads into safe report contracts', async () => {
    const { normalizeCashFlowStatementReport, normalizeVatReturnReport } = await import('./financialReportsService');

    expect(normalizeCashFlowStatementReport({
      period: { from: '2026-06-01', to: '2026-06-30' },
      operating: { receipts: '1500.250', expenses: 400, net_operating: '1100.25' },
      investing: { note: 'not_applicable_single_office', amount: 0 },
      financing: { note: 'not_applicable_single_office', amount: '0' },
      net_change: '1100.25',
    })).toEqual({
      period: { from: '2026-06-01', to: '2026-06-30' },
      operating: { receipts: 1500.25, expenses: 400, netOperating: 1100.25 },
      investing: { note: 'not_applicable_single_office', amount: 0 },
      financing: { note: 'not_applicable_single_office', amount: 0 },
      netChange: 1100.25,
    });

    expect(normalizeVatReturnReport({
      period: { from: '2026-06-01', to: '2026-06-30' },
      total_sales_amount: '900',
      total_tax_amount: '45.5',
      invoice_count: '3',
    })).toEqual({
      period: { from: '2026-06-01', to: '2026-06-30' },
      totalSalesAmount: 900,
      totalTaxAmount: 45.5,
      invoiceCount: 3,
    });
  });

  it('groups expenses by category and property using safe numeric totals', async () => {
    const { summarizeExpenseBreakdownReport } = await import('./financialReportsService');
    const properties = new Map([
      ['property_1', { id: 'property_1', title: 'Building A' }],
      ['property_2', { id: 'property_2', title: 'Building B' }],
    ]);

    expect(summarizeExpenseBreakdownReport([
      { amount: '80' as unknown as number, category: 'صيانة', property_id: 'property_1' },
      { amount: 20, category: 'صيانة', property_id: 'property_1' },
      { amount: 15.5, category: 'مرافق', property_id: 'property_2' },
      { amount: Number.NaN, category: 'أخرى', property_id: 'property_3' },
    ], properties)).toEqual({
      totalExpenses: 115.5,
      expensesCount: 4,
      byCategory: [
        { category: 'أخرى', total: 0, count: 1 },
        { category: 'صيانة', total: 100, count: 2 },
        { category: 'مرافق', total: 15.5, count: 1 },
      ],
      byProperty: [
        { propertyId: 'property_1', propertyTitle: 'Building A', total: 100, count: 2 },
        { propertyId: 'property_2', propertyTitle: 'Building B', total: 15.5, count: 1 },
        { propertyId: 'property_3', propertyTitle: null, total: 0, count: 1 },
      ],
    });
  });

  it('builds a stable collection summary from independent report totals', async () => {
    const { summarizeCollectionReport } = await import('./financialReportsService');

    expect(summarizeCollectionReport({
      invoiceTotals: { totalAmount: 500, totalPaid: 100, totalOutstanding: 400, invoicesCount: 4 },
      paymentTotals: { totalPaid: '125.75' as unknown as number, paymentsCount: 3 },
      outstandingBalance: { totalOutstanding: 275, invoicesCount: 2 },
      expenseTotals: { totalExpenses: Number.NaN, expensesCount: 1 },
    })).toEqual({
      invoiced: 500,
      paid: 125.75,
      outstanding: 275,
      receiptsCount: 3,
      invoicesCount: 4,
      expensesTotal: 0,
    });
  });


  it('summarizes arrears using due_date/as-of semantics and safe positive balances only', async () => {
    const {
      getAgingBucketKey,
      summarizeAgedReceivablesReport,
      summarizeArrearsSummaryReport,
      summarizeOverdueInvoicesReport,
    } = await import('./financialReportsService');
    const filters = { asOf: '2026-05-14', propertyId: 'property_1', tenantId: 'tenant_1' };
    const invoices = [
      {
        id: 'inv_current',
        contract_id: 'contract_1',
        issue_date: '2026-01-01',
        due_date: '2026-05-20',
        amount: '100' as unknown as number,
        paid_amount: 25,
        status: 'issued' as const,
        deleted_at: null,
        contracts: { id: 'contract_1', property_id: 'property_1', tenant_id: 'tenant_1', unit_id: 'unit_1' },
      },
      {
        id: 'inv_30',
        contract_id: 'contract_1',
        issue_date: '2025-01-01',
        due_date: '2026-04-15',
        amount: 200,
        paid_amount: 50,
        status: 'partial' as const,
        deleted_at: null,
        contracts: { id: 'contract_1', property_id: 'property_1', tenant_id: 'tenant_1', unit_id: 'unit_1' },
      },
      {
        id: 'inv_60',
        contract_id: 'contract_1',
        issue_date: '2026-05-14',
        due_date: '2026-03-15',
        amount: Number.NaN,
        paid_amount: 0,
        status: 'overdue' as const,
        deleted_at: null,
        contracts: { id: 'contract_1', property_id: 'property_1', tenant_id: 'tenant_1', unit_id: 'unit_1' },
      },
      {
        id: 'inv_90',
        contract_id: 'contract_2',
        issue_date: '2026-05-14',
        due_date: '2026-02-13',
        amount: 300,
        paid_amount: 0,
        status: 'issued' as const,
        deleted_at: null,
        contracts: { id: 'contract_2', property_id: 'property_1', tenant_id: 'tenant_1', unit_id: null },
      },
      {
        id: 'inv_over90',
        contract_id: 'contract_2',
        issue_date: '2026-05-14',
        due_date: '2026-02-12',
        amount: 400,
        paid_amount: 100,
        status: 'overdue' as const,
        deleted_at: null,
        contracts: { id: 'contract_2', property_id: 'property_1', tenant_id: 'tenant_1', unit_id: null },
      },
      {
        id: 'inv_overpaid',
        contract_id: 'contract_1',
        issue_date: '2026-05-14',
        due_date: '2026-04-01',
        amount: 100,
        paid_amount: 150,
        status: 'partial' as const,
        deleted_at: null,
        contracts: { id: 'contract_1', property_id: 'property_1', tenant_id: 'tenant_1', unit_id: 'unit_1' },
      },
      {
        id: 'inv_deleted',
        contract_id: 'contract_1',
        issue_date: '2026-05-14',
        due_date: '2026-04-01',
        amount: 100,
        paid_amount: 0,
        status: 'issued' as const,
        deleted_at: '2026-05-01',
        contracts: { id: 'contract_1', property_id: 'property_1', tenant_id: 'tenant_1', unit_id: 'unit_1' },
      },
      {
        id: 'inv_wrong_tenant',
        contract_id: 'contract_3',
        issue_date: '2026-05-14',
        due_date: '2026-04-01',
        amount: 100,
        paid_amount: 0,
        status: 'issued' as const,
        deleted_at: null,
        contracts: { id: 'contract_3', property_id: 'property_1', tenant_id: 'tenant_2', unit_id: null },
      },
      {
        id: 'inv_void',
        contract_id: 'contract_1',
        issue_date: '2026-05-14',
        due_date: '2026-04-01',
        amount: 100,
        paid_amount: 0,
        status: 'void' as const,
        deleted_at: null,
        contracts: { id: 'contract_1', property_id: 'property_1', tenant_id: 'tenant_1', unit_id: 'unit_1' },
      },
    ];
    const contexts = {
      tenantsById: new Map([['tenant_1', { id: 'tenant_1', full_name: 'Tenant One' }]]),
      propertiesById: new Map([['property_1', { id: 'property_1', title: 'Building A' }]]),
      unitsById: new Map([['unit_1', { id: 'unit_1', unit_number: '101' }]]),
    };

    expect(getAgingBucketKey('2026-05-20', filters.asOf)).toBe('current');
    expect(getAgingBucketKey('2026-04-15', filters.asOf)).toBe('days_1_30');
    expect(getAgingBucketKey('2026-03-15', filters.asOf)).toBe('days_31_60');
    expect(getAgingBucketKey('2026-02-13', filters.asOf)).toBe('days_61_90');
    expect(getAgingBucketKey('2026-02-12', filters.asOf)).toBe('days_90_plus');

    expect(summarizeOverdueInvoicesReport(invoices, filters, contexts)).toMatchObject({
      asOf: '2026-05-14',
      totalOverdue: 750,
      invoiceCount: 3,
      rows: [
        expect.objectContaining({ invoiceId: 'inv_over90', tenantName: 'Tenant One', propertyTitle: 'Building A', remainingAmount: 300, daysOverdue: 91 }),
        expect.objectContaining({ invoiceId: 'inv_90', remainingAmount: 300, daysOverdue: 90 }),
        expect.objectContaining({ invoiceId: 'inv_30', unitNumber: '101', remainingAmount: 150, daysOverdue: 29 }),
      ],
    });

    expect(summarizeAgedReceivablesReport(invoices, filters, contexts)).toMatchObject({
      totalOutstanding: 825,
      totalOverdue: 750,
      buckets: {
        current: expect.objectContaining({ total: 75, invoiceCount: 1 }),
        days_1_30: expect.objectContaining({ total: 150, invoiceCount: 1 }),
        days_31_60: expect.objectContaining({ total: 0, invoiceCount: 0 }),
        days_61_90: expect.objectContaining({ total: 300, invoiceCount: 1 }),
        days_90_plus: expect.objectContaining({ total: 300, invoiceCount: 1 }),
      },
    });

    expect(summarizeArrearsSummaryReport(invoices, filters)).toEqual({
      asOf: '2026-05-14',
      totalOverdue: 750,
      overdueInvoiceCount: 3,
      over90Amount: 300,
      over90InvoiceCount: 1,
      averageDaysOverdue: 70,
    });
  });



  it('excludes VOID payments from payment-backed collection totals even when they are not soft-deleted', async () => {
    const {
      filterPaymentsForReport,
      summarizeCollectionReport,
      summarizeDailyCollectionReport,
      summarizeExpenseTotals,
      summarizeInvoiceTotals,
      summarizeOutstandingBalance,
      summarizePaymentTotals,
    } = await import('./financialReportsService');
    const filters = { dateFrom: '2026-05-01', dateTo: '2026-05-31' };
    const payments = [
      { id: 'payment_posted', invoice_id: 'invoice_1', amount: 300, payment_date: '2026-05-10', payment_method: 'cash' as const, status: 'POSTED' as const, deleted_at: null, invoice: { id: 'invoice_1', contract_id: 'contract_1' }, contract: { id: 'contract_1', property_id: 'property_1', tenant_id: 'tenant_1' } },
      { id: 'payment_void', invoice_id: 'invoice_1', amount: 300, payment_date: '2026-05-10', payment_method: 'cash' as const, status: 'VOID' as const, deleted_at: null, invoice: { id: 'invoice_1', contract_id: 'contract_1' }, contract: { id: 'contract_1', property_id: 'property_1', tenant_id: 'tenant_1' } },
    ];

    const reportPayments = filterPaymentsForReport(payments, filters);
    const invoiceTotals = summarizeInvoiceTotals([createReportInvoiceFixture({ amount: 300, paid_amount: 300 })]);
    const paymentTotals = summarizePaymentTotals(reportPayments);
    const outstandingBalance = summarizeOutstandingBalance([createReportInvoiceFixture({ amount: 300, paid_amount: 300 })]);
    const expenseTotals = summarizeExpenseTotals([]);
    const collection = summarizeCollectionReport({ invoiceTotals, paymentTotals, outstandingBalance, expenseTotals });
    const daily = summarizeDailyCollectionReport(reportPayments);

    expect(reportPayments.map((payment) => payment.id)).toEqual(['payment_posted']);
    expect(collection.paid).toBe(300);
    expect(collection.receiptsCount).toBe(1);
    expect(daily.grandTotal).toBe(collection.paid);
    expect(daily.paymentsCount).toBe(collection.receiptsCount);
  });

  it('reconciles collection, period, and daily receipt totals from the same payment evidence', async () => {
    const {
      summarizeCollectionReport,
      summarizeDailyCollectionReport,
      summarizeFinancialPeriodSummaryReport,
      summarizeInvoiceTotals,
      summarizeOutstandingBalance,
      summarizePaymentTotals,
      summarizeExpenseTotals,
    } = await import('./financialReportsService');
    const invoices = [
      createReportInvoiceFixture({ paid_amount: 600 }),
      createReportInvoiceFixture({ amount: 500, paid_amount: 500 }),
      createReportInvoiceFixture({ amount: 250 }),
    ];
    const payments = [
      createReportPaymentFixture(),
      createReportPaymentFixture({ amount: 500, payment_date: '2026-05-02', payment_method: 'bank_transfer' }),
      createReportPaymentFixture({ payment_date: '2026-05-02', payment_method: 'card' }),
    ];
    const expenses = [createReportExpenseFixture(125), createReportExpenseFixture(75)];
    const invoiceTotals = summarizeInvoiceTotals(invoices);
    const paymentTotals = summarizePaymentTotals(payments);
    const outstandingBalance = summarizeOutstandingBalance(invoices);
    const expenseTotals = summarizeExpenseTotals(expenses);

    const collection = summarizeCollectionReport({ invoiceTotals, paymentTotals, outstandingBalance, expenseTotals });
    const period = summarizeFinancialPeriodSummaryReport({ invoiceTotals, paymentTotals, outstandingBalance, expenseTotals });
    const daily = summarizeDailyCollectionReport(payments);

    expect(collection).toEqual({
      invoiced: 1750,
      paid: 1100,
      outstanding: 650,
      receiptsCount: 3,
      invoicesCount: 3,
      expensesTotal: 200,
    });
    expect(period).toMatchObject({ invoiced: collection.invoiced, paid: collection.paid, outstanding: collection.outstanding, netCash: 900 });
    expect(daily.grandTotal).toBe(collection.paid);
    expect(daily.paymentsCount).toBe(collection.receiptsCount);
    expect(invoiceTotals.totalAmount - paymentTotals.totalPaid).toBe(outstandingBalance.totalOutstanding);
  });
});

describe('financialReportsService Supabase queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('loads daily collection with date, deleted_at, and context filters while preserving payment method totals', async () => {
    const log = mockSupabaseTables({
      payments: [
        { id: 'payment_1', invoice_id: 'invoice_1', amount: 100, payment_date: '2026-05-14', payment_method: 'cash', status: 'POSTED', deleted_at: null },
        { id: 'payment_2', invoice_id: 'invoice_2', amount: 75, payment_date: '2026-05-14', payment_method: 'card', status: 'POSTED', deleted_at: null },
        { id: 'payment_deleted', invoice_id: 'invoice_1', amount: 200, payment_date: '2026-05-14', payment_method: 'cash', status: 'POSTED', deleted_at: '2026-05-15' },
        { id: 'payment_outside_range', invoice_id: 'invoice_1', amount: 300, payment_date: '2026-06-01', payment_method: 'check', status: 'POSTED', deleted_at: null },
        { id: 'payment_void', invoice_id: 'invoice_1', amount: 500, payment_date: '2026-05-14', payment_method: 'cash', status: 'VOID', deleted_at: null },
      ],
      invoices: [
        { id: 'invoice_1', contract_id: 'contract_1', deleted_at: null },
        { id: 'invoice_2', contract_id: 'contract_2', deleted_at: null },
      ],
      contracts: [
        { id: 'contract_1', property_id: 'property_1', tenant_id: 'tenant_1' },
        { id: 'contract_2', property_id: 'property_2', tenant_id: 'tenant_2' },
      ],
    });
    const { getDailyCollectionReport } = await import('./financialReportsService');

    await expect(getDailyCollectionReport({
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
      propertyId: 'property_1',
      tenantId: 'tenant_1',
    })).resolves.toEqual({
      rows: [{
        paymentDate: '2026-05-14',
        totalPaid: 100,
        paymentsCount: 1,
        methodTotals: { cash: 100, bank_transfer: 0, card: 0, check: 0, other: 0 },
      }],
      grandTotal: 100,
      paymentsCount: 1,
      methodTotals: { cash: 100, bank_transfer: 0, card: 0, check: 0, other: 0 },
    });

    expect(log).toEqual(expect.arrayContaining([
      { table: 'payments', method: 'is', args: ['deleted_at', null] },
      { table: 'payments', method: 'gte', args: ['payment_date', '2026-05-01'] },
      { table: 'payments', method: 'lte', args: ['payment_date', '2026-05-31'] },
      { table: 'invoices', method: 'is', args: ['deleted_at', null] },
      { table: 'contracts', method: 'is', args: ['deleted_at', null] },
    ]));
  });

  it('loads a formal financial period summary from current invoices, payments, and expenses', async () => {
    const log = mockSupabaseTables({
      invoices: [
        {
          id: 'inv_1',
          contract_id: 'contract_1',
          issue_date: '2026-05-05',
          due_date: '2026-05-31',
          amount: 400,
          paid_amount: 150,
          status: 'partial',
          deleted_at: null,
          contracts: { id: 'contract_1', property_id: 'property_1', tenant_id: 'tenant_1' },
        },
        {
          id: 'inv_deleted',
          contract_id: 'contract_1',
          issue_date: '2026-05-10',
          due_date: '2026-05-31',
          amount: 900,
          paid_amount: 0,
          status: 'issued',
          deleted_at: '2026-05-11',
          contracts: { id: 'contract_1', property_id: 'property_1', tenant_id: 'tenant_1' },
        },
      ],
      payments: [{ id: 'payment_1', invoice_id: 'inv_1', amount: 150, payment_date: '2026-05-06', payment_method: 'bank_transfer', deleted_at: null }],
      contracts: [{ id: 'contract_1', property_id: 'property_1', tenant_id: 'tenant_1' }],
      expenses: [
        { id: 'expense_1', property_id: 'property_1', category: 'صيانة', amount: 35, expense_date: '2026-05-07', deleted_at: null },
        { id: 'expense_deleted', property_id: 'property_1', category: 'صيانة', amount: 100, expense_date: '2026-05-07', deleted_at: '2026-05-08' },
      ],
    });
    const { getFinancialPeriodSummaryReport } = await import('./financialReportsService');

    await expect(getFinancialPeriodSummaryReport({
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
      propertyId: 'property_1',
      tenantId: 'tenant_1',
    })).resolves.toEqual({
      invoiced: 400,
      paid: 150,
      outstanding: 250,
      expenses: 35,
      netCash: 115,
      invoicesCount: 1,
      paymentsCount: 1,
      expensesCount: 1,
    });

    expect(log).toEqual(expect.arrayContaining([
      { table: 'expenses', method: 'is', args: ['deleted_at', null] },
      { table: 'expenses', method: 'gte', args: ['expense_date', '2026-05-01'] },
      { table: 'expenses', method: 'lte', args: ['expense_date', '2026-05-31'] },
      { table: 'expenses', method: 'eq', args: ['property_id', 'property_1'] },
    ]));
  });

  it('loads expense breakdowns by category and property with optional category filtering', async () => {
    const log = mockSupabaseTables({
      expenses: [
        { id: 'expense_1', property_id: 'property_1', category: 'صيانة', amount: 25, expense_date: '2026-05-02', deleted_at: null },
        { id: 'expense_2', property_id: 'property_2', category: 'صيانة', amount: '40' as unknown as number, expense_date: '2026-05-03', deleted_at: null },
        { id: 'expense_other_category', property_id: 'property_2', category: 'مرافق', amount: 100, expense_date: '2026-05-04', deleted_at: null },
        { id: 'expense_outside_range', property_id: 'property_1', category: 'صيانة', amount: 100, expense_date: '2026-06-01', deleted_at: null },
        { id: 'expense_deleted', property_id: 'property_1', category: 'صيانة', amount: 100, expense_date: '2026-05-05', deleted_at: '2026-05-06' },
      ],
      properties: [
        { id: 'property_1', title: 'Building A' },
        { id: 'property_2', title: 'Building B' },
      ],
    });
    const { getExpenseBreakdownReport } = await import('./financialReportsService');

    await expect(getExpenseBreakdownReport({
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
      category: 'صيانة',
    })).resolves.toEqual({
      totalExpenses: 65,
      expensesCount: 2,
      byCategory: [{ category: 'صيانة', total: 65, count: 2 }],
      byProperty: [
        { propertyId: 'property_1', propertyTitle: 'Building A', total: 25, count: 1 },
        { propertyId: 'property_2', propertyTitle: 'Building B', total: 40, count: 1 },
      ],
    });

    expect(log).toEqual(expect.arrayContaining([
      { table: 'expenses', method: 'is', args: ['deleted_at', null] },
      { table: 'expenses', method: 'gte', args: ['expense_date', '2026-05-01'] },
      { table: 'expenses', method: 'lte', args: ['expense_date', '2026-05-31'] },
      { table: 'expenses', method: 'eq', args: ['category', 'صيانة'] },
      { table: 'properties', method: 'in', args: ['id', ['property_1', 'property_2']] },
      { table: 'properties', method: 'is', args: ['deleted_at', null] },
    ]));
  });

  it('omits property breakdown when expense breakdown is scoped to one property', async () => {
    const log = mockSupabaseTables({
      expenses: [{ id: 'expense_1', property_id: 'property_1', category: 'صيانة', amount: 25, expense_date: '2026-05-02', deleted_at: null }],
    });
    const { getExpenseBreakdownReport } = await import('./financialReportsService');

    await expect(getExpenseBreakdownReport({
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
      propertyId: 'property_1',
    })).resolves.toEqual({
      totalExpenses: 25,
      expensesCount: 1,
      byCategory: [{ category: 'صيانة', total: 25, count: 1 }],
      byProperty: [],
    });

    expect(log).toEqual(expect.arrayContaining([
      { table: 'expenses', method: 'eq', args: ['property_id', 'property_1'] },
    ]));
    expect(log.some((entry) => entry.table === 'properties')).toBe(false);
  });



  it('loads overdue invoices by due_date/as-of with batched tenant property and unit context', async () => {
    const log = mockSupabaseTables({
      invoices: [
        {
          id: 'invoice_due',
          contract_id: 'contract_1',
          issue_date: '2026-01-01',
          due_date: '2026-05-01',
          amount: 250,
          paid_amount: 50,
          status: 'partial',
          deleted_at: null,
          contracts: { id: 'contract_1', property_id: 'property_1', tenant_id: 'tenant_1', unit_id: 'unit_1' },
        },
        {
          id: 'invoice_future',
          contract_id: 'contract_1',
          issue_date: '2026-01-01',
          due_date: '2026-06-01',
          amount: 100,
          paid_amount: 0,
          status: 'issued',
          deleted_at: null,
          contracts: { id: 'contract_1', property_id: 'property_1', tenant_id: 'tenant_1', unit_id: 'unit_1' },
        },
        {
          id: 'invoice_deleted',
          contract_id: 'contract_1',
          issue_date: '2026-01-01',
          due_date: '2026-05-01',
          amount: 999,
          paid_amount: 0,
          status: 'issued',
          deleted_at: '2026-05-02',
          contracts: { id: 'contract_1', property_id: 'property_1', tenant_id: 'tenant_1', unit_id: 'unit_1' },
        },
      ],
      people: [{ id: 'tenant_1', full_name: 'Tenant One' }],
      properties: [{ id: 'property_1', title: 'Building A' }],
      units: [{ id: 'unit_1', unit_number: '101' }],
    });
    const { getOverdueInvoicesReport } = await import('./financialReportsService');

    await expect(getOverdueInvoicesReport({
      asOf: '2026-05-14',
      propertyId: 'property_1',
      tenantId: 'tenant_1',
      contractId: 'contract_1',
    })).resolves.toEqual({
      asOf: '2026-05-14',
      totalOverdue: 200,
      invoiceCount: 1,
      rows: [{
        invoiceId: 'invoice_due',
        shortInvoiceId: 'invoice_',
        contractId: 'contract_1',
        tenantId: 'tenant_1',
        tenantName: 'Tenant One',
        propertyId: 'property_1',
        propertyTitle: 'Building A',
        unitId: 'unit_1',
        unitNumber: '101',
        dueDate: '2026-05-01',
        daysOverdue: 13,
        amount: 250,
        paidAmount: 50,
        remainingAmount: 200,
        status: 'partial',
      }],
    });

    expect(log).toEqual(expect.arrayContaining([
      { table: 'invoices', method: 'is', args: ['deleted_at', null] },
      { table: 'invoices', method: 'in', args: ['status', ['issued', 'partial', 'overdue']] },
      { table: 'invoices', method: 'eq', args: ['contract_id', 'contract_1'] },
      { table: 'people', method: 'in', args: ['id', ['tenant_1']] },
      { table: 'properties', method: 'in', args: ['id', ['property_1']] },
      { table: 'units', method: 'in', args: ['id', ['unit_1']] },
    ]));
    expect(log.some((entry) => ['insert', 'update', 'delete', 'rpc'].includes(entry.method))).toBe(false);
  });


  it('queries invoice totals with deleted_at, date range, status, and contract filters', async () => {
    const log = mockSupabaseTables({
      invoices: [{
        id: 'inv_1',
        contract_id: 'contract_1',
        issue_date: '2026-05-14',
        due_date: '2026-05-31',
        amount: 200,
        paid_amount: 50,
        status: 'partial',
        deleted_at: null,
        contracts: { id: 'contract_1', property_id: 'property_1', tenant_id: 'tenant_1' },
      }],
    });
    const { getInvoiceTotalsReport } = await import('./financialReportsService');

    await expect(getInvoiceTotalsReport({
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
      contractId: 'contract_1',
      status: 'partial',
    })).resolves.toEqual({ totalAmount: 200, totalPaid: 50, totalOutstanding: 150, invoicesCount: 1 });

    expect(log).toEqual(expect.arrayContaining([
      { table: 'invoices', method: 'is', args: ['deleted_at', null] },
      { table: 'invoices', method: 'gte', args: ['issue_date', '2026-05-01'] },
      { table: 'invoices', method: 'lte', args: ['issue_date', '2026-05-31'] },
      { table: 'invoices', method: 'eq', args: ['status', 'partial'] },
      { table: 'invoices', method: 'eq', args: ['contract_id', 'contract_1'] },
    ]));
  });

  it('derives receipt/payment totals from posted payments without mutating payment records', async () => {
    const log = mockSupabaseTables({
      payments: [{ id: 'payment_1', invoice_id: 'invoice_1', amount: 75, payment_date: '2026-05-14', deleted_at: null }],
      invoices: [{ id: 'invoice_1', contract_id: 'contract_1', deleted_at: null }],
      contracts: [{ id: 'contract_1', property_id: 'property_1', tenant_id: 'tenant_1' }],
    });
    const { getPaymentTotalsReport } = await import('./financialReportsService');

    await expect(getPaymentTotalsReport({
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
      propertyId: 'property_1',
      tenantId: 'tenant_1',
    })).resolves.toEqual({ totalPaid: 75, paymentsCount: 1 });

    expect(log).toEqual(expect.arrayContaining([
      { table: 'payments', method: 'is', args: ['deleted_at', null] },
      { table: 'payments', method: 'gte', args: ['payment_date', '2026-05-01'] },
      { table: 'payments', method: 'lte', args: ['payment_date', '2026-05-31'] },
      { table: 'invoices', method: 'is', args: ['deleted_at', null] },
      { table: 'contracts', method: 'is', args: ['deleted_at', null] },
    ]));
    expect(log.some((entry) => ['insert', 'update', 'delete', 'rpc'].includes(entry.method))).toBe(false);
  });

});
