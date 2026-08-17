import { Suspense, lazy, useCallback, useMemo, useRef, type ComponentType } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { SectionTabs } from '@/components/ui/section-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { isLeasingHubSectionId, leasingHubSections, type LeasingHubSectionId } from './leasing-hub-sections';

export const LEASING_HUB_SEARCH_KEY = 'workspace';

const ContractsBody = lazy(async () => {
  const { ContractsWorkspace } = await import('@/features/contracts/ContractsListPage');
  return { default: function ContractsEmbedded() { return <ContractsWorkspace embedded />; } };
});
const TenantsBody = lazy(async () => {
  const { TenantsWorkspace } = await import('@/features/tenants/TenantsPage');
  return { default: function TenantsEmbedded() { return <TenantsWorkspace embedded />; } };
});
const PeopleBody = lazy(async () => {
  const { PeopleListPage } = await import('@/features/people/people-list-page');
  return { default: function PeopleEmbedded() { return <PeopleListPage embedded />; } };
});
const LeadsBody = lazy(async () => {
  const { LeadsWorkspace } = await import('@/features/leads/leads-page');
  return { default: function LeadsEmbedded() { return <LeadsWorkspace embedded />; } };
});
const CommunicationBody = lazy(async () => {
  const { CommunicationWorkspace } = await import('@/features/communication/communication-page');
  return { default: function CommunicationEmbedded() { return <CommunicationWorkspace embedded />; } };
});

const sectionComponents: Record<LeasingHubSectionId, ComponentType> = {
  contracts: ContractsBody,
  tenants: TenantsBody,
  people: PeopleBody,
  leads: LeadsBody,
  communication: CommunicationBody,
};

function SectionFallback() {
  return (
    <div className="space-y-3" role="status" aria-label="جارٍ تحميل قسم التأجير">
      <Skeleton className="h-24" />
      <Skeleton className="h-64" />
    </div>
  );
}

export function LeasingHubWorkspace() {
  const { canAccess } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const requested = search[LEASING_HUB_SEARCH_KEY];

  const visibleSections = useMemo(
    () => leasingHubSections.filter((section) => section.permission === null || canAccess(section.permission)),
    [canAccess],
  );
  const requestedSection = isLeasingHubSectionId(requested) ? requested : null;
  const requestedDefinition = requestedSection
    ? leasingHubSections.find((section) => section.id === requestedSection)
    : null;
  const isRequestedForbidden = Boolean(
    requestedDefinition?.permission && !canAccess(requestedDefinition.permission),
  );
  const activeSection: LeasingHubSectionId = requestedSection ?? 'contracts';

  const mountedSections = useRef(new Set<LeasingHubSectionId>());
  if (!isRequestedForbidden) mountedSections.current.add(activeSection);

  const handleSectionChange = useCallback(
    (nextSection: LeasingHubSectionId) => {
      void navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => ({
          ...previous,
          [LEASING_HUB_SEARCH_KEY]: nextSection === 'contracts' ? undefined : nextSection,
        }),
        replace: true,
      });
    },
    [navigate],
  );

  return (
    <PageLayout dir="rtl" lang="ar" size="wide" visualVariant="malek-pro">
      <PageHeader
        title="التأجير"
        description="من الفرصة والمستأجر إلى العقد والمتابعة والتجديد — دورة التأجير في سياق واحد."
      />

      {isRequestedForbidden ? (
        <AccessDenied message="ليس لديك صلاحية لعرض هذا القسم من التأجير." />
      ) : (
        <>
          <SectionTabs
            items={visibleSections}
            activeId={activeSection}
            onChange={handleSectionChange}
            ariaLabel="أقسام التأجير"
          />

          {leasingHubSections
            .filter((section) => mountedSections.current.has(section.id) && visibleSections.some((visible) => visible.id === section.id))
            .map((section) => {
              const SectionBody = sectionComponents[section.id];
              const isActive = section.id === activeSection;
              return (
                <div
                  key={section.id}
                  id={`leasing-panel-${section.id}`}
                  role="tabpanel"
                  aria-labelledby={`leasing-tab-${section.id}`}
                  data-leasing-section={section.id}
                  hidden={!isActive}
                >
                  <Suspense fallback={<SectionFallback />}><SectionBody /></Suspense>
                </div>
              );
            })}
        </>
      )}
    </PageLayout>
  );
}

export function LeasingHubPage() {
  return <LeasingHubWorkspace />;
}
