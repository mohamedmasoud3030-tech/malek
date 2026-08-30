/**
 * Property Performance Report (تقرير أداء العقار) — professional
 * property-performance document.
 *
 * Unlike the Owner Report (financial traceability + settlement), this
 * document answers PERFORMANCE questions: is the property performing well,
 * improving or deteriorating, where are the risks, which units need
 * intervention. It is more visual (deterministic print charts, executive KPI
 * page) and ends with a Property Performance Summary — never an owner
 * settlement.
 *
 * Financial truth rules enforced here:
 *  - Period amounts come from the canonical reports RPCs (financial period
 *    summary, arrears as-of, expense breakdown) and the authoritative
 *    portfolio collection rate (`rpt_dashboard_snapshot.collections.collection_rate`)
 *    — never recomputed in the browser for the portfolio.
 *  - Where a canonical portfolio rate does not apply (single-property
 *    scope), the report shows authoritative AMOUNTS and omits the rate
 *    rather than inventing a non-canonical ratio.
 *  - Comparisons use absolute differences and percentage POINTS (never
 *    percent-of-percent); the previous comparable period is the same-length
 *    window immediately before the selected period.
 *  - Occupancy trend is labelled as contractual coverage, deterministic
 *    from units + contracts (never a model/prediction).
 *  - No renewal probability, AI risk score or predictive confidence is
 *    invented: leasing/risk facts are deterministic (expiring contracts,
 *    vacancy duration, arrears).
 *  - collections − expenses is never labelled "profit".
 */
import type { ContractListItem } from '@/features/contracts/services/contractService';
import type { AgedReceivablesReport, OverdueInvoiceReportRow } from '@/features/financials/reports/arrears-reports-service';
import type {
  DailyCollectionReportRow,
  ExpenseBreakdownReport,
  FinancialPeriodSummaryReport,
} from '@/features/financials/reports/financial-reporting';
import type { InvoiceReportRow, PaymentWithInvoiceContext } from '@/features/financials/reports/financial-report-rows';
import { loadInvoices, loadPayments } from '@/features/financials/reports/financial-reporting/report-loaders';
import {
  getExpenseBreakdownReport,
  getFinancialPeriodSummaryReport,
  getOverdueInvoicesReport,
} from '@/features/financials/reports/financialReportsService';
import type { Maintenance } from '@/features/maintenance/maintenance-service';
import { isContractStatus } from '@/lib/contractStatus';
import { listUnits } from '@/features/units/unit-service';
import type { Unit } from '@/types/domain';
import { buildVacancyAnalytics, type VacancyAnalytics } from '@/features/units/vacancy-analytics';
import { documentService } from '@/services/documents/DocumentService';
import { hasCompleteCompanyIdentity, type DocumentCompanySettings } from '@/services/documents/companyIdentity';
import { runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import type { ProfessionalReportGroup, PropertyReportPayload, ReportCellFormat, ReportChartData } from '@/services/documents/documentPayloads';
import { getAuthoritativeReportsCollectionRate } from '../reports-collection-efficiency';
import { getTodayLocalDateString, type ExpiringContractRow } from '../reports-page.helpers';
import type { ReportsWorkspaceModel } from '../use-reports-workspace';
import type { ReportsFilterState } from '../reports-workspace-filters';
import { arabicMonthLabel, formatPointChange, formatSignedAmountChange, monthEndIso, monthKeyOf, previousPeriodRange } from './report-period';

/* ------------------------------------------------------------------ */
/* Truthful label maps                                                 */
/* ------------------------------------------------------------------ */

const OCCUPIED_UNIT_STATUSES = new Set(['occupied', 'rented']);
const isOccupiedUnitStatus = (status: string | null | undefined): boolean => OCCUPIED_UNIT_STATUSES.has(String(status ?? '').trim().toLowerCase());

const ARREARS_BUCKET_LABELS: Array<{ key: string; label: string }> = [
  { key: 'current', label: 'غير متأخر بعد' },
  { key: 'days_1_30', label: '1–30 يوم' },
  { key: 'days_31_60', label: '31–60 يوم' },
  { key: 'days_61_90', label: '61–90 يوم' },
  { key: 'days_90_plus', label: '+90 يوم' },
];

/* ------------------------------------------------------------------ */
/* Report data type (read models → deterministic metrics)              */
/* ------------------------------------------------------------------ */

export type UnitPerformanceRow = {
  unit: string;
  statusLabel: string;
  tenant: string;
  rent: number | null;
  due: number | null;
  collected: number | null;
  overdue: number | null;
  endDate: string | null;
};

export type PropertyReportData = {
  propertyTitle: string | null;
  propertyId?: string | null;
  scopeLabel: string;
  periodFrom?: string | null;
  periodTo?: string | null;
  generatedAt?: string | null;
  /** True when the report covers the whole managed portfolio. */
  isPortfolioScope: boolean;
  /** Authoritative portfolio collection rate (null at single-property scope). */
  collectionRateCurrent: number | null;
  collectionRatePrevious: number | null;
  asOf: string;
  occupancy: { units: number; occupied: number; vacant: number; rate: number | null };
  summary: FinancialPeriodSummaryReport | null;
  overdueTotal: number | null;
  arrearsAsOf: string | null;
  arrearsBuckets: Array<{ label: string; total: number }> | null;
  expenseTotal: number | null;
  expenseByCategory: Array<{ category: string; total: number }>;
  maintenancePeriodCount: number;
  maintenanceOpenAsOf: number;
  expiringCount: number;
  expiringRentExposed: number | null;
  expiringRowsSlice: readonly ExpiringContractRow[] | null;
  longestVacancyDays: number | null;
  averageVacancyDays: number | null;
  vacancyCount: number;
  vacancyRows: Array<{ unitNumber: string; propertyTitle: string; daysVacant: number; referenceRent: number | null }> | null;
  monthlyCollectionTrend: Array<{ month: string; due: number; collected: number }>;
  occupancyTrend: Array<{ month: string; occupied: number; vacant: number }>;
  unitRows: UnitPerformanceRow[];
  /** Total utility invoices in scope when the caller can supply them (else omitted truthfully). */
  utilitiesTotal?: number | null;
  previous: {
    occupancyRate: number | null;
    due: number | null;
    collected: number | null;
    outstanding: number | null;
    arrears: number | null;
    expenses: number | null;
    maintenanceCount: number | null;
    maintenanceOpen: number | null;
    averageVacancyDays: number | null;
    collectionRate: number | null;
  } | null;
  portfolio?: {
    occupancyRate: number | null;
    totalUnits: number;
    occupiedUnits: number;
    vacantUnits: number;
    expensePerOccupiedUnit: number | null;
  } | null;
};

/* ------------------------------------------------------------------ */
/* Cell helpers (engine formats amounts/percent, adapters only shape)  */
/* ------------------------------------------------------------------ */

const text = (value: string | null | undefined): ReportCellFormat => ({ kind: 'text', value: value?.trim() || '—' });
const amount = (value: number | null | undefined): ReportCellFormat => ({ kind: 'amount', value: value ?? 0 });
const percentOf = (value: number | null | undefined): ReportCellFormat => (value != null ? { kind: 'percent', value } : text('—'));
const countCell = (value: number | null | undefined): ReportCellFormat => (value != null ? { kind: 'text', value: String(value) } : text('—'));
const dateLabel = (value: string | null | undefined): string => (value ? value.slice(0, 10) : '—');

/** Signed absolute change (amounts/counts — never percent-of-percent). */
const amountDelta = formatSignedAmountChange;

/** Signed percentage-POINT change for rates. */
const pointDelta = formatPointChange;

/* ------------------------------------------------------------------ */
/* Deterministic helpers                                               */
/* ------------------------------------------------------------------ */

function unitOccupiedAsOf(contracts: readonly ContractListItem[], unitId: string, asOfIso: string): boolean {
  for (const contract of contracts) {
    if (contract.unit_id !== unitId) continue;
    if (contract.deleted_at) continue;
    if (!contract.start_date || contract.start_date > asOfIso) continue;
    if (contract.end_date && contract.end_date < asOfIso) continue;
    return true;
  }
  return false;
}

function isOpenMaintenanceRequest(request: Maintenance): boolean {
  return !['resolved', 'closed', 'cancelled'].includes(String(request.status ?? '').toLowerCase());
}

function maintenanceRequestOpenAsOf(request: Maintenance, asOf: string): boolean {
  const requestDate = (request.request_date ?? request.created_at)?.slice(0, 10);
  if (!requestDate || requestDate > asOf) return false;
  if (isOpenMaintenanceRequest(request)) return true;
  const terminalDate = (request.cancelled_at ?? request.resolved_at ?? request.completed_at)?.slice(0, 10);
  return Boolean(terminalDate && terminalDate > asOf);
}

function maintenanceInPeriod(request: Maintenance, from: string, to: string): boolean {
  const date = (request.request_date ?? request.created_at)?.slice(0, 10);
  return Boolean(date && date >= from && date <= to);
}

export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  let cursor = `${from.slice(0, 7)}-01`;
  const endKey = to.slice(0, 7);
  let guard = 0;
  while (cursor.slice(0, 7) <= endKey && guard < 240) {
    months.push(cursor.slice(0, 7));
    const [year, month] = cursor.slice(0, 7).split('-').map(Number);
    cursor = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    guard += 1;
  }
  return months;
}

