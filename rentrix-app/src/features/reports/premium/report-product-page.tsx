import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { ArrowRight, FileText } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessDenied } from '@/components/layout/access-denied';
import { DataRefreshAlert } from '@/components/data-refresh-alert';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import {
  canAccess,
  financialOperationPermissions,
} from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import {
  getInitialReportsFilters,
  scopeReportsFiltersToFields,
  type ReportsFilterState,
} from '../reports-workspace-filters';
import {
  buildReportProductSearch,
  diffReportFiltersFromSearch,
  type ReportDrillHandler,
} from '../report-route';
import {
  getReportProduct,
  getReportProductFilterFields,
  getReportProductTarget,
  getReportProductTargetForLocation,
  type ReportProduct,
  type ReportProductTarget,
} from '../report-products';
import { buildReportProductSharePayload } from '../report-share';
import { ReportDocumentActions } from '../components/report-document-actions';
import { ReportsFilterSurface } from '../components/ReportsFilterSurface';
import { ReportViewPanel } from '../components/report-view-panel';
import { useReportsWorkspace } from '../use-reports-workspace';
import { getCurrentMonthFilters } from '../reports-page.helpers';
import { useReportProductDocumentActions } from './report-product-document-actions';

/* ------------------------------------------------------------------ */
/* Product target tabs — one compact switcher per premium product.     */
/* ------------------------------------------------------------------ */

