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
import { formatMoney } from '@/features/financials/components/financials-formatters';
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
import { SectionTabPanel, SectionTabs } from '@/components/ui/section-tabs';
import { ReportViewPanel } from '../components/report-view-panel';
import { useReportsWorkspace } from '../use-reports-workspace';
import { getCurrentMonthFilters } from '../reports-page.helpers';
import { useReportProductDocumentActions } from './report-product-document-actions';
import { StatementProductHeader, type StatementContextItem } from './statement-product-header';

/* ------------------------------------------------------------------ */
/* The premium report product page (real route: /reports/$reportId)    */
/* ------------------------------------------------------------------ */

const REPORT_PRODUCT_TABS_ID_PREFIX = 'report-product';

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
  const isStatement = product.kind === 'statement';
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
      contentKind: product.kind,
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

  const ownerStatement = model.sections.statements.ownerStatement;
  const ownerReportPayload = model.sections.statements.ownerReportPayload;
  const tenantStatement = model.sections.statements.tenantStatement;
  const statementTitle =
    product.statementFocus === 'owner'
      ? 'كشف حساب المالك'
      : product.statementFocus === 'tenant'
        ? 'كشف حساب المستأجر'
        : product.title;
  const statementDescription =
    product.statementFocus === 'owner'
      ? 'سجل مالي مفصل للمالك ضمن الفترة المحددة، مع الأرصدة والحركات المعتمدة.'
      : 'سجل مالي للعقد والمستأجر، يعرض الحركات والأرصدة ضمن سياق العقد المعتمد.';
  const statementContext: StatementContextItem[] =
    product.statementFocus === 'owner'
      ? [
          {
            label: 'المالك',
            value: ownerStatement?.ownerName || 'اختر المالك',
          },
          {
            label: 'نطاق العقارات',
            value: ownerReportPayload?.scopeLabel || 'كل عقارات المالك',
          },
          {
            label: 'فترة الكشف',
            value: `${ownerStatement?.periodFrom || scopedFilters.from || '—'} — ${ownerStatement?.periodTo || scopedFilters.to || '—'}`,
          },
          {
            label: 'صافي الحركة',
            value: ownerStatement
              ? formatMoney(ownerStatement.totalNet)
              : 'يظهر بعد تحميل كشف الحساب',
          },
        ]
      : [
          {
            label: 'المستأجر',
            value: tenantStatement?.tenantName || 'اختر العقد',
          },
          {
            label: 'العقار والوحدة',
            value:
              [tenantStatement?.propertyName, tenantStatement?.unitName]
                .filter(Boolean)
                .join(' — ') || 'تظهر بعد اختيار العقد',
          },
          {
            label: 'مدة العقد',
            value:
              tenantStatement?.startDate && tenantStatement?.endDate
                ? `${tenantStatement.startDate} — ${tenantStatement.endDate}`
                : 'تظهر من العقد المختار',
          },
          {
            label: 'الرصيد الختامي',
            value: tenantStatement
              ? formatMoney(tenantStatement.finalBalance)
              : 'يظهر بعد تحميل كشف الحساب',
          },
        ];
  const statementBack = () => {
    if (product.statementFocus === 'owner' && scopedFilters.ownerId) {
      void navigate({
        to: '/owners/$ownerId',
        params: { ownerId: scopedFilters.ownerId },
      });
      return;
    }
    if (product.statementFocus === 'tenant' && scopedFilters.contractId) {
      void navigate({
        to: '/contracts/$contractId',
        params: { contractId: scopedFilters.contractId },
      });
      return;
    }
    onBack();
  };
  const statementBackLabel =
    product.statementFocus === 'owner' && scopedFilters.ownerId
      ? 'العودة إلى ملف المالك'
      : product.statementFocus === 'tenant' && scopedFilters.contractId
        ? 'العودة إلى العقد'
        : 'العودة إلى التقارير';
  const documentActions = (
    <ReportDocumentActions
      reportLabel={
        product.targets.length > 1
          ? `${isStatement ? statementTitle : product.title} — ${target.label}`
          : isStatement
            ? statementTitle
            : product.title
      }
      contentKind={product.kind}
      whatsapp={false}
      disabled={model.isIncomplete}
      {...capabilities}
      share={canExportReports ? shareInput : undefined}
    />
  );

  return (
    <PageLayout dir="rtl" lang="ar" size="wide">
      <div
        data-report-product-page={product.id}
        data-product-kind={product.kind}
        data-statement-product-page={isStatement ? product.id : undefined}
        className="min-w-0 space-y-3"
      >
        {isStatement ? (
          <StatementProductHeader
            title={statementTitle}
            description={statementDescription}
            icon={Icon}
            contextItems={statementContext}
            actions={documentActions}
            notice={
              documentUnavailableHint ? (
                <p
                  className="rounded-lg border border-border/55 bg-background/70 px-2.5 py-1.5 text-[11px] font-semibold leading-4 text-muted-foreground"
                  role="note"
                >
                  {documentUnavailableHint}
                </p>
              ) : null
            }
            backLabel={statementBackLabel}
            onBack={statementBack}
          />
        ) : (
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
              {documentActions}
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
            <div className="mt-3 border-t border-border/55 pt-2.5" data-report-product-tabs>
              <SectionTabs
                items={product.targets.map((nextTarget) => ({
                  id: nextTarget.id,
                  label: nextTarget.label,
                }))}
                activeId={target.id}
                onChange={(activeTargetId) => {
                  const next = product.targets.find(
                    (candidate) => candidate.id === activeTargetId,
                  );
                  if (next) onOpenTarget(next);
                }}
                ariaLabel={`أجزاء ${product.title}`}
                idPrefix={REPORT_PRODUCT_TABS_ID_PREFIX}
              />
            </div>
          ) : null}
          </header>
        )}

        <section
          className="min-w-0 space-y-3"
          data-report-product-content={!isStatement ? '' : undefined}
          data-statement-product-content={isStatement ? '' : undefined}
        >
          <ReportsFilterSurface
            filters={scopedFilters}
            costCenterRows={model.filters.costCenterRows}
            ownerRows={model.filters.ownerRows}
            contractRows={model.filters.contractRows}
            visibleFields={visibleFilterFields}
            contentKind={product.kind}
            onChange={onFiltersChange}
            onResetCurrentMonth={handleResetCurrentMonth}
          />

          {model.isIncomplete ? (
            <DataRefreshAlert
              title={
                isStatement
                  ? 'كشف الحساب غير مكتمل التحديث'
                  : 'نتائج التقرير غير مكتملة'
              }
              description={
                isStatement
                  ? 'تعذر تحديث مصدر واحد أو أكثر. قد تبقى الحركات السابقة ظاهرة للمراجعة، لكن طباعة كشف الحساب وتصديره متوقفان حتى ينجح تحديث جميع المصادر.'
                  : 'تعذر تحديث مصدر واحد أو أكثر. قد تبقى النتائج السابقة ظاهرة للمراجعة، لكن الطباعة والتصدير متوقفان حتى ينجح تحديث جميع المصادر.'
              }
              onRetry={() => {
                void model.retryFailedSources();
              }}
            />
          ) : null}

          <div
            data-stale-report-content={
              !isStatement && model.isIncomplete ? 'true' : undefined
            }
            data-stale-statement-content={
              isStatement && model.isIncomplete ? 'true' : undefined
            }
            aria-label={
              model.isIncomplete
                ? isStatement
                  ? 'كشف حساب غير مكتمل للقراءة فقط'
                  : 'نتائج تقرير غير مكتملة للقراءة فقط'
                : undefined
            }
          >
            <SectionTabPanel
              id={target.id}
              activeId={target.id}
              idPrefix={REPORT_PRODUCT_TABS_ID_PREFIX}
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
            </SectionTabPanel>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