function aggregateArrearsBuckets(aged: AgedReceivablesReport | null): Array<{ label: string; total: number }> | null {
  if (!aged) return null;
  return ARREARS_BUCKET_LABELS.map(({ key, label }) => ({ label, total: aged.buckets[key as keyof typeof aged.buckets]?.total ?? 0 }));
}

function countMaintenanceInPeriod(rows: readonly Maintenance[], from: string, to: string): number {
  return rows.filter((row) => maintenanceInPeriod(row, from, to)).length;
}

function countMaintenanceOpenAsOf(rows: readonly Maintenance[], asOf: string): number {
  return rows.filter((row) => maintenanceRequestOpenAsOf(row, asOf.slice(0, 10))).length;
}

function occupancyFromRows(rows: Array<{ occupied: number; vacant: number }>): { units: number; occupied: number; vacant: number; rate: number | null } {
  const occupied = rows.reduce((sum, row) => sum + row.occupied, 0);
  const vacant = rows.reduce((sum, row) => sum + row.vacant, 0);
  const units = occupied + vacant;
  return { units, occupied, vacant, rate: units > 0 ? (occupied / units) * 100 : null };
}

/* ------------------------------------------------------------------ */
/* Payload builder (pure & deterministic)                              */
/* ------------------------------------------------------------------ */

