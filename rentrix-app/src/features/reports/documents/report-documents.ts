/**
 * Operational and Financial Reports document adapters and actions:
 * - #7 Aged Arrears Breakdown (reusing 'generic_report')
 * - #9 Quarterly / Annual VAT Statement (reusing 'generic_report')
 * - #12 Annual Portfolio Performance Report (reusing 'generic_report')
 * - #14 Vacancy Loss Assessment (reusing 'generic_report')
 * - #18 Building Rent Roll (reusing 'generic_report')
 *
 * Canonical authorities:
 * - `src/features/financials/reports/arrears-reports-service.ts`
 * - `src/features/financials/reports/financial-statements-service.ts`
 * - `src/features/reports/reports-page.helpers.ts`
 *
 * Presentation-only adapters: never recalculate subledger or GL figures.
 */
import { documentService } from '@/services/documents/DocumentService';
import { hasCompleteCompanyIdentity, type DocumentCompanySettings } from '@/services/documents/companyIdentity';
import { runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import type { GenericReportPayload } from '@/services/documents/documentPayloads';
import type { AgedReceivablesReport } from '@/features/financials/reports/arrears-reports-service';
import type { VatReturnReport } from '@/features/financials/reports/financial-statements-service';
import type { OccupancyChartRow, RentRollReportRow } from '../reports-page.helpers';

// ---------------------------------------------------------------------------
// #7 Aged Arrears Breakdown
// ---------------------------------------------------------------------------

export function toAgedArrearsPayload(report: AgedReceivablesReport): GenericReportPayload {
  const rows: string[][] = report.rows.map((row) => [
    row.tenantName ?? '—',
    `${row.propertyTitle ?? '—'}${row.unitNumber ? ` (${row.unitNumber})` : ''}`,
    String(row.buckets.current?.total ?? 0),
    String(row.buckets.days_1_30?.total ?? 0),
    String(row.buckets.days_31_60?.total ?? 0),
    String(row.buckets.days_61_90?.total ?? 0),
    String(row.buckets.days_90_plus?.total ?? 0),
    String(row.totalOutstanding),
  ]);

  const totals = [
    'الإجمالي العام',
    '',
    String(report.buckets.current?.total ?? 0),
    String(report.buckets.days_1_30?.total ?? 0),
    String(report.buckets.days_31_60?.total ?? 0),
    String(report.buckets.days_61_90?.total ?? 0),
    String(report.buckets.days_90_plus?.total ?? 0),
    String(report.totalOutstanding),
  ];

  return {
    reportTitle: 'كشف أعمار الديون والمتأخرات المستحقة',
    reportType: 'Aged_Arrears_Report',
    periodTo: report.asOf,
    sections: [
      {
        title: 'تفصيل المتأخرات حسب فترات الاستحقاق',
        columns: ['المستأجر', 'العقار / الوحدة', 'غير متأخر', '1–30 يوم', '31–60 يوم', '61–90 يوم', '+90 يوم', 'إجمالي المستحق'],
        rows,
        totals,
      },
    ],
    totalSummary: `إجمالي المستحق القائم: ${report.totalOutstanding} | إجمالي المتأخر الفعلي: ${report.totalOverdue}`,
  };
}

export function printAgedArrearsReport(params: {
  report: AgedReceivablesReport;
  settings: DocumentCompanySettings;
}): Promise<void> {
  const { report, settings } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.printDocument('generic_report', {
        settings,
        payload: toAgedArrearsPayload(report),
      }),
    fallbackMessage: 'تعذرت طباعة تقرير أعمار الديون.',
  });
}

export function downloadAgedArrearsReportPdf(params: {
  report: AgedReceivablesReport;
  settings: DocumentCompanySettings;
}): Promise<void> {
  const { report, settings } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.downloadDocumentPdf('generic_report', {
        settings,
        payload: toAgedArrearsPayload(report),
      }),
    fallbackMessage: 'تعذر تصدير تقرير أعمار الديون كملف PDF.',
  });
}

// ---------------------------------------------------------------------------
// #9 Quarterly / Annual VAT Statement
// ---------------------------------------------------------------------------

export function toVatStatementPayload(report: VatReturnReport): GenericReportPayload {
  const rows: string[][] = [
    ['إجمالي المبيعات والإيرادات الخاضعة للضريبة', String(report.totalSalesAmount)],
    ['إجمالي ضريبة القيمة المضافة المستحقة (VAT)', String(report.totalTaxAmount)],
    ['عدد الفواتير الصادرة ضمن الفترة', String(report.invoiceCount)],
  ];

  return {
    reportTitle: 'إقرار / كشف ضريبة القيمة المضافة (VAT Statement)',
    reportType: 'VAT_Return_Statement',
    periodFrom: report.period.from,
    periodTo: report.period.to,
    sections: [
      {
        title: 'ملخص الحركة الضريبية للفترة',
        columns: ['البيان الضريبي', 'المبلغ / العدد'],
        rows,
      },
    ],
    totalSummary: `صافي الضريبة المستحقة: ${report.totalTaxAmount}`,
  };
}

