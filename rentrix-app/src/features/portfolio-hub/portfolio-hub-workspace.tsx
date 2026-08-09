import { useNavigate, useSearch } from '@tanstack/react-router';
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, type ComponentType } from 'react';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
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

const sectionComponents: Record<PortfolioHubSectionId, ComponentType> = {
  properties: PropertiesBody,
  units: UnitsBody,
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

export function PortfolioHubWorkspace({
  defaultSection = 'properties',
  title = 'العقارات',
  description = 'العقارات والوحدات والأراضي في مساحة تشغيل واحدة.',
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

  useEffect(() => {
    if (requestedSection === 'owners') {
      void navigate({ to: '/owners', replace: true });
      return;
    }
    if (requestedSection === 'lands') {
      void navigate({ to: '/lands', replace: true });
      return;
    }
  }, [navigate, requestedSection]);

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
      return <div data-visual-wave="malek-pro" className="min-w-0 space-y-4 sm:space-y-5">{children}</div>;
    }

    return (
      <PageLayout dir="rtl" lang="ar" size="wide" visualVariant="malek-pro">
        <PageHeader title={title} description={description} />
        {children}
      </PageLayout>
    );
  };

  // Backward compatibility: owners and lands are now first-class routes (Phase 2).
  if (requestedSection === 'owners' || requestedSection === 'lands') {
    return shell(<SectionFallback />);
  }

  if (hasNoVisibleSections) {
    return shell(<AccessDenied message="ليس لديك صلاحية لعرض أي من أقسام العقارات." />);
  }

  if (isRequestedSectionForbidden || !activeSection) {
    return shell(<AccessDenied message="ليس لديك صلاحية لعرض هذا القسم من العقارات." />);
  }

  return shell(
    <>
      <SectionTabs items={visibleSections} activeId={activeSection} onChange={handleSectionChange} ariaLabel="أقسام العقارات" />
      {portfolioHubSections
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
              data-portfolio-section={section.id}
              hidden={!isActive}
            >
              <Suspense fallback={<SectionFallback />}><SectionBody /></Suspense>
            </div>
          );
        })}
    </>,
  );
}

export function PortfolioHubPage() {
  return <PortfolioHubWorkspace defaultSection="properties" mode="standalone" />;
}