export function buildPropertyReportPayload(data: PropertyReportData): PropertyReportPayload {
  const { occupancy, summary } = data;
  const occupancyRate = occupancy.rate;
  const prev = data.previous;
  const prevOccupancyRate = prev?.occupancyRate ?? null;

  const groups: ProfessionalReportGroup[] = [];

  /* --- Group 1 — executive property-performance page --- */
  const kpis: Array<{ label: string; value: ReportCellFormat; comparison?: ReportCellFormat | null }> = [
    { label: 'نسبة الإشغال', value: percentOf(occupancyRate), comparison: text(pointDelta(occupancyRate, prevOccupancyRate)) },
    { label: 'الوحدات المشغولة', value: countCell(occupancy.occupied) },
    { label: 'الوحدات الشاغرة', value: countCell(occupancy.vacant) },
  ];
  if (data.isPortfolioScope && data.collectionRateCurrent != null) {
    kpis.push({
      label: 'نسبة التحصيل (معتمدة)',
      value: percentOf(data.collectionRateCurrent),
      comparison: text(pointDelta(data.collectionRateCurrent, data.collectionRatePrevious)),
    });
  }
  kpis.push(
    { label: 'المستحق للفترة', value: amount(summary?.invoiced ?? null), comparison: text(amountDelta(summary?.invoiced ?? null, prev?.due ?? null)) },
    { label: 'المحصل للفترة', value: amount(summary?.paid ?? null), comparison: text(amountDelta(summary?.paid ?? null, prev?.collected ?? null)) },
    { label: 'المتبقي', value: amount(summary?.outstanding ?? null), comparison: text(amountDelta(summary?.outstanding ?? null, prev?.outstanding ?? null)) },
    { label: 'المتأخرات', value: amount(data.overdueTotal), comparison: text(amountDelta(data.overdueTotal, prev?.arrears ?? null)) },
    { label: 'المصروفات المسجلة', value: amount(data.expenseTotal), comparison: text(amountDelta(data.expenseTotal, prev?.expenses ?? null)) },
    { label: 'صيانة مفتوحة', value: countCell(data.maintenanceOpenAsOf), comparison: text(amountDelta(data.maintenanceOpenAsOf, prev?.maintenanceOpen ?? null)) },
    { label: 'عقود تنتهي قريبًا', value: countCell(data.expiringCount) },
  );

  const execBlocks: ProfessionalReportGroup['blocks'] = [{ kind: 'kpis', kpis }];

  if (prev) {
    const comparisonRows: ReportCellFormat[][] = [
      [text('نسبة الإشغال'), percentOf(occupancyRate), prevOccupancyRate != null ? percentOf(prevOccupancyRate) : text('—'), text(pointDelta(occupancyRate, prevOccupancyRate) ?? '—')],
    ];
    if (data.isPortfolioScope && data.collectionRateCurrent != null) {
      comparisonRows.push([
        text('نسبة التحصيل (معتمدة)'),
        percentOf(data.collectionRateCurrent),
        data.collectionRatePrevious != null ? percentOf(data.collectionRatePrevious) : text('—'),
        text(pointDelta(data.collectionRateCurrent, data.collectionRatePrevious) ?? '—'),
      ]);
    }
    comparisonRows.push(
      [text('المستحق'), amount(summary?.invoiced ?? null), amount(prev.due ?? null), text(amountDelta(summary?.invoiced ?? null, prev.due ?? null) ?? '—')],
      [text('المحصل'), amount(summary?.paid ?? null), amount(prev.collected ?? null), text(amountDelta(summary?.paid ?? null, prev.collected ?? null) ?? '—')],
      [text('المتبقي'), amount(summary?.outstanding ?? null), amount(prev.outstanding ?? null), text(amountDelta(summary?.outstanding ?? null, prev.outstanding ?? null) ?? '—')],
      [text('المتأخرات'), amount(data.overdueTotal), amount(prev.arrears ?? null), text(amountDelta(data.overdueTotal, prev.arrears ?? null) ?? '—')],
      [text('المصروفات'), amount(data.expenseTotal), amount(prev.expenses ?? null), text(amountDelta(data.expenseTotal, prev.expenses ?? null) ?? '—')],
      [text('طلبات الصيانة في الفترة'), countCell(data.maintenancePeriodCount), countCell(prev.maintenanceCount ?? null), text(amountDelta(data.maintenancePeriodCount, prev.maintenanceCount ?? null) ?? '—')],
      [text('متوسط مدة الشغور (أيام)'), countCell(data.averageVacancyDays ?? null), countCell(prev.averageVacancyDays ?? null), text(amountDelta(data.averageVacancyDays ?? null, prev.averageVacancyDays ?? null) ?? '—')],
    );
    execBlocks.push({
      kind: 'table',
      table: {
        title: 'مقارنة الأداء: الفترة الحالية مقابل الفترة السابقة',
        columns: ['المؤشر', 'الفترة الحالية', 'الفترة السابقة', 'التغير'],
        rows: comparisonRows,
      },
    });
  } else {
    execBlocks.push({
      kind: 'note',
      note: {
        text: 'لا تتوفر فترة سابقة قابلة للمقارنة (الشهر التقويمي السابق للفترات الشهرية، أو نافذة بنفس المدة لغيرها)؛ تُعرض المؤشرات الحالية دون مقارنة.',
        tone: 'neutral',
      },
    });
  }

  if (data.portfolio && !data.isPortfolioScope) {
    const p = data.portfolio;
    const propertyExpensePerOccupied = data.expenseTotal != null && occupancy.occupied > 0 ? data.expenseTotal / occupancy.occupied : null;
    execBlocks.push({
      kind: 'table',
      table: {
        title: 'مقارنة العقار مع متوسط المحفظة',
        columns: ['المؤشر', 'هذا العقار', 'متوسط المحفظة'],
        rows: [
          [text('نسبة الإشغال'), percentOf(occupancyRate), percentOf(p.occupancyRate)],
          [text('الوحدات المشغولة'), countCell(occupancy.occupied), countCell(p.occupiedUnits)],
          [text('الوحدات الشاغرة'), countCell(occupancy.vacant), countCell(p.vacantUnits)],
          [text('إجمالي الوحدات'), countCell(occupancy.units), countCell(p.totalUnits)],
          [text('مصروف لكل وحدة مشغولة'), amount(propertyExpensePerOccupied), amount(p.expensePerOccupiedUnit)],
        ],
      },
    });
  }

  groups.push({ blocks: execBlocks });

  /* --- Group 2 — charts page (collections trend + occupancy trend) --- */
  const trendBlocks: ProfessionalReportGroup['blocks'] = [];
  if (data.monthlyCollectionTrend.some((month) => month.due > 0 || month.collected > 0)) {
    const trendChart: ReportChartData = {
      chartType: 'bars',
      title: 'اتجاه التحصيل الشهري',
      caption: 'المستحق مقابل المحصل للفترة',
      categories: data.monthlyCollectionTrend.map((month) => arabicMonthLabel(month.month)),
      series: [
        { name: 'المستحق', values: data.monthlyCollectionTrend.map((month) => month.due) },
        { name: 'المحصل', values: data.monthlyCollectionTrend.map((month) => month.collected) },
      ],
      note: 'المستحق حسب تاريخ استحقاق الفواتير والمحصل حسب تواريخ الدفع — حركة الفترة وليست أرصدة.',
    };
    trendBlocks.push({ kind: 'chart', chart: trendChart });
  }
  if (data.occupancyTrend.length > 0) {
    trendBlocks.push({
      kind: 'chart',
      chart: {
        chartType: 'stacked-bars',
        title: 'اتجاه الإشغال الشهري',
        caption: 'الوحدات المشغولة مقابل الشاغرة',
        categories: data.occupancyTrend.map((month) => arabicMonthLabel(month.month)),
        series: [
          { name: 'مشغول', values: data.occupancyTrend.map((month) => month.occupied) },
          { name: 'شاغر', values: data.occupancyTrend.map((month) => month.vacant) },
        ],
        note: 'الإشغال مقدر من تغطية العقود كما في نهاية كل شهر داخل الفترة (تحديد قاطع من العقود والوحدات، بلا نماذج تنبؤية).',
      },
    });
  }
  if (trendBlocks.length > 0) groups.push({ blocks: trendBlocks });

  /* --- Group 3 — unit performance --- */
  groups.push({
    blocks: [
      {
        kind: 'table',
        table: {
          title: 'أداء الوحدات',
          columns: ['الوحدة', 'الحالة', 'المستأجر', 'الإيجار التعاقدي', 'المستحق للفترة', 'المحصل للفترة', 'المتأخر المعتمد', 'نهاية العقد'],
          rows: data.unitRows.map((row) => [
            text(row.unit),
            text(row.statusLabel),
            text(row.tenant),
            amount(row.rent),
            amount(row.due),
            amount(row.collected),
            amount(row.overdue),
            text(dateLabel(row.endDate)),
          ]),
          emptyNote: 'لا توجد وحدات ضمن نطاق التقرير.',
        },
      },
      {
        kind: 'note',
        note: {
          text: 'المستحق والمحصل للفترة حسب فواتير ومدفوعات العقار المعتمدة؛ المتأخر كما في تاريخ الإعداد من كشف المتأخرات. الوحدات ذات المحصل المنخفض مقارنة بالمستحق أو المتأخر الموجب هي أولوية المتابعة.',
          tone: 'info',
        },
      },
    ],
  });

  /* --- Group 4 — arrears ageing + operating details --- */
  const operationalBlocks: ProfessionalReportGroup['blocks'] = [];
  if (data.arrearsBuckets && data.arrearsBuckets.some((bucket) => bucket.total > 0)) {
    operationalBlocks.push({
      kind: 'chart',
      chart: {
        chartType: 'hbar',
        title: 'أعمار المتأخرات',
        caption: data.arrearsAsOf ? `كما في ${data.arrearsAsOf}` : 'توزيع أعمار الديون',
        categories: data.arrearsBuckets.map((bucket) => bucket.label),
        series: [{ name: 'المبلغ', values: data.arrearsBuckets.map((bucket) => bucket.total) }],
        note: 'التصنيف حسب أعمار الديون المعتمدة؛ لا تُدمج مع المتحصلات.',
      },
    });
  }
  if (data.expenseByCategory.length > 0) {
    operationalBlocks.push({
      kind: 'chart',
      chart: {
        chartType: 'hbar',
        title: 'توزيع المصروفات حسب التصنيف',
        categories: data.expenseByCategory.map((row) => row.category),
        series: [{ name: 'المبلغ', values: data.expenseByCategory.map((row) => row.total) }],
        note: 'حسب المصروفات المسجلة للفترة.',
      },
    });
  }
  if (data.maintenancePeriodCount > 0 || data.maintenanceOpenAsOf > 0) {
    operationalBlocks.push({
      kind: 'table',
      table: {
        title: 'ملخص الصيانة',
        columns: ['المؤشر', 'القيمة'],
        rows: [
          [text('طلبات مسجلة في الفترة'), countCell(data.maintenancePeriodCount)],
          [text('طلبات مفتوحة حتى تاريخ الإعداد'), countCell(data.maintenanceOpenAsOf)],
          [text('أطول مدة شغور حالية (أيام)'), countCell(data.longestVacancyDays ?? null)],
        ],
      },
    });
  }
  if (operationalBlocks.length > 0) {
    operationalBlocks.push({
      kind: 'note',
      note: {
        text: 'تكلفة الصيانة تُعرض تشغيلياً ولا تُعد مصروفاً مالياً تلقائياً؛ المصروف المسجل هو المرجع المالي المعتمد. لا ازدواج في الاحتساب.',
        tone: 'neutral',
      },
    });
    groups.push({ blocks: operationalBlocks });
  }

  /* --- Group 5 — leasing & risk (deterministic facts only) --- */
  const leasingBlocks: ProfessionalReportGroup['blocks'] = [];
  if (data.expiringRowsSlice && data.expiringRowsSlice.length > 0) {
    leasingBlocks.push({
      kind: 'table',
      table: {
        title: 'العقود القريبة من الانتهاء',
        columns: ['المستأجر', 'العقار', 'الوحدة', 'نهاية العقد', 'الأيام المتبقية', 'الإيجار الشهري'],
        rows: data.expiringRowsSlice.map((row) => [
          text(row.tenantName),
          text(row.propertyTitle),
          text(row.unitNumber),
          text(dateLabel(row.endDate)),
          countCell(row.daysRemaining),
          amount(row.monthlyRent),
        ]),
      },
    });
  }
  if (data.vacancyRows && data.vacancyRows.length > 0) {
    leasingBlocks.push({
      kind: 'table',
      table: {
        title: 'الوحدات الشاغرة ومدة الشغور',
        columns: ['الوحدة', 'العقار', 'مدة الشغور (أيام)', 'الإيجار المرجعي'],
        rows: data.vacancyRows.slice(0, 20).map((row) => [text(row.unitNumber), text(row.propertyTitle), countCell(row.daysVacant), amount(row.referenceRent)]),
      },
    });
  }
  if (leasingBlocks.length > 0) {
    leasingBlocks.push({
      kind: 'note',
      note: {
        text: data.expiringRentExposed != null
          ? `إجمالي الإيجار المعرض للخطر خلال نافذة المتابعة (عقود تنتهي قريباً + شغور قائم): ${data.expiringRentExposed}. تُعرض حقائق محددة فقط (مواعيد انتهاء وشغور ومتأخرات) دون احتمالات تجديد أو درجات مخاطر تخمينية.`
          : 'تُعرض حقائق محددة فقط (مواعيد انتهاء ومدة شغور وفواتير متأخرة) دون احتمالات تجديد أو درجات مخاطر تخمينية.',
        tone: 'risk',
      },
    });
    groups.push({ blocks: leasingBlocks });
  }

  /* --- Group 6 (LAST) — property performance summary --- */
  const summaryRows: ReportCellFormat[][] = [
    [text('الإيجارات المستحقة'), amount(summary?.invoiced ?? null)],
    [text('التحصيلات الفعلية'), amount(summary?.paid ?? null)],
    [text('المتبقي'), amount(summary?.outstanding ?? null)],
    [text('المتأخرات'), amount(data.overdueTotal)],
    [text('المصروفات المسجلة'), amount(data.expenseTotal)],
  ];
  if (data.utilitiesTotal != null) {
    summaryRows.push([text('الخدمات والمرافق (إجمالي الفواتير)'), amount(data.utilitiesTotal)]);
  }
  summaryRows.push([text('طلبات الصيانة المفتوحة'), countCell(data.maintenanceOpenAsOf)]);
  if (data.isPortfolioScope && data.collectionRateCurrent != null) {
    summaryRows.push([text('نسبة التحصيل (معتمدة)'), percentOf(data.collectionRateCurrent)]);
  }
  summaryRows.push([text('نسبة الإشغال'), percentOf(occupancyRate)]);

  const finalBlocks: ProfessionalReportGroup['blocks'] = [
    {
      kind: 'table',
      table: {
        title: 'الملخص المالي والتشغيلي الختامي',
        columns: ['البند', 'القيمة'],
        rows: summaryRows,
      },
    },
    {
      kind: 'note',
      note: {
        text: 'حصيلة (التحصيلات − المصروفات) ليست ربحاً محاسبياً؛ لا يُعرض أي رقم بصفة ربح في هذا التقرير مالم تثبته السلطة المحاسبية. نسبة التحصيل تظهر من المصدر المعتمد فقط.',
        tone: 'neutral',
      },
    },
  ];
  finalBlocks.push(...buildPerformanceInsightNotes(data));

  groups.push({ keepTogether: true, blocks: finalBlocks });

  return {
    reportTitle: 'تقرير أداء العقار',
    reportType: 'Property_Performance_Report',
    periodFrom: data.periodFrom ?? null,
    periodTo: data.periodTo ?? null,
    generatedAt: data.generatedAt ?? getTodayLocalDateString(),
    scopeLabel: data.scopeLabel,
    propertyTitle: data.propertyTitle,
    identity: [
      { label: 'العقار', value: data.propertyTitle ?? data.scopeLabel },
      { label: 'نطاق التقرير', value: data.scopeLabel },
      { label: 'فترة التقرير', value: `${dateLabel(data.periodFrom)} إلى ${dateLabel(data.periodTo)}` },
      { label: 'المؤشرات الرصيدية كما في', value: dateLabel(data.asOf) },
      { label: 'إجمالي الوحدات', value: String(occupancy.units) },
      { label: 'تاريخ الإصدار', value: dateLabel(data.generatedAt ?? getTodayLocalDateString()) },
    ],
    groups,
  };
}

