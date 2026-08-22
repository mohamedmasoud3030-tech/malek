import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Building2 } from 'lucide-react';
import { useEffect, useMemo, lazy, Suspense, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';

import { useAuth } from '@/hooks/use-auth';
import {
  FINANCE_SECTIONS,
  FINANCE_VIEWS,
  getPermittedSections,
  getPermittedViews,
  isViewPermitted,
  resolveFinanceLocation,
  type FinanceSectionId,
  type FinancialsSearch,
} from './finance-shell-model';
import { FinancialReportsPreviewSection } from './components/financial-reports-preview-section';
import { getTodayLocalDateString } from './financials-date-utils';
import { useCollectionSummaryReport } from './reports/useFinancialReports';
import { cn } from '@/lib/utils';
import { SectionTabs } from '@/components/ui/section-tabs';
import { WorkspaceNav } from '@/components/ui/workspace-nav';
import { Skeleton } from '@/components/ui/skeleton';
import { AccessDenied } from '@/components/layout/access-denied';
import { translateSharedLabel } from '@/lib/i18n';

function getCurrentMonthReportRange() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    dateFrom: getTodayLocalDateString(firstDay),
    dateTo: getTodayLocalDateString(lastDay),
    status: 'all' as const,
  };
}

function SectionFallback() {
  return (
    <div className="space-y-3" role="status" aria-label="جارٍ تحميل القسم">
      <Skeleton className="h-24" />
      <Skeleton className="h-64" />
    </div>
  );
}

const InvoicesWorkspace = lazy(async () => ({
  default: (await import('@/features/financials/invoices/invoices-page')).InvoicesWorkspace,
}));
const ReceiptsWorkspace = lazy(async () => ({
  default: (await import('@/features/financials/receipts/receipts-page')).ReceiptsWorkspace,
}));
const ExpensesWorkspace = lazy(async () => ({
  default: (await import('@/features/financials/expenses/expenses-page')).ExpensesWorkspace,
}));
const ArrearsWorkspace = lazy(async () => ({
  default: (await import('@/features/financials/arrears/arrears-page')).ArrearsWorkspace,
}));
const DepositsWorkspace = lazy(async () => ({
  default: (await import('@/features/financials/deposits/deposits-page')).DepositsWorkspace,
}));
const OwnerSettlementsWorkspace = lazy(async () => ({
  default: (await import('@/features/owners/owner-settlements-page')).OwnerSettlementsWorkspace,
}));
const FixedMonthlyAccrualWorkspace = lazy(async () => ({
  default: (await import('@/features/financials/fixed-monthly-accruals/fixed-monthly-accrual-workspace')).FixedMonthlyAccrualWorkspace,
}));
const BankReconciliationWorkspace = lazy(async () => ({
  default: (await import('@/features/financials/reconciliation/bank-reconciliation-page')).BankReconciliationWorkspace,
}));
// Commissions is now a standalone top-level module at /commissions (Phase 2).
// Legacy deep-links (?view=commissions, /finance/banking?section=commissions) redirect
// to /commissions via effect below and via route-tree redirects.

// R9 — Finance Shell: the route model (sections/views/permissions/URL
// resolution) lives in finance-shell-model.ts. Re-exported so existing
// imports keep working (zero duplicated finance navigation models).
export {
  FINANCE_SECTIONS,
  FINANCE_VIEWS,
  getPermittedSections,
  getPermittedViews,
  isViewPermitted,
  type FinanceSectionDefinition,
  type FinanceSectionId,
  type FinanceViewDefinition,
  type FinanceViewId,
  type FinancialsSearch,
} from './finance-shell-model';

/**
 * Rebuilt financials-page.tsx
 * Replaces the finance hub overview. It directly contains the operational Finance workspace
 * and uses ONE contextual navigation layer.
 */
