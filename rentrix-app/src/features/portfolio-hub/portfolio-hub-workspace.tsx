import { useNavigate, useSearch } from '@tanstack/react-router';
import { Suspense, lazy, useCallback, useMemo, useRef, type ComponentType } from 'react';
import { AccessDenied } from '@/components/layout/access-denied';
import { EmbeddableWorkspace } from '@/components/layout/embeddable-workspace';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionTabs } from '@/components/ui/section-tabs';
import { useAuth } from '@/hooks/use-auth';
import { resolvePortfolioHubState } from './portfolio-hub-model';
import { portfolioHubSections, type PortfolioHubSectionId } from './portfolio-hub-sections';

export const PORTFOLIO_HUB_SECTION_SEARCH_KEY = 'section';

const PropertiesBody = lazy(async () => {
  const { PropertiesWorkspace } = await import('@/features/properties/properties-list-page');
  return { default: function PropertiesEmbedded() { return <PropertiesWorkspace embedded />; } };
});
const UnitsBody = lazy(async () => {
  const { UnitsWorkspace } = await import('@/features/units/units-page');
  return { default: function UnitsEmbedded() { return <UnitsWorkspace embedded />; } };
});
const LandsBody = lazy(async () => {
  const { LandsWorkspace } = await import('@/features/lands/lands-page');
  return { default: function LandsEmbedded() { return <LandsWorkspace embedded />; } };
});
const OwnersBody = lazy(async () => {
  const { OwnersWorkspace } = await import('@/features/owners/OwnersPage');
  return { default: function OwnersEmbedded() { return <OwnersWorkspace embedded />; } };
});

const sectionComponents: Record<PortfolioHubSectionId, ComponentType> = {
  properties: PropertiesBody,
  units: UnitsBody,
  lands: LandsBody,
  owners: OwnersBody,
};

function SectionFallback() {
  return (
    <div className="space-y-3" role="status" aria-label="جارٍ تحميل قسم المحفظة">
      <Skeleton className="h-24" />
      <Skeleton className="h-64" />
    </div>
  );
}

export type PortfolioHubWorkspaceProps = Readonly<{
  defaultSection?: PortfolioHubSectionId;
  title?: string;
  description?: string;
  mode?: 'standalone' | 'embedded';
}>;

export function PortfolioHubWorkspace({
  defaultSection = 'properties',
  title,
  description,
  mode = 'standalone',
}: PortfolioHubWorkspaceProps) {
  const { authorization } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const requestedSection = search[PORTFOLIO_HUB_SECTION_SEARCH_KEY];

  const { activeSection, accessibleSections, visibleSections, isRequestedSectionForbidden, hasNoAccessibleSections } = useMemo(
    () => resolvePortfolioHubState({ requestedSection, defaultSection, authorization }),
    [requestedSection, defaultSection, authorization],
  );
  const isActiveSectionVisible = Boolean(activeSection && visibleSections.some((section) => section.id === activeSection));
  const activeSectionDefinition = portfolioHubSections.find((section) => section.id === activeSection) ?? portfolioHubSections[0];

  const mountedSections = useRef(new Set<PortfolioHubSectionId>());
  if (activeSection) mountedSections.current.add(activeSection);

  const handleSectionChange = useCallback(
    (nextSection: PortfolioHubSectionId) => {
      void navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => ({
          ...previous,
          [PORTFOLIO_HUB_SECTION_SEARCH_KEY]: nextSection,
        }),
        replace: true,
      });
    },
    [navigate],
  );

  const content = useMemo(() => {
    if (hasNoAccessibleSections) {
      return <AccessDenied message="ليس لديك صلاحية لعرض أي من أقسام المحفظة." />;
    }

    if (isRequestedSectionForbidden || !activeSection) {
      return <AccessDenied message="ليس لديك صلاحية لعرض هذا القسم من المحفظة." />;
    }

    return (
      <div
        data-hub-workspace-grid="portfolio"
        className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-x-2 gap-y-2.5 sm:gap-x-3 sm:gap-y-3"
      >
        {isActiveSectionVisible ? (
          <div className="col-start-1 row-start-1 min-w-0">
            <SectionTabs items={visibleSections} activeId={activeSection} onChange={handleSectionChange} ariaLabel="أقسام المحفظة" compactMobile />
          </div>
        ) : null}
        {portfolioHubSections
          .filter((section) => mountedSections.current.has(section.id) && accessibleSections.some((accessible) => accessible.id === section.id))
          .map((section) => {
            const SectionBody = sectionComponents[section.id];
            const isActive = section.id === activeSection;
            return (
              <div
                key={section.id}
                id={`section-panel-${section.id}`}
                role="tabpanel"
                aria-labelledby={section.showInPrimaryNavigation ? `section-tab-${section.id}` : undefined}
                data-portfolio-section={section.id}
                className={isActive ? 'contents' : undefined}
                hidden={!isActive}
              >
                <Suspense fallback={<SectionFallback />}><SectionBody /></Suspense>
              </div>
            );
          })}
      </div>
    );
  }, [hasNoAccessibleSections, isRequestedSectionForbidden, activeSection, accessibleSections, visibleSections, isActiveSectionVisible, handleSectionChange]);

  return (
    <EmbeddableWorkspace
      embedded={mode === 'embedded'}
      title={title ?? activeSectionDefinition.label}
      description={description ?? activeSectionDefinition.description}
      size="wide"
    >
      {content}
    </EmbeddableWorkspace>
  );
}

export function PortfolioHubPage() {
  return <PortfolioHubWorkspace defaultSection="properties" mode="standalone" />;
}
