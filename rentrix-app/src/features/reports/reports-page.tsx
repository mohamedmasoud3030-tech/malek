import { useCallback, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { AccessDenied } from '@/components/layout/access-denied';
import { CrossRouteHint } from '@/components/layout/cross-route-hint';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { canAccess, financialOperationPermissions } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { ReportsWorkspace } from './components/ReportsWorkspace';
import { getCurrentMonthFilters } from './reports-page.helpers';
import type { ReportSectionId } from './reports-page.sections';
import {
  mergeReportSectionIntoSearch,
  REPORTS_SECTION_SEARCH_KEY,
  resolveReportSection,
} from './reports-section-model';
import { useReportsWorkspace } from './use-reports-workspace';

export { escapeCsvValue } from '@/lib/csvExport';
export { buildReportCsvFilename, getTodayLocalDateString, toDateInputValue } from './reports-page.helpers';

export function ReportsPage() {
  const [filters, setFilters] = useState(() => getCurrentMonthFilters());
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const { authorization } = useAuth();
  const workspace = useReportsWorkspace(filters);
  const canExportReports = canAccess(authorization, financialOperationPermissions.exportReports);
  const canViewReports = canAccess(authorization, financialOperationPermissions.exportReports);
  const activeSection = resolveReportSection(search[REPORTS_SECTION_SEARCH_KEY]);

  const handleSectionChange = useCallback(
    (nextSection: ReportSectionId) => {
      void navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => mergeReportSectionIntoSearch(previous, nextSection),
        replace: true,
      });
    },
    [navigate],
  );

  if (!canViewReports) {
    return <AccessDenied message="عرض المحاسبة والتقارير متاح فقط للصلاحيات المالية المخولة." />;
  }

  return (
    <PageLayout dir="rtl" lang="ar" size="wide" visualVariant="malek-pro" className="space-y-5 pb-8">
      <div data-finance-root className="space-y-5">
        <div data-finance-header>
          <PageHeader
            title="المحاسبة والتقارير"
            description="دفتر الأستاذ والقوائم والكشوف والتحليلات في مساحة واحدة بدل توزيعها على صفحات مستقلة."
          />
        </div>

        <div data-finance-cluster>
          <CrossRouteHint
            message="للعمليات اليومية مثل التحصيل والمصروفات والتسويات استخدم صفحة المالية."
            action={{ to: '/financials', label: 'فتح المالية' }}
          />
        </div>

        <section data-finance-section aria-label="مساحة المحاسبة والتقارير">
          <ReportsWorkspace
            model={workspace}
            filters={filters}
            canExportReports={canExportReports}
            activeSection={activeSection}
            onSectionChange={handleSectionChange}
            onFiltersChange={setFilters}
            onResetCurrentMonth={() => setFilters(getCurrentMonthFilters())}
          />
        </section>
      </div>
    </PageLayout>
  );
}
