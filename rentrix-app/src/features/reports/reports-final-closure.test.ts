/**
 * MALEK Reports — FINAL CLOSURE CONTRACT.
 *
 * This suite exists so the semantics, presentation grammar and output
 * inventory that closed Reports can never silently regress. It is deliberately
 * source- and model-level (not snapshot-level): it locks the invariants, not
 * the pixels.
 *
 * If something here fails, Reports has genuinely regressed — do not relax the
 * assertion, fix the code.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { REPORT_PRODUCTS } from './report-products';
import {
  previousPeriodRange,
  formatPointChange,
  formatSignedAmountChange,
} from './documents/report-period';
import {
  buildPropertyAnalyticsComparison,
  buildPropertyAnalyticsExecutive,
  buildPropertyAnalyticsScope,
  perUnit,
  rateOf,
} from './property-analytics-model';
import {
  buildPropertyReportPayload,
  type PropertyReportData,
} from './documents/professional-property-report';
import { documentTemplateRegistry as documentRegistry } from '@/services/documents/documentRegistry';

const reportsDir = resolve(dirname(fileURLToPath(import.meta.url)));
const srcDir = resolve(reportsDir, '../..');
const read = (relative: string) =>
  readFileSync(resolve(reportsDir, relative), 'utf8').replaceAll('"', "'");

/* ------------------------------------------------------------------ */
/* 1. Financial semantics                                              */
/* ------------------------------------------------------------------ */

describe('reports closure — financial semantics', () => {
  it('keeps outstanding and overdue as distinct concepts', () => {
    // Outstanding comes from the period summary; overdue comes from the
    // arrears read model as-of. They are separate inputs and never aliased.
    const model = read('property-analytics-model.ts');
    expect(model).toContain('overdueTotal');
    expect(model).toContain('periodSummary');
    expect(model).not.toMatch(/overdue\s*[:=]\s*.*outstanding/);
  });

  it('keeps the three-way occupancy denominator (occupied + vacant + nonRentable)', () => {
    const scope = buildPropertyAnalyticsScope([
      {
        property: 'p',
        propertyId: 'p',
        shortPropertyId: '',
        hasTitle: true,
        occupied: 5,
        vacant: 3,
        nonRentable: 2,
      },
    ]);
    expect(scope.units).toBe(10);
    expect(scope.occupancyRate).toBe(50);
    // Non-rentable stock is never folded into vacancy.
    expect(scope.vacant).toBe(3);
    expect(scope.nonRentable).toBe(2);
  });

  it('never publishes zero for an unavailable metric', () => {
    expect(rateOf(1, 0)).toBeNull();
    expect(perUnit(100, 0)).toBeNull();
    const executive = buildPropertyAnalyticsExecutive({
      occupancyRows: [],
      expenseRows: [],
      performanceRows: [],
    });
    for (const value of [
      executive.collected,
      executive.due,
      executive.overdue,
      executive.expenses,
      executive.expensePerOccupiedUnit,
      executive.scope.occupancyRate,
    ]) {
      expect(value).toBeNull();
    }
  });

  it('keeps maintenance cost separate from posted expense (no double counting)', () => {
    const helpers = read('reports-page.helpers.ts');
    expect(helpers).toContain('!request.expense_id');
    expect(helpers).toContain('maintenanceCost');
    // Maintenance cost is its own field on the row; it is never added to expenses.
    expect(helpers).not.toMatch(/property\.expenses \+= .*maintenance/i);
  });

  it('never treats reference vacant rent as income or a receivable', () => {
    const model = read('property-analytics-model.ts');
    expect(model).toContain('vacancyReferenceRent');
    expect(model).toMatch(/neither income nor a receivable/);
    const section = read('components/PropertyAnalyticsSection.tsx');
    expect(section).toContain('قيمة إيجار مرجعية للشواغر');
    expect(section).toContain('ليست إيرادًا ولا ذمة مدينة');
  });

  it('keeps the priority score an operational ordering, never a risk probability', async () => {
    const section = read('components/PropertyAnalyticsSection.tsx');
    expect(section).toContain('ترتيب تشغيلي');
    expect(section).toContain('ليست احتمال تعثر');
    // No insight sentence may assert a probability, forecast or renewal chance.
    const { buildPropertyAnalyticsInsights } =
      await import('./property-analytics-model');
    const insights = buildPropertyAnalyticsInsights({
      occupancyRows: [
        {
          property: 'p',
          propertyId: 'p',
          shortPropertyId: '',
          hasTitle: true,
          occupied: 1,
          vacant: 4,
          nonRentable: 0,
        },
      ],
      expenseRows: [],
      performanceRows: [],
      openMaintenanceCount: 6,
      expiringContractsCount: 3,
      longestVacancyDays: 120,
      previous: {
        from: '2026-01-01',
        to: '2026-01-31',
        occupancyRate: 90,
        due: null,
        collected: null,
        overdue: null,
        expenses: null,
      },
    });
    for (const insight of insights) {
      expect(insight.text).not.toMatch(/احتمال|توقع|تنبؤ|probabilit|forecast/i);
    }
  });

  it('never labels collections minus expenses as profit', () => {
    const report = read('documents/professional-property-report.ts');
    expect(report).toContain('ليست ربحاً محاسبياً');
  });
});

