import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Building2 } from 'lucide-react';
import { lazy, Suspense, useCallback, useMemo } from 'react';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageLayout } from '@/components/layout/page-layout';
import { SectionTabs } from '@/components/ui/section-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { WorkspaceNav } from '@/components/ui/workspace-nav';
import { FinanceReadinessSection } from '@/features/financials/tax-authority/finance-readiness-section';
import { FinancialReportsPreviewSection } from '@/features/financials/components/financial-reports-preview-section';
import { getTodayLocalDateString } from '@/features/financials/financials-date-utils';
import { useCollectionSummaryReport } from '@/features/financials/reports/useFinancialReports';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { FinanceWorkspaceHero } from './components/finance-workspace-hero';
import {
  FINANCE_SECTIONS,
  FINANCE_VIEWS,
  getPermittedSections,
  getPermittedViews,
  isViewPermitted,
  resolveFinanceLocation,
  type FinanceSectionId,
  type FinancialsSearch,
} from './shell/financeShellModel';

const FINANCE_SECTION_HELP: Record<FinanceSectionId, string> = {
  overview: 'صورة سريعة عن الجاهزية والتحصيل الحالي.',
  collections: 'الفواتير والإيصالات والمتأخرات في دورة تحصيل واحدة.',
  expenses: 'المصروفات والعمولات ومتابعة ما تم اعتماده أو دفعه.',
  fees: 'استحقاقات أتعاب الإدارة الدورية ومتابعة تسجيلها.',
  funds: 'تأمينات المستأجرين ومستحقات وتسويات الملاك.',
  banking: 'مطابقة كشف البنك وربط الحركة المصرفية بالسجلات.',
};

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
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
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
const CommissionsWorkspace = lazy(async () => ({
  default: (await import('@/features/commissions/commissions-page')).CommissionsWorkspace,
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

export function FinancePage() {
  const { authorization } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as FinancialsSearch;

  const reportFilters = useMemo(() => getCurrentMonthReportRange(), []);
  const collectionReport = useCollectionSummaryReport(reportFilters);
  const permittedViews = useMemo(() => getPermittedViews(authorization), [authorization]);
  const permittedSections = useMemo(() => getPermittedSections(authorization), [authorization]);

  const rawSection = search.section || '';
  const rawView = search.view || '';
  const { resolvedSectionId, resolvedViewId } = useMemo(
    () => resolveFinanceLocation(rawSection, rawView, authorization),
    [rawSection, rawView, authorization],
  );

  const { activeSection, activeView, isRequestedViewForbidden } = useMemo(() => {
    if (permittedSections.length === 0) {
      return { activeSection: null, activeView: null, isRequestedViewForbidden: false };
    }

    const matchedView = permittedViews.find((view) => view.id === resolvedViewId);
    const isExplicitlyRequested = Boolean(rawSection || rawView);
    const viewExists = FINANCE_VIEWS.some((view) => view.id === resolvedViewId);
    const hasPermissionForView = Boolean(matchedView);

    if (isExplicitlyRequested && viewExists && !hasPermissionForView) {
      return { activeSection: null, activeView: null, isRequestedViewForbidden: true };
    }

    if (matchedView) {
      return { activeSection: resolvedSectionId, activeView: resolvedViewId, isRequestedViewForbidden: false };
    }

    const fallbackSection = permittedSections.find((section) => section.id === 'overview') || permittedSections[0];
    const sectionViews = permittedViews.filter((view) => view.sectionId === fallbackSection.id);
    const fallbackView = sectionViews[0];

    return {
      activeSection: fallbackSection.id,
      activeView: fallbackView ? fallbackView.id : null,
      isRequestedViewForbidden: false,
    };
  }, [resolvedSectionId, resolvedViewId, rawSection, rawView, permittedViews, permittedSections]);

  const handleSectionChange = useCallback((sectionId: FinanceSectionId) => {
    const sectionViews = FINANCE_VIEWS.filter((view) => view.sectionId === sectionId);
    const permittedSectionViews = sectionViews.filter((view) => isViewPermitted(authorization, view));
    const defaultView = permittedSectionViews[0] ? permittedSectionViews[0].id : '';

    void navigate({
      to: '.',
      search: (previous: Record<string, unknown>) => {
        const next: Record<string, unknown> = { ...previous, section: sectionId };
        if (defaultView) next.view = defaultView;
        else delete next.view;
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

  const subViews = useMemo(
    () => permittedViews.filter((view) => view.sectionId === activeSection),
    [activeSection, permittedViews],
  );
  const activeSectionDefinition = FINANCE_SECTIONS.find((section) => section.id === activeSection) ?? null;
  const activeViewDefinition = FINANCE_VIEWS.find((view) => view.id === activeView) ?? null;

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
    <PageLayout dir="rtl" lang="ar" size="wide" visualVariant="malek-pro" className="pb-8">
      <div data-finance-root className="min-w-0 space-y-4 sm:space-y-5">
        <FinanceWorkspaceHero
          activeSection={activeSectionDefinition}
          activeView={activeViewDefinition}
          summary={collectionReport.data}
          isLoading={collectionReport.isLoading}
          onOpenCollections={() => handleSectionChange('collections')}
        />

        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)] lg:items-start">
          <aside className="min-w-0 space-y-3 lg:sticky lg:top-4">
            <nav
              aria-label="أقسام المالية"
              className="hidden overflow-hidden rounded-3xl border border-border/70 bg-card p-2 shadow-card lg:block"
            >
              <div className="px-3 pb-2 pt-1">
                <p className="text-xs font-black text-muted-foreground">مساحات العمل</p>
                <p className="mt-0.5 text-sm font-black">انتقل حسب دورة المال</p>
              </div>
              <div className="space-y-1.5">
                {permittedSections.map((section) => {
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => handleSectionChange(section.id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'group flex min-h-16 w-full items-start gap-3 rounded-2xl px-3 py-3 text-right transition-[background-color,color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-foreground hover:-translate-y-px hover:bg-muted/60',
                      )}
                    >
                      <span className={cn(
                        'mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl',
                        isActive ? 'bg-primary-foreground/15' : 'bg-muted text-muted-foreground group-hover:text-foreground',
                      )}>
                        <section.icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black">{section.label}</span>
                        <span className={cn(
                          'mt-0.5 line-clamp-2 block text-[11px] font-bold leading-5',
                          isActive ? 'text-primary-foreground/75' : 'text-muted-foreground',
                        )}>
                          {FINANCE_SECTION_HELP[section.id]}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </nav>

            <div className="rounded-2xl border border-border/70 bg-card p-2 shadow-card lg:hidden" data-finance-mobile-nav>
              <WorkspaceNav
                items={permittedSections}
                activeId={activeSection}
                onChange={handleSectionChange}
                ariaLabel="أقسام المالية"
              />
            </div>
          </aside>

          <main className="min-w-0">
            <section className="min-w-0 rounded-3xl border border-border/70 bg-card shadow-card" aria-label="مساحة العمل المالية الحالية">
              <header className="border-b border-border/60 px-3 py-3 sm:px-4 sm:py-4">
                <div className="flex min-w-0 items-start gap-3">
                  {activeSectionDefinition ? (
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                      <activeSectionDefinition.icon className="size-5" aria-hidden="true" />
                    </span>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black text-primary">المساحة الحالية</p>
                    <h2 className="mt-0.5 text-base font-black sm:text-lg">
                      {activeViewDefinition?.label ?? activeSectionDefinition?.label ?? 'المالية'}
                    </h2>
                    {activeSectionDefinition ? (
                      <p className="mt-0.5 text-xs font-semibold leading-5 text-muted-foreground">
                        {FINANCE_SECTION_HELP[activeSectionDefinition.id]}
                      </p>
                    ) : null}
                  </div>
                </div>

                {subViews.length > 1 ? (
                  <div className="mt-3 border-t border-border/50 pt-3">
                    <SectionTabs
                      items={subViews}
                      activeId={activeView || ''}
                      onChange={handleViewChange}
                      ariaLabel="أقسام فرعية للمالية"
                    />
                  </div>
                ) : null}
              </header>

              <div className="relative min-w-0 p-3 sm:p-4">
                {activeSection === 'overview' ? (
                  <div id="section-panel-overview" role="tabpanel" aria-labelledby="section-tab-overview">
                    <div className="space-y-5">
                      <section data-finance-section aria-label="جاهزية المالية" className="space-y-3">
                        <FinanceReadinessSection />
                      </section>

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
                        className="flex min-h-16 items-center gap-3 rounded-2xl border border-primary/20 bg-primary/[0.04] px-4 py-3 font-bold outline-none transition-[border-color,background-color,transform] hover:-translate-y-px hover:border-primary/35 hover:bg-primary/[0.07] focus-visible:ring-4 focus-visible:ring-primary/20"
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                          <Building2 className="size-5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-black">المحاسبة والرقابة والتقارير</span>
                          <span className="mt-0.5 block text-xs font-medium leading-5 text-muted-foreground">
                            دفتر الأستاذ والرقابة المحاسبية والكشوف والتحليلات والتقارير الرسمية.
                          </span>
                        </span>
                      </Link>
                    </div>
                  </div>
                ) : null}

                {activeSection === 'collections' && activeView === 'invoices' ? (
                  <div id="section-panel-invoices" role="tabpanel">
                    <Suspense fallback={<SectionFallback />}><InvoicesWorkspace embedded /></Suspense>
                  </div>
                ) : null}
                {activeSection === 'collections' && activeView === 'receipts' ? (
                  <div id="section-panel-receipts" role="tabpanel">
                    <Suspense fallback={<SectionFallback />}><ReceiptsWorkspace embedded /></Suspense>
                  </div>
                ) : null}
                {activeSection === 'collections' && activeView === 'arrears' ? (
                  <div id="section-panel-arrears" role="tabpanel">
                    <Suspense fallback={<SectionFallback />}><ArrearsWorkspace embedded /></Suspense>
                  </div>
                ) : null}

                {activeSection === 'expenses' && activeView === 'expenses' ? (
                  <div id="section-panel-expenses" role="tabpanel">
                    <Suspense fallback={<SectionFallback />}><ExpensesWorkspace embedded /></Suspense>
                  </div>
                ) : null}
                {activeSection === 'expenses' && activeView === 'commissions' ? (
                  <div id="section-panel-commissions" role="tabpanel">
                    <Suspense fallback={<SectionFallback />}><CommissionsWorkspace embedded /></Suspense>
                  </div>
                ) : null}

                {activeSection === 'fees' && activeView === 'fixed_monthly_accruals' ? (
                  <div id="section-panel-fixed_monthly-accruals" role="tabpanel">
                    <Suspense fallback={<SectionFallback />}><FixedMonthlyAccrualWorkspace /></Suspense>
                  </div>
                ) : null}

                {activeSection === 'funds' && activeView === 'deposits' ? (
                  <div id="section-panel-deposits" role="tabpanel">
                    <Suspense fallback={<SectionFallback />}><DepositsWorkspace /></Suspense>
                  </div>
                ) : null}
                {activeSection === 'funds' && activeView === 'owner_settlements' ? (
                  <div id="section-panel-owner_settlements" role="tabpanel">
                    <Suspense fallback={<SectionFallback />}><OwnerSettlementsWorkspace embedded /></Suspense>
                  </div>
                ) : null}

                {activeSection === 'banking' && activeView === 'bank_reconciliation' ? (
                  <div id="section-panel-bank_reconciliation" role="tabpanel">
                    <Suspense fallback={<SectionFallback />}><BankReconciliationWorkspace embedded /></Suspense>
                  </div>
                ) : null}
              </div>
            </section>
          </main>
        </div>
      </div>
    </PageLayout>
  );
}

export default FinancePage;
