import { useNavigate, useSearch } from '@tanstack/react-router';
import { lazy, Suspense, useCallback, useId, useMemo } from 'react';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { SectionTabs } from '@/components/ui/section-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import {
  FINANCE_SECTIONS,
  FINANCE_VIEWS,
  getDefaultFinanceView,
  getPermittedSections,
  getPermittedViews,
  getRoutineFinanceViews,
  resolveFinanceLocation,
  type FinanceSectionId,
  type FinancialsSearch,
} from './shell/financeShellModel';

function SectionFallback() {
  return (
    <div className="space-y-3" role="status" aria-label="جارٍ تحميل القسم">
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
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

  const permittedViews = useMemo(() => getPermittedViews(authorization), [authorization]);
  const permittedSections = useMemo(() => getPermittedSections(authorization), [authorization]);

  const rawSection = search.section || '';
  const rawView = search.view || '';
  const { resolvedSectionId, resolvedViewId } = useMemo(
    () => resolveFinanceLocation(rawSection, rawView, authorization),
    [rawSection, rawView, authorization],
  );

  const explicitlyRequestedView = useMemo(
    () => rawView ? FINANCE_VIEWS.find((view) => view.id === rawView) : undefined,
    [rawView],
  );
  const isRequestedViewForbidden = Boolean(
    explicitlyRequestedView && !permittedViews.some((view) => view.id === explicitlyRequestedView.id),
  );

  const activeSection = permittedSections.some((section) => section.id === resolvedSectionId)
    ? resolvedSectionId
    : permittedSections[0]?.id ?? null;
  const activeView = permittedViews.some((view) => view.id === resolvedViewId)
    ? resolvedViewId
    : getDefaultFinanceView(authorization, activeSection)?.id ?? null;

  const handleSectionChange = useCallback((sectionId: FinanceSectionId) => {
    const defaultView = getDefaultFinanceView(authorization, sectionId)?.id;
    if (!defaultView) return;
    void navigate({
      to: '.',
      search: (previous: Record<string, unknown>) => ({
        ...previous,
        section: sectionId,
        view: defaultView,
      }),
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

  const routineViews = useMemo(
    () => getRoutineFinanceViews(authorization, activeSection),
    [activeSection, authorization],
  );
  const activeSectionDefinition = FINANCE_SECTIONS.find((section) => section.id === activeSection) ?? null;
  const activeViewDefinition = FINANCE_VIEWS.find((view) => view.id === activeView) ?? null;
  const routineActiveView = routineViews.some((view) => view.id === activeView) ? activeView ?? '' : '';
  const specialistViewLabelId = useId();

  if (isRequestedViewForbidden) {
    return (
      <PageLayout dir="rtl" lang="ar" size="wide">
        <PageHeader title="المال" />
        <AccessDenied message="ليس لديك صلاحية لعرض هذا القسم المالي." />
      </PageLayout>
    );
  }

  if (permittedSections.length === 0 || !activeSection || !activeView) {
    return (
      <PageLayout dir="rtl" lang="ar" size="wide">
        <PageHeader title="المال" />
        <AccessDenied message="ليس لديك صلاحية لعرض أي من أقسام المالية." />
      </PageLayout>
    );
  }

  return (
    <PageLayout dir="rtl" lang="ar" size="wide">
      <PageHeader
        title="المال"
        description="الفواتير والتحصيل والمصروفات والتسويات والأمانات والبنوك من مكان واحد."
      />

      <div data-finance-root className="min-w-0 space-y-3 sm:space-y-4">
        <nav
          aria-label="أقسام المالية"
          className="min-w-0"
          data-finance-primary-nav
        >
          <SectionTabs
            items={permittedSections}
            activeId={activeSection}
            onChange={handleSectionChange}
            ariaLabel="أقسام المالية"
            panelId="finance-workspace-panel"
            idPrefix="finance-section"
          />
        </nav>

        {routineViews.length > 1 ? (
          <div className="min-w-0" data-finance-subview-strip>
            <SectionTabs
              items={routineViews}
              activeId={routineActiveView}
              onChange={handleViewChange}
              ariaLabel={`تفاصيل ${activeSectionDefinition?.label ?? 'المالية'}`}
              panelId="finance-workspace-panel"
              idPrefix="finance-view"
            />
          </div>
        ) : null}

        {activeViewDefinition?.showInSectionNavigation === false ? (
          <div
            id={specialistViewLabelId}
            className="sr-only"
            data-finance-specialist-view
          >
            {activeViewDefinition.label}
          </div>
        ) : null}

        <section id="finance-workspace-panel" className="min-w-0" aria-label="مساحة العمل المالية الحالية">
          {activeSection === 'collections' && activeView === 'invoices' ? (
            <div id="finance-view-panel-invoices" role="tabpanel" aria-labelledby="finance-view-tab-invoices">
              <Suspense fallback={<SectionFallback />}><InvoicesWorkspace embedded /></Suspense>
            </div>
          ) : null}
          {activeSection === 'collections' && activeView === 'receipts' ? (
            <div id="finance-view-panel-receipts" role="tabpanel" aria-labelledby="finance-view-tab-receipts">
              <Suspense fallback={<SectionFallback />}><ReceiptsWorkspace embedded /></Suspense>
            </div>
          ) : null}
          {activeSection === 'collections' && activeView === 'arrears' ? (
            /*
             * Arrears is a specialist view (showInSectionNavigation: false), so
             * no tab ever controls it. It is a standalone region named by the
             * specialist-view heading rather than an orphan tabpanel whose
             * aria-labelledby would point at an element that is never rendered.
             */
            <div id="finance-view-panel-arrears" role="region" aria-labelledby={specialistViewLabelId}>
              <Suspense fallback={<SectionFallback />}><ArrearsWorkspace embedded /></Suspense>
            </div>
          ) : null}

          {activeSection === 'fees' && activeView === 'fixed_monthly_accruals' ? (
            <div id="finance-view-panel-fixed_monthly_accruals" role="tabpanel" aria-labelledby="finance-view-tab-fixed_monthly_accruals">
              <Suspense fallback={<SectionFallback />}><FixedMonthlyAccrualWorkspace /></Suspense>
            </div>
          ) : null}
          {activeSection === 'fees' && activeView === 'commissions' ? (
            <div id="finance-view-panel-commissions" role="tabpanel" aria-labelledby="finance-view-tab-commissions">
              <Suspense fallback={<SectionFallback />}><CommissionsWorkspace embedded /></Suspense>
            </div>
          ) : null}

          {activeSection === 'expenses' && activeView === 'expenses' ? (
            <div id="finance-view-panel-expenses" role="tabpanel" aria-labelledby="finance-view-tab-expenses">
              <Suspense fallback={<SectionFallback />}><ExpensesWorkspace embedded /></Suspense>
            </div>
          ) : null}

          {activeSection === 'funds' && activeView === 'deposits' ? (
            <div id="finance-view-panel-deposits" role="tabpanel" aria-labelledby="finance-view-tab-deposits">
              <Suspense fallback={<SectionFallback />}><DepositsWorkspace /></Suspense>
            </div>
          ) : null}
          {activeSection === 'funds' && activeView === 'owner_settlements' ? (
            <div id="finance-view-panel-owner_settlements" role="tabpanel" aria-labelledby="finance-view-tab-owner_settlements">
              <Suspense fallback={<SectionFallback />}><OwnerSettlementsWorkspace embedded /></Suspense>
            </div>
          ) : null}

          {activeSection === 'banking' && activeView === 'bank_reconciliation' ? (
            <div id="finance-view-panel-bank_reconciliation" role="tabpanel" aria-labelledby="finance-view-tab-bank_reconciliation">
              <Suspense fallback={<SectionFallback />}><BankReconciliationWorkspace embedded /></Suspense>
            </div>
          ) : null}
        </section>
      </div>
    </PageLayout>
  );
}

export default FinancePage;
