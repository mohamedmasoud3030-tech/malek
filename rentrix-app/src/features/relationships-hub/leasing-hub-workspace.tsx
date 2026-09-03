import { Suspense, lazy, useCallback, useMemo, useRef, type ComponentType } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { AccessDenied } from '@/components/layout/access-denied';
import { EmbeddableWorkspace } from '@/components/layout/embeddable-workspace';
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
    <div className="col-span-full row-start-2 space-y-2.5" role="status" aria-label="جارٍ تحميل قسم التأجير">
      <Skeleton className="h-12 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}

export function LeasingHubWorkspace() {
  const { canAccess } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const requested = search[LEASING_HUB_SEARCH_KEY];

  const accessibleSections = useMemo(
    () => leasingHubSections.filter((section) => section.permission === null || canAccess(section.permission)),
    [canAccess],
  );
  const visibleSections = useMemo(
    () => accessibleSections.filter((section) => section.showInPrimaryNavigation),
    [accessibleSections],
  );
  const requestedSection = isLeasingHubSectionId(requested) ? requested : null;
  const requestedDefinition = requestedSection
    ? leasingHubSections.find((section) => section.id === requestedSection)
    : null;
  const isRequestedForbidden = Boolean(
    requestedDefinition?.permission && !canAccess(requestedDefinition.permission),
  );
  const activeSection: LeasingHubSectionId = requestedSection ?? 'contracts';
  const activeSectionDefinition = leasingHubSections.find((section) => section.id === activeSection) ?? leasingHubSections[0];
  const isActiveSectionVisible = visibleSections.some((section) => section.id === activeSection);

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
    <EmbeddableWorkspace
      title={activeSectionDefinition.label}
      description={activeSectionDefinition.description}
      size="wide"
    >
      {isRequestedForbidden ? (
        <AccessDenied message="ليس لديك صلاحية لعرض هذا القسم من التأجير." />
      ) : (
        <div
          data-hub-workspace-grid="leasing"
          className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-x-2 gap-y-2.5 sm:gap-x-3 sm:gap-y-3"
        >
          {isActiveSectionVisible ? (
            <div className="col-start-1 row-start-1 min-w-0">
              <SectionTabs
                items={visibleSections}
                activeId={activeSection}
                onChange={handleSectionChange}
                ariaLabel="أقسام التأجير"
                compactMobile
              />
            </div>
          ) : null}

          {leasingHubSections
            .filter((section) => mountedSections.current.has(section.id) && accessibleSections.some((accessible) => accessible.id === section.id))
            .map((section) => {
              const SectionBody = sectionComponents[section.id];
              const isActive = section.id === activeSection;
              return (
                <div
                  key={section.id}
                  id={`leasing-panel-${section.id}`}
                  role="tabpanel"
                  aria-labelledby={section.showInPrimaryNavigation ? `section-tab-${section.id}` : undefined}
                  data-leasing-section={section.id}
                  className={isActive ? 'contents' : undefined}
                  hidden={!isActive}
                >
                  <Suspense fallback={<SectionFallback />}><SectionBody /></Suspense>
                </div>
              );
            })}
        </div>
      )}
    </EmbeddableWorkspace>
  );
}

export function LeasingHubPage() {
  return <LeasingHubWorkspace />;
}
