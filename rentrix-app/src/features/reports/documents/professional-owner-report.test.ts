import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildOwnerReportPayload, downloadOwnerReportPdf, loadOwnerReportContext, printOwnerReport, type OwnerReportContext } from './professional-owner-report';
import { documentService } from '@/services/documents/DocumentService';
import { getOwnerFinancialAuthority, type OwnerFinancialPosition } from '@/features/owners/services/owner-financial-service';
import type { OwnerStatementReport } from '@/features/financials/reports/financialReportsService';
import { listOwnerSettlements, type OwnerSettlementRecord } from '@/features/owners/services/owner-settlements-service';
import { listOwnerProperties } from '@/features/owners/services/owner-service';
import { listMaintenance, type Maintenance } from '@/features/maintenance/maintenance-service';
import { listUtilityBills, responsiblePartyLabels, type UtilityBill } from '@/features/utilities/utilities-service';

vi.mock('@/services/documents/DocumentService', () => ({
  documentService: {
    printDocument: vi.fn().mockResolvedValue(undefined),
    downloadDocumentPdf: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/features/owners/services/owner-financial-service', () => ({
  getOwnerFinancialAuthority: vi.fn(),
}));
vi.mock('@/features/owners/services/owner-settlements-service', () => ({
  listOwnerSettlements: vi.fn(),
}));
vi.mock('@/features/owners/services/owner-service', () => ({
  listOwnerProperties: vi.fn(),
}));
vi.mock('@/features/maintenance/maintenance-service', () => ({
  listMaintenance: vi.fn(),
}));
vi.mock('@/features/utilities/utilities-service', () => ({
  listUtilityBills: vi.fn(),
  responsiblePartyLabels: { tenant: 'المستأجر', landlord: 'المالك', company: 'شركة الإدارة' },
}));

const validSettings = {
  companyName: 'شركة مسار العقارية',
  crNumber: '12345678',
  taxNumber: 'OM12345678',
  currency: 'OMR',
  city: 'مسقط',
  documentPrefixes: {},
};

const position: OwnerFinancialPosition = {
  owner_id: 'o-01',
  basis: 'settlement-cycle',
  operating_model: 'management-fees',
  period: {
    tenant_collections: 5000,
    management_fees: { amount: 250 },
    owner_expenses: 300,
    fee_vat: 12.5,
    authorized_adjustments: 0,
    net_payable: 4437.5,
  },
  lifecycle_all_time: {
    settled_pending_net: 800,
    paid_net: 3000,
    remaining_payable: 1437.5,
    draft_count: 1,
    approved_count: 2,
    paid_count: 3,
    cancelled_count: 1,
  },
  owner_funds: { held: 0 },
};

const statement: OwnerStatementReport = {
  ownerName: 'سالم الحارثي',
  commissionType: 'RATE',
  commissionValue: 5,
  transactions: [
    { date: '2026-02-10', details: 'إيجار شقة 101', type: 'payment', propertyName: 'برج الشروق', gross: 1000, deduction: 50, net: 950 },
    { date: '2026-02-15', details: 'إصلاح سباكة', type: 'expense', propertyName: 'برج الشروق', gross: 120, deduction: 0, net: 120 },
  ],
  totalGross: 1000,
  totalDeductions: 50,
  totalNet: 950,
  periodFrom: '2026-02-01',
  periodTo: '2026-02-28',
  error: null,
};

const approvedSettlement: OwnerSettlementRecord = {
  id: 'stl-01',
  owner_id: 'o-01',
  owner_name: 'سالم الحارثي',
  property_id: 'p-01',
  property_title: 'برج الشروق',
  period_start: '2026-01-01',
  period_end: '2026-01-31',
  gross_rent_collected: 5000,
  management_fee_amount: 250,
  owner_expenses: 300,
  fee_vat_amount: 12.5,
  net_payable_amount: 4437.5,
  status: 'approved',
  payout_reference: null,
  created_at: '2026-02-01T00:00:00Z',
};

const paidSettlement: OwnerSettlementRecord = {
  ...approvedSettlement,
  id: 'stl-paid',
  status: 'paid',
  payout_reference: 'PAY-2026-001',
};

const cancelledSettlement: OwnerSettlementRecord = {
  ...approvedSettlement,
  id: 'stl-02',
  status: 'cancelled',
  net_payable_amount: 0,
  payout_reference: 'VOID',
};

const maintenanceRows = [
  {
    id: 'm-01',
    property_id: 'p-01',
    unit_id: 'u-01',
    title: 'إصلاح مكيف',
    no: 'WO-100',
    reference: 'WO-100',
    request_date: '2026-02-12',
    created_at: '2026-02-12T00:00:00Z',
    status: 'in_progress',
    technician_name: 'شركة التكييف',
    charged_to: 'owner',
    cost: 60,
    expense_id: 'exp-01',
  },
  {
    id: 'm-02',
    property_id: 'p-01',
    unit_id: 'u-02',
    title: 'إصلاح تسرب مياه',
    no: 'WO-101',
    reference: 'WO-101',
    request_date: '2026-02-18',
    created_at: '2026-02-18T00:00:00Z',
    status: 'resolved',
    technician_name: 'فني السباكة',
    charged_to: 'tenant',
    cost: 45,
    expense_id: null,
  },
] as unknown as Maintenance[];

const utilityBills = [
  {
    id: 'ub-01',
    meter_id: 'mt-01',
    property_id: 'p-01',
    unit_id: 'u-01',
    bill_number: 'ELE-2026-02',
    billing_period_start: '2026-02-01',
    billing_period_end: '2026-02-28',
    previous_reading: 100,
    current_reading: 200,
    consumption_units: 100,
    amount: 45,
    paid_amount: 45,
    due_date: '2026-03-15',
    status: 'paid',
    responsible_party: 'tenant',
    created_at: '2026-02-20T00:00:00Z',
  },
] as unknown as UtilityBill[];

const baseContext: OwnerReportContext = {
  ownerName: 'سالم الحارثي',
  periodFrom: '2026-02-01',
  periodTo: '2026-02-28',
  scopeLabel: 'برج الشروق',
  propertyTitles: new Map([['p-01', 'برج الشروق']]),
};

/** Helper to flatten every block across all groups for assertions. */
function allBlocks(payload: { groups: Array<{ blocks: unknown[] }> }): unknown[] {
  return payload.groups.flatMap((group) => group.blocks);
}

function findTable(payload: { groups: Array<{ blocks: unknown[] }> }, title: string) {
  return allBlocks(payload).find(
    (block) => (block as { table?: { title?: string } }).table?.title === title,
  ) as { kind: string; table: { title: string; columns: string[]; rows: unknown[][]; totals?: unknown[]; emptyNote?: string } } | undefined;
}

function findNote(payload: { groups: Array<{ blocks: unknown[] }> }, substring: string) {
  return allBlocks(payload).find(
    (block) => (block as { kind?: string; note?: { text?: string } }).kind === 'note'
      && (block as { note?: { text?: string } }).note?.text?.includes(substring),
  ) as { kind: string; note: { text: string } } | undefined;
}

describe('professional-owner-report adapter', () => {
  it('builds the pack with canonical financial-position KPIs and final account', () => {
    const payload = buildOwnerReportPayload({ ...baseContext, position });

    expect(payload.reportType).toBe('Owner_Financial_Report_Pack');
    expect(payload.ownerName).toBe('سالم الحارثي');
    expect(payload.periodFrom).toBe('2026-02-01');

    const firstGroup = payload.groups[0];
    expect(firstGroup.blocks[0]).toMatchObject({ kind: 'kpis' });
    const kpis = firstGroup.blocks[0] as { kind: 'kpis'; kpis: Array<{ label: string; value: { kind: string; value: number } }> };
    expect(kpis.kpis).toHaveLength(8);
    const netKpi = kpis.kpis.find((kpi) => kpi.label === 'صافي المستحق للفترة');
    expect(netKpi?.value).toEqual({ kind: 'amount', value: 4437.5 });

    // Final account must be the LAST group and built from the position.
    const lastGroup = payload.groups[payload.groups.length - 1];
    expect(lastGroup.keepTogether).toBe(true);
    const finalTable = lastGroup.blocks.find((block) => (block as { kind?: string }).kind === 'table') as {
      kind: string;
      table: { title: string; rows: unknown[][] };
    };
    expect(finalTable.table.title).toBe('الحساب الختامي — تسوية حساب المالك');
    expect(finalTable.table.rows).toHaveLength(7);
    expect(finalTable.table.rows[0][0]).toEqual({ kind: 'text', value: '+ التحصيلات العائدة للمالك' });
    expect(finalTable.table.rows[6][1]).toEqual({ kind: 'amount', value: 1437.5 });
  });

  it('falls back to the canonical owner statement when no financial position exists', () => {
    const payload = buildOwnerReportPayload({ ...baseContext, statement });

    const kpiBlock = allBlocks(payload).find((block) => (block as { kind?: string }).kind === 'kpis') as {
      kind: string;
      kpis: Array<{ label: string }>;
    };
    expect(kpiBlock.kpis.map((kpi) => kpi.label)).toEqual(['إجمالي الإيجارات المحصلة', 'إجمالي الاستقطاعات', 'صافي المستحق']);
  });

  it('includes a detailed daily financial movement table with ALL transactions', () => {
    const payload = buildOwnerReportPayload({ ...baseContext, statement });

    const movementTable = findTable(payload, 'الحركة المالية اليومية التفصيلية');
    expect(movementTable).toBeDefined();
    // Both the payment and expense transactions appear
    expect(movementTable!.table.rows).toHaveLength(2);
    // First row is the payment
    expect(movementTable!.table.rows[0][1]).toEqual({ kind: 'text', value: 'تحصيل إيجار' });
    expect(movementTable!.table.rows[0][4]).toEqual({ kind: 'amount', value: 1000 });
    // Second row is the expense
    expect(movementTable!.table.rows[1][1]).toEqual({ kind: 'text', value: 'مصروف مُحمَّل على المالك' });
    expect(movementTable!.table.rows[1][4]).toEqual({ kind: 'amount', value: 120 });
    // Totals row aggregates all
    expect(movementTable!.table.totals).toBeDefined();
    expect(movementTable!.table.totals![4]).toEqual({ kind: 'amount', value: 1120 });
  });

  it('never invents financial data when no authority is available', () => {
    const payload = buildOwnerReportPayload({ ...baseContext, statement: null, position: null });

    const note = findNote(payload, 'لا توجد بيانات مالية معتمدة');
    expect(note).toBeDefined();
    expect(note!.note.text).toContain('لا توجد بيانات مالية معتمدة للفترة.');

    // No final account rows may be fabricated.
    const finalTable = findTable(payload, 'الحساب الختامي — تسوية حساب المالك');
    expect(finalTable!.table.rows).toHaveLength(0);
  });

  it('filters cancelled settlements and labels approved ones truthfully (approved ≠ paid)', () => {
    const payload = buildOwnerReportPayload({
      ...baseContext,
      statement,
      settlements: [approvedSettlement, paidSettlement, cancelledSettlement],
    });

    const settlementTable = findTable(payload, 'تسويات مستحقات المالك');
    expect(settlementTable).toBeDefined();
    // Cancelled settlements are filtered out
    expect(settlementTable!.table.rows).toHaveLength(2);
    // Approved settlement is labeled truthfully (NOT as paid)
    expect(settlementTable!.table.rows[0][2]).toEqual({ kind: 'text', value: 'كشف تسوية مالك معتمد للصرف' });
    // Paid settlement shows its truthful status
    expect(settlementTable!.table.rows[1][2]).toEqual({ kind: 'text', value: 'كشف تسوية مالك مصروف ومسدد' });
    // Payout reference shown only for actually-paid settlement
    expect(settlementTable!.table.rows[0][4]).toEqual({ kind: 'text', value: '—' });
    expect(settlementTable!.table.rows[1][4]).toEqual({ kind: 'text', value: 'PAY-2026-001' });
  });

  it('renders maintenance and utility operational tables with truthful labels', () => {
    const payload = buildOwnerReportPayload({ ...baseContext, statement, maintenanceRows, utilityBills });

    const maintenanceTable = findTable(payload, 'تفاصيل الصيانة');
    expect(maintenanceTable).toBeDefined();
    expect(maintenanceTable!.table.rows).toHaveLength(2);
    // [date, property, work order, status, technician, charged-to, cost, linked-expense]
    expect(maintenanceTable!.table.rows[0][3]).toEqual({ kind: 'text', value: 'قيد التنفيذ' });
    expect(maintenanceTable!.table.rows[0][5]).toEqual({ kind: 'text', value: 'المالك' });
    expect(maintenanceTable!.table.rows[0][6]).toEqual({ kind: 'amount', value: 60 });
    expect(maintenanceTable!.table.rows[0][7]).toEqual({ kind: 'text', value: 'نعم' });
    // Second maintenance: tenant-charged, no linked expense
    expect(maintenanceTable!.table.rows[1][5]).toEqual({ kind: 'text', value: 'المستأجر' });
    expect(maintenanceTable!.table.rows[1][7]).toEqual({ kind: 'text', value: '—' });

    const utilityTable = findTable(payload, 'الخدمات والمرافق');
    expect(utilityTable).toBeDefined();
    expect(utilityTable!.table.rows).toHaveLength(1);
    expect(utilityTable!.table.rows[0][6]).toEqual({ kind: 'text', value: 'المستأجر' });
    expect(utilityTable!.table.rows[0][7]).toEqual({ kind: 'text', value: 'مسددة بالكامل' });
  });

  it('shows maintenance cost as operational info, NOT as automatic owner deduction', () => {
    const payload = buildOwnerReportPayload({ ...baseContext, statement, maintenanceRows: maintenanceRows.slice(0, 1) });

    // The note explains maintenance cost ≠ automatic deduction
    const note = findNote(payload, 'تكلفة طلب الصيانة لا تُخصم تلقائياً');
    expect(note).toBeDefined();
  });

  it('expenses table uses statement expense transactions, not maintenance records', () => {
    const payload = buildOwnerReportPayload({ ...baseContext, statement, maintenanceRows: maintenanceRows.slice(0, 1) });

    const expenseTable = findTable(payload, 'تفاصيل المصروفات المسجلة');
    expect(expenseTable).toBeDefined();
    // The expense row comes from the statement's 'expense' type transaction
    expect(expenseTable!.table.rows).toHaveLength(1);
    expect(expenseTable!.table.rows[0][2]).toEqual({ kind: 'text', value: 'إصلاح سباكة' });
    expect(expenseTable!.table.rows[0][3]).toEqual({ kind: 'amount', value: 120 });
  });

  it('omits empty operational sections (no fixed empty pages)', () => {
    // No maintenance, no expense transactions, no utilities → no operational group
    const cleanStatement: OwnerStatementReport = {
      ...statement,
      transactions: [{ date: '2026-02-10', details: 'إيجار', type: 'payment', propertyName: 'برج الشروق', gross: 1000, deduction: 50, net: 950 }],
    };
    const payload = buildOwnerReportPayload({ ...baseContext, statement: cleanStatement });

    const maintenanceTable = findTable(payload, 'تفاصيل الصيانة');
    expect(maintenanceTable).toBeUndefined();
    const expenseTable = findTable(payload, 'تفاصيل المصروفات المسجلة');
    expect(expenseTable).toBeUndefined();
    const utilityTable = findTable(payload, 'الخدمات والمرافق');
    expect(utilityTable).toBeUndefined();
  });

  it('final reconciliation is always the LAST meaningful financial group', () => {
    const payload = buildOwnerReportPayload({
      ...baseContext,
      statement,
      position,
      settlements: [approvedSettlement],
      maintenanceRows,
      utilityBills,
    });

    const lastGroup = payload.groups[payload.groups.length - 1];
    const finalTable = lastGroup.blocks.find((block) => (block as { table?: { title?: string } }).table?.title === 'الحساب الختامي — تسوية حساب المالك');
    expect(finalTable).toBeDefined();
    expect(lastGroup.keepTogether).toBe(true);
  });

  it('opening/closing running balance remains unavailable (never fabricated)', () => {
    const payload = buildOwnerReportPayload({ ...baseContext, statement });

    // The movement note explicitly states that running balance is unavailable
    const note = findNote(payload, 'رصيد أول المدة ورصيد آخر المدة');
    expect(note).toBeDefined();

    // No "الرصيد الجاري" or "رصيد افتتاحي" anywhere in the movement table
    const movementTable = findTable(payload, 'الحركة المالية اليومية التفصيلية');
    expect(movementTable).toBeDefined();
    expect(movementTable!.table.columns).not.toContain('الرصيد الجاري');
    expect(movementTable!.table.columns).not.toContain('الرصيد الافتتاحي');
    expect(movementTable!.table.columns).not.toContain('الرصيد الختامي');
  });

  it('delegates print and PDF download to documentService with the owner_report type', async () => {
    const context: OwnerReportContext = { ...baseContext, position };

    await printOwnerReport({ settings: validSettings, context });
    expect(documentService.printDocument).toHaveBeenCalledWith('owner_report', expect.objectContaining({
      settings: validSettings,
      payload: expect.objectContaining({ ownerName: 'سالم الحارثي' }),
    }));

    await downloadOwnerReportPdf({ settings: validSettings, context });
    expect(documentService.downloadDocumentPdf).toHaveBeenCalledWith('owner_report', expect.objectContaining({
      settings: validSettings,
      payload: expect.objectContaining({ reportType: 'Owner_Financial_Report_Pack' }),
    }));
  });
});

describe('Golden Owner fixture — full integration', () => {
  /**
   * Representative Golden Owner fixture with:
   *  - multiple properties
   *  - collections (payment transactions)
   *  - owner expense (expense transaction)
   *  - maintenance linked to expense (m-01 has expense_id)
   *  - maintenance NOT linked to expense (m-02 has no expense_id)
   *  - utility bill
   *  - management fee/VAT
   *  - approved unpaid settlement
   *  - paid settlement
   *  - cancelled settlement
   *
   * Proves the document does not double count or mislabel anything.
   */
  const goldenStatement: OwnerStatementReport = {
    ownerName: 'خالد بن عبدالله',
    commissionType: 'RATE',
    commissionValue: 7,
    transactions: [
      { date: '2026-03-01', details: 'إيجار مارس - شقة 201', type: 'payment', propertyName: 'مجمع النور', gross: 2000, deduction: 140, net: 1860 },
      { date: '2026-03-05', details: 'إيجار مارس - شقة 302', type: 'payment', propertyName: 'برج الأفق', gross: 1500, deduction: 105, net: 1395 },
      { date: '2026-03-10', details: 'صيانة مكيف شقة 201', type: 'expense', propertyName: 'مجمع النور', gross: 200, deduction: 0, net: 200 },
      { date: '2026-03-15', details: 'تسوية مستحقات فبراير', type: 'settlement', propertyName: 'مجمع النور', gross: 0, deduction: 3000, net: -3000 },
    ],
    totalGross: 3500,
    totalDeductions: 3245,
    totalNet: 255,
    periodFrom: '2026-03-01',
    periodTo: '2026-03-31',
    error: null,
  };

  const goldenPosition: OwnerFinancialPosition = {
    owner_id: 'o-golden',
    basis: 'settlement-cycle',
    operating_model: 'management-fees',
    period: {
      tenant_collections: 3500,
      management_fees: { amount: 245 },
      owner_expenses: 200,
      fee_vat: 12.25,
      authorized_adjustments: 0,
      net_payable: 3042.75,
    },
    lifecycle_all_time: {
      settled_pending_net: 3042.75,
      paid_net: 6000,
      remaining_payable: 3042.75,
      draft_count: 0,
      approved_count: 1,
      paid_count: 4,
      cancelled_count: 1,
    },
    owner_funds: { held: 1042.75 },
  };

  const goldenMaintenance: Maintenance[] = [
    {
      id: 'm-g1',
      property_id: 'p-g1',
      unit_id: 'u-g1',
      title: 'صيانة مكيف شقة 201',
      no: 'WO-200',
      reference: 'WO-200',
      request_date: '2026-03-08',
      created_at: '2026-03-08T00:00:00Z',
      status: 'resolved',
      technician_name: 'شركة التبريد',
      charged_to: 'owner',
      cost: 200,
      expense_id: 'exp-g1', // linked to expense
    },
    {
      id: 'm-g2',
      property_id: 'p-g1',
      unit_id: 'u-g2',
      title: 'إصلاح باب شقة 302',
      no: 'WO-201',
      reference: 'WO-201',
      request_date: '2026-03-12',
      created_at: '2026-03-12T00:00:00Z',
      status: 'in_progress',
      technician_name: 'نجار',
      charged_to: 'tenant',
      cost: 80,
      expense_id: null, // NOT linked to expense
    },
  ] as unknown as Maintenance[];

  const goldenUtilities: UtilityBill[] = [
    {
      id: 'ub-g1',
      meter_id: 'mt-g1',
      property_id: 'p-g1',
      unit_id: 'u-g1',
      bill_number: 'WAT-2026-03',
      billing_period_start: '2026-03-01',
      billing_period_end: '2026-03-31',
      previous_reading: 50,
      current_reading: 80,
      consumption_units: 30,
      amount: 25,
      paid_amount: 25,
      due_date: '2026-04-15',
      status: 'paid',
      responsible_party: 'tenant',
      created_at: '2026-03-25T00:00:00Z',
    },
  ] as unknown as UtilityBill[];

  const goldenSettlements: OwnerSettlementRecord[] = [
    {
      id: 'stl-g1',
      owner_id: 'o-golden',
      owner_name: 'خالد بن عبدالله',
      property_id: 'p-g1',
      property_title: 'مجمع النور',
      period_start: '2026-03-01',
      period_end: '2026-03-31',
      gross_rent_collected: 3500,
      management_fee_amount: 245,
      owner_expenses: 200,
      fee_vat_amount: 12.25,
      net_payable_amount: 3042.75,
      status: 'approved',
      payout_reference: null,
      created_at: '2026-04-01T00:00:00Z',
    },
    {
      id: 'stl-g2',
      owner_id: 'o-golden',
      owner_name: 'خالد بن عبدالله',
      property_id: 'p-g1',
      property_title: 'مجمع النور',
      period_start: '2026-02-01',
      period_end: '2026-02-28',
      gross_rent_collected: 3200,
      management_fee_amount: 224,
      owner_expenses: 100,
      fee_vat_amount: 11.2,
      net_payable_amount: 2864.8,
      status: 'paid',
      payout_reference: 'TRF-2026-042',
      created_at: '2026-03-01T00:00:00Z',
    },
    {
      id: 'stl-g3',
      owner_id: 'o-golden',
      owner_name: 'خالد بن عبدالله',
      property_id: 'p-g2',
      property_title: 'برج الأفق',
      period_start: '2026-01-01',
      period_end: '2026-01-31',
      gross_rent_collected: 1500,
      management_fee_amount: 105,
      owner_expenses: 0,
      fee_vat_amount: 5.25,
      net_payable_amount: 1389.75,
      status: 'cancelled',
      payout_reference: null,
      created_at: '2026-02-01T00:00:00Z',
    },
  ];

  const goldenContext: OwnerReportContext = {
    ownerName: 'خالد بن عبدالله',
    periodFrom: '2026-03-01',
    periodTo: '2026-03-31',
    scopeLabel: 'عقارات المالك المُدارة (2)',
    propertyTitles: new Map([['p-g1', 'مجمع النور'], ['p-g2', 'برج الأفق']]),
    statement: goldenStatement,
    position: goldenPosition,
    settlements: goldenSettlements,
    maintenanceRows: goldenMaintenance,
    utilityBills: goldenUtilities,
  };

  it('produces the full Golden Report without double-counting or mislabeling', () => {
    const payload = buildOwnerReportPayload(goldenContext);

    // --- Executive summary uses canonical position ---
    const kpiBlock = allBlocks(payload).find((block) => (block as { kind?: string }).kind === 'kpis') as {
      kind: string; kpis: Array<{ label: string; value: { value: number } }>;
    };
    const collections = kpiBlock.kpis.find((k) => k.label === 'التحصيلات العائدة للمالك');
    expect(collections?.value.value).toBe(3500);
    const fees = kpiBlock.kpis.find((k) => k.label === 'أتعاب إدارة الأملاك');
    expect(fees?.value.value).toBe(245);

    // --- Daily movement shows ALL 4 transactions ---
    const movementTable = findTable(payload, 'الحركة المالية اليومية التفصيلية');
    expect(movementTable!.table.rows).toHaveLength(4);
    // Settlement type is correctly labeled
    expect(movementTable!.table.rows[3][1]).toEqual({ kind: 'text', value: 'تسوية / صرف' });

    // --- Maintenance table has both rows; cost is operational info only ---
    const maintTable = findTable(payload, 'تفاصيل الصيانة');
    expect(maintTable!.table.rows).toHaveLength(2);
    // m-g1: linked to expense → "نعم"
    expect(maintTable!.table.rows[0][7]).toEqual({ kind: 'text', value: 'نعم' });
    // m-g2: NOT linked to expense → "—"
    expect(maintTable!.table.rows[1][7]).toEqual({ kind: 'text', value: '—' });
    // m-g2 charged to tenant, not owner
    expect(maintTable!.table.rows[1][5]).toEqual({ kind: 'text', value: 'المستأجر' });

    // --- Expense table shows only the statement expense (not maintenance cost) ---
    const expTable = findTable(payload, 'تفاصيل المصروفات المسجلة');
    expect(expTable!.table.rows).toHaveLength(1);
    expect(expTable!.table.rows[0][2]).toEqual({ kind: 'text', value: 'صيانة مكيف شقة 201' });
    // Maintenance cost 200 is the same figure — NOT double-counted

    // --- Utility shows tenant responsibility correctly ---
    const utilTable = findTable(payload, 'الخدمات والمرافق');
    expect(utilTable!.table.rows).toHaveLength(1);
    expect(utilTable!.table.rows[0][6]).toEqual({ kind: 'text', value: 'المستأجر' });

    // --- Settlements: approved ≠ paid, cancelled filtered ---
    const stlTable = findTable(payload, 'تسويات مستحقات المالك');
    expect(stlTable!.table.rows).toHaveLength(2); // approved + paid, cancelled filtered
    expect(stlTable!.table.rows[0][2]).toEqual({ kind: 'text', value: 'كشف تسوية مالك معتمد للصرف' });
    expect(stlTable!.table.rows[0][4]).toEqual({ kind: 'text', value: '—' }); // no payout ref for approved
    expect(stlTable!.table.rows[1][2]).toEqual({ kind: 'text', value: 'كشف تسوية مالك مصروف ومسدد' });
    expect(stlTable!.table.rows[1][4]).toEqual({ kind: 'text', value: 'TRF-2026-042' });

    // --- Final reconciliation is last and uses canonical position ---
    const lastGroup = payload.groups[payload.groups.length - 1];
    const finalTable = lastGroup.blocks.find((block) => (block as { table?: { title?: string } }).table?.title === 'الحساب الختامي — تسوية حساب المالك') as { table: { rows: unknown[][] } };
    expect(finalTable).toBeDefined();
    expect(finalTable.table.rows).toHaveLength(7);
    // Final row shows remaining payable from canonical authority
    expect(finalTable.table.rows[6][1]).toEqual({ kind: 'amount', value: 3042.75 });
  });
});

describe('loadOwnerReportContext', () => {
  const authority = { position, statement: { total_gross: 5000, total_deductions: 250, total_net: 4750 } };
  const ownerSettlements = [
    { ...approvedSettlement, id: 'stl-owner-1' },
    { ...approvedSettlement, id: 'stl-owner-2', status: 'paid' as const },
    { ...approvedSettlement, id: 'stl-other', owner_id: 'o-02' },
  ] as unknown as OwnerSettlementRecord[];
  const ownerPropertyRows = [
    { id: 'p-01', title: 'برج الشروق' },
    { id: 'p-02', title: 'مجمع الواحة' },
  ] as unknown as ReturnType<typeof listOwnerProperties> extends Promise<infer T> ? T[number][] : Array<{ id: string; title: string }>;
  const maintenanceRows = [
    { id: 'm-1', property_id: 'p-01', request_date: '2026-02-10', created_at: '2026-02-10T00:00:00Z', status: 'open' },
    { id: 'm-2', property_id: 'p-02', request_date: '2026-02-15', created_at: '2026-02-15T00:00:00Z', status: 'resolved' },
    { id: 'm-3', property_id: 'p-99', request_date: '2026-02-20', created_at: '2026-02-20T00:00:00Z', status: 'open' },
    { id: 'm-4', property_id: 'p-01', request_date: '2026-03-05', created_at: '2026-03-05T00:00:00Z', status: 'open' },
  ] as unknown as Maintenance[];
  const utilityBills = [
    { id: 'b-1', property_id: 'p-01', billing_period_end: '2026-02-28', due_date: '2026-03-15', amount: 45, paid_amount: 0, status: 'unpaid', responsible_party: 'tenant' },
    { id: 'b-2', property_id: 'p-02', billing_period_end: '2026-01-31', due_date: '2026-02-10', amount: 30, paid_amount: 30, status: 'paid', responsible_party: 'tenant' },
    { id: 'b-3', property_id: 'p-99', billing_period_end: '2026-02-28', due_date: '2026-03-15', amount: 60, paid_amount: 0, status: 'unpaid', responsible_party: 'owner' },
  ] as unknown as UtilityBill[];

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('assembles the context from canonical authorities, scoped to the owner and the period', async () => {
    vi.mocked(getOwnerFinancialAuthority).mockResolvedValue(authority);
    vi.mocked(listOwnerSettlements).mockResolvedValue(ownerSettlements);
    vi.mocked(listOwnerProperties).mockResolvedValue(ownerPropertyRows);
    vi.mocked(listMaintenance).mockResolvedValue(maintenanceRows);
    vi.mocked(listUtilityBills).mockResolvedValue(utilityBills);

    const context = await loadOwnerReportContext({
      ownerId: 'o-01',
      from: '2026-02-01',
      to: '2026-02-28',
      statement,
    });

    expect(context.ownerName).toBe('سالم الحارثي');
    expect(context.periodFrom).toBe('2026-02-01');
    expect(context.periodTo).toBe('2026-02-28');
    expect(context.statement).toBe(statement);
    expect(context.position).toBe(position);
    expect(context.scopeLabel).toBe('عقارات المالك المُدارة (2)');

    // Settlements are already owner-filtered (the builder only drops cancelled).
    expect(context.settlements.map((settlement) => settlement.id)).toEqual(['stl-owner-1', 'stl-owner-2']);

    // Maintenance scoped to the owner's properties AND inside the period.
    expect(context.maintenanceRows.map((row) => row.id)).toEqual(['m-1', 'm-2']);
    // Utilities scoped to the owner's properties AND period-end inside the period.
    expect(context.utilityBills.map((bill) => bill.id)).toEqual(['b-1']);

    expect(context.propertyTitles?.get('p-01')).toBe('برج الشروق');
    expect(context.propertyTitles?.get('p-02')).toBe('مجمع الواحة');
  });

  it('collapses the operational scope to the selected property when it belongs to the owner', async () => {
    vi.mocked(getOwnerFinancialAuthority).mockResolvedValue(authority);
    vi.mocked(listOwnerSettlements).mockResolvedValue(ownerSettlements);
    vi.mocked(listOwnerProperties).mockResolvedValue(ownerPropertyRows);
    vi.mocked(listMaintenance).mockResolvedValue(maintenanceRows);
    vi.mocked(listUtilityBills).mockResolvedValue(utilityBills);

    const context = await loadOwnerReportContext({
      ownerId: 'o-01',
      from: '2026-02-01',
      to: '2026-02-28',
      propertyId: 'p-01',
      statement,
    });

    expect(context.scopeLabel).toBe('العقار: برج الشروق');
    expect(context.maintenanceRows.map((row) => row.id)).toEqual(['m-1']);
    expect(context.utilityBills.map((bill) => bill.id)).toEqual(['b-1']);
    expect([...context.propertyTitles!.keys()]).toEqual(['p-01']);
  });

  it('never claims a property scope that does not belong to the owner', async () => {
    vi.mocked(getOwnerFinancialAuthority).mockResolvedValue(authority);
    vi.mocked(listOwnerSettlements).mockResolvedValue(ownerSettlements);
    vi.mocked(listOwnerProperties).mockResolvedValue(ownerPropertyRows);
    vi.mocked(listMaintenance).mockResolvedValue(maintenanceRows);
    vi.mocked(listUtilityBills).mockResolvedValue(utilityBills);

    const context = await loadOwnerReportContext({
      ownerId: 'o-01',
      from: '2026-02-01',
      to: '2026-02-28',
      propertyId: 'p-99',
      statement,
    });

    // Falls back to the owner's real property scope instead of faking p-99.
    expect(context.scopeLabel).toBe('عقارات المالك المُدارة (2)');
    expect(context.maintenanceRows.map((row) => row.id)).toEqual(['m-1', 'm-2']);
    expect(context.propertyTitles?.has('p-99')).toBe(false);
  });
});