export function printVatStatementReport(params: {
  report: VatReturnReport;
  settings: DocumentCompanySettings;
}): Promise<void> {
  const { report, settings } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.printDocument('generic_report', {
        settings,
        payload: toVatStatementPayload(report),
      }),
    fallbackMessage: 'تعذرت طباعة كشف ضريبة القيمة المضافة.',
  });
}

export function downloadVatStatementReportPdf(params: {
  report: VatReturnReport;
  settings: DocumentCompanySettings;
}): Promise<void> {
  const { report, settings } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.downloadDocumentPdf('generic_report', {
        settings,
        payload: toVatStatementPayload(report),
      }),
    fallbackMessage: 'تعذر تصدير كشف ضريبة القيمة المضافة كملف PDF.',
  });
}

// ---------------------------------------------------------------------------
// #12 Annual Portfolio Performance Report
// ---------------------------------------------------------------------------

export function toPortfolioPerformancePayload(params: {
  occupancyRows: readonly OccupancyChartRow[];
  periodFrom?: string | null;
  periodTo?: string | null;
  performanceNote?: string | null;
}): GenericReportPayload {
  const { occupancyRows, periodFrom, periodTo, performanceNote } = params;

  let totalOccupied = 0;
  let totalVacant = 0;
  let totalNonRentable = 0;

  const rows: string[][] = occupancyRows.map((row) => {
    totalOccupied += row.occupied;
    totalVacant += row.vacant;
    totalNonRentable += row.nonRentable ?? 0;
    const totalUnits = row.occupied + row.vacant + (row.nonRentable ?? 0);
    const occupancyRate = totalUnits > 0 ? `${Math.round((row.occupied / totalUnits) * 100)}%` : '—';
    return [row.property, String(row.occupied), String(row.vacant), String(row.nonRentable ?? 0), String(totalUnits), occupancyRate];
  });

  const grandTotal = totalOccupied + totalVacant + totalNonRentable;
  const overallRate = grandTotal > 0 ? `${Math.round((totalOccupied / grandTotal) * 100)}%` : '—';

  return {
    reportTitle: 'تقرير الأداء التشغيلي للمحفظة العقارية',
    reportType: 'Portfolio_Performance_Report',
    periodFrom: periodFrom ?? null,
    periodTo: periodTo ?? null,
    sections: [
      {
        title: 'مؤشرات الإشغال والطاقة الاستيعابية للعقارات',
        columns: ['اسم العقار', 'الوحدات المؤجرة', 'الوحدات الشاغرة', 'غير قابلة للتأجير', 'إجمالي الوحدات', 'نسبة الإشغال'],
        rows,
        totals: ['الإجمالي العام للمحفظة', String(totalOccupied), String(totalVacant), String(totalNonRentable), String(grandTotal), overallRate],
      },
    ],
    totalSummary: performanceNote ?? `إجمالي الوحدات: ${grandTotal} | المؤجر: ${totalOccupied} (${overallRate}) | الشاغر: ${totalVacant} | غير قابلة للتأجير: ${totalNonRentable}`,
  };
}

export function printPortfolioPerformanceReport(params: {
  occupancyRows: readonly OccupancyChartRow[];
  settings: DocumentCompanySettings;
  periodFrom?: string | null;
  periodTo?: string | null;
  performanceNote?: string | null;
}): Promise<void> {
  const { settings, ...rest } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.printDocument('generic_report', {
        settings,
        payload: toPortfolioPerformancePayload(rest),
      }),
    fallbackMessage: 'تعذرت طباعة تقرير أداء المحفظة.',
  });
}

export function downloadPortfolioPerformanceReportPdf(params: {
  occupancyRows: readonly OccupancyChartRow[];
  settings: DocumentCompanySettings;
  periodFrom?: string | null;
  periodTo?: string | null;
  performanceNote?: string | null;
}): Promise<void> {
  const { settings, ...rest } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.downloadDocumentPdf('generic_report', {
        settings,
        payload: toPortfolioPerformancePayload(rest),
      }),
    fallbackMessage: 'تعذر تصدير تقرير أداء المحفظة كملف PDF.',
  });
}

// ---------------------------------------------------------------------------
// #14 Vacancy Loss Assessment
// ---------------------------------------------------------------------------

export type VacancyLossItem = {
  propertyTitle: string;
  unitNumber: string;
  unitType?: string | null;
  marketRent?: number | null;
  daysVacant?: number | null;
  estimatedLoss?: number | null;
};

