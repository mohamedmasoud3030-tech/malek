import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { AlertTriangle, BadgeDollarSign, FileCheck, FileSpreadsheet, HandCoins, ReceiptText, WalletCards } from 'lucide-react';
import { lazy, Suspense, useCallback, useMemo } from 'react';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { SectionTabs } from '@/components/ui/section-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { getTodayLocalDateString } from '@/features/financials/financials-date-utils';
import { useArrearsSummaryReport, useCollectionSummaryReport } from '@/features/financials/reports/useFinancialReports';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { FinanceOperationsOverview } from './components/finance-operations-overview';
import { FinanceWorkspaceHero } from './components/finance-workspace-hero';
import {
  FINANCE_SECTIONS,
  FINANCE_VIEWS,
  getPermittedSections,
  getPermittedViews,
  isViewPermitted,
  resolveFinanceLocation,
  type FinanceSectionId,
  type FinanceViewId,
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

function getSectionStatus(
  sectionId: FinanceSectionId,
  outstanding: number,
  overdue: number,
  expenses: number,
  dataUnavailable: boolean,
): string {
  if (sectionId === 'overview') return 'الآن';
  if (dataUnavailable && (sectionId === 'collections' || sectionId === 'expenses')) return 'غير متاح';
  if (sectionId === 'collections') {
    if (overdue > 0) return 'تدخل مطلوب';
    return outstanding > 0 ? 'قيد التحصيل' : 'مستقر';
  }
  if (sectionId === 'expenses') return expenses > 0 ? 'حركة مسجلة' : 'لا حركة';
  if (sectionId === 'fees') return 'استحقاق دوري';
  if (sectionId === 'funds') return 'أموال محفوظة';
  return 'جاهز للمطابقة';
}

type FinanceHeaderAction = Readonly<{
  id: string;
  label: string;
  icon: typeof ReceiptText;
  sectionId?: FinanceSectionId;
  viewId?: FinanceViewId;
  reports?: boolean;
}>;

function getHeaderActions(
  sectionId: FinanceSectionId | null,
  viewId: FinanceViewId | null,
  permittedViewIds: ReadonlySet<FinanceViewId>,
): FinanceHeaderAction[] {
  const canViewArrears = permittedViewIds.has('arrears');
  if (sectionId === 'overview') {
    return [
      { id: 'record-receipt', label: 'تسجيل تحصيل', icon: ReceiptText, sectionId: 'collections', viewId: 'receipts' },
      canViewArrears
        ? { id: 'review-arrears', label: 'المتأخرات', icon: AlertTriangle, sectionId: 'collections', viewId: 'arrears' }
        : permittedViewIds.has('expenses')
          ? { id: 'review-expenses', label: 'المصروفات', icon: WalletCards, sectionId: 'expenses', viewId: 'expenses' }
          : { id: 'open-reports', label: 'التقارير', icon: FileSpreadsheet, reports: true },
    ];
  }
  if (sectionId === 'collections') {
    const actions: FinanceHeaderAction[] = [
      viewId === 'receipts'
        ? { id: 'open-invoices', label: 'الفواتير', icon: FileSpreadsheet, sectionId: 'collections', viewId: 'invoices' }
        : { id: 'record-receipt', label: 'تسجيل تحصيل', icon: ReceiptText, sectionId: 'collections', viewId: 'receipts' },
    ];
    if (canViewArrears && viewId !== 'arrears') {
      actions.push({ id: 'review-arrears', label: 'المتأخرات', icon: AlertTriangle, sectionId: 'collections', viewId: 'arrears' });
    }
    return actions;
  }
  if (sectionId === 'expenses') {
    if (viewId === 'expenses' && permittedViewIds.has('commissions')) {
      return [{ id: 'open-commissions', label: 'العمولات', icon: BadgeDollarSign, sectionId: 'expenses', viewId: 'commissions' }];
    }
    if (viewId !== 'expenses' && permittedViewIds.has('expenses')) {
      return [{ id: 'open-expenses', label: 'المصروفات', icon: WalletCards, sectionId: 'expenses', viewId: 'expenses' }];
    }
    return [{ id: 'open-reports', label: 'التقارير', icon: FileSpreadsheet, reports: true }];
  }
  if (sectionId === 'funds') {
    if (viewId === 'deposits' && permittedViewIds.has('owner_settlements')) {
      return [{ id: 'open-settlements', label: 'تسويات الملاك', icon: HandCoins, sectionId: 'funds', viewId: 'owner_settlements' }];
    }
    if (viewId !== 'deposits' && permittedViewIds.has('deposits')) {
      return [{ id: 'open-deposits', label: 'التأمينات', icon: FileCheck, sectionId: 'funds', viewId: 'deposits' }];
    }
    return [{ id: 'open-reports', label: 'التقارير', icon: FileSpreadsheet, reports: true }];
  }
  return [{ id: 'open-reports', label: 'التقارير', icon: FileSpreadsheet, reports: true }];
}

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
  const permittedViews = useMemo(() => getPermittedViews(authorization), [authorization]);
  const permittedSections = useMemo(() => getPermittedSections(authorization), [authorization]);
  const permittedViewIds = useMemo(() => new Set(permittedViews.map((view) => view.id)), [permittedViews]);
  const canViewArrears = permittedViewIds.has('arrears');
  const arrearsFilters = useMemo(() => ({ asOf: getTodayLocalDateString() }), []);
  const collectionReport = useCollectionSummaryReport(reportFilters);
  const arrearsReport = useArrearsSummaryReport(arrearsFilters, { enabled: canViewArrears });

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

  const handleLocationChange = useCallback((sectionId: FinanceSectionId, viewId: FinanceViewId) => {
    void navigate({
      to: '.',
      search: (previous: Record<string, unknown>) => ({
        ...previous,
        section: sectionId,
        view: viewId,
      }),
      replace: true,
    });
  }, [navigate]);

  const subViews = useMemo(
    () => permittedViews.filter((view) => view.sectionId === activeSection),
    [activeSection, permittedViews],
  );
  const activeSectionDefinition = FINANCE_SECTIONS.find((section) => section.id === activeSection) ?? null;
  const activeViewDefinition = FINANCE_VIEWS.find((view) => view.id === activeView) ?? null;
  const cockpitIsLoading = collectionReport.isLoading || (canViewArrears && arrearsReport.isLoading);
  const cockpitIsError = collectionReport.isError || (canViewArrears && arrearsReport.isError);
  const headerActions = getHeaderActions(activeSection, activeView, permittedViewIds);

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
          summary={collectionReport.data}
          arrears={arrearsReport.data}
          isLoading={cockpitIsLoading}
          isError={cockpitIsError}
          canViewArrears={canViewArrears}
          onOpenCollections={() => handleSectionChange('collections')}
          onOpenArrears={() => handleLocationChange('collections', 'arrears')}
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
                        'group flex min-h-12 w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-right transition-[background-color,color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-foreground hover:-translate-y-px hover:bg-muted/60',
                      )}
                    >
                      <span className={cn(
                        'grid size-8 shrink-0 place-items-center rounded-lg',
                        isActive ? 'bg-primary-foreground/15' : 'bg-muted text-muted-foreground group-hover:text-foreground',
                      )}>
                        <section.icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                        <span className="truncate text-sm font-black">{section.label}</span>
                        <span className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black',
                          isActive ? 'bg-primary-foreground/15 text-primary-foreground/85' : 'bg-muted text-muted-foreground',
                        )}>
                          {getSectionStatus(
                            section.id,
                            collectionReport.data?.outstanding ?? 0,
                            arrearsReport.data?.totalOverdue ?? 0,
                            collectionReport.data?.expensesTotal ?? 0,
                            cockpitIsError,
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </nav>

            <div className="lg:hidden" data-finance-mobile-nav data-finance-mobile-nav-mode="direct-tabs">
              <SectionTabs
                items={permittedSections}
                activeId={activeSection || permittedSections[0]?.id || 'overview'}
                onChange={handleSectionChange}
                ariaLabel="أقسام المالية"
                panelId="finance-workspace-panel"
                idPrefix="finance-section"
              />
            </div>
          </aside>

          <main className="min-w-0">
            <section
              id="finance-workspace-panel"
              className="min-w-0 rounded-3xl border border-border/70 bg-card shadow-card"
              aria-label="مساحة العمل المالية الحالية"
            >
              <header className="border-b border-border/60 px-3 py-3 sm:px-4 sm:py-4">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    {activeSectionDefinition ? (
                      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                        <activeSectionDefinition.icon className="size-5" aria-hidden="true" />
                      </span>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-black text-primary">{activeSectionDefinition?.label ?? 'المالية'}</p>
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

                  <div className="flex shrink-0 flex-wrap gap-2" aria-label="إجراءات القسم الحالي">
                    {headerActions.map((action) => {
                      const Icon = action.icon;
                      if (action.reports) {
                        return (
                          <Button key={action.id} variant="outline" size="sm" asChild className="min-h-10">
                            <Link to="/reports">
                              <Icon className="me-1.5 size-4" aria-hidden="true" />
                              {action.label}
                            </Link>
                          </Button>
                        );
                      }
                      return (
                        <Button
                          key={action.id}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-10"
                          onClick={() => action.sectionId && action.viewId && handleLocationChange(action.sectionId, action.viewId)}
                        >
                          <Icon className="me-1.5 size-4" aria-hidden="true" />
                          {action.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3 min-h-12 border-t border-border/50 pt-3" data-finance-subview-strip>
                  {subViews.length > 0 ? (
                    <SectionTabs
                      items={subViews}
                      activeId={activeView || ''}
                      onChange={handleViewChange}
                      ariaLabel="أقسام فرعية للمالية"
                      idPrefix="finance-view"
                    />
                  ) : null}
                </div>
              </header>

              <div className="relative min-w-0 p-3 sm:p-4">
                {activeSection === 'overview' ? (
                  <div id="finance-view-panel-overview" role="tabpanel" aria-labelledby="finance-view-tab-overview">
                    <FinanceOperationsOverview
                      summary={collectionReport.data}
                      arrears={arrearsReport.data}
                      isLoading={cockpitIsLoading}
                      isError={cockpitIsError}
                      canViewArrears={canViewArrears}
                      canViewExpenses={permittedViewIds.has('expenses')}
                      onOpenCollections={() => handleLocationChange('collections', 'invoices')}
                      onOpenReceipts={() => handleLocationChange('collections', 'receipts')}
                      onOpenArrears={() => handleLocationChange('collections', 'arrears')}
                      onOpenExpenses={() => handleLocationChange('expenses', 'expenses')}
                    />
                  </div>
                ) : null}

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
                  <div id="finance-view-panel-arrears" role="tabpanel" aria-labelledby="finance-view-tab-arrears">
                    <Suspense fallback={<SectionFallback />}><ArrearsWorkspace embedded /></Suspense>
                  </div>
                ) : null}

                {activeSection === 'expenses' && activeView === 'expenses' ? (
                  <div id="finance-view-panel-expenses" role="tabpanel" aria-labelledby="finance-view-tab-expenses">
                    <Suspense fallback={<SectionFallback />}><ExpensesWorkspace embedded /></Suspense>
                  </div>
                ) : null}
                {activeSection === 'expenses' && activeView === 'commissions' ? (
                  <div id="finance-view-panel-commissions" role="tabpanel" aria-labelledby="finance-view-tab-commissions">
                    <Suspense fallback={<SectionFallback />}><CommissionsWorkspace embedded /></Suspense>
                  </div>
                ) : null}

                {activeSection === 'fees' && activeView === 'fixed_monthly_accruals' ? (
                  <div id="finance-view-panel-fixed_monthly_accruals" role="tabpanel" aria-labelledby="finance-view-tab-fixed_monthly_accruals">
                    <Suspense fallback={<SectionFallback />}><FixedMonthlyAccrualWorkspace /></Suspense>
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
              </div>
            </section>
          </main>
        </div>
      </div>
    </PageLayout>
  );
}

export default FinancePage;
