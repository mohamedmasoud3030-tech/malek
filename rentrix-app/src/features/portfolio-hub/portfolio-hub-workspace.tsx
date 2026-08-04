import { useNavigate, useSearch } from '@tanstack/react-router';
import { Suspense, lazy, useCallback, useMemo, useRef, type ComponentType } from 'react';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionTabs } from '@/components/ui/section-tabs';
import { useAuth } from '@/hooks/use-auth';
import { resolvePortfolioHubState } from './portfolio-hub-model';
import {
  portfolioHubSections,
  type PortfolioHubSectionId,
} from './portfolio-hub-sections';

/** `?section=` deep-link contract for the portfolio hub. */
export const PORTFOLIO_HUB_SECTION_SEARCH_KEY = 'section';

const PropertiesBody = lazy(async () => {
  const { PropertiesWorkspace } = await import('@/features/properties/properties-list-page');
  return { default: function PropertiesEmbedded() { return <PropertiesWorkspace embedded />; } };
});
const OwnersBody = lazy(async () => {
  const { OwnersWorkspace } = await import('@/features/owners/OwnersPage');
  return { default: function OwnersEmbedded() { return <OwnersWorkspace embedded />; } };
});
const UnitsBody = lazy(async () => {
  const { UnitsWorkspace } = await import('@/features/units/units-page');
  return { default: function UnitsEmbedded() { return <UnitsWorkspace embedded />; } };
});
const LandsBody = lazy(async () => {
  const { LandsWorkspace } = await import('@/features/lands/lands-page');
  return { default: function LandsEmbedded() { return <LandsWorkspace embedded />; } };
});

const sectionComponents: Record<PortfolioHubSectionId, ComponentType> = {
  properties: PropertiesBody,
  owners: OwnersBody,
  units: UnitsBody,
  lands: LandsBody,
};

function SectionFallback() {
  return (
    <div className="space-y-3" role="status" aria-label="جارٍ تحميل القسم">
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

/**
 * Unified portfolio hub at /properties.
 * Tabs: Properties, Owners, Units, Lands — permission-filtered, URL-synced.
 */
export function PortfolioHubWorkspace({
  defaultSection = 'properties',
  title = 'المحفظة العقارية',
  description = 'العقارات والملاك والوحدات والأراضي في مساحة عمل واحدة.',
  mode = 'standalone',
}: PortfolioHubWorkspaceProps) {
  const { authorization } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const requestedSection = search[PORTFOLIO_HUB_SECTION_SEARCH_KEY];

  const { activeSection, visibleSections, isRequestedSectionForbidden, hasNoVisibleSections } = useMemo(
    () => resolvePortfolioHubState({ requestedSection, defaultSection, authorization }),
    [requestedSection, defaultSection, authorization],
  );

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

  const shell = (children: React.ReactNode) => {
    if (mode === 'embedded') {
      return <div className="min-w-0 space-y-5">{children}</div>;
    }

    return (
      <PageLayout dir="rtl" lang="ar" size="wide">
        <PageHeader title={title} description={description} />
        {children}
      </PageLayout>
    );
  };

  if (hasNoVisibleSections) {
    return shell(<AccessDenied message="ليس لديك صلاحية لعرض أي من أقسام المحفظة العقارية." />);
  }

  if (isRequestedSectionForbidden || !activeSection) {
    return shell(<AccessDenied message="ليس لديك صلاحية لعرض هذا القسم من المحفظة." />);
  }

  return shell(
    <>
      <SectionTabs
        items={visibleSections}
        activeId={activeSection}
        onChange={handleSectionChange}
        ariaLabel="أقسام المحفظة العقارية"
      />

      {portfolioHubSections
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
              data-portfolio-section={section.id}
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

/** Thin page entry used by the /properties route. */
export function PortfolioHubPage() {
  return <PortfolioHubWorkspace defaultSection="properties" mode="standalone" />;
}
