import { describe, expect, it, vi } from 'vitest';
import {
  aggregatePropertyReportData,
  buildMonthlyCollectionTrend,
  buildOccupancyTrend,
  buildPropertyReportPayload,
  downloadPropertyReportPdf,
  printPropertyReport,
  type PropertyReadModelInput,
  type PropertyReportData,
  type UnitPerformanceRow,
} from './professional-property-report';
import { documentService } from '@/services/documents/DocumentService';
import type { AgedReceivablesReport } from '@/features/financials/reports/arrears-reports-service';
import type { DailyCollectionReportRow, ExpenseBreakdownReport, FinancialPeriodSummaryReport } from '@/features/financials/reports/financial-reporting';
import type { ContractListItem } from '@/features/contracts/services/contractService';
import type { Maintenance } from '@/features/maintenance/maintenance-service';
import type { Unit } from '@/types/domain';
import type { ExpiringContractRow } from '../reports-page.helpers';
import type { ReportsWorkspaceModel } from '../use-reports-workspace';
import type { ReportsFilterState } from '../reports-workspace-filters';

vi.mock('@/services/documents/DocumentService', () => ({
  documentService: {
    printDocument: vi.fn().mockResolvedValue(undefined),
    downloadDocumentPdf: vi.fn().mockResolvedValue(undefined),
  },
}));

// Period-scoped invoice/payment detail + units are read-model inputs to the
// loader; resolve them to empty deterministic sets in the action tests.
vi.mock('@/features/financials/reports/financial-reporting/report-loaders', () => ({
  loadInvoices: vi.fn().mockResolvedValue([]),
  loadPayments: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/features/units/unit-service', () => ({
  listUnits: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/features/financials/reports/financialReportsService', () => ({
  getExpenseBreakdownReport: vi.fn().mockResolvedValue(null),
  getFinancialPeriodSummaryReport: vi.fn().mockResolvedValue(null),
  getOverdueInvoicesReport: vi.fn().mockResolvedValue({ asOf: '2026-01-31', totalOverdue: 0, invoiceCount: 0, rows: [] }),
}));
vi.mock('../reports-collection-efficiency', () => ({
  getAuthoritativeReportsCollectionRate: vi.fn().mockResolvedValue(null),
}));

const validSettings = {
  companyName: 'شركة مسار العقارية',
  crNumber: '12345678',
  taxNumber: 'OM12345678',
  currency: 'OMR',
  city: 'مسقط',
  documentPrefixes: {},
};

const summary: FinancialPeriodSummaryReport = {
  invoiced: 5000,
  paid: 4000,
  outstanding: 1000,
  expenses: 300,
  netCash: 3700,
  invoicesCount: 10,
  paymentsCount: 8,
  expensesCount: 3,
};

const agedReport: AgedReceivablesReport = {
  asOf: '2026-02-28',
  totalOutstanding: 1000,
  totalOverdue: 600,
  buckets: {
    current: { key: 'current', label: 'غير متأخر', total: 400, invoiceCount: 2 },
    days_1_30: { key: 'days_1_30', label: '1–30 يوم', total: 300, invoiceCount: 1 },
    days_31_60: { key: 'days_31_60', label: '31–60 يوم', total: 200, invoiceCount: 1 },
    days_61_90: { key: 'days_61_90', label: '61–90 يوم', total: 100, invoiceCount: 1 },
    days_90_plus: { key: 'days_90_plus', label: '+90 يوم', total: 0, invoiceCount: 0 },
  },
  rows: [],
};

const expenseReport: ExpenseBreakdownReport = {
  totalExpenses: 300,
  expensesCount: 3,
  byCategory: [
    { category: 'صيانة', total: 200, count: 2 },
    { category: 'نظافة', total: 100, count: 1 },
  ],
  byProperty: [],
};