/* ------------------------------------------------------------------ */
/* 2. Comparison semantics                                             */
/* ------------------------------------------------------------------ */

describe('reports closure — current vs previous comparable period', () => {
  it('uses one deterministic definition of the previous period', () => {
    expect(previousPeriodRange('2026-02-01', '2026-02-28')).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
    });
    expect(previousPeriodRange('2026-02-10', '2026-02-19')).toEqual({
      from: '2026-01-31',
      to: '2026-02-09',
    });
    expect(previousPeriodRange(null, '2026-02-19')).toBeNull();
    expect(previousPeriodRange('2026-03-01', '2026-02-01')).toBeNull();
  });

  it('expresses rate changes in POINTS and amount changes as absolute differences', () => {
    expect(formatPointChange(94, 90)).toBe('+4 نقاط');
    expect(formatSignedAmountChange(1200, 1000)).toBe('+200');
    expect(formatPointChange(94, null)).toBeNull();
    expect(formatSignedAmountChange(null, 1000)).toBeNull();
  });

  it('omits the comparison entirely when the previous period is unavailable', () => {
    expect(
      buildPropertyAnalyticsComparison({
        occupancyRows: [],
        expenseRows: [],
        performanceRows: [],
      }),
    ).toEqual([]);
  });

  it('shares the same previous-period arithmetic between the workspace and the document', () => {
    const workspace = read('use-reports-workspace.ts');
    const document = read('documents/professional-property-report.ts');
    expect(workspace).toContain('previousPeriodRange');
    expect(workspace).toContain("from './documents/report-period'");
    expect(document).toContain('previousPeriodRange');
  });
});

/* ------------------------------------------------------------------ */
/* 3. Presentation contracts                                           */
/* ------------------------------------------------------------------ */

describe('reports closure — presentation contracts', () => {
  it('routes report drill-through only through the canonical ReportDrillAction', () => {
    const surfaces = [
      'components/PropertyAnalyticsSection.tsx',
      'components/OverviewSection.tsx',
      'components/OperationalPrioritiesPanel.tsx',
    ];
    for (const surface of surfaces) {
      const source = read(surface);
      expect(source, `${surface} must use ReportDrillAction`).toContain(
        'ReportDrillAction',
      );
      expect(
        source,
        `${surface} must not hand-roll a drill button`,
      ).not.toMatch(/<button[\s>]/);
    }
  });

  it('keeps exactly one shared segmented switcher for report bodies', () => {
    const primitives = readFileSync(
      resolve(srcDir, 'components/ui/report-section-primitives.tsx'),
      'utf8',
    );
    expect(primitives).toContain('export function ReportSegmentedTabs');
    for (const surface of [
      'components/AccountingReportsSection.tsx',
      'components/GeneralLedgerCoreSection.tsx',
    ]) {
      const source = read(surface);
      expect(source, `${surface} must compose ReportSegmentedTabs`).toContain(
        '<ReportSegmentedTabs',
      );
      expect(
        source,
        `${surface} must not re-implement the segmented track`,
      ).not.toContain('rounded-xl border border-border/60 bg-muted/20 p-1');
    }
  });

  it('keeps one shell header hierarchy — report bodies never render a second page header', () => {
    for (const file of [
      'components/PropertyAnalyticsSection.tsx',
      'components/OverviewSection.tsx',
      'components/CollectionsSection.tsx',
      'components/StatementsSection.tsx',
    ]) {
      expect(read(file), `${file} must not render a PageHeader`).not.toContain(
        '<PageHeader',
      );
    }
    const productPage = read('premium/report-product-page.tsx');
    expect(productPage).toContain('data-report-product-header');
    expect(productPage).toContain('<ReportViewPanel');
  });

  it('does not repeat statement filter/readiness state in a second selection strip', () => {
    const section = read('components/StatementsSection.tsx');
    const summaryPanels = read(
      'components/statements/statement-summary-panels.tsx',
    );
    expect(section).not.toContain('StatementSelectionStrip');
    expect(summaryPanels).not.toContain('StatementSelectionStrip');
    expect(summaryPanels).not.toContain('SelectionItem');
  });

  it('keeps report output actions behind the shared control', () => {
    const section = read('components/PropertyAnalyticsSection.tsx');
    expect(section).toContain('<ReportDocumentActions');
    // Exactly one output control per report body — no competing export row.
    expect((section.match(/<ReportDocumentActions/g) ?? []).length).toBe(1);
  });

  it('does not keep a second, unreachable report directory surface', () => {
    expect(
      existsSync(resolve(reportsDir, 'directory/ReportDirectory.tsx')),
    ).toBe(false);
    expect(
      existsSync(resolve(reportsDir, 'directory/report-directory-groups.ts')),
    ).toBe(false);
    expect(read('reports-page.tsx')).toContain('<ReportsCatalog');
  });
});