function buildPerformanceInsightNotes(data: PropertyReportData): ProfessionalReportGroup['blocks'] {
  const notes: Array<{ text: string; tone: 'info' | 'risk' | 'success' | 'neutral' }> = [];
  const { occupancy, summary, overdueTotal, maintenanceOpenAsOf, expiringCount } = data;
  if (occupancy.rate != null && occupancy.rate >= 90) {
    notes.push({ text: 'مؤشر إيجابي: نسبة الإشغال مرتفعة ضمن نطاق مريح.', tone: 'success' });
  }
  if (overdueTotal != null && overdueTotal > 0) {
    notes.push({ text: `مؤشر خطر: متأخرات قائمة بمبلغ ${overdueTotal} — تُراجع أعمار الديون في قسم التحصيل.`, tone: 'risk' });
  }
  if (maintenanceOpenAsOf > 0) {
    notes.push({ text: `يتطلب عناية: ${maintenanceOpenAsOf} طلب صيانة مفتوح حتى تاريخ الإعداد.`, tone: 'risk' });
  }
  if (expiringCount > 0) {
    notes.push({ text: `قرارات مطلوبة: ${expiringCount} عقد يقترب من الانتهاء ضمن نافذة المتابعة — يُحدد قرار التجديد مبكراً.`, tone: 'info' });
  }
  if (data.previous && data.previous.collected != null && summary?.paid != null && summary.paid - data.previous.collected > 0) {
    notes.push({ text: `تحسن في المحصل مقارنة بالفترة السابقة (+${summary.paid - data.previous.collected}).`, tone: 'success' });
  }
  if (notes.length === 0) {
    notes.push({ text: 'لا توجد مؤشرات أداء تدعو إلى إجراء فوري ضمن البيانات المعتمدة.', tone: 'neutral' });
  }
  return notes.map((note) => ({ kind: 'note' as const, note }));
}

