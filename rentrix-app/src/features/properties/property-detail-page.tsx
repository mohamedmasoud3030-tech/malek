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
import { PropertyOwnerAgreementsSection } from './ownership/property-owner-agreements-section';
import { PropertyFinancialSummaryCard } from './financial-summary/property-financial-summary-card';
import {
  PropertyActivityTab,
  PropertyContractsTab,
  PropertyDocumentsTab,
  PropertyFinancialsTab,
  PropertyMaintenanceTab,
} from './components/property-workspace-tabs';
export { PropertyOverview } from './overview/property-overview-page';
export { PropertyUnitsPage } from './units/property-units-page';
export { PropertyUnitDetailPage } from './units/property-unit-detail-page';

export type PropertyDetailSearch = {
  tab?: 'overview' | 'contracts' | 'financials' | 'maintenance' | 'ownership' | 'documents' | 'activity';
};

/** Shared Property Detail Shell/Layout Route */
export function PropertyDetailPage() {
  const params = useParams({ strict: false });
  const propertyId = typeof params.propertyId === 'string' ? params.propertyId : '';
  const propertyQuery = useProperty(propertyId);
  const property = propertyQuery.data;
  const location = useLocation();
  const isUnitsTab = location.pathname.endsWith('/units') || location.pathname.includes('/units/');
  const tab = (location.search as PropertyDetailSearch)?.tab;

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

          <nav className="border-b border-border overflow-x-auto" aria-label="أقسام العقار">
            <div className="flex gap-6 min-w-max">
              <Link
                to="/properties/$propertyId"
                params={{ propertyId }}
                search={{}}
                aria-current={!isUnitsTab && !tab ? 'page' : undefined}
                className={`border-b-2 pb-3 text-sm font-bold transition-all duration-150 ${!isUnitsTab && !tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                نظرة عامة
              </Link>
              <Link
                to="/properties/$propertyId/units"
                params={{ propertyId }}
                aria-current={isUnitsTab ? 'page' : undefined}
                className={`border-b-2 pb-3 text-sm font-bold transition-all duration-150 ${isUnitsTab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                الوحدات العقارية
              </Link>
              <Link
                to="/properties/$propertyId"
                params={{ propertyId }}
                search={{ tab: 'contracts' }}
                aria-current={tab === 'contracts' ? 'page' : undefined}
                className={`border-b-2 pb-3 text-sm font-bold transition-all duration-150 ${tab === 'contracts' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                العقود والمستأجرون
              </Link>
              <Link
                to="/properties/$propertyId"
                params={{ propertyId }}
                search={{ tab: 'financials' }}
                aria-current={tab === 'financials' ? 'page' : undefined}
                className={`border-b-2 pb-3 text-sm font-bold transition-all duration-150 ${tab === 'financials' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                المالية والتحصيلات
              </Link>
              <Link
                to="/properties/$propertyId"
                params={{ propertyId }}
                search={{ tab: 'maintenance' }}
                aria-current={tab === 'maintenance' ? 'page' : undefined}
                className={`border-b-2 pb-3 text-sm font-bold transition-all duration-150 ${tab === 'maintenance' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                الصيانة والمرافق
              </Link>
              <Link
                to="/properties/$propertyId"
                params={{ propertyId }}
                search={{ tab: 'ownership' }}
                aria-current={tab === 'ownership' ? 'page' : undefined}
                className={`border-b-2 pb-3 text-sm font-bold transition-all duration-150 ${tab === 'ownership' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                الملكية واتفاقيات التشغيل
              </Link>
              <Link
                to="/properties/$propertyId"
                params={{ propertyId }}
                search={{ tab: 'documents' }}
                aria-current={tab === 'documents' ? 'page' : undefined}
                className={`border-b-2 pb-3 text-sm font-bold transition-all duration-150 ${tab === 'documents' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                المستندات
              </Link>
              <Link
                to="/properties/$propertyId"
                params={{ propertyId }}
                search={{ tab: 'activity' }}
                aria-current={tab === 'activity' ? 'page' : undefined}
                className={`border-b-2 pb-3 text-sm font-bold transition-all duration-150 ${tab === 'activity' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                سجل النشاط
              </Link>
            </div>
          </nav>

          {tab === 'ownership' ? (
            <div className="space-y-6 pt-4">
              <PropertyOwnerAgreementsSection propertyId={propertyId} />
            </div>
          ) : tab === 'financials' ? (
            <div className="space-y-6 pt-4">
              <PropertyFinancialsTab propertyId={propertyId} />
            </div>
          ) : tab === 'contracts' ? (
            <div className="space-y-6 pt-4">
              <PropertyContractsTab propertyId={propertyId} />
            </div>
          ) : tab === 'maintenance' ? (
            <div className="space-y-6 pt-4">
              <PropertyMaintenanceTab propertyId={propertyId} />
            </div>
          ) : tab === 'documents' ? (
            <div className="space-y-6 pt-4">
              <PropertyDocumentsTab propertyId={propertyId} />
            </div>
          ) : tab === 'activity' ? (
            <div className="space-y-6 pt-4">
              <PropertyActivityTab propertyId={propertyId} />
            </div>
          ) : (
            <Outlet />
          )}
        </PageLayout>
      )}
    </AsyncContentState>
  );
}