const maintenanceRows = [
  { id: 'm-01', property_id: 'p-01', request_date: '2026-02-10', created_at: '2026-02-10T00:00:00Z', status: 'resolved', resolved_at: '2026-02-14T00:00:00Z' },
  { id: 'm-02', property_id: 'p-01', request_date: '2026-02-20', created_at: '2026-02-20T00:00:00Z', status: 'open' },
] as unknown as Maintenance[];

const expiringRows: ExpiringContractRow[] = [
  { contractId: 'c-01', tenantName: 'سالم الكعبي', propertyTitle: 'برج الشروق', unitNumber: '101', endDate: '2026-03-31', daysRemaining: 31, monthlyRent: 400 },
];

const vacancyRows: PropertyReportData['vacancyRows'] = [
  { unitNumber: '203', propertyTitle: 'برج الشروق', daysVacant: 45, referenceRent: 350 },
];

const unitRows: UnitPerformanceRow[] = [
  { unit: '101', statusLabel: 'مشغولة', tenant: 'سالم الكعبي', rent: 400, due: 400, collected: 400, overdue: null, endDate: '2026-03-31' },
];

function makeAggregateInput(): PropertyReadModelInput {
  return {
    from: '2026-02-01',
    to: '2026-02-28',
    asOf: '2026-02-28',
    occupancyRows: [{ occupied: 8, vacant: 2 }],
    summary,
    overdueTotal: 600,
    arrears: agedReport,
    expenseReport,
    maintenanceRows,
    expiringRows,
    expiringRentExposed: 400,
    vacancyAnalytics: {
      totalUnits: 10,
      occupiedUnits: 8,
      availableUnits: 2,
      nonRentableUnits: 0,
      occupancyRate: 80,
      vacancyRate: 20,
      averageVacancyDays: 22.5,
      referenceVacantRent: 350,
      previousMonthOccupancyRate: 75,
      occupancyChangePoints: 5,
      previousMonthEnd: '2026-01-31',
      vacantRows: [
        { unitId: 'u-203', propertyId: 'p-01', unitNumber: '203', propertyTitle: 'برج الشروق', referenceRent: 350, lastContractEndDate: '2026-01-14', vacancySince: '2026-01-14', vacancySinceSource: 'contract_end', daysVacant: 45 },
      ],
      vacancyRiskRows: [],
    },
    unitRows,
    monthlyCollectionTrend: [
      { month: '2026-02', due: 5000, collected: 4000 },
      { month: '2026-01', due: 4500, collected: 4200 },
    ],
    occupancyTrend: [
      { month: '2026-01', occupied: 7, vacant: 3 },
      { month: '2026-02', occupied: 8, vacant: 2 },
    ],
    vacancyRows,
    previous: {
      occupancyRate: 75,
      due: 4500,
      collected: 4200,
      outstanding: 300,
      arrears: 500,
      expenses: 250,
      maintenanceCount: 2,
      maintenanceOpen: 1,
      averageVacancyDays: 30,
      collectionRate: null,
    },
    portfolio: null,
    utilitiesTotal: null,
  };
}

function allBlocks(payload: { groups: Array<{ blocks: unknown[] }> }): unknown[] {
  return payload.groups.flatMap((group) => group.blocks);
}