/* ------------------------------------------------------------------ */
/* 4. Reports Center IA reachability                                   */
/* ------------------------------------------------------------------ */

describe('reports closure — Reports Center reachability', () => {
  it('gives every catalogued product one distinct identity and route target', () => {
    const titles = REPORT_PRODUCTS.map((product) => product.title);
    expect(new Set(titles).size).toBe(titles.length);
    expect(REPORT_PRODUCTS).toHaveLength(5);
    for (const product of REPORT_PRODUCTS)
      expect(product.targets.length).toBeGreaterThan(0);
  });

  it('has one unique canonical product target for every retained analytics or accounting body', () => {
    const bodyLocations = REPORT_PRODUCTS.flatMap((product) =>
      product.targets
        .filter((target) => target.section !== 'statements')
        .map((target) => `${target.section}:${target.view}`),
    );
    expect(bodyLocations).toHaveLength(15);
    expect(new Set(bodyLocations).size).toBe(bodyLocations.length);
  });

  it('uses business language, never developer terminology, in the product catalog', () => {
    for (const product of REPORT_PRODUCTS) {
      for (const text of [
        product.title,
        product.description,
        product.businessQuestion,
        ...product.targets.flatMap((target) => [
          target.label,
          target.description,
        ]),
      ]) {
        expect(text).not.toMatch(
          /RPC|adapter|read model|payload|registry|snapshot/i,
        );
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* 5. Document outputs                                                 */
/* ------------------------------------------------------------------ */

describe('reports closure — document outputs', () => {
  const registeredTypes = new Set(documentRegistry.map((spec) => spec.type));

  it('registers the Golden Report and statement outputs Reports depends on', () => {
    for (const type of [
      'owner_report',
      'property_report',
      'tenant_statement',
      'owner_statement',
      'generic_report',
    ]) {
      expect(
        registeredTypes.has(type as never),
        `${type} must be registered`,
      ).toBe(true);
    }
  });

  it('keeps every Reports-owned document on A4 with print and PDF outputs', () => {
    for (const type of [
      'owner_report',
      'property_report',
      'tenant_statement',
    ]) {
      const spec = documentRegistry.find((item) => item.type === type)!;
      expect(spec.page.size).toBe('A4');
      expect(spec.supportedOutputs).toContain('print');
      expect(spec.supportedOutputs).toContain('pdf');
      expect(spec.signatureRoles.length).toBeGreaterThan(0);
    }
  });

  it('keeps the Property Golden Report distinct from the Owner Golden Report', () => {
    const property = read('documents/professional-property-report.ts');
    const owner = read('documents/professional-owner-report.ts');
    // Property = performance/utilisation; Owner = settlement/owner money.
    expect(property).toContain('Property_Performance_Report');
    expect(property).not.toContain('صافي التسوية المستحق للمالك');
    expect(owner).toMatch(/تسوية|استقطاع/);
  });

  it('renders an unavailable amount as an em dash, never as a printed zero', () => {
    const data: PropertyReportData = {
      propertyTitle: null,
      scopeLabel: 'جميع العقارات المُدارة',
      periodFrom: '2026-02-01',
      periodTo: '2026-02-28',
      generatedAt: '2026-03-01',
      isPortfolioScope: true,
      collectionRateCurrent: null,
      collectionRatePrevious: null,
      asOf: '2026-02-28',
      occupancy: {
        units: 0,
        occupied: 0,
        vacant: 0,
        nonRentable: 0,
        rate: null,
      },
      summary: null,
      overdueTotal: null,
      arrearsAsOf: null,
      arrearsBuckets: null,
      expenseTotal: null,
      expenseByCategory: [],
      maintenancePeriodCount: 0,
      maintenanceOpenAsOf: 0,
      expiringCount: 0,
      expiringRentExposed: null,
      expiringRowsSlice: null,
      longestVacancyDays: null,
      averageVacancyDays: null,
      vacancyCount: 0,
      vacancyRows: null,
      monthlyCollectionTrend: [],
      occupancyTrend: [],
      unitRows: [],
      previous: null,
      portfolio: null,
    };
    const payload = buildPropertyReportPayload(data);
    const kpis = payload.groups[0].blocks.find(
      (block) => block.kind === 'kpis',
    );
    expect(kpis).toBeDefined();
    const occupancyKpi =
      kpis && kpis.kind === 'kpis'
        ? kpis.kpis.find((kpi) => kpi.label === 'نسبة الإشغال')
        : undefined;
    expect(occupancyKpi?.value).toEqual({ kind: 'text', value: '—' });
    const collectedKpi =
      kpis && kpis.kind === 'kpis'
        ? kpis.kpis.find((kpi) => kpi.label === 'المحصل للفترة')
        : undefined;
    expect(collectedKpi?.value).toEqual({ kind: 'text', value: '—' });
  });

  it('omits the comparison block truthfully when there is no previous period', () => {
    const data = {
      propertyTitle: 'برج الخوير',
      scopeLabel: 'العقار: برج الخوير',
      periodFrom: '2026-02-01',
      periodTo: '2026-02-28',
      generatedAt: '2026-03-01',
      isPortfolioScope: false,
      collectionRateCurrent: null,
      collectionRatePrevious: null,
      asOf: '2026-02-28',
      occupancy: {
        units: 10,
        occupied: 8,
        vacant: 1,
        nonRentable: 1,
        rate: 80,
      },
      summary: null,
      overdueTotal: 100,
      arrearsAsOf: null,
      arrearsBuckets: null,
      expenseTotal: 50,
      expenseByCategory: [],
      maintenancePeriodCount: 0,
      maintenanceOpenAsOf: 0,
      expiringCount: 0,
      expiringRentExposed: null,
      expiringRowsSlice: null,
      longestVacancyDays: null,
      averageVacancyDays: null,
      vacancyCount: 0,
      vacancyRows: null,
      monthlyCollectionTrend: [],
      occupancyTrend: [],
      unitRows: [],
      previous: null,
      portfolio: null,
    } satisfies PropertyReportData;
    const payload = buildPropertyReportPayload(data);
    const blocks = payload.groups[0].blocks;
    const comparisonTable = blocks.find(
      (block) =>
        block.kind === 'table' &&
        (block.table.title ?? '').includes('مقارنة الأداء'),
    );
    expect(comparisonTable).toBeUndefined();
    const note = blocks.find((block) => block.kind === 'note');
    expect(note && note.kind === 'note' ? note.note.text : '').toContain(
      'لا تتوفر فترة سابقة قابلة للمقارنة',
    );
  });
});

/* ------------------------------------------------------------------ */
/* 6. Charts                                                           */
/* ------------------------------------------------------------------ */

describe('reports closure — charts stay purposeful and source-backed', () => {
  it('uses one chart architecture (the document chart payload) inside report documents', () => {
    const property = read('documents/professional-property-report.ts');
    expect(property).toContain("kind: 'chart'");
    // No second chart engine inside a document.
    expect(property).not.toContain('recharts');
    expect(property).not.toContain('ReportBarChart');
  });

  it('keeps the occupancy trend three-way so vacancy is never overstated', () => {
    const property = read('documents/professional-property-report.ts');
    expect(property).toContain("{ name: 'غير قابل للتأجير'");
    expect(property).toContain('isRentableUnitStatus');
  });
});