export function FinancialsPage() {
  const { authorization } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as FinancialsSearch;

  const reportFilters = useMemo(() => getCurrentMonthReportRange(), []);
  const collectionReport = useCollectionSummaryReport(reportFilters);

  // Dynamic translated labels
  // Visible / permitted views & sections for the current user
  const permittedViews = useMemo(() => getPermittedViews(authorization), [authorization]);
  const permittedSections = useMemo(() => getPermittedSections(authorization), [authorization]);

  // URL Deep link translation / Normalization
  const rawSection = search.section || '';
  const rawView = search.view || '';

  // Phase 2: legacy commissions deep-links redirect to standalone /commissions
  useEffect(() => {
    const sec = rawSection.toLowerCase().trim();
    const vi = rawView.toLowerCase().trim();
    if (sec === 'commissions' || vi === 'commissions') {
      void navigate({ to: '/commissions', replace: true });
    }
  }, [rawSection, rawView, navigate]);

  const { resolvedSectionId, resolvedViewId } = useMemo(
    () => resolveFinanceLocation(rawSection, rawView, authorization),
    [rawSection, rawView, authorization],
  );

  const { activeSection, activeView, isRequestedViewForbidden } = useMemo(() => {
    // If no permitted sections at all
    if (permittedSections.length === 0) {
      return { activeSection: null, activeView: null, isRequestedViewForbidden: false };
    }

    const matchedView = permittedViews.find(v => v.id === resolvedViewId);
    
    // Check if the explicitly requested view is forbidden
    const isExplicitlyRequested = Boolean(rawSection || rawView);
    const viewExists = FINANCE_VIEWS.some(v => v.id === resolvedViewId);
    const hasPermissionForView = Boolean(matchedView);

    if (isExplicitlyRequested && viewExists && !hasPermissionForView) {
      // Show AccessDenied for forbidden requests
      return { activeSection: null, activeView: null, isRequestedViewForbidden: true };
    }

    if (matchedView) {
      return { activeSection: resolvedSectionId, activeView: resolvedViewId, isRequestedViewForbidden: false };
    }

    // Default fallback to first permitted section and its first permitted view
    const fallbackSection = permittedSections.find(s => s.id === 'overview') || permittedSections[0];
    const sectionViews = permittedViews.filter(v => v.sectionId === fallbackSection.id);
    const fallbackView = sectionViews[0];

    return {
      activeSection: fallbackSection.id,
      activeView: fallbackView ? fallbackView.id : null,
      isRequestedViewForbidden: false
    };
  }, [resolvedSectionId, resolvedViewId, rawSection, rawView, permittedViews, permittedSections]);

  // Handle section and sub-view updates
  const handleSectionChange = useCallback((sectionId: FinanceSectionId) => {
    const sectionViews = FINANCE_VIEWS.filter(v => v.sectionId === sectionId);
    const permittedSectionViews = sectionViews.filter(v => isViewPermitted(authorization, v));
    const defaultView = permittedSectionViews[0] ? permittedSectionViews[0].id : '';

    void navigate({
      to: '.',
      search: (previous: Record<string, unknown>) => {
        const next: Record<string, unknown> = { ...previous, section: sectionId };
        if (defaultView) {
          next.view = defaultView;
        } else {
          delete next.view;
        }
        return next;
      },
      replace: true,
    });
  }, [navigate, authorization]);

  const handleViewChange = useCallback((viewId: string) => {
    void navigate({
      to: '.',
      search: (previous: Record<string, unknown>) => ({ ...previous, view: viewId }),
      replace: true,
    });
  }, [navigate]);

  // Get active section sub-views/tabs
  const subViews = useMemo(() => {
    return permittedViews.filter(v => v.sectionId === activeSection);
  }, [activeSection, permittedViews]);

  if (isRequestedViewForbidden) {
    return (
      <PageLayout dir="rtl" lang="ar" size="wide" visualVariant="malek-pro">
        <AccessDenied message="ليس لديك صلاحية لعرض هذا القسم المالي." />
      </PageLayout>
    );
  }

  if (permittedSections.length === 0) {
    return (
      <PageLayout dir="rtl" lang="ar" size="wide" visualVariant="malek-pro">
        <AccessDenied message="ليس لديك صلاحية لعرض أي من أقسام المالية." />
      </PageLayout>
    );
  }

  return (
    <PageLayout dir="rtl" lang="ar" size="wide" visualVariant="malek-pro">
      <div data-finance-root className="space-y-5">
        <PageHeader title="المال" />

        <div className="flex flex-col gap-6 md:flex-row-reverse md:items-start">
          {/* Sidebar / Navigation Column (Right on RTL) */}
          <aside className="w-full md:w-64 shrink-0 space-y-4">
            {/* Desktop Navigation */}
            <nav aria-label="أقسام المالية" className="hidden md:flex flex-col gap-1.5 bg-card rounded-2xl border border-border/70 p-2 shadow-card">
              {permittedSections.map(section => {
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => handleSectionChange(section.id)}
                    className={cn(
                      "flex items-center gap-3 w-full px-4 py-3 text-xs font-black rounded-xl transition-colors text-right focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    )}
                  >
                    <section.icon className="size-4 shrink-0" />
                    <span className="truncate">{section.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="md:hidden rounded-2xl border border-border/70 bg-card p-2 shadow-card" data-finance-mobile-nav>
              <WorkspaceNav
                items={permittedSections}
                activeId={activeSection}
                onChange={handleSectionChange}
                ariaLabel="أقسام المالية"
              />
            </div>
          </aside>

          {/* Content Column (Left on RTL) */}
          <main className="flex-1 min-w-0 space-y-4">
            {/* Sub-tabs / Horizontal Sub Navigation (Only if we have active view/sub-tabs) */}
            {subViews.length > 1 && (
              <div className="border-b border-border/50 pb-2">
                <SectionTabs
                  items={subViews}
                  activeId={activeView || ''}
                  onChange={handleViewChange}
                  ariaLabel="أقسام فرعية للمالية"
                />
              </div>
            )}

            {/* View Panels */}
            <div className="relative min-w-0">
              {/* Overview Operational Dashboard */}
              {activeSection === 'overview' && (
                <div id="section-panel-overview" role="tabpanel" aria-labelledby="section-tab-overview">
                  <div className="space-y-5">
                    <section data-finance-section aria-label="ملخص التحصيل الشهري" className="space-y-3">
                      <FinancialReportsPreviewSection
                        reportFilters={reportFilters}
                        collectionSummary={collectionReport.data}
                        isLoading={collectionReport.isLoading}
                        isError={collectionReport.isError}
                        error={collectionReport.error}
                      />
                    </section>

                    <Link
                      to="/reports"
                      className="flex min-h-14 items-center gap-3 rounded-2xl border border-border/80 bg-card px-4 py-3 font-bold outline-none transition-colors hover:border-primary/30 hover:bg-primary/[0.025] focus-visible:ring-4 focus-visible:ring-primary/20"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
                        <Building2 className="size-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm">المحاسبة والرقابة والتقارير</span>
                        <span className="mt-0.5 block text-xs font-medium text-muted-foreground">دفتر الأستاذ والرقابة المحاسبية والكشوف والتحليلات والتقارير الرسمية.</span>
                      </span>
                    </Link>
                  </div>
                </div>
              )}

              {/* Collections & Receivables */}
              {activeSection === 'collections' && activeView === 'invoices' && (
                <div id="section-panel-invoices" role="tabpanel">
                  <Suspense fallback={<SectionFallback />}>
                    <InvoicesWorkspace embedded={true} />
                  </Suspense>
                </div>
              )}
              {activeSection === 'collections' && activeView === 'receipts' && (
                <div id="section-panel-receipts" role="tabpanel">
                  <Suspense fallback={<SectionFallback />}>
                    <ReceiptsWorkspace embedded={true} />
                  </Suspense>
                </div>
              )}
              {activeSection === 'collections' && activeView === 'arrears' && (
                <div id="section-panel-arrears" role="tabpanel">
                  <Suspense fallback={<SectionFallback />}>
                    <ArrearsWorkspace embedded={true} />
                  </Suspense>
                </div>
              )}

              {/* Expenses & Payables */}
              {activeSection === 'expenses' && activeView === 'expenses' && (
                <div id="section-panel-expenses" role="tabpanel">
                  <Suspense fallback={<SectionFallback />}>
                    <ExpensesWorkspace embedded={true} />
                  </Suspense>
                </div>
              )}

              {/* Management fees and earned/accrued consideration */}
              {activeSection === 'fees' && activeView === 'fixed_monthly_accruals' && (
                <div id="section-panel-fixed_monthly-accruals" role="tabpanel">
                  <Suspense fallback={<SectionFallback />}>
                    <FixedMonthlyAccrualWorkspace />
                  </Suspense>
                </div>
              )}

              {/* Custody Funds & Owners */}
              {activeSection === 'funds' && activeView === 'deposits' && (
                <div id="section-panel-deposits" role="tabpanel">
                  <Suspense fallback={<SectionFallback />}>
                    <DepositsWorkspace />
                  </Suspense>
                </div>
              )}
              {activeSection === 'funds' && activeView === 'owner_settlements' && (
                <div id="section-panel-owner_settlements" role="tabpanel">
                  <Suspense fallback={<SectionFallback />}>
                    <OwnerSettlementsWorkspace embedded={true} />
                  </Suspense>
                </div>
              )}

              {/* Banking & Reconciliation */}
              {activeSection === 'banking' && activeView === 'bank_reconciliation' && (
                <div id="section-panel-bank_reconciliation" role="tabpanel">
                  <Suspense fallback={<SectionFallback />}>
                    <BankReconciliationWorkspace embedded={true} />
                  </Suspense>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </PageLayout>
  );
}

export default FinancialsPage;