export function toVacancyLossPayload(params: {
  items: readonly VacancyLossItem[];
  asOf?: string | null;
  methodologyNote?: string | null;
}): GenericReportPayload {
  const { items, asOf, methodologyNote } = params;

  let totalLoss = 0;

  const rows: string[][] = items.map((item) => {
    if (item.estimatedLoss) totalLoss += item.estimatedLoss;
    return [
      item.propertyTitle,
      item.unitNumber,
      item.unitType ?? '—',
      item.marketRent !== undefined && item.marketRent !== null ? String(item.marketRent) : '—',
      item.daysVacant !== undefined && item.daysVacant !== null ? String(item.daysVacant) : '—',
      item.estimatedLoss !== undefined && item.estimatedLoss !== null ? String(item.estimatedLoss) : '—',
    ];
  });

  return {
    reportTitle: 'كشف تقييم فاقد الشغور والفرص الإيجارية الضائعة',
    reportType: 'Vacancy_Loss_Assessment',
    periodTo: asOf ?? null,
    sections: [
      {
        title: 'الوحدات الشاغرة وحساب فاقد الفرصة البديلة',
        columns: ['العقار', 'رقم الوحدة', 'نوع الوحدة', 'الإيجار المقدر', 'أيام الشغور', 'فاقد الشغور المقدر'],
        rows,
        totals: totalLoss > 0 ? ['إجمالي فاقد الشغور المقدر', '', '', '', '', String(totalLoss)] : undefined,
      },
    ],
    totalSummary: methodologyNote ?? (totalLoss > 0 ? `إجمالي الفاقد التقديري المحسوب: ${totalLoss}` : null),
  };
}

export function printVacancyLossReport(params: {
  items: readonly VacancyLossItem[];
  settings: DocumentCompanySettings;
  asOf?: string | null;
  methodologyNote?: string | null;
}): Promise<void> {
  const { settings, ...rest } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.printDocument('generic_report', {
        settings,
        payload: toVacancyLossPayload(rest),
      }),
    fallbackMessage: 'تعذرت طباعة كشف فاقد الشغور.',
  });
}

export function downloadVacancyLossReportPdf(params: {
  items: readonly VacancyLossItem[];
  settings: DocumentCompanySettings;
  asOf?: string | null;
  methodologyNote?: string | null;
}): Promise<void> {
  const { settings, ...rest } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.downloadDocumentPdf('generic_report', {
        settings,
        payload: toVacancyLossPayload(rest),
      }),
    fallbackMessage: 'تعذر تصدير كشف فاقد الشغور كملف PDF.',
  });
}

// ---------------------------------------------------------------------------
// #18 Building Rent Roll
// ---------------------------------------------------------------------------

export function toRentRollPayload(params: {
  rows: readonly RentRollReportRow[];
  asOf?: string | null;
  propertyFilterLabel?: string | null;
}): GenericReportPayload {
  const { rows, asOf, propertyFilterLabel } = params;

  let totalRent = 0;
  const tableRows: string[][] = rows.map((row) => {
    totalRent += row.rentAmount;
    return [
      row.tenantName,
      row.propertyTitle,
      row.unitNumber,
      String(row.rentAmount),
      row.paymentCycle,
      row.statusLabel,
      row.startDate,
      row.endDate,
    ];
  });

  return {
    reportTitle: propertyFilterLabel ? `سجل عقود وإيجارات المبنى (Rent Roll) - ${propertyFilterLabel}` : 'سجل عقود وإيجارات المباني (Rent Roll)',
    reportType: 'Rent_Roll_Statement',
    periodTo: asOf ?? null,
    sections: [
      {
        title: 'العقود السارية والمجدولة وقيم الإيجار التعاقدية',
        columns: ['المستأجر', 'العقار', 'الوحدة', 'قيمة الإيجار', 'دورة الدفع', 'حالة العقد', 'تاريخ البدء', 'تاريخ الانتهاء'],
        rows: tableRows,
        totals: ['إجمالي القيم الإيجارية التعاقدية', '', '', String(totalRent), '', '', '', ''],
      },
    ],
    totalSummary: `إجمالي عدد العقود المدرجة: ${rows.length} | إجمالي القيمة الإيجارية: ${totalRent}`,
  };
}

export function printRentRollReport(params: {
  rows: readonly RentRollReportRow[];
  settings: DocumentCompanySettings;
  asOf?: string | null;
  propertyFilterLabel?: string | null;
}): Promise<void> {
  const { settings, ...rest } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.printDocument('generic_report', {
        settings,
        payload: toRentRollPayload(rest),
      }),
    fallbackMessage: 'تعذرت طباعة سجل الإيجارات (Rent Roll).',
  });
}

export function downloadRentRollReportPdf(params: {
  rows: readonly RentRollReportRow[];
  settings: DocumentCompanySettings;
  asOf?: string | null;
  propertyFilterLabel?: string | null;
}): Promise<void> {
  const { settings, ...rest } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.downloadDocumentPdf('generic_report', {
        settings,
        payload: toRentRollPayload(rest),
      }),
    fallbackMessage: 'تعذر تصدير سجل الإيجارات (Rent Roll) كملف PDF.',
  });
}
