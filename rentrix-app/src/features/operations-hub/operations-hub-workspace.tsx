import { useNavigate, useSearch } from '@tanstack/react-router';
import { Suspense, lazy, useCallback, useMemo, useRef, type ComponentType } from 'react';
import { AccessDenied } from '@/components/layout/access-denied';
import { EmbeddableWorkspace } from '@/components/layout/embeddable-workspace';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionTabs } from '@/components/ui/section-tabs';
import { useAuth } from '@/hooks/use-auth';
import { resolveOperationsHubState } from './operations-hub-model';
import {
  operationsHubSections,
  type OperationsHubSectionId,
} from './operations-hub.sections';

export const OPERATIONS_HUB_SECTION_SEARCH_KEY = 'section';

const MaintenanceBody = lazy(async () => {
  const { MaintenanceWorkspace } = await import('@/features/maintenance/components/maintenance-workspace');
  return { default: function MaintenanceEmbedded() { return <MaintenanceWorkspace mode="embedded" />; } };
});
const ServiceProvidersBody = lazy(async () => {
  const { ServiceProvidersWorkspace } = await import('@/features/service-providers/service-providers-page');
  return { default: function ServiceProvidersEmbedded() { return <ServiceProvidersWorkspace embedded />; } };
});
const UtilitiesBody = lazy(async () => {
  const { UtilitiesWorkspace } = await import('@/features/utilities/components/utilities-workspace');
  return { default: function UtilitiesEmbedded() { return <UtilitiesWorkspace mode="embedded" />; } };
});
const DocumentsVaultBody = lazy(async () => {
  const { DocumentsVaultWorkspace } = await import('@/features/documents-vault/components/documents-vault-workspace');
  return { default: function DocumentsVaultEmbedded() { return <DocumentsVaultWorkspace mode="embedded" />; } };
});

const sectionComponents: Record<OperationsHubSectionId, ComponentType> = {
  maintenance: MaintenanceBody,
  service_providers: ServiceProvidersBody,
  utilities: UtilitiesBody,
  documents_vault: DocumentsVaultBody,
};

function SectionFallback() {
  return (
    <div className="space-y-3" role="status" aria-label="جارٍ تحميل قسم الخدمات">
      <Skeleton className="h-24" />
      <Skeleton className="h-64" />
    </div>
  );
}

export type OperationsHubWorkspaceProps = Readonly<{
  defaultSection: OperationsHubSectionId;
  title?: string;
  description?: string;
  mode?: 'standalone' | 'embedded';
}>;

/**
 * Services workspace: one operational context for maintenance, providers,
 * utilities and documents. Administrative automation intentionally lives in
 * Settings only, so there is one authority per user task.
 */
export function OperationsHubWorkspace({
  defaultSection,
  title = 'الخدمات',
  description = 'الصيانة ومزودو الخدمات والمرافق والمستندات التشغيلية في مساحة عمل واحدة.',
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

  const mountedSections = useRef(new Set<OperationsHubSectionId>());
  if (activeSection) mountedSections.current.add(activeSection);

  const handleSectionChange = useCallback(
    (nextSection: OperationsHubSectionId) => {
      void navigate({
        to: '/maintenance',
        search: (previous: Record<string, unknown>) => ({
          ...previous,
          [OPERATIONS_HUB_SECTION_SEARCH_KEY]: nextSection,
        }),
        replace: true,
      });
    },
    [navigate],
  );

  const content = useMemo(() => {
    if (hasNoVisibleSections) {
      return <AccessDenied message="ليس لديك صلاحية لعرض أي من أقسام الخدمات." />;
    }

    if (isRequestedSectionForbidden || !activeSection) {
      return <AccessDenied message="ليس لديك صلاحية لعرض هذا القسم من الخدمات." />;
    }

    return (
      <>
        <SectionTabs
          items={visibleSections}
          activeId={activeSection}
          onChange={handleSectionChange}
          ariaLabel="أقسام الخدمات"
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
                <Suspense fallback={<SectionFallback />}><SectionBody /></Suspense>
              </div>
            );
          })}
      </>
    );
  }, [hasNoVisibleSections, isRequestedSectionForbidden, activeSection, visibleSections, handleSectionChange]);

  return (
    <EmbeddableWorkspace
      embedded={mode === 'embedded'}
      title={title}
      description={description}
      size="wide"
      visualVariant="malek-pro"
    >
      {content}
    </EmbeddableWorkspace>
  );
}

/** @deprecated Prefer OperationsHubWorkspace — kept for existing imports. */
export { OperationsHubWorkspace as OperationsHub };
