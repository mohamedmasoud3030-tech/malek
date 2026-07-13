import { Link, Outlet, useLocation, useParams } from '@tanstack/react-router';
import { Edit } from 'lucide-react';
import { AsyncContentState } from '@/components/async-content-state';
import { EntityDetailHeader } from '@/components/layout/entity-detail-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { propertyStatusLabels } from './property-schema';
import { useProperty } from './use-properties';
import { propertyStatusTone } from './components/property-status';
export { PropertyOverview } from './overview/property-overview-page';
export { PropertyUnitsPage } from './units/property-units-page';
export { PropertyUnitDetailPage } from './units/property-unit-detail-page';

/** Shared Property Detail Shell/Layout Route */
export function PropertyDetailPage() {
  const params = useParams({ strict: false });
  const propertyId = typeof params.propertyId === 'string' ? params.propertyId : '';
  const propertyQuery = useProperty(propertyId);
  const property = propertyQuery.data;
  const location = useLocation();
  const isUnitsTab = location.pathname.endsWith('/units') || location.pathname.includes('/units/');

  return (
    <AsyncContentState
      status={propertyQuery.isLoading ? 'loading' : propertyQuery.isError ? 'error' : !property ? 'empty' : 'ready'}
      error={propertyQuery.error}
      errorTitle="تعذر تحميل العقار"
      errorAction={<Button onClick={() => propertyQuery.refetch()}>إعادة المحاولة</Button>}
      emptyTitle="العقار غير موجود"
      emptyDescription="ربما تم حذف العقار أو لا تملك صلاحية الوصول إليه."
    >
      {property && (
        <PageLayout dir="rtl" size="wide">
          <EntityDetailHeader
            title={property.title ?? 'عقار'}
            subtitle={property.address ?? undefined}
            backTo="/properties"
            backLabel="العقارات"
            status={<StatusBadge tone={propertyStatusTone[property.status]}>{propertyStatusLabels[property.status]}</StatusBadge>}
            actions={
              <Button asChild>
                <Link to="/properties/$propertyId/edit" params={{ propertyId }}>
                  <Edit className="me-2 size-4" />تعديل
                </Link>
              </Button>
            }
          />

          <div className="border-b border-border">
            <div className="flex gap-6">
              <Link
                to="/properties/$propertyId"
                params={{ propertyId }}
                className={`border-b-2 pb-3 text-sm font-bold transition-all duration-150 ${!isUnitsTab ? 'border-primary text-primary font-black' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                نظرة عامة
              </Link>
              <Link
                to="/properties/$propertyId/units"
                params={{ propertyId }}
                className={`border-b-2 pb-3 text-sm font-bold transition-all duration-150 ${isUnitsTab ? 'border-primary text-primary font-black' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                الوحدات
              </Link>
            </div>
          </div>

          <Outlet />
        </PageLayout>
      )}
    </AsyncContentState>
  );
}
