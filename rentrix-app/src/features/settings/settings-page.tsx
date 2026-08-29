import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { RefreshCcw } from 'lucide-react';
import { DataRefreshAlert } from '@/components/data-refresh-alert';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityFormVisualProvider } from '@/components/ui/entity-form';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { Skeleton } from '@/components/ui/skeleton';
import { DirtyRouteNavigationGuard } from '@/hooks/use-unsaved-changes-guard';
import { cn } from '@/lib/utils';
import { OverviewRow, SettingsHero } from './components/settings-hero';
import { SettingsSaveBar } from './components/settings-save-bar';
import { SectionCard } from './components/settings-section-card';
import { SettingsWorkspaceNav } from './components/settings-workspace-nav';
import { getCompanySettingsPreviewModel } from './settingsForm';
import { buildSettingsSummaryTiles } from './settings-workspace-model';
import { settingsSectionRegistry, type SettingsSectionDefinition } from './registry/sectionRegistry';
import { settingsSections, type SettingsSectionId } from './settingsSections';
import type { SettingsSectionRenderProps } from './registry/types';
import { useSettingsPageController } from './useSettingsPageController';

export function preventSettingsUnload(event: BeforeUnloadEvent) {
  event.preventDefault();
  event.returnValue = '';
}

export { settingsSections };
export type SettingsWorkspaceVariant = 'standalone' | 'embedded';
type SettingsWorkspaceProps = Readonly<{
  variant?: SettingsWorkspaceVariant;
  activeSection?: SettingsSectionId;
  onSectionChange?: (section: SettingsSectionId) => void;
}>;

function SettingsVariantShell({
  variant,
  dir,
  lang,
  contentClassName,
  children,
}: Readonly<{
  variant: SettingsWorkspaceVariant;
  dir: 'rtl' | 'ltr';
  lang: string;
  contentClassName: string;
  children: ReactNode;
}>) {
  if (variant === 'embedded') {
    return (
      <EntityFormVisualProvider variant="operational">
        <div data-visual-wave="malek-pro" className={contentClassName} dir={dir} lang={lang}>{children}</div>
      </EntityFormVisualProvider>
    );
  }
  return (
    <PageLayout dir={dir} lang={lang} contentClassName={contentClassName} visualVariant="malek-pro">
      {children}
    </PageLayout>
  );
}

function SettingsSectionSkeleton() {
  return (
    <ResponsiveCardGrid desktopColumns={2} gap="md" aria-label="جارٍ تحميل محتوى القسم">
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-20 rounded-xl" />
    </ResponsiveCardGrid>
  );
}

function SettingsSectionView({
  definition,
  renderProps,
}: Readonly<{
  definition: SettingsSectionDefinition;
  renderProps: SettingsSectionRenderProps;
}>) {
  const SectionComponent = definition.component;

  return (
    <Suspense
      fallback={(
        <SectionCard id={definition.id} activeId={renderProps.activeSection} title={definition.label} subtitle={definition.description}>
          <SettingsSectionSkeleton />
        </SectionCard>
      )}
    >
      <SectionComponent {...renderProps} />
    </Suspense>
  );
}

