import { useAuth } from '@/hooks/use-auth';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import {
  canAccess,
  financialOperationPermissions,
} from '@/features/auth/permissions';
import { translateSharedLabel } from '@/lib/i18n';
import { ReportsCatalog } from './components/ReportsCatalog';

export { escapeCsvValue } from '@/lib/csvExport';
export {
  buildReportCsvFilename,
  getTodayLocalDateString,
  toDateInputValue,
} from './reports-page.helpers';

/**
 * Canonical Reports landing. All live report bodies have dedicated product
 * routes; historical query URLs are redirected by the route boundary before
 * this component is mounted.
 */
export function ReportsPage() {
  const { authorization } = useAuth();
  const canViewReports = canAccess(
    authorization,
    financialOperationPermissions.viewReports,
  );

  if (!canViewReports) {
    return <AccessDenied message="عرض التقارير متاح فقط للصلاحيات المخولة." />;
  }

  return (
    <PageLayout dir="rtl" lang="ar" size="wide">
      <PageHeader
        title={translateSharedLabel('financialsSectionReports')}
        description={translateSharedLabel('reportsPageDescription')}
      />
      <div
        data-reports-catalog-landing
        data-report-landing
        dir="rtl"
        lang="ar"
        className="min-w-0"
      >
        <ReportsCatalog />
      </div>
    </PageLayout>
  );
}