function ProductTargetTabs({
  product,
  activeTargetId,
  onOpen,
}: Readonly<{
  product: ReportProduct;
  activeTargetId: string;
  onOpen: (target: ReportProductTarget) => void;
}>) {
  if (product.targets.length <= 1) return null;
  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-1"
      role="tablist"
      aria-label={`أجزاء ${product.title}`}
      data-report-product-tabs
    >
      {product.targets.map((nextTarget) => {
        const active = nextTarget.id === activeTargetId;
        return (
          <Button
            key={nextTarget.id}
            type="button"
            variant="outline"
            role="tab"
            aria-selected={active}
            onClick={() => onOpen(nextTarget)}
            className={cn(
              'min-h-11 rounded-lg px-2.5 text-xs font-black focus-visible:ring-2 focus-visible:ring-primary/30',
              active
                ? 'border-primary/35 bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary'
                : 'border-border/70 bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground',
            )}
          >
            {nextTarget.label}
          </Button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The premium report product page (real route: /reports/$reportId)    */
/* ------------------------------------------------------------------ */

export function ReportProductPage() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { reportId?: string };
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const { authorization } = useAuth();
  const canExportReports = canAccess(
    authorization,
    financialOperationPermissions.exportReports,
  );
  const canViewReports = canAccess(
    authorization,
    financialOperationPermissions.viewReports,
  );

  const product = getReportProduct(params.reportId);
  const target = product
    ? getReportProductTarget(product, search.view)
    : undefined;

  const [filters, setFilters] = useState<ReportsFilterState>(() =>
    getInitialReportsFilters(search ?? {}),
  );

  // URL (deep links / shared links) → state, one-way — the same contract the
  // reports workspace uses, so both modes agree on the active scope.
  const lastSearchRef = useRef<Record<string, unknown>>(search ?? {});
  useEffect(() => {
    const previous = lastSearchRef.current;
    if (previous === search) return;
    lastSearchRef.current = search;
    const patch = diffReportFiltersFromSearch(previous, search);
    if (patch) setFilters((current) => ({ ...current, ...patch }));
  }, [search]);

  const openTarget = useCallback(
    (next: ReportProductTarget) => {
      const nextFilters = scopeReportsFiltersToFields(
        filters,
        getReportProductFilterFields(next),
      );
      void navigate({
        to: '/reports/$reportId',
        params: { reportId: String(params.reportId ?? '') },
        search: (previous: Record<string, unknown>) =>
          buildReportProductSearch(previous, next, nextFilters),
      });
    },
    [filters, navigate, params.reportId],
  );

  if (!product || !target) {
    return (
      <PageLayout dir="rtl" lang="ar">
        <div
          className="mx-auto max-w-md rounded-xl border border-border/70 bg-card/80 p-6 text-center"
          role="status"
          data-report-product-not-found
        >
          <p className="text-sm font-black text-foreground">
            هذا التقرير غير موجود ضمن كتالوج MALEK.
          </p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            قد تكون معرفته قد تغيّرت؛ العودة إلى الكتالوج تعرض التقارير المدعومة
            الحالية.
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-4 min-h-11 text-xs font-black"
            onClick={() => void navigate({ to: '/reports' })}
          >
            العودة إلى كتالوج التقارير
          </Button>
        </div>
      </PageLayout>
    );
  }

  if (!canViewReports) {
    return <AccessDenied message="عرض التقارير متاح فقط للصلاحيات المخولة." />;
  }

  return (
    <OpenReportProduct
      product={product}
      target={target}
      filters={filters}
      canExportReports={canExportReports}
      onFiltersChange={setFilters}
      onOpenTarget={openTarget}
      onBack={() => void navigate({ to: '/reports', search: {} })}
    />
  );
}

function OpenReportProduct({
  product,
  target,
  filters,
  canExportReports,
  onFiltersChange,
  onOpenTarget,
  onBack,
}: Readonly<{
  product: ReportProduct;
  target: ReportProductTarget;
  filters: ReportsFilterState;
  canExportReports: boolean;
  onFiltersChange: (filters: ReportsFilterState) => void;
  onOpenTarget: (target: ReportProductTarget) => void;
  onBack: () => void;
}>) {
  const navigate = useNavigate();
  const Icon = product.icon;
  const visibleFilterFields = getReportProductFilterFields(target);
  const scopedFilters = useMemo(
    () => scopeReportsFiltersToFields(filters, visibleFilterFields),
    [filters, visibleFilterFields],
  );
  const model = useReportsWorkspace(
    scopedFilters,
    { section: target.section, view: target.view },
    { statementFocus: product.statementFocus },
  );
  const { capabilities, documentUnavailableHint } =
    useReportProductDocumentActions({
      target,
      model,
      filters: scopedFilters,
      canExportReports,
    });

  const shareInput = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const payload = buildReportProductSharePayload(
      origin,
      {
        reportId: product.id,
        view: product.targets.length > 1 ? target.id : undefined,
        filters: {
          from: scopedFilters.from,
          to: scopedFilters.to,
          asOf: scopedFilters.asOf,
          propertyId: scopedFilters.propertyId,
          unitId: scopedFilters.unitId,
          tenantId: scopedFilters.tenantId,
          ownerId: scopedFilters.ownerId,
          contractId: scopedFilters.contractId,
        },
      },
      {
        reportLabel:
          product.targets.length > 1
            ? `${product.title} — ${target.label}`
            : product.title,
        summaryText: [
          `الفترة: ${scopedFilters.from || '—'} → ${scopedFilters.to || '—'}`,
          model.firstError ? 'قد تُعرض نتائج جزئية؛ بعض المصادر لم تكتمل.' : '',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    );
    return {
      title: product.title,
      text: payload.shareText,
      url: payload.url,
      buildFile: capabilities.buildPdfFile,
    };
  }, [
    capabilities.buildPdfFile,
    model.firstError,
    product,
    scopedFilters,
    target,
  ]);

  // Drill-through resolves to the product that owns the retained body. It
  // never reopens a workspace shell or writes legacy route keys.
  const handleDrill: ReportDrillHandler = useCallback(
    (section, view, filterPatch) => {
      const destination = getReportProductTargetForLocation(section, view);
      if (!destination) return;
      void navigate({
        to: '/reports/$reportId',
        params: { reportId: destination.product.id },
        search: (previous: Record<string, unknown>) =>
          buildReportProductSearch(
            previous,
            destination.target,
            scopedFilters,
            filterPatch,
          ),
      });
    },
    [navigate, scopedFilters],
  );

  const handleResetCurrentMonth = useCallback(() => {
    onFiltersChange({ ...scopedFilters, ...getCurrentMonthFilters() });
  }, [onFiltersChange, scopedFilters]);

  return (
    <PageLayout dir="rtl" lang="ar" size="wide">
      <div data-report-product-page={product.id} className="min-w-0 space-y-3">
        <header
          className="rounded-xl border border-border/70 bg-card/85 p-3 shadow-sm sm:p-4"
          data-report-product-header
        >
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-2.5">
            <div className="flex min-w-0 flex-1 items-start gap-2.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="mt-0.5 min-h-11 shrink-0 gap-1.5 px-2 text-xs font-black text-muted-foreground hover:text-foreground"
                aria-label="العودة إلى كتالوج التقارير"
              >
                <ArrowRight className="size-4" aria-hidden="true" />
                الكتالوج
              </Button>
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border border-primary/15 bg-primary/[0.06] text-primary sm:size-10">
                <Icon className="size-4.5 sm:size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h1 className="text-base font-black leading-6 text-foreground sm:text-lg">
                  {product.title}
                </h1>
                <p
                  className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground"
                  dir="ltr"
                >
                  <FileText className="size-3" aria-hidden="true" />
                  {product.englishTitle}
                </p>
                <p className="mt-1 max-w-2xl text-[11px] font-medium leading-4 text-muted-foreground sm:text-xs">
                  {product.businessQuestion}
                </p>
              </div>
            </div>

            <div className="shrink-0" data-report-product-actions>
              <ReportDocumentActions
                reportLabel={
                  product.targets.length > 1
                    ? `${product.title} — ${target.label}`
                    : product.title
                }
                whatsapp={false}
                disabled={model.isIncomplete}
                {...capabilities}
                share={canExportReports ? shareInput : undefined}
              />
            </div>
          </div>
          {documentUnavailableHint ? (
            <p
              className="mt-2 rounded-lg border border-border/55 bg-muted/25 px-2.5 py-1.5 text-[11px] font-semibold leading-4 text-muted-foreground"
              role="note"
            >
              {documentUnavailableHint}
            </p>
          ) : null}
          {product.targets.length > 1 ? (
            <div className="mt-3 border-t border-border/55 pt-2.5">
              <ProductTargetTabs
                product={product}
                activeTargetId={target.id}
                onOpen={onOpenTarget}
              />
            </div>
          ) : null}
        </header>

        <section className="min-w-0 space-y-3" data-report-product-content>
          <ReportsFilterSurface
            filters={scopedFilters}
            costCenterRows={model.filters.costCenterRows}
            ownerRows={model.filters.ownerRows}
            contractRows={model.filters.contractRows}
            visibleFields={visibleFilterFields}
            onChange={onFiltersChange}
            onResetCurrentMonth={handleResetCurrentMonth}
          />

          {model.isIncomplete ? (
            <DataRefreshAlert
              title="نتائج التقرير غير مكتملة"
              description="تعذر تحديث مصدر واحد أو أكثر. قد تبقى النتائج السابقة ظاهرة للمراجعة، لكن الطباعة والتصدير متوقفان حتى ينجح تحديث جميع المصادر."
              onRetry={() => {
                void model.retryFailedSources();
              }}
            />
          ) : null}

          <div
            data-stale-report-content={model.isIncomplete ? 'true' : undefined}
            aria-label={
              model.isIncomplete
                ? 'نتائج تقرير غير مكتملة للقراءة فقط'
                : undefined
            }
          >
            <ReportViewPanel
              activeSection={target.section}
              activeView={target.view}
              model={model}
              filters={scopedFilters}
              canExportReports={canExportReports && !model.isIncomplete}
              onDrill={handleDrill}
              statementFocus={product.statementFocus}
            />
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
