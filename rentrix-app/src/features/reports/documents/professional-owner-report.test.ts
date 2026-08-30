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

    // Collection detail table uses the statement's payment transactions verbatim.
    const collectionTable = allBlocks(payload).find(
      (block) => (block as { kind?: string; table?: { title?: string } }).kind === 'table'
        && (block as { table?: { title?: string } }).table?.title === 'تفاصيل التحصيلات العائدة للمالك (إيرادات الإيجار)',
    ) as { kind: string; table: { rows: unknown[][] } };
    expect(collectionTable.table.rows).toHaveLength(1);
    expect(collectionTable.table.rows[0][3]).toEqual({ kind: 'amount', value: 1000 });
  });

  it('never invents financial data when no authority is available', () => {
    const payload = buildOwnerReportPayload({ ...baseContext, statement: null, position: null });

    const note = allBlocks(payload).find(
      (block) => (block as { kind?: string }).kind === 'note'
        && (block as { note?: { text?: string } }).note?.text?.includes('لا توجد بيانات مالية معتمدة'),
    ) as { kind: string; note: { text: string } };
    expect(note).toBeDefined();
    expect(note.note.text).toContain('لا توجد بيانات مالية معتمدة للفترة.');

    // No final account rows may be fabricated.
    const finalTable = allBlocks(payload).find(
      (block) => (block as { table?: { title?: string } }).table?.title === 'الحساب الختامي — تسوية حساب المالك',
    ) as { table: { rows: unknown[][] } };
    expect(finalTable.table.rows).toHaveLength(0);
  });

  it('filters cancelled settlements and labels approved ones truthfully', () => {
    const payload = buildOwnerReportPayload({
      ...baseContext,
      statement,
      settlements: [approvedSettlement, cancelledSettlement],
    });

    const settlementTable = allBlocks(payload).find(
      (block) => (block as { table?: { title?: string } }).table?.title === 'تسويات مستحقات المالك',
    ) as { table: { rows: unknown[][] } };
    expect(settlementTable.table.rows).toHaveLength(1);
    expect(settlementTable.table.rows[0][2]).toEqual({ kind: 'text', value: 'كشف تسوية مالك معتمد للصرف' });
    expect(settlementTable.table.rows[0][3]).toEqual({ kind: 'amount', value: 4437.5 });
  });

  it('renders maintenance and utility operational tables with truthful labels', () => {
    const payload = buildOwnerReportPayload({ ...baseContext, statement, maintenanceRows, utilityBills });

    const maintenanceTable = allBlocks(payload).find(
      (block) => (block as { table?: { title?: string } }).table?.title === 'تفاصيل الصيانة',
    ) as { table: { rows: unknown[][] } };
    expect(maintenanceTable.table.rows).toHaveLength(1);
    // [date, property, work order, status, technician, charged-to, cost, linked-expense]
    expect(maintenanceTable.table.rows[0][3]).toEqual({ kind: 'text', value: 'قيد التنفيذ' });
    expect(maintenanceTable.table.rows[0][5]).toEqual({ kind: 'text', value: 'المالك' });
    expect(maintenanceTable.table.rows[0][6]).toEqual({ kind: 'amount', value: 60 });
    expect(maintenanceTable.table.rows[0][7]).toEqual({ kind: 'text', value: 'نعم' });

    const utilityTable = allBlocks(payload).find(
      (block) => (block as { table?: { title?: string } }).table?.title === 'الخدمات والمرافق',
    ) as { table: { rows: unknown[][] } };
    expect(utilityTable.table.rows).toHaveLength(1);
    expect(utilityTable.table.rows[0][6]).toEqual({ kind: 'text', value: 'المستأجر' });
    expect(utilityTable.table.rows[0][7]).toEqual({ kind: 'text', value: 'مسددة بالكامل' });
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
