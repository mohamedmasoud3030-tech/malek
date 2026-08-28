import { useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { SectionHeader } from '@/components/ui/section-header';
import { canAccess, financialOperationPermissions } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { translateSharedLabel } from '@/lib/i18n';
import { ReportDirectory } from './directory/ReportDirectory';
import { getCurrentMonthFilters } from './reports-page.helpers';
import { getInitialReportsFilters } from './reports-workspace-filters';
import { reportSections, type ReportSectionId } from './reports-page.sections';
import { getReportSubViewLabel } from './report-view-registry';
import {
  REPORTS_SECTION_SEARCH_KEY,
  resolveReportLocation,
  type ReportViewId,
} from './reports-section-model';
import { ReportsWorkspace } from './workspace/ReportsWorkspace';
import { useReportsWorkspace } from './use-reports-workspace';

export { escapeCsvValue } from '@/lib/csvExport';
export { buildReportCsvFilename, getTodayLocalDateString, toDateInputValue } from './reports-page.helpers';

export function ReportsPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const [filters, setFilters] = useState(() => getInitialReportsFilters(search));
  const { authorization } = useAuth();
  const canExportReports = canAccess(authorization, financialOperationPermissions.exportReports);
  const canViewReports = canAccess(authorization, financialOperationPermissions.viewReports);

  const { section: activeSection, view: activeView } = resolveReportLocation(
    search[REPORTS_SECTION_SEARCH_KEY],
    search.view,
  );
  const workspace = useReportsWorkspace(filters, { section: activeSection, view: activeView });

  const reportsTitle = translateSharedLabel('financialsSectionReports');
  const pageDescription = translateSharedLabel('reportsPageDescription');
  const activeSectionMeta = reportSections.find((section) => section.id === activeSection) ?? reportSections[0];
  const activeViewLabel = getReportSubViewLabel(activeSection, activeView);
  const activeReportLabel = activeViewLabel ?? activeSectionMeta.label;

  const handleSectionViewChange = useCallback(
    (nextSection: ReportSectionId, nextView: ReportViewId) => {
      void navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => {
          const next: Record<string, unknown> = {
            ...previous,
            [REPORTS_SECTION_SEARCH_KEY]: nextSection,
          };
          if (nextView) next.view = nextView;
          else delete next.view;
          return next;
        },
        replace: true,
      });
    },
    [navigate],
  );

  if (!canViewReports) {
    return <AccessDenied message="عرض التقارير متاح فقط للصلاحيات المخولة." />;
  }

  return (
    <PageLayout dir="rtl" lang="ar" size="wide" visualVariant="malek-pro" className="pb-8">
      <PageHeader title={reportsTitle} description={pageDescription} />

      <div data-finance-root className="min-w-0 space-y-3 sm:space-y-4">
        <ReportDirectory
          activeSection={activeSection}
          activeView={activeView}
          scope={{ ownerId: filters.ownerId, tenantId: filters.tenantId, contractId: filters.contractId }}
          onOpen={handleSectionViewChange}
        />

        <section className="space-y-2" aria-label={activeReportLabel} data-active-report-workspace>
          <SectionHeader
            eyebrow="التقرير المفتوح"
            title={activeReportLabel}
            description="الخلاصة أولًا، ثم الجدول والفلاتر والتصدير"
          />

          <ReportsWorkspace
            model={workspace}
            filters={filters}
            canExportReports={canExportReports}
            activeSection={activeSection}
            activeView={activeView}
            onSectionViewChange={handleSectionViewChange}
            onFiltersChange={setFilters}
            onResetCurrentMonth={() => setFilters((current) => ({
              ...current,
              ...getCurrentMonthFilters(),
            }))}
          />
        </section>
      </div>
    </PageLayout>
  );
}