/* ------------------------------------------------------------------ */
/* Read-model aggregation (pure)                                       */
/* ------------------------------------------------------------------ */

export type PropertyReadModelInput = {
  from: string;
  to: string;
  asOf: string;
  occupancyRows: Array<{ occupied: number; vacant: number }>;
  summary: FinancialPeriodSummaryReport | null;
  overdueTotal: number | null;
  arrears: AgedReceivablesReport | null;
  expenseReport: ExpenseBreakdownReport | null;
  maintenanceRows: readonly Maintenance[];
  expiringRows: readonly ExpiringContractRow[];
  expiringRentExposed: number | null;
  vacancyAnalytics: VacancyAnalytics | null;
  unitRows: UnitPerformanceRow[];
  monthlyCollectionTrend: Array<{ month: string; due: number; collected: number }>;
  occupancyTrend: Array<{ month: string; occupied: number; vacant: number }>;
  vacancyRows?: Array<{ unitNumber: string; propertyTitle: string; daysVacant: number; referenceRent: number | null }> | null;
  previous?: PropertyReportData['previous'] | null;
  portfolio?: PropertyReportData['portfolio'] | null;
  utilitiesTotal?: number | null;
};

/** Aggregates canonical read models into the report data the builder needs. */
export function aggregatePropertyReportData(input: PropertyReadModelInput): PropertyReportData {
  const occupancy = occupancyFromRows(input.occupancyRows);
  const arrearsBuckets = aggregateArrearsBuckets(input.arrears);
  const vacancyCount = input.vacancyAnalytics?.vacantRows.length ?? 0;
  const longestVacancyDays = input.vacancyAnalytics
    ? input.vacancyAnalytics.vacantRows.reduce((max, row) => Math.max(max, row.daysVacant), 0)
    : null;

  return {
    propertyTitle: null,
    scopeLabel: 'جميع العقارات المُدارة',
    periodFrom: input.from,
    periodTo: input.to,
    generatedAt: getTodayLocalDateString(),
    isPortfolioScope: true,
    collectionRateCurrent: null,
    collectionRatePrevious: null,
    asOf: input.asOf,
    occupancy,
    summary: input.summary,
    overdueTotal: input.overdueTotal,
    arrearsAsOf: input.arrears?.asOf ?? null,
    arrearsBuckets,
    expenseTotal: input.expenseReport?.totalExpenses ?? null,
    expenseByCategory: input.expenseReport?.byCategory.map((row) => ({ category: row.category, total: row.total })) ?? [],
    maintenancePeriodCount: countMaintenanceInPeriod(input.maintenanceRows, input.from, input.to),
    maintenanceOpenAsOf: countMaintenanceOpenAsOf(input.maintenanceRows, input.asOf),
    expiringCount: input.expiringRows.length,
    expiringRentExposed: input.expiringRentExposed,
    expiringRowsSlice: input.expiringRows,
    longestVacancyDays,
    averageVacancyDays: input.vacancyAnalytics?.averageVacancyDays ?? null,
    vacancyCount,
    vacancyRows: input.vacancyRows ?? null,
    monthlyCollectionTrend: input.monthlyCollectionTrend,
    occupancyTrend: input.occupancyTrend,
    unitRows: input.unitRows,
    previous: input.previous ?? null,
    portfolio: input.portfolio ?? null,
    utilitiesTotal: input.utilitiesTotal ?? null,
  };
}

