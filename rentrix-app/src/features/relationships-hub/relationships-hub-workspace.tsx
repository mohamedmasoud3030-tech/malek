import { useNavigate, useSearch } from '@tanstack/react-router';
import { Suspense, lazy, useCallback, useMemo, useRef, type ComponentType } from 'react';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionTabs } from '@/components/ui/section-tabs';
import { useAuth } from '@/hooks/use-auth';
import { resolveRelationshipsHubState } from './relationships-hub-model';
import {
  relationshipsHubSections,
  type RelationshipsHubSectionId,
} from './relationships-hub-sections';

/** `?section=` deep-link contract for the relationships hub. */
export const RELATIONSHIPS_HUB_SECTION_SEARCH_KEY = 'section';

const ContractsBody = lazy(async () => {
  const { ContractsWorkspace } = await import('@/features/contracts/ContractsListPage');
  return { default: function ContractsEmbedded() { return <ContractsWorkspace embedded />; } };
});
const PeopleBody = lazy(async () => {
  const { PeopleWorkspace } = await import('@/features/people/people-list-page');
  return { default: function PeopleEmbedded() { return <PeopleWorkspace embedded />; } };
});
const TenantsBody = lazy(async () => {
  const { TenantsWorkspace } = await import('@/features/tenants/TenantsPage');
  return { default: function TenantsEmbedded() { return <TenantsWorkspace embedded />; } };
});
const LeadsBody = lazy(async () => {
  const { LeadsWorkspace } = await import('@/features/leads/leads-page');
  return { default: function LeadsEmbedded() { return <LeadsWorkspace embedded />; } };
});
const CommunicationBody = lazy(async () => {
  const { CommunicationWorkspace } = await import('@/features/communication/communication-page');
  return { default: function CommunicationEmbedded() { return <CommunicationWorkspace embedded />; } };
});

const sectionComponents: Record<RelationshipsHubSectionId, ComponentType> = {
  contracts: ContractsBody,
  people: PeopleBody,
  tenants: TenantsBody,
  leads: LeadsBody,
  communication: CommunicationBody,
};

function SectionFallback() {
  return (
    <div className="space-y-3" role="status" aria-label="جارٍ تحميل القسم">
      <Skeleton className="h-24" />
      <Skeleton className="h-64" />
    </div>
  );
}

export type RelationshipsHubWorkspaceProps = Readonly<{
  defaultSection?: RelationshipsHubSectionId;
  title?: string;
  description?: string;
  mode?: 'standalone' | 'embedded';
}>;

/**
 * Unified relationships hub at /contracts.
 * Tabs: Contracts, People, Tenants, Leads, Communication — permission-filtered, URL-synced.
 */
export function RelationshipsHubWorkspace({
  defaultSection = 'contracts',
  title = 'العلاقات والعقود',
  description = 'العقود والأشخاص والمستأجرون والعملاء المحتملون والتواصل في مساحة عمل واحدة.',
  mode = 'standalone',
}: RelationshipsHubWorkspaceProps) {
  const { authorization } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const requestedSection = search[RELATIONSHIPS_HUB_SECTION_SEARCH_KEY];

  const { activeSection, visibleSections, isRequestedSectionForbidden, hasNoVisibleSections } = useMemo(
    () => resolveRelationshipsHubState({ requestedSection, defaultSection, authorization }),
    [requestedSection, defaultSection, authorization],
  );

  const mountedSections = useRef(new Set<RelationshipsHubSectionId>());
  if (activeSection) mountedSections.current.add(activeSection);

  const handleSectionChange = useCallback(
    (nextSection: RelationshipsHubSectionId) => {
      void navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => ({
          ...previous,
          [RELATIONSHIPS_HUB_SECTION_SEARCH_KEY]: nextSection,
        }),
        replace: true,
      });
    },
    [navigate],
  );

  const shell = (children: React.ReactNode) => {
    if (mode === 'embedded') {
      return <div data-visual-wave="malek-pro" className="min-w-0 space-y-4 sm:space-y-5">{children}</div>;
    }

    return (
      <PageLayout dir="rtl" lang="ar" size="wide" visualVariant="malek-pro">
        <PageHeader title={title} description={description} />
        {children}
      </PageLayout>
    );
  };

  if (hasNoVisibleSections) {
    return shell(<AccessDenied message="ليس لديك صلاحية لعرض أي من أقسام العلاقات والعقود." />);
  }

  if (isRequestedSectionForbidden || !activeSection) {
    return shell(<AccessDenied message="ليس لديك صلاحية لعرض هذا القسم من العلاقات." />);
  }

  return shell(
    <>
      <SectionTabs
        items={visibleSections}
        activeId={activeSection}
        onChange={handleSectionChange}
        ariaLabel="أقسام العلاقات والعقود"
      />

      {relationshipsHubSections
        .filter(
          (section) =>
            mountedSections.current.has(section.id) &&
            visibleSections.some((visible) => visible.id === section.id),
        )
        .map((section) => {
          const SectionBody = sectionComponents[section.id];
          const isActive = section.id === activeSection;

          return (
            <div
              key={section.id}
              id={`section-panel-${section.id}`}
              role="tabpanel"
              aria-labelledby={`section-tab-${section.id}`}
              data-relationships-section={section.id}
              hidden={!isActive}
            >
              <Suspense fallback={<SectionFallback />}>
                <SectionBody />
              </Suspense>
            </div>
          );
        })}
    </>,
  );
}

/** Thin page entry used by the /contracts route. */
export function RelationshipsHubPage() {
  return <RelationshipsHubWorkspace defaultSection="contracts" mode="standalone" />;
}

/** Alias matching the stage brief's ContractsWorkspace name. */
export { RelationshipsHubWorkspace as ContractsWorkspace };
