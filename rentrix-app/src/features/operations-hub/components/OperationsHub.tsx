import { lazy, Suspense, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { LoadingState } from '@/components/ui/loading-state';
import { SectionTabPanel, SectionTabs } from '@/components/ui/section-tabs';
import { useAuth } from '@/hooks/use-auth';
import {
  getVisibleOperationsHubSections,
  type OperationsHubSectionId,
} from '../operations-hub.sections';

// Each tab's workspace (and its data-service imports) is loaded on first visit.
// Visited panels stay mounted so switching sections does not discard drafts,
// filters, or open workflow state.
const MaintenanceWorkspace = lazy(() =>
  import('@/features/maintenance/components/maintenance-workspace').then((m) => ({ default: m.MaintenanceWorkspace })),
);
const UtilitiesWorkspace = lazy(() =>
  import('@/features/utilities/components/utilities-workspace').then((m) => ({ default: m.UtilitiesWorkspace })),
);
const AutomationWorkspace = lazy(() =>
  import('@/features/automation/components/automation-workspace').then((m) => ({ default: m.AutomationWorkspace })),
);
const DocumentsVaultWorkspace = lazy(() =>
  import('@/features/documents-vault/components/documents-vault-workspace').then((m) => ({ default: m.DocumentsVaultWorkspace })),
);

const SectionFallback = () => <LoadingState variant="section" label="جارٍ التحميل..." />;

export type OperationsHubProps = Readonly<{
  /** Which tab opens by default. Defaults to the maintenance tab. */
  defaultSection?: OperationsHubSectionId;
}>;

/**
 * Unified operations hub: /maintenance renders this workspace with tabs for
 * Maintenance, Utilities, Automation, and Documents Vault. Each tab embeds
 * the same workspace component its standalone route uses (mode="embedded") —
 * no logic, queries, or forms are duplicated. Tabs the current user lacks
 * permission for are hidden; existing route guards remain unchanged.
 */
export function OperationsHub({ defaultSection = 'maintenance' }: OperationsHubProps) {
  const { canAccess } = useAuth();

  const visibleSections = useMemo(
    () => getVisibleOperationsHubSections(canAccess),
    [canAccess],
  );

  const initialSection = visibleSections.some((section) => section.id === defaultSection)
    ? defaultSection
    : visibleSections[0]?.id ?? defaultSection;

  const [activeSection, setActiveSection] = useState<OperationsHubSectionId>(() => initialSection);
  const [mountedSections, setMountedSections] = useState<ReadonlySet<OperationsHubSectionId>>(
    () => new Set<OperationsHubSectionId>([initialSection]),
  );

  const resolvedActiveSection = visibleSections.some((section) => section.id === activeSection)
    ? activeSection
    : (visibleSections[0]?.id ?? activeSection);
  const activeSectionMeta = visibleSections.find((section) => section.id === resolvedActiveSection);

  const handleSectionChange = (nextSection: OperationsHubSectionId) => {
    setMountedSections((current) => {
      if (current.has(nextSection)) return current;
      const next = new Set(current);
      next.add(nextSection);
      return next;
    });
    setActiveSection(nextSection);
  };

  const shouldRenderSection = (section: OperationsHubSectionId) =>
    visibleSections.some((item) => item.id === section) &&
    (mountedSections.has(section) || resolvedActiveSection === section);

  if (!activeSectionMeta) {
    return (
      <PageLayout dir="rtl" lang="ar" size="wide">
        <PageHeader title="مركز التشغيل" description="لا تملك صلاحية الوصول إلى أي قسم من مركز التشغيل." />
      </PageLayout>
    );
  }

  return (
    <PageLayout dir="rtl" lang="ar" size="wide">
      <PageHeader
        title="مركز التشغيل"
        description="الصيانة، المرافق والعدادات، الأتمتة والتنبيهات، وخزينة المستندات في مكان واحد."
      />

      <section className="min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card" aria-label="أقسام مركز التشغيل">
        <div className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <activeSectionMeta.icon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0" aria-live="polite">
              <h2 className="text-base font-extrabold sm:text-lg">{activeSectionMeta.label}</h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground sm:text-sm">
                {activeSectionMeta.description}
              </p>
            </div>
          </div>
        </div>

        <div className="no-scrollbar sticky top-0 z-20 overflow-x-auto border-b border-border/60 bg-card/95 px-3 pt-3 backdrop-blur sm:px-4">
          <div className="min-w-max">
            <SectionTabs
              items={visibleSections}
              activeId={resolvedActiveSection}
              onChange={handleSectionChange}
              ariaLabel="أقسام مركز التشغيل"
            />
          </div>
        </div>
      </section>

      <div className="min-w-0">
        <Suspense fallback={<SectionFallback />}>
          {shouldRenderSection('maintenance') && (
            <SectionTabPanel id="maintenance" activeId={resolvedActiveSection}>
              <MaintenanceWorkspace mode="embedded" />
            </SectionTabPanel>
          )}
          {shouldRenderSection('utilities') && (
            <SectionTabPanel id="utilities" activeId={resolvedActiveSection}>
              <UtilitiesWorkspace mode="embedded" />
            </SectionTabPanel>
          )}
          {shouldRenderSection('automation') && (
            <SectionTabPanel id="automation" activeId={resolvedActiveSection}>
              <AutomationWorkspace mode="embedded" />
            </SectionTabPanel>
          )}
          {shouldRenderSection('documents_vault') && (
            <SectionTabPanel id="documents_vault" activeId={resolvedActiveSection}>
              <DocumentsVaultWorkspace mode="embedded" />
            </SectionTabPanel>
          )}
        </Suspense>
      </div>
    </PageLayout>
  );
}