/** Deterministic monthly due-vs-collected series for the period. */
export function buildMonthlyCollectionTrend(
  dailyCollections: readonly DailyCollectionReportRow[],
  invoices: readonly { dueDate: string | null; amount: number }[],
  from: string,
  to: string,
): Array<{ month: string; due: number; collected: number }> {
  const months = monthsBetween(from, to);
  const collectedByMonth = new Map<string, number>();
  for (const row of dailyCollections) {
    const key = monthKeyOf(row.paymentDate);
    if (!key || !isDateInRange(row.paymentDate, from, to)) continue;
    collectedByMonth.set(key, (collectedByMonth.get(key) ?? 0) + row.totalPaid);
  }
  const dueByMonth = new Map<string, number>();
  for (const invoice of invoices) {
    const key = monthKeyOf(invoice.dueDate);
    if (!key || !isDateInRange(invoice.dueDate, from, to)) continue;
    dueByMonth.set(key, (dueByMonth.get(key) ?? 0) + invoice.amount);
  }
  return months.map((month) => ({ month, due: dueByMonth.get(month) ?? 0, collected: collectedByMonth.get(month) ?? 0 }));
}

function isDateInRange(iso: string | null | undefined, from: string, to: string): boolean {
  if (!iso) return false;
  const value = iso.slice(0, 10);
  return value >= from && value <= to;
}

