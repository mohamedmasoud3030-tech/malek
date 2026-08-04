import { lazy, Suspense, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { LoadingState } from '@/components/ui/loading-state';
import { SectionTabPanel, SectionTabs } from '@/components/ui/section-tabs';
import { useAuth } from '@/hooks/use-auth';
import { getVisibleGovernanceHubSections, type GovernanceHubSectionId } from '../governance-hub-sections';

// Each tab's content lives in an existing feature module. Lazy-loading keeps
// /settings' first paint light — only the first visible tab loads initially;
// every other workspace loads on first visit, then stays mounted so in-progress
// form state is not discarded when the user switches between hub sections.
const SettingsWorkspace = lazy(() =>
  import('@/features/settings/settings-page').then((m) => ({ default: m.SettingsWorkspace })),
);
const UserRolesWorkspace = lazy(() =>
  import('./UserRolesWorkspace').then((m) => ({ default: m.UserRolesWorkspace })),
);
const AuditLogWorkspace = lazy(() =>
  import('@/features/audit/audit-log-page').then((m) => ({ default: m.AuditLogWorkspace })),
);
const DataIntegrityWorkspace = lazy(() =>
  import('@/features/system/data-integrity-page').then((m) => ({ default: m.DataIntegrityWorkspace })),
);
const ChangePasswordWorkspace = lazy(() =>
  import('@/features/auth/change-password-page').then((m) => ({ default: m.ChangePasswordWorkspace })),
);

const TabFallback = () => <LoadingState variant="section" label="جارٍ تحميل القسم..." />;

/**
 * Unified administration & governance hub rendered at /settings.
 * Tabs are filtered per-session by permission — a tab never renders (and
 * its underlying workspace never loads) unless the current authorization
 * context already has the same permission the legacy standalone route
 * enforces via route-tree.ts. This does not change or relax any guard;
 * it only decides which already-permitted surfaces to show as tabs.
 */
export function GovernanceHubWorkspace() {
  const { canAccess } = useAuth();
  const visibleSections = useMemo(() => getVisibleGovernanceHubSections(canAccess), [canAccess]);

  const [activeTab, setActiveTab] = useState<GovernanceHubSectionId>(
    () => visibleSections[0]?.id ?? 'office',
  );
  const [mountedTabs, setMountedTabs] = useState<ReadonlySet<GovernanceHubSectionId>>(
    () => new Set<GovernanceHubSectionId>([visibleSections[0]?.id ?? 'office']),
  );

  // If the previously active tab is no longer visible (e.g. authorization
  // context resolved after an initial render), fall back to the first
  // visible tab instead of rendering an empty pane.
  const resolvedActiveTab = visibleSections.some((section) => section.id === activeTab)
    ? activeTab
    : (visibleSections[0]?.id ?? activeTab);

  const handleTabChange = (nextTab: GovernanceHubSectionId) => {
    setMountedTabs((current) => {
      if (current.has(nextTab)) return current;
      const next = new Set(current);
      next.add(nextTab);
      return next;
    });
    setActiveTab(nextTab);
  };

  const shouldRenderTab = (tab: GovernanceHubSectionId) =>
    visibleSections.some((section) => section.id === tab) &&
    (mountedTabs.has(tab) || resolvedActiveTab === tab);

  if (visibleSections.length === 0) {
    return (
      <PageLayout dir="rtl" lang="ar">
        <PageHeader
          title="الإدارة والحوكمة"
          description="مركز موحّد لإعدادات المكتب والحوكمة والأمان."
        />
        <div className="rounded-2xl border border-border bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
          لا توجد أقسام إدارية متاحة لصلاحياتك الحالية.
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout dir="rtl" lang="ar" contentClassName="min-w-0 space-y-4">
      <PageHeader
        title="الإدارة والحوكمة"
        description="مركز موحّد لإعدادات المكتب، المستخدمين والأدوار، سجل التدقيق، سلامة البيانات، وكلمة المرور والأمان."
      />

      {/* SectionTabs is the single navigation controller for this workspace.
          A duplicated secondary-nav row previously showed the same section set
          twice on desktop and stacked two horizontal menus on mobile. */}
      <div className="no-scrollbar sticky top-0 z-20 -mx-1 overflow-x-auto rounded-xl border border-border/60 bg-card/95 px-1 pt-2 backdrop-blur">
        <div className="min-w-max">
          <SectionTabs
            items={visibleSections}
            activeId={resolvedActiveTab}
            onChange={handleTabChange}
            ariaLabel="أقسام الإدارة والحوكمة"
          />
        </div>
      </div>

      <div className="min-w-0">
        <Suspense fallback={<TabFallback />}>
          {shouldRenderTab('office') && (
            <SectionTabPanel id="office" activeId={resolvedActiveTab}>
              <SettingsWorkspace variant="embedded" />
            </SectionTabPanel>
          )}
          {shouldRenderTab('users-roles') && (
            <SectionTabPanel id="users-roles" activeId={resolvedActiveTab}>
              <UserRolesWorkspace />
            </SectionTabPanel>
          )}
          {shouldRenderTab('audit-log') && (
            <SectionTabPanel id="audit-log" activeId={resolvedActiveTab}>
              <AuditLogWorkspace variant="embedded" />
            </SectionTabPanel>
          )}
          {shouldRenderTab('data-integrity') && (
            <SectionTabPanel id="data-integrity" activeId={resolvedActiveTab}>
              <DataIntegrityWorkspace variant="embedded" />
            </SectionTabPanel>
          )}
          {shouldRenderTab('security') && (
            <SectionTabPanel id="security" activeId={resolvedActiveTab}>
              <ChangePasswordWorkspace variant="embedded" />
            </SectionTabPanel>
          )}
        </Suspense>
      </div>
    </PageLayout>
  );
}
