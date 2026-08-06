import type { ReactNode } from 'react';
import { RefreshCcw } from 'lucide-react';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityFormVisualProvider } from '@/components/ui/entity-form';
import { Skeleton } from '@/components/ui/skeleton';
import { DirtyRouteNavigationGuard } from '@/hooks/use-unsaved-changes-guard';
import { CompanyProfileSections } from './components/company-profile-sections';
import { OverviewRow, SettingsHero } from './components/settings-hero';
import { SettingsOperationsSections } from './components/settings-operations-sections';
import { SettingsSaveBar } from './components/settings-save-bar';
import { SectionCard } from './components/settings-section-card';
import { SettingsWorkspaceNav } from './components/settings-workspace-nav';
import { CostCentersSettingsSection } from './cost-centers-settings-section';
import { PaymentTermsSettingsSection } from './payment-terms-settings-section';
import { getCompanySettingsPreviewModel } from './settingsForm';
import { buildSettingsSummaryTiles } from './settings-workspace-model';
import { settingsSections } from './settingsSections';
import { useSettingsPageController } from './useSettingsPageController';

export function preventSettingsUnload(event: BeforeUnloadEvent) {
  event.preventDefault();
  event.returnValue = '';
}

export { settingsSections };

export type SettingsWorkspaceVariant = 'standalone' | 'embedded';

type SettingsWorkspaceProps = Readonly<{
  variant?: SettingsWorkspaceVariant;
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
        <div data-visual-wave="malek-pro" className={contentClassName} dir={dir} lang={lang}>
          {children}
        </div>
      </EntityFormVisualProvider>
    );
  }
  return (
    <PageLayout
      dir={dir}
      lang={lang}
      contentClassName={contentClassName}
      visualVariant="malek-pro"
    >
      {children}
    </PageLayout>
  );
}

export function SettingsWorkspace({ variant = 'standalone' }: SettingsWorkspaceProps = {}) {
  const controller = useSettingsPageController();
  const {
    theme,
    authorization,
    authorizationDiagnostics,
    user,
    companySettingsQuery,
    draft,
    errors,
    activeSection,
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
    handleJumpToSection,
  } = controller;

  if (companySettingsQuery.isError) {
    return (
      <SettingsVariantShell variant={variant} dir={pageLanguage.direction} lang={pageLanguage.locale} contentClassName="space-y-4">
        <SettingsHero companyName="—" hasUnsavedChanges={false} />
        <Card>
          <CardHeader>
            <CardTitle>تعذر تحميل إعدادات الشركة</CardTitle>
            <p className="text-sm text-muted-foreground">
              {companySettingsQuery.error instanceof Error
                ? companySettingsQuery.error.message
                : 'حدث خطأ غير متوقع أثناء تحميل الإعدادات.'}
            </p>
          </CardHeader>
          <CardContent>
            <Button onClick={handleRetryLoad}>
              <RefreshCcw className="me-2 size-4" aria-hidden="true" />
              إعادة المحاولة
            </Button>
          </CardContent>
        </Card>
      </SettingsVariantShell>
    );
  }

  if (companySettingsQuery.isLoading || !draft) {
    return (
      <SettingsVariantShell variant={variant} dir={pageLanguage.direction} lang={pageLanguage.locale} contentClassName="space-y-4">
        <SettingsHero companyName="…" hasUnsavedChanges={false} />
        <Card>
          <CardHeader>
            <CardTitle>إعدادات الشركة</CardTitle>
            <p className="text-sm text-muted-foreground">جارٍ تحميل الإعدادات المحفوظة...</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
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

  return (
    <SettingsVariantShell
      variant={variant}
      dir={pageLanguage.direction}
      lang={pageLanguage.locale}
      contentClassName="min-w-0 space-y-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
    >
      <SettingsHero companyName={preview.companyName} hasUnsavedChanges={isDirty} />
      <OverviewRow tiles={summaryTiles} />
      <SettingsSaveBar isDirty={isDirty} isSaving={isSaving} onDiscard={discardDraft} />

      <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(230px,280px)_minmax(0,1fr)] md:items-start">
        <SettingsWorkspaceNav activeSection={activeSection} onChange={handleJumpToSection} />

        <form
          id="settings-company-form"
          className="min-w-0 space-y-4"
          onSubmit={handleSubmit}
        >
          <CompanyProfileSections
            activeSection={activeSection}
            draft={draft}
            errors={errors}
            isSaving={isSaving}
            preview={preview}
            formattedPreviewDate={formattedPreviewDate}
            formattedPreviewMoney={formattedPreviewMoney}
            onDraftChange={handleDraftChange}
            onLogoFileChange={handleLogoFileChange}
          />

          <SectionCard
            id="cost-centers"
            activeId={activeSection}
            title="مراكز التكلفة"
            subtitle="تصنيف تشغيلي للمصروفات والتقارير حسب العقار أو النشاط بدون دفتر أستاذ عام."
          >
            <CostCentersSettingsSection />
          </SectionCard>

          <SectionCard
            id="payment-terms"
            activeId={activeSection}
            title="شروط السداد"
            subtitle="قوالب تشغيلية لاختيار جدول السداد في العقد بدون إنشاء دفتر أستاذ أو جدولة تلقائية موسعة."
          >
            <PaymentTermsSettingsSection />
          </SectionCard>

          <SettingsOperationsSections
            activeSection={activeSection}
            draft={draft}
            preview={preview}
            isSaving={isSaving}
            authorization={authorization}
            authorizationDiagnostics={authorizationDiagnostics}
            user={user}
            theme={theme}
            pageLanguage={pageLanguage}
            onDraftChange={handleDraftChange}
            onToggleTheme={handleToggleTheme}
            onDefaultLanguageChange={handleDefaultLanguageChange}
          />
        </form>
      </div>

      <DirtyRouteNavigationGuard
        isDirty={isDirty}
        disabled={isSaving}
        onDiscard={discardDraft}
      />
    </SettingsVariantShell>
  );
}

export function SettingsPage() {
  return <SettingsWorkspace variant="standalone" />;
}