/** Deterministic monthly occupancy series (contractual coverage at month-end). */
export function buildOccupancyTrend(
  contracts: readonly ContractListItem[],
  units: readonly Unit[],
  from: string,
  to: string,
): Array<{ month: string; occupied: number; vacant: number }> {
  return monthsBetween(from, to).map((month) => {
    const asOf = monthEndIso(month);
    let occupied = 0;
    let vacant = 0;
    for (const unit of units) {
      if (unitOccupiedAsOf(contracts, unit.id, asOf)) occupied += 1;
      else vacant += 1;
    }
    return { month, occupied, vacant };
  });
}

/* ------------------------------------------------------------------ */
/* Print/PDF actions (read-model wiring + guarded output)              */
/* ------------------------------------------------------------------ */

const preparingMessage = (mode: 'print' | 'pdf') =>
  mode === 'print' ? 'تعذرت طباعة تقرير أداء العقار.' : 'تعذر تصدير تقرير أداء العقار كملف PDF.';

export function runPropertyReportAction(params: {
  settings: DocumentCompanySettings;
  data: PropertyReportData;
  mode: 'print' | 'pdf';
}): Promise<void> {
  const { settings, data, mode } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () => {
      const payload = buildPropertyReportPayload(data);
      if (mode === 'print') {
        return documentService.printDocument('property_report', { settings, payload });
      }
      return documentService.downloadDocumentPdf('property_report', { settings, payload });
    },
    fallbackMessage: preparingMessage(mode),
  });
}

/**
 * Assembles the property report data from the workspace read models plus
 * the period-scoped invoice/payment detail and the previous comparable
 * period (fetched on demand — read-only, no posting logic touched).
 */
