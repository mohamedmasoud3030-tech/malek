import { RefreshCcw, Save } from 'lucide-react';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DirtyRouteNavigationGuard } from '@/hooks/use-unsaved-changes-guard';
import { SectionTabs } from '@/components/ui/section-tabs';
import { CompanyProfileSections } from './components/company-profile-sections';
import { OverviewRow, SettingsHero } from './components/settings-hero';
import { SettingsOperationsSections } from './components/settings-operations-sections';
import { CostCentersSettingsSection } from './cost-centers-settings-section';
import { PaymentTermsSettingsSection } from './payment-terms-settings-section';
import { SectionCard } from './components/settings-section-card';
import { getCompanySettingsPreviewModel } from './settingsForm';
import { settingsSections } from './settingsSections';
import { useSettingsPageController } from './useSettingsPageController';

export function preventSettingsUnload(event: BeforeUnloadEvent) {
  event.preventDefault();
  event.returnValue = '';
}

// Re-exported for backward compatibility: settings-page.test.ts imports
// `settingsSections` from this module.
export { settingsSections };

export function SettingsPage() {
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
      <div className="space-y-4" dir={pageLanguage.direction} lang={pageLanguage.locale}>
        <SettingsHero companyName="—" hasUnsavedChanges={false} />
        <Card>
          <CardHeader>
            <CardTitle>تعذر تحميل إعدادات الشركة</CardTitle>
            <p className="text-sm text-muted-foreground">{companySettingsQuery.error instanceof Error ? companySettingsQuery.error.message : 'حدث خطأ غير متوقع أثناء تحميل الإعدادات.'}</p>
          </CardHeader>
          <CardContent>
            <Button onClick={handleRetryLoad}>
              <RefreshCcw className="me-2 size-4" />
              إعادة المحاولة
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (companySettingsQuery.isLoading || !draft) {
    return (
      <div className="space-y-4" dir={pageLanguage.direction} lang={pageLanguage.locale}>
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
      </div>
    );
  }

  const preview = getCompanySettingsPreviewModel(draft);
  const persistedOffice = Boolean(draft.company_name.trim());
  const persistedIdentity = Boolean(draft.currency && draft.locale && draft.timezone && draft.date_format && draft.number_format);
  const persistedDocuments = Boolean(draft.invoice_prefix.trim() && draft.contract_prefix.trim() && draft.receipt_prefix.trim());
  const persistedNotifications = draft.notification_email_enabled === 'true' || draft.notification_sms_enabled === 'true';
  const sessionTone = authorizationDiagnostics.metadataMismatch ? 'gold' : 'green';

  return (
    <PageLayout dir={pageLanguage.direction} lang={pageLanguage.locale} contentClassName="space-y-5">
      <SettingsHero companyName={preview.companyName} hasUnsavedChanges={isDirty} />

      <OverviewRow
        tiles={[
          { label: 'هوية المكتب',     value: persistedOffice ? 'مكتملة' : 'مطلوبة',    helper: preview.companyName, tone: persistedOffice ? 'green' : 'red' },
          { label: 'حالة المستندات',   value: persistedIdentity ? 'مكتملة' : 'مطلوبة',  helper: `العملة ${preview.defaultCurrency} · ${preview.locale}`, tone: persistedIdentity ? 'green' : 'gold' },
          { label: 'بادئات الإصدار',   value: persistedDocuments ? 'مكتملة' : 'مطلوبة', helper: `${preview.invoicePrefix} · ${preview.contractPrefix} · ${preview.receiptPrefix}`, tone: persistedDocuments ? 'green' : 'gold' },
          { label: 'الأمان والحساب',   value: authorization ? 'جلسة فعّالة' : 'مكشوف', helper: user?.email ?? 'لا يوجد بريد', tone: authorization ? 'green' : 'gold' },
          { label: 'الإشعارات',        value: persistedNotifications ? 'مفعّلة' : 'متوقفة', helper: persistedNotifications ? 'بعض القنوات مفعّلة' : 'كل القنوات متوقفة', tone: persistedNotifications ? 'green' : 'gray' },
          { label: 'حالة الجلسة',      value: authorizationDiagnostics.metadataMismatch ? 'تحتاج مراجعة' : 'صالحة', helper: `الدور: ${authorization?.role ?? authorizationDiagnostics.resolvedRole ?? 'غير محدد'}`, tone: sessionTone },
        ]}
      />

      <SectionTabs items={settingsSections} activeId={activeSection} onChange={handleJumpToSection} ariaLabel="أقسام الإعدادات" />

      <form className="space-y-4" onSubmit={handleSubmit}>
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

        <SectionCard id="cost-centers" activeId={activeSection} title="مراكز التكلفة" subtitle="تصنيف تشغيلي للمصروفات والتقارير حسب العقار أو النشاط بدون دفتر أستاذ عام.">
          <CostCentersSettingsSection />
        </SectionCard>

        <SectionCard id="payment-terms" activeId={activeSection} title="شروط السداد" subtitle="قوالب تشغيلية لاختيار جدول السداد في العقد بدون إنشاء دفتر أستاذ أو جدولة تلقائية موسعة.">
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

        <div className="sticky z-10 -mx-3 rounded-2xl border bg-card/95 px-3 py-3 shadow-lg backdrop-blur bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] sm:mx-0 sm:px-5 sm:bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={!isDirty || isSaving}>
              <Save className="me-2 size-4" />
              {isSaving ? 'جارٍ الحفظ...' : 'حفظ إعدادات الشركة'}
            </Button>
            <span className="text-[11px] font-bold text-muted-foreground">
              {isDirty ? 'توجد تغييرات غير محفوظة' : 'لا توجد تغييرات للحفظ'}
            </span>
            <span className="ms-auto text-[10px] text-muted-foreground">
              التغييرات تُحفظ في سجل إعدادات الشركة، وتُستخدم لاحقاً لقوالب المستندات.
            </span>
          </div>
        </div>
      </form>

      <DirtyRouteNavigationGuard
        isDirty={isDirty}
        disabled={isSaving}
        onDiscard={discardDraft}
      />
    </PageLayout>
  );
}
