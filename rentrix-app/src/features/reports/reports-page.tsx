import { useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { canAccess, financialOperationPermissions } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { translateSharedLabel } from '@/lib/i18n';
import { ReportsCatalog } from './components/ReportsCatalog';
import { getCurrentMonthFilters } from './reports-page.helpers';
import { getInitialReportsFilters, type ReportsFilterState } from './reports-workspace-filters';
import {
  REPORTS_SECTION_SEARCH_KEY,
  buildWorkspaceSearch,
  diffReportFiltersFromSearch,
  resolveWorkspaceLocation,
} from './reports-section-model';
import type { ReportViewId } from './report-view-registry';
import {
  LEGACY_REPORT_DESTINATION_MAP,
  REPORT_PRODUCTS,
  getReportProduct,
  getReportProductTarget,
  type ReportProduct,
  type ReportProductId,
  type ReportProductTarget,
} from './report-products';
import { WORKSPACE_SEARCH_KEY, type ReportDrillHandler, type ReportWorkspaceId } from './report-workspaces';
import { ReportsPrimaryNavigation } from './workspace/ReportsPrimaryNavigation';
import { ReportsWorkspace } from './workspace/ReportsWorkspace';
import { useReportsWorkspace } from './use-reports-workspace';

export { escapeCsvValue } from '@/lib/csvExport';
export { buildReportCsvFilename, getTodayLocalDateString, toDateInputValue } from './reports-page.helpers';

const REPORT_PRODUCT_SEARCH_KEY = 'report';
const REPORT_PRODUCT_VIEW_SEARCH_KEY = 'reportView';

const WORKSPACE_PRODUCT_FALLBACK: Readonly<Record<ReportWorkspaceId, ReportProductId>> = Object.freeze({
  office: 'portfolio-property-performance',
  collections: 'collections-arrears-cheques',
  leasing: 'portfolio-property-performance',
  operations: 'portfolio-property-performance',
  properties: 'portfolio-property-performance',
  statements: 'owner-comprehensive-statement',
  financial_review: 'financial-settlement-pack',
});

function clearLegacyReportLocation(search: Record<string, unknown>) {
  const next = { ...search };
  delete next[WORKSPACE_SEARCH_KEY];
  delete next[REPORTS_SECTION_SEARCH_KEY];
  delete next.view;
  return next;
}

function hasExplicitLegacyLocation(search: Record<string, unknown>) {
  return [search[WORKSPACE_SEARCH_KEY], search[REPORTS_SECTION_SEARCH_KEY], search.view].some(
    (value) => typeof value === 'string' && value.trim() !== '',
  );
}

function resolveProductForDrill(
  currentProduct: ReportProduct,
  workspace: ReportWorkspaceId,
  view?: ReportViewId,
): { product: ReportProduct; target: ReportProductTarget } {
  const legacyKey = view || (workspace === 'statements' ? 'statements' : '');
  const mappedProductId = legacyKey ? LEGACY_REPORT_DESTINATION_MAP[legacyKey] : undefined;
  let productId = mappedProductId ?? WORKSPACE_PRODUCT_FALLBACK[workspace];

  if (workspace === 'statements' && !view && (currentProduct.id === 'tenant-statement' || currentProduct.id === 'financial-settlement-pack')) {
    productId = currentProduct.id;
  }

  const product = REPORT_PRODUCTS.find((candidate) => candidate.id === productId) ?? currentProduct;
  const target = product.targets.find(
    (candidate) => candidate.workspace === workspace && (view === undefined || candidate.view === view),
  ) ?? getReportProductTarget(product, view);

  return { product, target };
}

function ProductCapabilityNotice({ product }: Readonly<{ product: ReportProduct }>) {
  if (product.id === 'collections-arrears-cheques') {
    return (
      <div
        className="rounded-lg border border-border/70 bg-muted/25 px-3 py-2.5 text-xs font-semibold leading-5 text-muted-foreground"
        role="note"
        data-report-capability-note="cheques"
      >
        <strong className="text-foreground">الشيكات:</strong>{' '}
        لا توجد في نموذج البيانات الحالي دورة حيازة موثقة للشيك المؤجل من الاستلام إلى الإيداع والتحصيل أو الارتداد؛ لذلك لا يعرض MALEK حالات شيكات مصطنعة داخل هذا التقرير. التحصيل والمتأخرات أدناه من المصادر الفعلية الحالية فقط.
      </div>
    );
  }

  if (product.id === 'financial-settlement-pack') {
    return (
      <div
        className="rounded-lg border border-border/70 bg-muted/25 px-3 py-2.5 text-xs font-semibold leading-5 text-muted-foreground"
        role="note"
        data-report-capability-note="financial-pack"
      >
        هذه الحزمة لا تنشئ دفترًا ماليًا موازيًا: الحركة النقدية والقوائم ودفتر الأستاذ وتسوية الإيرادات تُقرأ من المصادر المحاسبية المعتمدة. تفاصيل العمليات البنكية والتأمينات وتسويات الملاك تبقى على مسارات Money التشغيلية إلى أن يتوفر لها read-model تقريري موحد وآمن.
      </div>
    );
  }

  return null;
}

function ReportProductNavigation({
  product,
  activeTarget,
  onOpen,
}: Readonly<{
  product: ReportProduct;
  activeTarget: ReportProductTarget;
  onOpen: (target: ReportProductTarget) => void;
}>) {
  if (product.targets.length <= 1) return null;

  return (
    <nav className="flex min-w-0 flex-wrap gap-1.5" aria-label={`أقسام ${product.title}`} data-report-product-navigation>
      {product.targets.map((target) => (
        <Button
          key={target.id}
          type="button"
          variant={target.id === activeTarget.id ? 'secondary' : 'outline'}
          size="sm"
          className="min-h-11 text-xs font-black"
          aria-current={target.id === activeTarget.id ? 'page' : undefined}
          onClick={() => onOpen(target)}
        >
          {target.label}
        </Button>
      ))}
    </nav>
  );
}

export function ReportsPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const [filters, setFilters] = useState(() => getInitialReportsFilters(search));
  const { authorization } = useAuth();
  const canExportReports = canAccess(authorization, financialOperationPermissions.exportReports);
  const canViewReports = canAccess(authorization, financialOperationPermissions.viewReports);
  const product = getReportProduct(search[REPORT_PRODUCT_SEARCH_KEY]);
  const legacyLocationRequested = !product && hasExplicitLegacyLocation(search);

  const { workspace: legacyWorkspace, section: legacySection, view: legacyView } = resolveWorkspaceLocation(
    search[WORKSPACE_SEARCH_KEY],
    search.view,
    search[REPORTS_SECTION_SEARCH_KEY],
  );

  const lastSearchRef = useRef<Record<string, unknown>>(search);
  useEffect(() => {
    const previous = lastSearchRef.current;
    if (previous === search) return;
    lastSearchRef.current = search;
    const patch = diffReportFiltersFromSearch(previous, search);
    if (patch) setFilters((current) => ({ ...current, ...patch }));
  }, [search]);

  const handleResetCurrentMonth = useCallback(() => {
    setFilters((current) => ({ ...current, ...getCurrentMonthFilters() }));
  }, []);

  const handleLegacyOpenReport = useCallback(
    (nextWorkspace: ReportWorkspaceId, nextView?: ReportViewId) => {
      void navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => buildWorkspaceSearch(previous, nextWorkspace, nextView),
      });
    },
    [navigate],
  );

  const handleLegacyDrill: ReportDrillHandler = useCallback(
    (targetWorkspace, targetView, filterPatch) => {
      void navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => buildWorkspaceSearch(previous, targetWorkspace, targetView, filterPatch),
      });
    },
    [navigate],
  );

  if (!canViewReports) {
    return <AccessDenied message="عرض التقارير متاح فقط للصلاحيات المخولة." />;
  }

  if (!product && !legacyLocationRequested) {
    return (
      <PageLayout dir="rtl" lang="ar" size="wide">
        <PageHeader
          title="التقارير"
          description="اختر التقرير الذي يجيب عن سؤال العمل المطلوب، ثم حدّد الطرف أو العقار والفترة داخل التقرير نفسه."
        />
        <div data-report-landing data-finance-root className="min-w-0">
          <ReportsCatalog />
        </div>
      </PageLayout>
    );
  }

  if (product) {
    const activeTarget = getReportProductTarget(product, search[REPORT_PRODUCT_VIEW_SEARCH_KEY]);

    const openProductTarget = (target: ReportProductTarget, filterPatch?: Partial<ReportsFilterState>) => {
      void navigate({
        to: '/reports',
        search: (previous: Record<string, unknown>) => ({
          ...clearLegacyReportLocation(previous),
          ...filterPatch,
          [REPORT_PRODUCT_SEARCH_KEY]: product.id,
          [REPORT_PRODUCT_VIEW_SEARCH_KEY]: target.id,
        }),
      });
    };

    const handleProductDrill: ReportDrillHandler = (targetWorkspace, targetView, filterPatch) => {
      const destination = resolveProductForDrill(product, targetWorkspace, targetView);
      void navigate({
        to: '/reports',
        search: (previous: Record<string, unknown>) => ({
          ...clearLegacyReportLocation(previous),
          ...filterPatch,
          [REPORT_PRODUCT_SEARCH_KEY]: destination.product.id,
          [REPORT_PRODUCT_VIEW_SEARCH_KEY]: destination.target.id,
        }),
      });
    };

    const handleOpenProductReport = (workspace: ReportWorkspaceId, view: ReportViewId) => {
      const destination = resolveProductForDrill(product, workspace, view);
      void navigate({
        to: '/reports',
        search: (previous: Record<string, unknown>) => ({
          ...clearLegacyReportLocation(previous),
          [REPORT_PRODUCT_SEARCH_KEY]: destination.product.id,
          [REPORT_PRODUCT_VIEW_SEARCH_KEY]: destination.target.id,
        }),
      });
    };

    return (
      <PageLayout dir="rtl" lang="ar" size="wide">
        <PageHeader
          title={product.title}
          description={product.businessQuestion}
          backTo="/reports"
          backLabel="كتالوج التقارير"
        />

        <div data-finance-root data-open-report-product={product.id} className="min-w-0 space-y-3">
          <ReportProductNavigation product={product} activeTarget={activeTarget} onOpen={openProductTarget} />
          <ProductCapabilityNotice product={product} />

          <OpenReportWorkspace
            filters={filters}
            canExportReports={canExportReports}
            activeWorkspace={activeTarget.workspace}
            activeSection={activeTarget.section}
            activeView={activeTarget.view}
            onOpenView={(view) => handleOpenProductReport(activeTarget.workspace, view)}
            onOpenReport={handleOpenProductReport}
            onDrill={handleProductDrill}
            onFiltersChange={setFilters}
            onResetCurrentMonth={handleResetCurrentMonth}
            hideWorkspaceNavigation
            statementFocus={product.statementFocus}
          />
        </div>
      </PageLayout>
    );
  }

  const reportsTitle = translateSharedLabel('financialsSectionReports');
  const pageDescription = translateSharedLabel('reportsPageDescription');

  return (
    <PageLayout dir="rtl" lang="ar" size="wide">
      <PageHeader title={reportsTitle} description={pageDescription} backTo="/reports" backLabel="كتالوج التقارير" />

      <div data-finance-root className="min-w-0 space-y-3" data-legacy-report-location>
        <ReportsPrimaryNavigation activeWorkspace={legacyWorkspace} onOpen={handleLegacyOpenReport} />
        <div id="reports-workspace-panel" className="min-w-0" data-active-report-workspace>
          <OpenReportWorkspace
            filters={filters}
            canExportReports={canExportReports}
            activeWorkspace={legacyWorkspace}
            activeSection={legacySection}
            activeView={legacyView}
            onOpenView={(view) => handleLegacyOpenReport(legacyWorkspace, view)}
            onOpenReport={handleLegacyOpenReport}
            onDrill={handleLegacyDrill}
            onFiltersChange={setFilters}
            onResetCurrentMonth={handleResetCurrentMonth}
          />
        </div>
      </div>
    </PageLayout>
  );
}