describe('professional-property-report adapter', () => {
  it('builds the performance payload with an executive KPI page and final summary', () => {
    const data = aggregatePropertyReportData(makeAggregateInput());
    const payload = buildPropertyReportPayload({ ...data, isPortfolioScope: true, collectionRateCurrent: 92, collectionRatePrevious: 90 });

    expect(payload.reportType).toBe('Property_Performance_Report');
    expect(payload.periodFrom).toBe('2026-02-01');

    const kpiBlock = payload.groups[0].blocks.find((block) => (block as { kind?: string }).kind === 'kpis') as {
      kind: string;
      kpis: Array<{ label: string; value: { kind: string; value: number }; comparison?: { value: string } }>;
    };
    const occupancyKpi = kpiBlock.kpis.find((kpi) => kpi.label === 'نسبة الإشغال');
    expect(occupancyKpi?.value).toEqual({ kind: 'percent', value: 80 });
    expect(occupancyKpi?.comparison?.value).toBe('+5 نقاط');

    const collectionKpi = kpiBlock.kpis.find((kpi) => kpi.label === 'نسبة التحصيل (معتمدة)');
    expect(collectionKpi?.value).toEqual({ kind: 'percent', value: 92 });

    // Comparison table appears because a previous period exists.
    const comparisonTable = allBlocks(payload).find(
      (block) => (block as { table?: { title?: string } }).table?.title === 'مقارنة الأداء: الفترة الحالية مقابل الفترة السابقة',
    ) as { table: { rows: unknown[][] } };
    expect(comparisonTable).toBeDefined();
    expect(comparisonTable.table.rows.some((row) => (row[0] as { value?: string }).value === 'نسبة الإشغال')).toBe(true);

    // Last group is the final summary and is keep-together.
    const lastGroup = payload.groups[payload.groups.length - 1];
    expect(lastGroup.keepTogether).toBe(true);
    const finalTable = lastGroup.blocks.find(
      (block) => (block as { table?: { title?: string } }).table?.title === 'الملخص المالي والتشغيلي الختامي',
    ) as { table: { rows: unknown[][] } };
    expect(finalTable).toBeDefined();
    expect(finalTable.table.rows[1]).toEqual([{ kind: 'text', value: 'التحصيلات الفعلية' }, { kind: 'amount', value: 4000 }]);

    // No numeric row/KPI label ever claims the result is "profit".
    const labels: string[] = [];
    for (const block of allBlocks(payload)) {
      const b = block as { kind?: string; table?: { rows?: unknown[][] }; kpis?: Array<{ label: string }> };
      if (b.kpis) labels.push(...b.kpis.map((kpi) => kpi.label));
      for (const row of b.table?.rows ?? []) labels.push(String((row[0] as { value?: string })?.value ?? ''));
    }
    expect(labels.some((label) => label.includes('ربح'))).toBe(false);
  });

  it('omits the collection-rate KPI at single-property scope (not canonical)', () => {
    const data = aggregatePropertyReportData(makeAggregateInput());
    const payload = buildPropertyReportPayload({
      ...data,
      isPortfolioScope: false,
      collectionRateCurrent: null,
      propertyTitle: 'برج الشروق',
      scopeLabel: 'العقار: برج الشروق',
    });

    const kpiBlock = payload.groups[0].blocks.find((block) => (block as { kind?: string }).kind === 'kpis') as {
      kind: string;
      kpis: Array<{ label: string }>;
    };
    expect(kpiBlock.kpis.some((kpi) => kpi.label === 'نسبة التحصيل (معتمدة)')).toBe(false);
  });

  it('shows a portfolio benchmark table at single-property scope', () => {
    const data = aggregatePropertyReportData(makeAggregateInput());
    const payload = buildPropertyReportPayload({
      ...data,
      isPortfolioScope: false,
      propertyTitle: 'برج الشروق',
      scopeLabel: 'العقار: برج الشروق',
      portfolio: {
        occupancyRate: 92,
        totalUnits: 20,
        occupiedUnits: 18,
        vacantUnits: 2,
        expensePerOccupiedUnit: 80,
      },
    });

    const benchmarkTable = allBlocks(payload).find(
      (block) => (block as { table?: { title?: string } }).table?.title === 'مقارنة العقار مع متوسط المحفظة',
    ) as { table: { rows: unknown[][] } };
    expect(benchmarkTable).toBeDefined();
    expect(benchmarkTable.table.rows[0]).toEqual([
      { kind: 'text', value: 'نسبة الإشغال' },
      { kind: 'percent', value: 80 },
      { kind: 'percent', value: 92 },
    ]);
  });

  it('aggregates canonical read models deterministically (maintenance counts, buckets, expenses)', () => {
    const data = aggregatePropertyReportData(makeAggregateInput());

    expect(data.maintenancePeriodCount).toBe(2); // m-01 + m-02 both requested inside the Feb period
    expect(data.maintenanceOpenAsOf).toBe(1); // m-02 open as of 2026-02-28; m-01 resolved before asOf
    expect(data.expiringCount).toBe(1);
    expect(data.expenseTotal).toBe(300);
    expect(data.expenseByCategory).toHaveLength(2);
    expect(data.arrearsBuckets?.find((bucket) => bucket.label === '31–60 يوم')?.total).toBe(200);
    expect(data.vacancyCount).toBe(1);
    expect(data.longestVacancyDays).toBe(45);
    expect(data.averageVacancyDays).toBe(22.5);
  });

  it('builds the monthly due-vs-collected trend from period-scoped daily collections', () => {
    const daily: DailyCollectionReportRow[] = [
      { paymentDate: '2026-02-10', totalPaid: 100, paymentsCount: 1, methodTotals: {} as DailyCollectionReportRow['methodTotals'] },
      { paymentDate: '2026-02-20', totalPaid: 50, paymentsCount: 1, methodTotals: {} as DailyCollectionReportRow['methodTotals'] },
      { paymentDate: '2026-01-30', totalPaid: 999, paymentsCount: 1, methodTotals: {} as DailyCollectionReportRow['methodTotals'] },
    ];
    const invoices = [
      { dueDate: '2026-02-15', amount: 200 },
      { dueDate: '2026-01-01', amount: 999 },
      { dueDate: null, amount: 1 },
    ];

    const trend = buildMonthlyCollectionTrend(daily, invoices, '2026-02-01', '2026-02-28');
    expect(trend).toEqual([{ month: '2026-02', due: 200, collected: 150 }]);
  });

  it('builds the month-end occupancy trend from contracts deterministically', () => {
    const units = [
      { id: 'u-01', property_id: 'p-01', unit_number: '101', status: 'occupied' },
      { id: 'u-02', property_id: 'p-01', unit_number: '102', status: 'vacant' },
    ] as unknown as Unit[];
    const contracts = [
      { id: 'c-01', unit_id: 'u-01', property_id: 'p-01', start_date: '2025-01-01', end_date: '2026-03-31', deleted_at: null },
    ] as unknown as ContractListItem[];

    const trend = buildOccupancyTrend(contracts, units, '2026-01-01', '2026-03-31');
    expect(trend).toHaveLength(3);
    // u-01 covered for all three months (contract spans the whole range).
    expect(trend[0]).toEqual({ month: '2026-01', occupied: 1, vacant: 1 });
    expect(trend[1]).toEqual({ month: '2026-02', occupied: 1, vacant: 1 });
    expect(trend[2]).toEqual({ month: '2026-03', occupied: 1, vacant: 1 });
  });

  it('delegates print and PDF download to documentService with the property_report type', async () => {
    const model = {
      filters: { costCenterRows: [], ownerRows: [], contractRows: [] },
      hero: { summary: null, collectionRate: 0 },
      sections: {
        overview: { summary: null },
        collections: { rows: [] },
        overdue: { rows: [], agedReport: null },
        expenses: { report: null },
        occupancy: { occupancyRows: [], expiringRows: [], vacancyAnalytics: null },
        maintenance: { rows: [] },
      },
    } as unknown as ReportsWorkspaceModel;
    const filters = {
      from: '2026-02-01',
      to: '2026-02-28',
      asOf: '2026-02-28',
      propertyId: undefined,
    } as unknown as ReportsFilterState;

    await printPropertyReport({ settings: validSettings, model, filters });
    expect(documentService.printDocument).toHaveBeenCalledWith('property_report', expect.objectContaining({
      settings: validSettings,
      payload: expect.objectContaining({ reportType: 'Property_Performance_Report' }),
    }));

    await downloadPropertyReportPdf({ settings: validSettings, model, filters });
    expect(documentService.downloadDocumentPdf).toHaveBeenCalledWith('property_report', expect.objectContaining({
      settings: validSettings,
      payload: expect.objectContaining({ reportType: 'Property_Performance_Report' }),
    }));
  });
});
