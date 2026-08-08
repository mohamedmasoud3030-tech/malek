import { useNavigate, useSearch } from '@tanstack/react-router';
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, type ComponentType } from 'react';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionTabs } from '@/components/ui/section-tabs';
import { useAuth } from '@/hooks/use-auth';
import { resolveRelationshipsHubState } from './relationships-hub-model';
import { relationshipsHubSections, type RelationshipsHubSectionId } from './relationships-hub-sections';

export const RELATIONSHIPS_HUB_SECTION_SEARCH_KEY = 'section';

const ContractsBody = lazy(async () => {
  const { ContractsWorkspace } = await import('@/features/contracts/ContractsListPage');
  return { default: function ContractsEmbedded() { return <ContractsWorkspace embedded />; } };
});
const PeopleBody = lazy(async () => {
  const { PeopleWorkspace } = await import('@/features/people/people-list-page');
  return { default: function PeopleEmbedded() { return <PeopleWorkspace embedded />; } };
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

export function RelationshipsHubWorkspace({
  defaultSection = 'contracts',
  title = 'العقود',
  description = 'العقود والتجديدات مع جهات التعامل والعملاء المحتملين والتواصل المساند.',
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

  useEffect(() => {
    if (requestedSection !== 'tenants') return;
    void navigate({ to: '/tenants', replace: true });
  }, [navigate, requestedSection]);

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

  // Compatibility for links/bookmarks from the previous hub structure.
  if (requestedSection === 'tenants') {
    return shell(<SectionFallback />);
  }

  if (hasNoVisibleSections) {
    return shell(<AccessDenied message="ليس لديك صلاحية لعرض أي من أقسام العقود." />);
  }

  if (isRequestedSectionForbidden || !activeSection) {
    return shell(<AccessDenied message="ليس لديك صلاحية لعرض هذا القسم من العقود." />);
  }

  return shell(
    <>
      <SectionTabs items={visibleSections} activeId={activeSection} onChange={handleSectionChange} ariaLabel="أقسام العقود" />
      {relationshipsHubSections
        .filter((section) => mountedSections.current.has(section.id) && visibleSections.some((visible) => visible.id === section.id))
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
              <Suspense fallback={<SectionFallback />}><SectionBody /></Suspense>
            </div>
          );
        })}
    </>,
  );
}

export function RelationshipsHubPage() {
  return <RelationshipsHubWorkspace defaultSection="contracts" mode="standalone" />;
}

export { RelationshipsHubWorkspace as ContractsWorkspace };