type OpenReportWorkspaceProps = Readonly<{
  filters: ReportsFilterState;
  canExportReports: boolean;
  activeWorkspace: ReportWorkspaceId;
  activeSection: Parameters<typeof useReportsWorkspace>[1]['section'];
  activeView: ReportViewId;
  onOpenView: (view: ReportViewId) => void;
  onOpenReport: (workspace: ReportWorkspaceId, view: ReportViewId) => void;
  onDrill: ReportDrillHandler;
  onFiltersChange: (filters: ReportsFilterState) => void;
  onResetCurrentMonth: () => void;
  hideWorkspaceNavigation?: boolean;
  statementFocus?: ReportProduct['statementFocus'];
}>;

function OpenReportWorkspace({
  filters,
  canExportReports,
  activeWorkspace,
  activeSection,
  activeView,
  onOpenView,
  onOpenReport,
  onDrill,
  onFiltersChange,
  onResetCurrentMonth,
  hideWorkspaceNavigation = false,
  statementFocus,
}: OpenReportWorkspaceProps) {
  const workspace = useReportsWorkspace(filters, { section: activeSection, view: activeView });

  return (
    <ReportsWorkspace
      model={workspace}
      filters={filters}
      canExportReports={canExportReports}
      activeWorkspace={activeWorkspace}
      activeSection={activeSection}
      activeView={activeView}
      onOpenView={onOpenView}
      onOpenReport={onOpenReport}
      onDrill={onDrill}
      onFiltersChange={onFiltersChange}
      onResetCurrentMonth={onResetCurrentMonth}
      hideWorkspaceNavigation={hideWorkspaceNavigation}
      statementFocus={statementFocus}
    />
  );
}
