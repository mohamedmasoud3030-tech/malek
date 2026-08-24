import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/loading-state';
import { SectionTabPanel, SectionTabs } from '@/components/ui/section-tabs';
import { CostCentersSettingsSection } from '@/features/settings/cost-centers-settings-section';
import { isSettingsSectionId } from '@/features/settings/settingsSections';
import { useAuth } from '@/hooks/use-auth';
import { getVisibleGovernanceHubSections, type GovernanceHubSectionId } from '../governance-hub-sections';

const SettingsWorkspace = lazy(() => import('@/features/settings/settings-page').then((module) => ({ default: module.SettingsWorkspace })));
const UserRolesWorkspace = lazy(() => import('./UserRolesWorkspace').then((module) => ({ default: module.UserRolesWorkspace })));
const AuditLogWorkspace = lazy(() => import('@/features/audit/audit-log-page').then((module) => ({ default: module.AuditLogWorkspace })));
const DataIntegrityWorkspace = lazy(() => import('@/features/system/data-integrity-page').then((module) => ({ default: module.DataIntegrityWorkspace })));
const ChangePasswordWorkspace = lazy(() => import('@/features/auth/change-password-page').then((module) => ({ default: module.ChangePasswordWorkspace })));
const AutomationWorkspace = lazy(() => import('@/features/automation/components/automation-workspace').then((module) => ({ default: module.AutomationWorkspace })));
const SystemWorkspace = lazy(() => import('@/features/system/system-page').then((module) => ({ default: module.SystemWorkspace })));

const TabFallback = () => <LoadingState variant="section" label="جارٍ تحميل القسم..." />;

function CostCentersWorkspace() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>مراكز التكلفة</CardTitle>
        <p className="text-sm text-muted-foreground">تصنيف المصروفات والتقارير حسب العقار أو النشاط، ضمن الصلاحية المخصصة.</p>
      </CardHeader>
      <CardContent><CostCentersSettingsSection /></CardContent>
    </Card>
  );
}

export function GovernanceHubWorkspace() {
  const { canAccess } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const visibleSections = useMemo(() => getVisibleGovernanceHubSections(canAccess), [canAccess]);
  const requestedSection = typeof search.section === 'string' ? search.section : null;
  const fallbackSection = visibleSections[0]?.id ?? 'security';
  const hasRequestedHubSection = visibleSections.some((section) => section.id === requestedSection);
  const legacyCompanySection = !hasRequestedHubSection && isSettingsSectionId(requestedSection) ? requestedSection : null;
  const canOpenCompany = visibleSections.some((section) => section.id === 'company');
  const urlSection = hasRequestedHubSection
    ? requestedSection as GovernanceHubSectionId
    : legacyCompanySection && canOpenCompany
      ? 'company'
      : fallbackSection;
  const [activeTab, setActiveTab] = useState<GovernanceHubSectionId>(urlSection);
  const [mountedTabs, setMountedTabs] = useState<ReadonlySet<GovernanceHubSectionId>>(() => new Set([urlSection]));

  useEffect(() => {
    setActiveTab(urlSection);
    setMountedTabs((current) => current.has(urlSection) ? current : new Set([...current, urlSection]));
  }, [urlSection]);

  useEffect(() => {
    if (!legacyCompanySection || !canOpenCompany) return;
    void navigate({
      to: '/settings',
      search: (previous: Record<string, unknown>) => ({
        ...previous,
        section: 'company',
        companySection: legacyCompanySection,
      }),
      replace: true,
    });
  }, [canOpenCompany, legacyCompanySection, navigate]);

  const handleTabChange = (nextTab: GovernanceHubSectionId) => {
    setMountedTabs((current) => current.has(nextTab) ? current : new Set([...current, nextTab]));
    setActiveTab(nextTab);
    void navigate({
      to: '/settings',
      search: (previous: Record<string, unknown>) => ({ ...previous, section: nextTab }),
    });
  };

  const resolvedActiveTab = visibleSections.some((section) => section.id === activeTab) ? activeTab : fallbackSection;
  const shouldRenderTab = (tab: GovernanceHubSectionId) => visibleSections.some((section) => section.id === tab) && (mountedTabs.has(tab) || resolvedActiveTab === tab);

  // Deep link from a permission-request notification (sub=permission-requests):
  // after the users-permissions tab mounts, bring the review queue into view.
  const requestedSub = typeof search.sub === 'string' ? search.sub : null;
  useEffect(() => {
    if (resolvedActiveTab !== 'users-permissions' || requestedSub !== 'permission-requests') return;
    let cancelled = false;
    let attempts = 0;
    const tryScroll = () => {
      if (cancelled) return;
      const target = document.getElementById('permission-requests');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      attempts += 1;
      if (attempts < 12) window.setTimeout(tryScroll, 150);
    };
    const frame = window.requestAnimationFrame(() => window.setTimeout(tryScroll, 50));
    return () => { cancelled = true; window.cancelAnimationFrame(frame); };
  }, [requestedSub, resolvedActiveTab]);

  return (
    <PageLayout dir="rtl" lang="ar" contentClassName="min-w-0 space-y-4">
      <PageHeader title="الإعدادات" description="الشركة، المستخدمون والصلاحيات، مراكز التكلفة، الأتمتة، إعدادات النظام والأمان." />

      {visibleSections.length === 0 ? (
        <div className="rounded-2xl border border-border bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">لا توجد أقسام إعدادات متاحة لصلاحياتك الحالية.</div>
      ) : (
        <>
          <div className="no-scrollbar sticky top-0 z-20 -mx-1 overflow-x-auto rounded-xl border border-border/60 bg-card/95 px-1 pt-2 backdrop-blur">
            <div className="min-w-max">
              <SectionTabs items={visibleSections} activeId={resolvedActiveTab} onChange={handleTabChange} ariaLabel="أقسام الإعدادات" />
            </div>
          </div>

          <div className="min-w-0">
            <Suspense fallback={<TabFallback />}>
              {shouldRenderTab('company') ? <SectionTabPanel id="company" activeId={resolvedActiveTab}><SettingsWorkspace variant="embedded" /></SectionTabPanel> : null}
              {shouldRenderTab('users-permissions') ? <SectionTabPanel id="users-permissions" activeId={resolvedActiveTab}><UserRolesWorkspace /></SectionTabPanel> : null}
              {shouldRenderTab('cost-centers') ? <SectionTabPanel id="cost-centers" activeId={resolvedActiveTab}><CostCentersWorkspace /></SectionTabPanel> : null}
              {shouldRenderTab('automation') ? <SectionTabPanel id="automation" activeId={resolvedActiveTab}><AutomationWorkspace mode="embedded" /></SectionTabPanel> : null}
              {shouldRenderTab('system-settings') ? <SectionTabPanel id="system-settings" activeId={resolvedActiveTab}><SystemWorkspace variant="embedded" /></SectionTabPanel> : null}
              {shouldRenderTab('audit-log') ? <SectionTabPanel id="audit-log" activeId={resolvedActiveTab}><AuditLogWorkspace variant="embedded" /></SectionTabPanel> : null}
              {shouldRenderTab('data-integrity') ? <SectionTabPanel id="data-integrity" activeId={resolvedActiveTab}><DataIntegrityWorkspace variant="embedded" /></SectionTabPanel> : null}
              {shouldRenderTab('security') ? <SectionTabPanel id="security" activeId={resolvedActiveTab}><ChangePasswordWorkspace variant="embedded" /></SectionTabPanel> : null}
            </Suspense>
          </div>
        </>
      )}
    </PageLayout>
  );
}
