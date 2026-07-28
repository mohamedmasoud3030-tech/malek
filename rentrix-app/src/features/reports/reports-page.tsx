import { useState } from 'react';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { canAccess, financialOperationPermissions } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { APP_BRAND_NAME } from '@/lib/brand';
import { ReportsWorkspace } from './components/ReportsWorkspace';
import { getCurrentMonthFilters } from './reports-page.helpers';
import { useReportsWorkspace } from './use-reports-workspace';

export { escapeCsvValue } from '@/lib/csvExport';
export { buildReportCsvFilename, getTodayLocalDateString, toDateInputValue } from './reports-page.helpers';

export function ReportsPage() {
  const [filters, setFilters] = useState(() => getCurrentMonthFilters());
  const { authorization } = useAuth();
  const workspace = useReportsWorkspace(filters);
  const canExportReports = canAccess(authorization, financialOperationPermissions.exportReports);
  const canViewReports = canAccess(authorization, financialOperationPermissions.exportReports);

  if (!canViewReports) {
    return <AccessDenied message="عرض التقارير المالية متاح فقط للمدير أو المسؤول." />;
  }

  return (
    <PageLayout dir="rtl" size="wide" className="space-y-5 pb-8">
      <PageHeader
        title="مركز التقارير والكشوف"
        description={`قراءة موحّدة للتحصيل والمتأخرات والإشغال والكشوف من نفس مصادر ${APP_BRAND_NAME} المعتمدة.`}
      />

      <ReportsWorkspace
        model={workspace}
        filters={filters}
        canExportReports={canExportReports}
        onFiltersChange={setFilters}
        onResetCurrentMonth={() => setFilters(getCurrentMonthFilters())}
      />
    </PageLayout>
  );
}
