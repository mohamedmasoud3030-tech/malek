import { useNavigate, useSearch } from '@tanstack/react-router';
import { lazy, Suspense, useCallback, useMemo } from 'react';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { SectionTabs } from '@/components/ui/section-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import {
  FINANCE_SECTIONS,
  FINANCE_VIEWS,
  getPermittedSections,
  getPermittedViews,
  getRoutineFinanceViews,
  resolveFinanceLocation,
  type FinanceSectionId,
  type FinanceViewId,
  type FinancialsSearch,
} from './shell/financeShellModel';

const FINANCE_SECTION_HELP: Record<FinanceSectionId, string> = {
  overview: 'مسار قديم متوافق؛ العمل اليومي يبدأ من الفواتير.',
  collections: 'ابحث عن الفاتورة، اعرف صاحبها وعقارها، ثم حصّلها من نفس السجل.',
  fees: 'دخل المكتب من أتعاب الإدارة والعمولات.',
  expenses: 'إضافة المصروف ومراجعته من سجل واحد.',
  funds: 'تأمينات المستأجرين ومستحقات وتسويات الملاك.',
  banking: 'الحسابات البنكية والمطابقة والفروقات التي تحتاج مراجعة.',
};

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
    : activeSection
      ? getRoutineFinanceViews(authorization, activeSection)[0]?.id ?? null
      : null;

  const handleSectionChange = useCallback((sectionId: FinanceSectionId) => {
    const defaultView = getRoutineFinanceViews(authorization, sectionId)[0]?.id;
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

  if (isRequestedViewForbidden) {
    return (
      <PageLayout dir="rtl" lang="ar" size="wide" visualVariant="malek-pro">
        <PageHeader title="المالية" />
        <AccessDenied message="ليس لديك صلاحية لعرض هذا القسم المالي." />
      </PageLayout>
    );
  }

  if (permittedSections.length === 0 || !activeSection || !activeView) {
    return (
      <PageLayout dir="rtl" lang="ar" size="wide" visualVariant="malek-pro">
        <PageHeader title="المالية" />
        <AccessDenied message="ليس لديك صلاحية لعرض أي من أقسام المالية." />
      </PageLayout>
    );
  }

  return (
    <PageLayout dir="rtl" lang="ar" size="wide" visualVariant="malek-pro">
      <PageHeader
        title="المالية"
        description={activeSectionDefinition ? FINANCE_SECTION_HELP[activeSectionDefinition.id] : 'أنجز العمل المالي من مكان واحد.'}
      />

      <div data-finance-root className="min-w-0 space-y-3 sm:space-y-4">
        <nav
          aria-label="أقسام المالية"
          className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card px-2 py-2 shadow-card"
          data-finance-primary-nav
        >
          <SectionTabs
            items={permittedSections}
            activeId={activeSection}
            onChange={handleSectionChange}
            ariaLabel="أقسام المالية"
            panelId="finance-workspace-panel"
            idPrefix="finance-section"
            compactMobile
          />
        </nav>

        {routineViews.length > 1 ? (
          <div className="min-w-0 border-b border-border/60 pb-2" data-finance-subview-strip>
            <SectionTabs
              items={routineViews}
              activeId={routineActiveView}
              onChange={handleViewChange}
              ariaLabel={`تفاصيل ${activeSectionDefinition?.label ?? 'المالية'}`}
              panelId="finance-workspace-panel"
              idPrefix="finance-view"
              compactMobile
            />
          </div>
        ) : null}

        {activeViewDefinition?.showInSectionNavigation === false ? (
          <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm font-bold" data-finance-specialist-view>
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
            <div id="finance-view-panel-arrears" role="tabpanel">
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
