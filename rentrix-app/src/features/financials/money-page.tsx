import { useMemo } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { SectionTabs } from '@/components/ui/section-tabs';
import { useAuth } from '@/hooks/use-auth';
import { CommissionsWorkspace } from '@/features/commissions/commissions-page';
import { FinancialsPage } from './financials-page';
import {
  FINANCE_SECTIONS,
  FINANCE_VIEWS,
  getPermittedSections,
  getPermittedViews,
  type FinanceSectionId,
  type FinanceViewId,
  type FinancialsSearch,
} from './finance-shell-model';

const COMMISSIONS_PANEL_ID = 'money-commissions-panel';

/**
 * Task-centric Money route.
 *
 * Existing Finance workspaces remain authoritative. This route only prevents
 * Commissions from escaping to a separate product when it is selected from
 * the Money journey. All other views continue to use the proven FinancialsPage
 * until they are migrated incrementally.
 */
export function MoneyPage() {
  const { authorization } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as FinancialsSearch;

  const permittedSections = useMemo(() => getPermittedSections(authorization), [authorization]);
  const permittedViews = useMemo(() => getPermittedViews(authorization), [authorization]);

  const rawSection = (search.section ?? '').toLowerCase().trim();
  const rawView = (search.view ?? '').toLowerCase().trim();
  const isCommissionsView = rawSection === 'commissions' || rawView === 'commissions';

  if (!isCommissionsView) return <FinancialsPage />;

  const commissionsView = FINANCE_VIEWS.find((view) => view.id === 'commissions');
  const canViewCommissions = permittedViews.some((view) => view.id === 'commissions');

  if (!commissionsView || !canViewCommissions) {
    return (
      <PageLayout dir="rtl" lang="ar" size="wide" visualVariant="malek-pro">
        <AccessDenied message="ليس لديك صلاحية لعرض العمولات." />
      </PageLayout>
    );
  }

  const expenseViews = permittedViews.filter((view) => view.sectionId === 'expenses');

  const navigateToSection = (sectionId: FinanceSectionId) => {
    const section = FINANCE_SECTIONS.find((candidate) => candidate.id === sectionId);
    const candidates = permittedViews.filter((view) => view.sectionId === sectionId);
    const preferred = candidates.find((view) => view.id === section?.defaultViewId) ?? candidates[0];
    if (!preferred) return;
    void navigate({
      to: '/financials',
      search: (previous: Record<string, unknown>) => ({ ...previous, section: sectionId, view: preferred.id }),
      replace: true,
    });
  };

  const navigateToView = (viewId: FinanceViewId) => {
    const view = permittedViews.find((candidate) => candidate.id === viewId);
    if (!view) return;
    void navigate({
      to: '/financials',
      search: (previous: Record<string, unknown>) => ({ ...previous, section: view.sectionId, view: view.id }),
      replace: true,
    });
  };

  return (
    <PageLayout dir="rtl" lang="ar" size="wide" visualVariant="malek-pro">
      <div data-money-root className="space-y-5">
        <PageHeader
          title="المال"
          description="المستحقات والتحصيل والمصروفات والعمولات وأموال الملاك والبنوك في مساحة عمل واحدة."
        />

        <SectionTabs
          items={permittedSections}
          activeId="expenses"
          onChange={navigateToSection}
          ariaLabel="أقسام المال"
          panelId={COMMISSIONS_PANEL_ID}
        />

        {expenseViews.length > 1 ? (
          <SectionTabs
            items={expenseViews}
            activeId="commissions"
            onChange={navigateToView}
            ariaLabel="المصروفات والعمولات"
            panelId={COMMISSIONS_PANEL_ID}
          />
        ) : null}

        <section id={COMMISSIONS_PANEL_ID} role="tabpanel" aria-label="العمولات" data-money-view="commissions">
          <CommissionsWorkspace embedded />
        </section>
      </div>
    </PageLayout>
  );
}
