import { useNavigate, useSearch } from '@tanstack/react-router';
import { Suspense, lazy, useCallback, useMemo, useRef, type ComponentType } from 'react';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { WorkspaceSubNav } from '@/components/layout/workspace-sub-nav';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionTabs } from '@/components/ui/section-tabs';
import { useAuth } from '@/hooks/use-auth';
import { resolveOperationsHubState } from './operations-hub-model';
import {
  operationsHubSections,
  type OperationsHubSectionId,
} from './operations-hub.sections';

/**
 * The one composition layer for every operations workspace.
 *
 * Each operations entry route renders this with its own `defaultSection`; the
 * page shell (PageLayout + PageHeader) lives here and nowhere else, so the
 * embedded section bodies never render a second layout or header.
 */

/** `?section=` is the deep-link contract shared by every operations entry route. */
export const OPERATIONS_HUB_SECTION_SEARCH_KEY = 'section';

// Each section body is code-split and forced into embedded mode so the hub
// shell is never duplicated by the child workspace.
const MaintenanceBody = lazy(async () => {
  const { MaintenanceWorkspace } = await import('@/features/maintenance/components/maintenance-workspace');
  return { default: function MaintenanceEmbedded() { return <MaintenanceWorkspace mode="embedded" />; } };
});
const UtilitiesBody = lazy(async () => {
  const { UtilitiesWorkspace } = await import('@/features/utilities/components/utilities-workspace');
  return { default: function UtilitiesEmbedded() { return <UtilitiesWorkspace mode="embedded" />; } };
});
const AutomationBody = lazy(async () => {
  const { AutomationWorkspace } = await import('@/features/automation/components/automation-workspace');
  return { default: function AutomationEmbedded() { return <AutomationWorkspace mode="embedded" />; } };
});
const DocumentsVaultBody = lazy(async () => {
  const { DocumentsVaultWorkspace } = await import('@/features/documents-vault/components/documents-vault-workspace');
  return { default: function DocumentsVaultEmbedded() { return <DocumentsVaultWorkspace mode="embedded" />; } };
});

const sectionComponents: Record<OperationsHubSectionId, ComponentType> = {
  maintenance: MaintenanceBody,
  utilities: UtilitiesBody,
  automation: AutomationBody,
  documents_vault: DocumentsVaultBody,
};

function SectionFallback() {
  return (
    <div className="space-y-3" role="status" aria-label="جارٍ تحميل القسم">
      <Skeleton className="h-24" />
      <Skeleton className="h-64" />
    </div>
  );
}

export type OperationsHubWorkspaceProps = Readonly<{
  /** Section shown when the URL does not request one. */
  defaultSection: OperationsHubSectionId;
  title?: string;
  description?: string;
  mode?: 'standalone' | 'embedded';
}>;

export function OperationsHubWorkspace({
  defaultSection,
  title = 'مركز التشغيل',
  description = 'الصيانة، المرافق والعدادات، الأتمتة والتنبيهات، وخزينة المستندات في مكان واحد.',
  mode = 'standalone',
}: OperationsHubWorkspaceProps) {
  const { authorization } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const requestedSection = search[OPERATIONS_HUB_SECTION_SEARCH_KEY];

  const { activeSection, visibleSections, isRequestedSectionForbidden, hasNoVisibleSections } = useMemo(
    () => resolveOperationsHubState({ requestedSection, defaultSection, authorization }),
    [requestedSection, defaultSection, authorization],
  );

  // Sections are mounted on first visit and then kept mounted (hidden) so
  // filters, scroll position, and in-flight forms survive a tab switch.
  const mountedSections = useRef(new Set<OperationsHubSectionId>());
  if (activeSection) mountedSections.current.add(activeSection);

  const handleSectionChange = useCallback(
    (nextSection: OperationsHubSectionId) => {
      void navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => ({
          ...previous,
          [OPERATIONS_HUB_SECTION_SEARCH_KEY]: nextSection,
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
        <WorkspaceSubNav rootPath="/maintenance" />
        {children}
      </PageLayout>
    );
  };

  if (hasNoVisibleSections) {
    return shell(<AccessDenied message="ليس لديك صلاحية لعرض أي من أقسام مركز التشغيل." />);
  }

  if (isRequestedSectionForbidden || !activeSection) {
    return shell(<AccessDenied message="ليس لديك صلاحية لعرض هذا القسم التشغيلي." />);
  }

  return shell(
    <>
      <SectionTabs
        items={visibleSections}
        activeId={activeSection}
        onChange={handleSectionChange}
        ariaLabel="أقسام مركز التشغيل"
      />

      {operationsHubSections
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
              data-operations-section={section.id}
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

/** @deprecated Prefer OperationsHubWorkspace — kept for existing imports. */
export { OperationsHubWorkspace as OperationsHub };
