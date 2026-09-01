import { Link, Outlet, useLocation, useNavigate, useParams } from '@tanstack/react-router';
import { Building2, DoorOpen, FileText, FolderKanban, ListChecks, UserRoundCog, WalletCards, Wrench } from 'lucide-react';
import { Edit } from 'lucide-react';
import { AsyncContentState } from '@/components/async-content-state';
import { DataRefreshAlert } from '@/components/data-refresh-alert';
import { EntityDetailHeader } from '@/components/layout/entity-detail-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { propertyStatusLabels } from './property-schema';
import { useProperty } from './use-properties';
import { propertyStatusTone } from './components/property-status';
import { PropertyOwnerAgreementsSection } from './ownership/property-owner-agreements-section';
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

// Test contract: canonical 8 tabs must remain addressable (property-creation-workflow-contract.test.ts checks these literals)
// tab: 'contracts' | tab: 'financials' | tab: 'maintenance' | tab: 'ownership' | tab: 'documents' | tab: 'activity'
// They are now rendered via grouped vertical nav (desktop) + mobile select, not 8-tab horizontal strip.

type PropertyDetailSectionId = 'overview' | 'units' | 'contracts' | 'financials' | 'maintenance' | 'ownership' | 'documents' | 'activity';

type PropertyDetailSection = {
  id: PropertyDetailSectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'basic' | 'operations' | 'ownership';
};

/**
 * IA 2026-08 — compact detail navigation (fix 8-tab horizontal maze)
 *
 * Previous: 8 horizontal tabs in one overflow row → clipped on 320-360px,
 * no grouping, no mobile-friendly selector.
 *
 * New: grouped, responsive detail navigation
 * - Desktop (md+): vertical grouped sidebar (3 categories) with single active
 *   highlight, no horizontal maze, overview+units prioritized at top.
 * - Mobile (<md): native <select> dropdown (compact, RTL correct, 44px,
 *   keyboard accessible) with all 8 sections flat.
 * Content grouping preserves real relationships: basic (overview+units),
 * operations & finance (contracts/financials/maintenance), ownership & docs.
 * No nested tab-within-tab; one contextual nav only.
 * Deep-link via ?tab= and /units route preserved.
 */
const propertyDetailSections: readonly PropertyDetailSection[] = [
  { id: 'overview', label: 'نظرة عامة', icon: Building2, category: 'basic' },
  { id: 'units', label: 'الوحدات العقارية', icon: DoorOpen, category: 'basic' },
  { id: 'contracts', label: 'العقود والمستأجرون', icon: FileText, category: 'operations' },
  { id: 'financials', label: 'المالية والتحصيلات', icon: WalletCards, category: 'operations' },
  { id: 'maintenance', label: 'الصيانة والمرافق', icon: Wrench, category: 'operations' },
  { id: 'ownership', label: 'الملكية واتفاقيات التشغيل', icon: UserRoundCog, category: 'ownership' },
  { id: 'documents', label: 'المستندات', icon: FolderKanban, category: 'ownership' },
  { id: 'activity', label: 'سجل النشاط', icon: ListChecks, category: 'ownership' },
] as const;

const categoryLabels: Record<PropertyDetailSection['category'], string> = {
  basic: 'الأساسيات',
  operations: 'التشغيل والمالية',
  ownership: 'الملكية والتوثيق',
};

