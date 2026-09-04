import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { ArrowRight, FileText } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { canAccess, financialOperationPermissions } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { buildXlsxBlob } from '@/lib/xlsx-export';
import { downloadBlob } from '@/lib/tabular-export';
import { cn } from '@/lib/utils';
import {
  downloadAgedArrearsReportPdf,
  downloadPortfolioPerformanceReportPdf,
  downloadRentRollReportPdf,
  printAgedArrearsReport,
  printPortfolioPerformanceReport,
  printRentRollReport,
} from '../documents/report-documents';
import { downloadPropertyReportPdf, printPropertyReport } from '../documents/professional-property-report';
import { getInitialReportsFilters, type ReportsFilterState } from '../reports-workspace-filters';
import {
  buildWorkspaceSearch,
  diffReportFiltersFromSearch,
  REPORTS_SECTION_SEARCH_KEY,
} from '../reports-section-model';
import { WORKSPACE_SEARCH_KEY, type ReportDrillHandler } from '../report-workspaces';
import {
  getReportProduct,
  getReportProductTarget,
  type ReportProduct,
  type ReportProductTarget,
} from '../report-products';
import { buildReportProductSharePayload } from '../report-share';
import { ReportDocumentActions } from '../components/report-document-actions';
import { ReportsWorkspace } from '../workspace/ReportsWorkspace';
import { useReportsWorkspace, type ReportsWorkspaceModel } from '../use-reports-workspace';
import { getCurrentMonthFilters } from '../reports-page.helpers';
import {
  buildOwnerReportPdfFile,
  buildTenantStatementPdfFile,
  downloadOwnerStatementExcel,
  downloadTenantStatementExcel,
  runOwnerReportDocumentAction,
  runTenantStatementDocumentAction,
} from './statement-report-actions';

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
          <button
            key={nextTarget.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onOpen(nextTarget)}
            className={cn(
              'inline-flex min-h-11 items-center rounded-lg border px-2.5 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
              active
                ? 'border-primary/35 bg-primary/10 text-primary'
                : 'border-border/70 bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground',
            )}
          >
            {nextTarget.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Canonical document capabilities per (product, target)               */
/* ------------------------------------------------------------------ */

type PremiumDocumentCapabilities = Readonly<{
  onPrint?: () => void | Promise<void>;
  onDownloadPdf?: () => void | Promise<void>;
  onDownloadExcel?: () => void;
  buildPdfFile?: () => Promise<File>;
}>;

function useReportProductDocumentActions(params: Readonly<{
  target: ReportProductTarget;
  model: ReportsWorkspaceModel;
  filters: ReportsFilterState;
  canExportReports: boolean;
}>): Readonly<{ capabilities: PremiumDocumentCapabilities; documentUnavailableHint: string | null }> {
  const { target, model, filters, canExportReports } = params;
  const { companySettings, isReady } = useDocumentSettings();
  const documentKind = target.documentKind;

  return useMemo(() => {
    if (!canExportReports) {
      return { capabilities: {}, documentUnavailableHint: 'الطباعة و PDF والمشاركة المباشرة تتطلب صلاحية تصدير التقارير؛ المعاينة متاحة كما هي.' };
    }
    if (!isReady) {
      return { capabilities: {}, documentUnavailableHint: 'أكمل بيانات الشركة الأساسية في الإعدادات لتفعيل الطباعة و PDF والمشاركة المباشرة.' };
    }
    if (!documentKind) {
      return { capabilities: {}, documentUnavailableHint: null };
    }

    const settings = companySettings;
    const statements = model.sections.statements;
    const period = { from: filters.from, to: filters.to };

    switch (documentKind) {
      case 'owner-pack': {
        const ownerId = statements.selectedOwnerId || filters.ownerId || null;
        const ownerParams = {
          isReady: true,
          settings,
          ownerId,
          statement: statements.ownerStatement,
          period: { ...period, propertyId: filters.propertyId },
        };
        return {
          documentUnavailableHint: null,
          capabilities: {
            onPrint: () => runOwnerReportDocumentAction(ownerParams, 'print'),
            onDownloadPdf: () => runOwnerReportDocumentAction(ownerParams, 'pdf'),
            onDownloadExcel: () => downloadOwnerStatementExcel(statements.ownerStatement, ownerId),
            buildPdfFile: async () => {
              if (!statements.ownerStatement || !ownerId) {
                throw Object.assign(new Error('لا يوجد كشف مالك معتمد للمجموعة المحددة بعد.'), { name: 'DocumentReadinessError' });
              }
              return buildOwnerReportPdfFile({
                settings,
                ownerId,
                statement: statements.ownerStatement,
                period: { ...period, propertyId: filters.propertyId },
              });
            },
          },
        };
      }
      case 'tenant-statement': {
        const tenantParams = { isReady: true, settings, statement: statements.tenantStatement, period };
        return {
          documentUnavailableHint: null,
          capabilities: {
            onPrint: () => runTenantStatementDocumentAction(tenantParams, 'print'),
            onDownloadPdf: () => runTenantStatementDocumentAction(tenantParams, 'pdf'),
            onDownloadExcel: () => downloadTenantStatementExcel(statements.tenantStatement, statements.selectedContractId || filters.contractId),
            buildPdfFile: () => buildTenantStatementPdfFile({ settings, statement: statements.tenantStatement, period }),
          },
        };
      }
      case 'rent-roll': {
        const rows = model.sections.collections.rentRollRows;
        return {
          documentUnavailableHint: rows.length === 0
            ? 'سجل العقود يبنى من عقود النطاق الحالي؛ يتفعل الإخراج عند وجود بيانات.'
            : null,
          capabilities: {
            onPrint: () => printRentRollReport({ rows, settings }),
            onDownloadPdf: () => downloadRentRollReportPdf({ rows, settings }),
            onDownloadExcel: () => {
              if (rows.length === 0) return;
              downloadBlob(
                buildXlsxBlob({
                  name: 'سجل العقود والإيجارات',
                  headers: ['المستأجر', 'العقار', 'الوحدة', 'الإيجار', 'دورة الدفع', 'حالة العقد', 'تاريخ البدء', 'تاريخ الانتهاء'],
                  rows: rows.map((row) => [
                    row.tenantName,
                    row.propertyTitle,
                    row.unitNumber,
                    row.rentAmount,
                    row.paymentCycle,
                    row.statusLabel,
                    row.startDate,
                    row.endDate,
                  ] as const),
                  rightToLeft: true,
                }),
                `rent-roll-${filters.from || 'all'}_${filters.to || 'now'}.xlsx`,
              );
            },
          },
        };
      }
      case 'aged-arrears': {
        const report = model.sections.overdue.agedReport;
        if (!report) {
          return {
            capabilities: {},
            documentUnavailableHint: 'كشف الأعمار يُبنى من مصدر المتأخرات المعتمد؛ يتفعل الإخراج عند اكتمال تحميله.',
          };
        }
        return {
          documentUnavailableHint: null,
          capabilities: {
            onPrint: () => printAgedArrearsReport({ report, settings }),
            onDownloadPdf: () => downloadAgedArrearsReportPdf({ report, settings }),
            onDownloadExcel: () => {
              downloadBlob(
                buildXlsxBlob({
                  name: 'أعمار المتأخرات',
                  headers: ['المستأجر', 'العقار / الوحدة', 'غير متأخر', '1–30', '31–60', '61–90', '+90', 'الإجمالي'],
                  rows: report.rows.map((row) => [
                    row.tenantName ?? '—',
                    `${row.propertyTitle ?? '—'}${row.unitNumber ? ` (${row.unitNumber})` : ''}`,
                    row.buckets.current?.total ?? 0,
                    row.buckets.days_1_30?.total ?? 0,
                    row.buckets.days_31_60?.total ?? 0,
                    row.buckets.days_61_90?.total ?? 0,
                    row.buckets.days_90_plus?.total ?? 0,
                    row.totalOutstanding,
                  ] as const),
                  rightToLeft: true,
                }),
                `arrears-aging-${report.asOf}.xlsx`,
              );
            },
          },
        };
      }
      case 'property-pack': {
        return {
          documentUnavailableHint: null,
          capabilities: {
            onPrint: () => printPropertyReport({ settings, model, filters }),
            onDownloadPdf: () => downloadPropertyReportPdf({ settings, model, filters }),
          },
        };
      }
      case 'portfolio-performance': {
        const occupancyRows = model.sections.occupancy.occupancyRows;
        return {
          documentUnavailableHint: occupancyRows.length === 0
            ? 'صورة المحفظة تُبنى من أداء الإشغال المعتمد؛ يتفعل الإخراج عند توفر بيانات الوحدات.'
            : null,
          capabilities: {
            onPrint: () => printPortfolioPerformanceReport({ occupancyRows, settings, periodFrom: filters.from, periodTo: filters.to }),
            onDownloadPdf: () => downloadPortfolioPerformanceReportPdf({ occupancyRows, settings, periodFrom: filters.from, periodTo: filters.to }),
          },
        };
      }
      default:
        return { capabilities: {}, documentUnavailableHint: null };
    }
  }, [canExportReports, companySettings, documentKind, filters, model]);
}

/* ------------------------------------------------------------------ */
/* The premium report product page (real route: /reports/$reportId)    */
/* ------------------------------------------------------------------ */

export function ReportProductPage() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { reportId?: string };
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const { authorization } = useAuth();
  const canExportReports = canAccess(authorization, financialOperationPermissions.exportReports);
  const canViewReports = canAccess(authorization, financialOperationPermissions.viewReports);

  const product = getReportProduct(params.reportId);
  const target = product ? getReportProductTarget(product, search.view ?? search.target) : undefined;

  const [filters, setFilters] = useState<ReportsFilterState>(() => getInitialReportsFilters(search ?? {}));

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

  const openTarget = useCallback((next: ReportProductTarget) => {
    void navigate({
      to: '/reports/$reportId',
      params: { reportId: String(params.reportId ?? '') },
      search: (previous: Record<string, unknown>) => {
        const merged: Record<string, unknown> = { ...previous };
        for (const key of ['from', 'to', 'asOf', 'propertyId', 'unitId', 'tenantId', 'ownerId', 'contractId'] as const) {
          const value = filters[key];
          if (value) merged[key] = value;
        }
        // Keep the product route free of legacy workspace routing keys; the
        // premium page owns its own (product, target) pair.
        delete merged[WORKSPACE_SEARCH_KEY];
        delete merged[REPORTS_SECTION_SEARCH_KEY];
        delete merged.report;
        delete merged.target;
        merged.view = next.id;
        return merged;
      },
    });
  }, [filters, navigate, params.reportId]);

  if (!product || !target) {
    return (
      <PageLayout dir="rtl" lang="ar">
        <div className="mx-auto max-w-md rounded-xl border border-border/70 bg-card/80 p-6 text-center" role="status" data-report-product-not-found>
          <p className="text-sm font-black text-foreground">هذا التقرير غير موجود ضمن كتالوج MALEK.</p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            قد تكون معرفته قد تغيّرت؛ العودة إلى الكتالوج تعرض التقارير المدعومة الحالية.
          </p>
          <Button type="button" variant="secondary" className="mt-4 min-h-11 text-xs font-black" onClick={() => void navigate({ to: '/reports' })}>
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
      onBack={() => void navigate({
        to: '/reports',
        search: (previous: Record<string, unknown>) => {
          const next = { ...previous };
          delete next[WORKSPACE_SEARCH_KEY];
          delete next[REPORTS_SECTION_SEARCH_KEY];
          delete next.view;
          delete next.report;
          return next;
        },
      })}
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
  const model = useReportsWorkspace(filters, { section: target.section, view: target.view });
  const { capabilities, documentUnavailableHint } = useReportProductDocumentActions({
    target,
    model,
    filters,
    canExportReports,
  });

  const shareInput = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const payload = buildReportProductSharePayload(origin, {
      reportId: product.id,
      view: product.targets.length > 1 ? target.id : undefined,
      filters: {
        from: filters.from,
        to: filters.to,
        asOf: filters.asOf,
        propertyId: filters.propertyId,
        unitId: filters.unitId,
        tenantId: filters.tenantId,
        ownerId: filters.ownerId,
        contractId: filters.contractId,
      },
    }, {
      reportLabel: product.targets.length > 1 ? `${product.title} — ${target.label}` : product.title,
      summaryText: [
        `الفترة: ${filters.from || '—'} → ${filters.to || '—'}`,
        model.firstError ? 'قد تُعرض نتائج جزئية؛ بعض المصادر لم تكتمل.' : '',
      ].filter(Boolean).join('\n'),
    });
    return {
      title: product.title,
      text: payload.shareText,
      url: payload.url,
      buildFile: capabilities.buildPdfFile,
    };
  }, [capabilities.buildPdfFile, filters, model.firstError, product, target]);

  // Legacy drill-through stays honest: the deep link reopens the preserved
  // compat workspace with the same scope, so no capability is lost.
  const handleDrill: ReportDrillHandler = useCallback((targetWorkspace, targetView, filterPatch) => {
    void navigate({
      to: '/reports',
      search: (previous: Record<string, unknown>) => {
        const next = { ...previous };
        delete next.report;
        delete next.view;
        return buildWorkspaceSearch(next, targetWorkspace, targetView, filterPatch);
      },
    });
  }, [navigate]);

  const handleResetCurrentMonth = useCallback(() => {
    onFiltersChange({ ...filters, ...getCurrentMonthFilters() });
  }, [filters, onFiltersChange]);

  return (
    <PageLayout dir="rtl" lang="ar" size="wide">
      <div data-report-product-page={product.id} className="min-w-0 space-y-3">
        <header className="rounded-xl border border-border/70 bg-card/85 p-3 shadow-sm sm:p-4" data-report-product-header>
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
                <h1 className="text-base font-black leading-6 text-foreground sm:text-lg">{product.title}</h1>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground" dir="ltr">
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
                reportLabel={product.targets.length > 1 ? `${product.title} — ${target.label}` : product.title}
                whatsapp={false}
                disabled={model.isIncomplete}
                {...capabilities}
                share={shareInput}
              />
            </div>
          </div>
          {documentUnavailableHint ? (
            <p className="mt-2 rounded-lg border border-border/55 bg-muted/25 px-2.5 py-1.5 text-[11px] font-semibold leading-4 text-muted-foreground" role="note">
              {documentUnavailableHint}
            </p>
          ) : null}
          {product.targets.length > 1 ? (
            <div className="mt-3 border-t border-border/55 pt-2.5">
              <ProductTargetTabs product={product} activeTargetId={target.id} onOpen={onOpenTarget} />
            </div>
          ) : null}
        </header>

        <div className="min-w-0" data-active-report-workspace data-report-product-workspace>
          <ReportsWorkspace
            model={model}
            filters={filters}
            canExportReports={canExportReports}
            activeWorkspace={target.workspace}
            activeSection={target.section}
            activeView={target.view}
            onOpenView={(nextView) => {
              const match = product.targets.find((candidate) => candidate.view === nextView);
              if (match) onOpenTarget(match);
            }}
            onOpenReport={(nextWorkspace, nextView) => {
              const match = product.targets.find((candidate) => candidate.workspace === nextWorkspace && candidate.view === nextView)
                ?? product.targets.find((candidate) => candidate.workspace === nextWorkspace);
              if (match) onOpenTarget(match);
            }}
            onDrill={handleDrill}
            onFiltersChange={onFiltersChange}
            onResetCurrentMonth={handleResetCurrentMonth}
            hideWorkspaceChrome
            statementFocus={product.statementFocus}
          />
        </div>
      </div>
    </PageLayout>
  );
}