export async function loadPropertyReportData(params: {
  model: ReportsWorkspaceModel;
  filters: ReportsFilterState;
}): Promise<PropertyReportData> {
  const { model, filters } = params;
  const from = filters.from;
  const to = filters.to;
  const propertyId = filters.propertyId || undefined;
  const isPortfolioScope = !propertyId;
  const asOf = filters.asOf.slice(0, 10);

  const occupancy = occupancyFromRows(model.sections.occupancy.occupancyRows);
  const summary = model.sections.overview.summary;
  const overdueRows: OverdueInvoiceReportRow[] = model.sections.overdue.rows;
  const overdueTotal = overdueRows.reduce((sum, row) => sum + row.remainingAmount, 0);
  const agedReport = model.sections.overdue.agedReport;
  const expenseReport = model.sections.expenses.report;
  const maintenanceRows = model.sections.maintenance.rows;
  const expiringRows = model.sections.occupancy.expiringRows;
  const expiringRentExposed = expiringRows.reduce((sum, row) => sum + row.monthlyRent, 0);
  const vacancyAnalytics = model.sections.occupancy.vacancyAnalytics;

  const allContracts = model.filters.contractRows;
  const scopedContracts = allContracts.filter((contract) => !propertyId || contract.property_id === propertyId);
  const allUnits = await listUnits();
  const scopedUnits = allUnits.filter((unit) => !propertyId || unit.property_id === propertyId);

  const invoiceRows: InvoiceReportRow[] = await loadInvoices({ dateFrom: from, dateTo: to, propertyId });
  const paymentRows: PaymentWithInvoiceContext[] = await loadPayments({ dateFrom: from, dateTo: to, propertyId });

  /* Unit performance rows. */
  const contractByUnit = new Map<string, ContractListItem>();
  for (const contract of scopedContracts) {
    if (contract.unit_id && !contractByUnit.has(contract.unit_id) && isContractStatus(contract.status, 'active')) {
      contractByUnit.set(contract.unit_id, contract);
    }
  }
  const overdueByUnit = new Map<string, number>();
  for (const row of overdueRows) {
    if (row.unitId) overdueByUnit.set(row.unitId, (overdueByUnit.get(row.unitId) ?? 0) + row.remainingAmount);
  }
  const unitRows: UnitPerformanceRow[] = scopedUnits
    .sort((a, b) => a.unit_number.localeCompare(b.unit_number, 'ar', { numeric: true }))
    .map((unit) => {
      const contract = contractByUnit.get(unit.id);
      const unitContractIds = new Set(scopedContracts.filter((contract) => contract.unit_id === unit.id).map((contract) => contract.id));
      const due = invoiceRows.filter((invoice) => unitContractIds.has(invoice.contract_id)).reduce((sum, invoice) => sum + invoice.amount, 0);
      const collected = paymentRows
        .filter((payment) => payment.invoice?.contract_id && unitContractIds.has(payment.invoice.contract_id))
        .reduce((sum, payment) => sum + payment.amount, 0);
      return {
        unit: unit.unit_number,
        statusLabel: isOccupiedUnitStatus(unit.status) ? 'مشغولة' : 'شاغرة',
        tenant: contract?.people?.full_name ?? '—',
        rent: contract?.rent_amount ?? null,
        due: due > 0 ? due : null,
        collected: collected > 0 ? collected : null,
        overdue: overdueByUnit.get(unit.id) ?? null,
        endDate: contract?.end_date ?? null,
      };
    });

  const monthlyCollectionTrend = buildMonthlyCollectionTrend(
    model.sections.collections.rows,
    invoiceRows.map((invoice) => ({ dueDate: invoice.due_date, amount: invoice.amount })),
    from,
    to,
  );
  const occupancyTrend = buildOccupancyTrend(scopedContracts, scopedUnits, from, to);

  /* Previous comparable period — same-length window immediately before. */
  const prevRange = previousPeriodRange(from, to);
  const collectionRateCurrent = isPortfolioScope ? model.hero.collectionRate : null;
  let collectionRatePrevious: number | null = null;
  let previous: PropertyReportData['previous'] = null;

  if (prevRange) {
    const prevFilters = { dateFrom: prevRange.from, dateTo: prevRange.to, propertyId };
    const [prevSummary, prevOverdue, prevExpenses, prevRate] = await Promise.all([
      getFinancialPeriodSummaryReport(prevFilters),
      getOverdueInvoicesReport({ asOf: prevRange.to, propertyId }),
      getExpenseBreakdownReport(prevFilters),
      isPortfolioScope ? getAuthoritativeReportsCollectionRate(prevRange) : Promise.resolve<number | null>(null),
    ]);
    const propertyTitlesById = new Map(
      allContracts
        .filter((contract) => contract.properties?.id && contract.properties?.title)
        .map((contract) => [contract.properties!.id, contract.properties!.title!] as const),
    );
    const prevVacancy = buildVacancyAnalytics(allUnits, allContracts, propertyTitlesById, prevRange.to);
    previous = {
      occupancyRate: prevVacancy.totalUnits > 0 ? (prevVacancy.occupiedUnits / prevVacancy.totalUnits) * 100 : null,
      due: prevSummary?.invoiced ?? null,
      collected: prevSummary?.paid ?? null,
      outstanding: prevSummary?.outstanding ?? null,
      arrears: prevOverdue?.totalOverdue ?? null,
      expenses: prevExpenses?.totalExpenses ?? null,
      maintenanceCount: countMaintenanceInPeriod(maintenanceRows, prevRange.from, prevRange.to),
      maintenanceOpen: countMaintenanceOpenAsOf(maintenanceRows, prevRange.to),
      averageVacancyDays: prevVacancy.averageVacancyDays,
      collectionRate: prevRate,
    };
    collectionRatePrevious = prevRate;
  }

  /* Portfolio benchmark (single-property scope only) — same read models, so
     the comparison population is complete and not misleading. */
  let portfolio: PropertyReportData['portfolio'] = null;
  if (!isPortfolioScope) {
    const portfolioRows = model.sections.occupancy.occupancyRows.filter((row) => row.propertyId !== propertyId);
    const pOccupied = portfolioRows.reduce((sum, row) => sum + row.occupied, 0);
    const pVacant = portfolioRows.reduce((sum, row) => sum + row.vacant, 0);
    const pExpense = (model.sections.expenses.report?.byProperty ?? []).filter((row) => row.propertyId !== propertyId).reduce((sum, row) => sum + row.total, 0);
    const portfolioTotal = pOccupied + pVacant;
    portfolio = {
      occupancyRate: portfolioTotal > 0 ? (pOccupied / portfolioTotal) * 100 : null,
      totalUnits: portfolioTotal,
      occupiedUnits: pOccupied,
      vacantUnits: pVacant,
      expensePerOccupiedUnit: pOccupied > 0 ? pExpense / pOccupied : null,
    };
  }

  const propertyTitle = propertyId
    ? (model.sections.occupancy.occupancyRows.find((row) => row.propertyId === propertyId)?.property ?? 'العقار المحدد')
    : null;

  const vacancyRows = vacancyAnalytics?.vacantRows.map((row) => ({
    unitNumber: row.unitNumber,
    propertyTitle: row.propertyTitle,
    daysVacant: row.daysVacant,
    referenceRent: row.referenceRent,
  })) ?? null;

  return {
    propertyTitle,
    propertyId: propertyId ?? null,
    scopeLabel: propertyId && propertyTitle ? `العقار: ${propertyTitle}` : 'جميع العقارات المُدارة (المحفظة)',
    periodFrom: from,
    periodTo: to,
    generatedAt: getTodayLocalDateString(),
    isPortfolioScope,
    collectionRateCurrent,
    collectionRatePrevious,
    asOf,
    occupancy: occupancyFromRows(model.sections.occupancy.occupancyRows),
    summary: summary ?? null,
    overdueTotal,
    arrearsAsOf: agedReport?.asOf ?? null,
    arrearsBuckets: aggregateArrearsBuckets(agedReport ?? null),
    expenseTotal: expenseReport?.totalExpenses ?? null,
    expenseByCategory: expenseReport?.byCategory.map((row) => ({ category: row.category, total: row.total })) ?? [],
    maintenancePeriodCount: countMaintenanceInPeriod(maintenanceRows, from, to),
    maintenanceOpenAsOf: countMaintenanceOpenAsOf(maintenanceRows, asOf),
    expiringCount: expiringRows.length,
    expiringRentExposed: expiringRentExposed,
    expiringRowsSlice: expiringRows,
    longestVacancyDays: vacancyAnalytics ? vacancyAnalytics.vacantRows.reduce((max, row) => Math.max(max, row.daysVacant), 0) : null,
    averageVacancyDays: vacancyAnalytics?.averageVacancyDays ?? null,
    vacancyCount: vacancyAnalytics?.vacantRows.length ?? 0,
    vacancyRows,
    monthlyCollectionTrend,
    occupancyTrend,
    unitRows,
    previous,
    portfolio,
    utilitiesTotal: null, // property-level utility totals are not preloaded — omitted truthfully.
  };
}

export function printPropertyReport(params: { settings: DocumentCompanySettings; model: ReportsWorkspaceModel; filters: ReportsFilterState }): Promise<void> {
  return loadPropertyReportData({ model: params.model, filters: params.filters }).then((data) =>
    runPropertyReportAction({ settings: params.settings, data, mode: 'print' }),
  );
}

export function downloadPropertyReportPdf(params: { settings: DocumentCompanySettings; model: ReportsWorkspaceModel; filters: ReportsFilterState }): Promise<void> {
  return loadPropertyReportData({ model: params.model, filters: params.filters }).then((data) =>
    runPropertyReportAction({ settings: params.settings, data, mode: 'pdf' }),
  );
}