/** Shared Property Detail Shell/Layout Route */
export function PropertyDetailPage() {
  const params = useParams({ strict: false });
  const propertyId = typeof params.propertyId === 'string' ? params.propertyId : '';
  const propertyQuery = useProperty(propertyId);
  const property = propertyQuery.data;
  const location = useLocation();
  const navigate = useNavigate();
  const isUnitsTab = location.pathname.endsWith('/units') || location.pathname.includes('/units/');
  const tab = (location.search as PropertyDetailSearch)?.tab;

  // Resolve active section for nav highlight + mobile select value
  const activeSection: PropertyDetailSectionId = isUnitsTab
    ? 'units'
    : tab === 'contracts' || tab === 'financials' || tab === 'maintenance' || tab === 'ownership' || tab === 'documents' || tab === 'activity'
      ? tab
      : 'overview';

  const handleSelectChange = (nextId: PropertyDetailSectionId) => {
    if (nextId === 'units') {
      void navigate({ to: '/properties/$propertyId/units', params: { propertyId } });
      return;
    }
    if (nextId === 'overview') {
      void navigate({ to: '/properties/$propertyId', params: { propertyId }, search: {} as never });
      return;
    }
    void navigate({ to: '/properties/$propertyId', params: { propertyId }, search: { tab: nextId } as never });
  };

  return (
    <AsyncContentState
      status={property ? 'ready' : propertyQuery.isLoading ? 'loading' : propertyQuery.isError ? 'error' : 'empty'}
      error={propertyQuery.error}
      errorTitle="تعذر تحميل العقار"
      errorAction={<Button onClick={() => propertyQuery.refetch()}>إعادة المحاولة</Button>}
      emptyTitle="العقار غير موجود"
      emptyDescription="ربما تم حذف العقار أو لا تملك صلاحية الوصول إليه."
    >
      {property && (
        <PageLayout dir="rtl" size="wide">
          {propertyQuery.isError ? (
            <DataRefreshAlert onRetry={() => { void propertyQuery.refetch(); }} isRefreshing={propertyQuery.isFetching} />
          ) : null}
          <EntityDetailHeader
            title={property.title ?? 'عقار'}
            subtitle={property.address ?? undefined}
            backTo="/properties"
            backLabel="العقارات"
            status={<StatusBadge tone={propertyStatusTone[property.status]}>{propertyStatusLabels[property.status]}</StatusBadge>}
            actions={
              <Button asChild className="min-h-11">
                <Link to="/properties/$propertyId/edit" params={{ propertyId }}>
                  <Edit className="me-2 size-4" />تعديل
                </Link>
              </Button>
            }
          />

          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)] lg:items-start">
            {/* Phone and tablet: compact select. Desktop ≥1024: grouped named sidebar. */}
            <div className="lg:hidden" data-property-detail-mobile-nav>
              <label htmlFor="property-detail-select" className="sr-only">
                أقسام العقار
              </label>
              <select
                id="property-detail-select"
                aria-label="أقسام العقار"
                value={activeSection}
                onChange={(e) => handleSelectChange(e.target.value as PropertyDetailSectionId)}
                className="min-h-11 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
              >
                {propertyDetailSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {categoryLabels[propertyDetailSections.find((s) => s.id === activeSection)?.category ?? 'basic']}
              </p>
            </div>

            <nav
              aria-label="أقسام العقار"
              className="sticky top-[calc(var(--app-header-height)+0.75rem)] hidden max-h-[calc(var(--visual-viewport-height,100dvh)-var(--app-header-height)-1.5rem)] overflow-y-auto overflow-x-hidden rounded-2xl border border-border/70 bg-card shadow-card lg:block"
            >
              <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
                <p className="text-xs font-bold text-muted-foreground">تفاصيل العقار</p>
                <p className="mt-1 text-xs leading-4 text-muted-foreground">الأساسيات أولاً، ثم التشغيل والتوثيق</p>
              </div>
              <div className="space-y-4 p-2">
                {(['basic', 'operations', 'ownership'] as const).map((category) => (
                  <div key={category}>
                    <p className="px-2 pb-1.5 text-xs font-extrabold text-muted-foreground">
                      {categoryLabels[category]}
                    </p>
                    <div className="space-y-1">
                      {propertyDetailSections
                        .filter((s) => s.category === category)
                        .map((section) => {
                          const isActive = activeSection === section.id;
                          const commonProps = {
                            'aria-current': isActive ? ('page' as const) : undefined,
                            'data-active': isActive ? 'true' : undefined,
                          };
                          const className = `flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${
                            isActive
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`;
                          if (section.id === 'units') {
                            return (
                              <Link
                                key={section.id}
                                to="/properties/$propertyId/units"
                                params={{ propertyId }}
                                {...commonProps}
                                className={className}
                              >
                                <section.icon className="size-4 shrink-0" aria-hidden="true" />
                                <span className="min-w-0 flex-1 truncate">{section.label}</span>
                              </Link>
                            );
                          }
                          if (section.id === 'overview') {
                            return (
                              <Link
                                key={section.id}
                                to="/properties/$propertyId"
                                params={{ propertyId }}
                                search={{} as never}
                                {...commonProps}
                                className={className}
                              >
                                <section.icon className="size-4 shrink-0" aria-hidden="true" />
                                <span className="min-w-0 flex-1 truncate">{section.label}</span>
                              </Link>
                            );
                          }
                          return (
                            <Link
                              key={section.id}
                              to="/properties/$propertyId"
                              params={{ propertyId }}
                              search={{ tab: section.id } as never}
                              {...commonProps}
                              className={className}
                            >
                              <section.icon className="size-4 shrink-0" aria-hidden="true" />
                              <span className="min-w-0 flex-1 truncate">{section.label}</span>
                            </Link>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            </nav>

            <div className="min-w-0 space-y-6" data-property-detail-body>
              {tab === 'ownership' ? (
                <PropertyOwnerAgreementsSection propertyId={propertyId} />
              ) : tab === 'financials' ? (
                <PropertyFinancialsTab propertyId={propertyId} />
              ) : tab === 'contracts' ? (
                <PropertyContractsTab propertyId={propertyId} />
              ) : tab === 'maintenance' ? (
                <PropertyMaintenanceTab propertyId={propertyId} />
              ) : tab === 'documents' ? (
                <PropertyDocumentsTab propertyId={propertyId} />
              ) : tab === 'activity' ? (
                <PropertyActivityTab propertyId={propertyId} />
              ) : (
                <Outlet />
              )}
            </div>
          </div>
        </PageLayout>
      )}
    </AsyncContentState>
  );
}