export function SettingsWorkspace({
  variant = 'standalone',
  activeSection: controlledActiveSection,
  onSectionChange,
}: SettingsWorkspaceProps = {}) {
  const controller = useSettingsPageController();
  const accessibleDefinitions = variant === 'embedded'
    ? settingsSectionRegistry.filter((section) => section.id !== 'cost-centers')
    : settingsSectionRegistry;
  const routineDefinitions = accessibleDefinitions.filter((section) => section.showInPrimaryNavigation);
  const workspaceSections = routineDefinitions.map((section) => ({
    id: section.id,
    label: section.label,
    description: section.description,
    icon: section.icon,
  }));
  const fallbackWorkspaceSection = routineDefinitions[0]?.id ?? accessibleDefinitions[0]?.id ?? 'office';
  const [localActiveSection, setLocalActiveSection] = useState<SettingsSectionId>(fallbackWorkspaceSection);
  const requestedActiveSection = controlledActiveSection ?? localActiveSection;
  const activeSection = accessibleDefinitions.some((section) => section.id === requestedActiveSection)
    ? requestedActiveSection
    : fallbackWorkspaceSection;
  const activeDefinition = accessibleDefinitions.find((section) => section.id === activeSection) ?? null;
  const isSpecialistSection = Boolean(activeDefinition && !activeDefinition.showInPrimaryNavigation);
  const [mountedSections, setMountedSections] = useState<ReadonlySet<SettingsSectionId>>(() => new Set([activeSection]));
  const handleJumpToSection = (section: SettingsSectionId) => {
    if (onSectionChange) {
      onSectionChange(section);
      return;
    }
    setLocalActiveSection(section);
  };
  const {
    theme,
    authorization,
    authorizationDiagnostics,
    companySettingsQuery,
    draft,
    errors,
    isDirty,
    isSaving,
    pageLanguage,
    formattedPreviewDate,
    formattedPreviewMoney,
    discardDraft,
    handleDraftChange,
    handleRetryLoad,
    handleToggleTheme,
    handleDefaultLanguageChange,
    handleLogoFileChange,
    handleSubmit,
  } = controller;

  useEffect(() => {
    if (!controlledActiveSection || controlledActiveSection === activeSection || !onSectionChange) return;
    onSectionChange(activeSection);
  }, [activeSection, controlledActiveSection, onSectionChange]);

  useEffect(() => {
    setMountedSections((current) => {
      if (current.has(activeSection)) return current;
      const next = new Set(current);
      next.add(activeSection);
      return next;
    });
  }, [activeSection]);

  if (companySettingsQuery.isError && !draft) {
    return (
      <SettingsVariantShell variant={variant} dir={pageLanguage.direction} lang={pageLanguage.locale} contentClassName="space-y-3">
        <SettingsHero companyName="—" hasUnsavedChanges={false} />
        <Card role="alert">
          <CardHeader>
            <CardTitle>تعذر تحميل إعدادات الشركة</CardTitle>
            <p className="text-sm text-muted-foreground">تعذر جلب الإعدادات المحفوظة. تحقق من الاتصال والصلاحيات ثم أعد المحاولة؛ لن يتم تغيير أي إعداد قبل نجاح التحميل.</p>
          </CardHeader>
          <CardContent>
            <Button onClick={handleRetryLoad}><RefreshCcw className="size-4" aria-hidden="true" />إعادة المحاولة</Button>
          </CardContent>
        </Card>
      </SettingsVariantShell>
    );
  }

  if (companySettingsQuery.isLoading || !draft) {
    return (
      <SettingsVariantShell variant={variant} dir={pageLanguage.direction} lang={pageLanguage.locale} contentClassName="space-y-3">
        <SettingsHero companyName="…" hasUnsavedChanges={false} />
        <Card>
          <CardHeader><CardTitle>إعدادات الشركة</CardTitle><p className="text-sm text-muted-foreground">جارٍ تحميل الإعدادات المحفوظة...</p></CardHeader>
          <CardContent>
            <ResponsiveCardGrid desktopColumns={3} gap="md" aria-label="جارٍ تحميل ملخص جاهزية الإعدادات">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </ResponsiveCardGrid>
          </CardContent>
        </Card>
      </SettingsVariantShell>
    );
  }

  const preview = getCompanySettingsPreviewModel(draft);
  const summaryTiles = buildSettingsSummaryTiles({
    draft,
    preview,
    isDirty,
    hasAuthorization: Boolean(authorization),
    metadataMismatch: authorizationDiagnostics.metadataMismatch,
  });

  const sectionRenderProps: SettingsSectionRenderProps = {
    activeSection,
    draft,
    errors,
    isSaving,
    preview,
    formattedPreviewDate,
    formattedPreviewMoney,
    theme,
    pageLanguage,
    onDraftChange: handleDraftChange,
    onLogoFileChange: handleLogoFileChange,
    onToggleTheme: handleToggleTheme,
    onDefaultLanguageChange: handleDefaultLanguageChange,
  };

  return (
    <SettingsVariantShell
      variant={variant}
      dir={pageLanguage.direction}
      lang={pageLanguage.locale}
      contentClassName={cn('min-w-0 space-y-2 pb-2 md:space-y-4', isDirty && 'pb-24 md:pb-8')}
    >
      <SettingsHero companyName={preview.companyName} hasUnsavedChanges={isDirty} />
      {companySettingsQuery.isError ? (
        <DataRefreshAlert
          title="تعذر تحديث إعدادات الشركة"
          description="المعروض هو آخر إعداد مكتمل. أوقفنا التعديل والحفظ حتى نؤكد أحدث نسخة من الخادم، مع الاحتفاظ بأي مسودة محلية."
          onRetry={() => { void handleRetryLoad(); }}
          isRefreshing={companySettingsQuery.isFetching}
        />
      ) : null}
      <div
        className="space-y-2 md:space-y-4"
        inert={companySettingsQuery.isError ? true : undefined}
        aria-disabled={companySettingsQuery.isError ? 'true' : undefined}
        data-stale-settings-content={companySettingsQuery.isError ? 'true' : undefined}
      >
      <div className="hidden lg:block">
        <OverviewRow tiles={summaryTiles} onOpenSection={handleJumpToSection} />
      </div>

      <div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(210px,255px)_minmax(0,1fr)] lg:items-start lg:gap-4">
        <SettingsWorkspaceNav activeSection={activeSection} onChange={handleJumpToSection} sections={workspaceSections} />
        <div className="min-w-0 space-y-2 md:space-y-3">
          {isSpecialistSection ? (
            <div
              data-settings-specialist-context
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground"
            >
              <span>إعداد متخصص مفتوح من سياق مرتبط. لا يظهر ضمن إعدادات المكتب اليومية.</span>
              <Button type="button" size="sm" variant="ghost" className="min-h-11" onClick={() => handleJumpToSection(fallbackWorkspaceSection)}>
                العودة لإعدادات المكتب
              </Button>
            </div>
          ) : null}
          <form id="settings-company-form" className="min-w-0 space-y-2.5 md:space-y-4" onSubmit={handleSubmit}>
            {accessibleDefinitions
              .filter((section) => mountedSections.has(section.id))
              .map((section) => (
                <SettingsSectionView key={section.id} definition={section} renderProps={sectionRenderProps} />
              ))}
          </form>
          <SettingsSaveBar isDirty={isDirty} isSaving={isSaving} onDiscard={discardDraft} />
        </div>
      </div>
      </div>

      <DirtyRouteNavigationGuard isDirty={isDirty} disabled={isSaving || companySettingsQuery.isError} onDiscard={discardDraft} />
    </SettingsVariantShell>
  );
}

export function SettingsPage() {
  return <SettingsWorkspace variant="standalone" />;
}
