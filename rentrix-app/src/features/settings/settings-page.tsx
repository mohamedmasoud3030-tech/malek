import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { KeyRound, RefreshCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SectionTabPanel, SectionTabs } from '@/components/ui/section-tabs';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { DirtyRouteNavigationGuard, useBeforeUnloadGuard } from '@/hooks/use-unsaved-changes-guard';
import { formatCompanyDate, formatCompanyMoney } from '@/lib/companyFormatters';
import {
  normalizeCompanyLocale,
  supportedCompanyLocales,
  supportedCountries,
  supportedTimezones,
  type SupportedLanguage,
} from '@/lib/companySettings';
import { supportedCurrencies } from '@/lib/formatters';
import { getAppLanguageState } from '@/lib/i18n';
import { useUiStore } from '@/store/ui-store';
import { useCompanySettings, useUpdateCompanySettings } from './useCompanySettings';
import { CostCentersSettingsSection } from './cost-centers-settings-section';
import { PaymentTermsSettingsSection } from './payment-terms-settings-section';
import { RoleSimulatorSection } from './role-simulator-section';
import { settingsSections, type SettingsSectionId } from './settingsSections';
import { FormField, PreviewField, SelectField } from './components/settings-form-fields';
import { OverviewRow, SettingsHero } from './components/settings-hero';
import { SectionCard } from './components/settings-section-card';
import {
  areCompanySettingsDraftsEqual,
  companySettingsDraftToLocalSettings,
  companySettingsDraftToPayload,
  companySettingsRecordToDraft,
  getCompanySettingsPreviewModel,
  hasCompanySettingsValidationErrors,
  validateCompanySettingsDraft,
  type CompanySettingsDraft,
  type CompanySettingsDraftField,
  type CompanySettingsValidationErrors,
} from './settingsForm';

const currencyOptions = supportedCurrencies;
const localeOptions = supportedCompanyLocales;
const countryOptions = supportedCountries;
const numberFormatOptions = ['ar-OM', 'en-OM', 'ar', 'en-US'];
const dateFormatOptions = ['dd/MM/yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy'];
const timezoneOptions = supportedTimezones;

export function preventSettingsUnload(event: BeforeUnloadEvent) {
  event.preventDefault();
  event.returnValue = '';
}

// Re-exported for backward compatibility: settings-page.test.ts imports
// `settingsSections` from this module.
export { settingsSections };

export function SettingsPage() {
  const { theme, setTheme } = useUiStore();
  const { authorization, authorizationDiagnostics, user } = useAuth();
  const companySettingsQuery = useCompanySettings();
  const updateCompanySettingsMutation = useUpdateCompanySettings();
  const [baseDraft, setBaseDraft] = useState<CompanySettingsDraft | null>(null);
  const [draft, setDraft] = useState<CompanySettingsDraft | null>(null);
  const baseDraftRef = useRef<CompanySettingsDraft | null>(null);
  const draftRef = useRef<CompanySettingsDraft | null>(null);
  const [errors, setErrors] = useState<CompanySettingsValidationErrors>({});
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('office');

  const isDirty = !areCompanySettingsDraftsEqual(draft, baseDraft);
  const isSaving = updateCompanySettingsMutation.isPending;

  useBeforeUnloadGuard(isDirty);

  const discardDraft = () => {
    const currentBaseDraft = baseDraftRef.current;
    if (!currentBaseDraft) return;
    draftRef.current = currentBaseDraft;
    setDraft(currentBaseDraft);
    setErrors({});
  };

  useEffect(() => {
    if (!companySettingsQuery.data) return;

    const currentDraft = draftRef.current;
    const currentBaseDraft = baseDraftRef.current;
    const nextDraft = companySettingsRecordToDraft(companySettingsQuery.data);
    const hasUnsavedDraft = Boolean(
      currentDraft
        && currentBaseDraft
        && !areCompanySettingsDraftsEqual(currentDraft, currentBaseDraft),
    );

    baseDraftRef.current = nextDraft;
    setBaseDraft(nextDraft);

    if (!hasUnsavedDraft) {
      draftRef.current = nextDraft;
      setDraft(nextDraft);
    }
  }, [companySettingsQuery.data]);

  const previewSettings = useMemo(() => draft ? companySettingsDraftToLocalSettings(draft) : null, [draft]);
  const pageLanguage = getAppLanguageState(previewSettings?.defaultLanguage);
  const formattedPreviewDate = previewSettings ? formatCompanyDate(previewSettings, new Date()) : '—';
  const formattedPreviewMoney = previewSettings ? formatCompanyMoney(previewSettings, 1234.56) : '—';

  const handleDraftChange = (field: CompanySettingsDraftField, value: string) => {
    setDraft((currentDraft) => {
      const nextDraft = currentDraft ? { ...currentDraft, [field]: value } : currentDraft;
      draftRef.current = nextDraft;
      return nextDraft;
    });
    setErrors((currentErrors) => {
      if (!currentErrors[field]) return currentErrors;
      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const handleRetryLoad = async () => {
    await companySettingsQuery.refetch();
  };

  const handleToggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleDefaultLanguageChange = (language: SupportedLanguage) => {
    handleDraftChange('locale', normalizeCompanyLocale(undefined, language));
  };

  const handleLogoFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      toast.error('يرجى اختيار ملف شعار بصيغة PNG أو JPG أو WEBP أو SVG');
      event.target.value = '';
      return;
    }

    if (file.size > 256 * 1024) {
      toast.error('حجم الشعار يجب ألا يتجاوز 256 كيلوبايت');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      handleDraftChange('logo_url', reader.result);
      toast.success('تم تجهيز الشعار للمعاينة. اضغط حفظ لتثبيته.');
    };
    reader.onerror = () => toast.error('تعذر قراءة ملف الشعار');
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;

    const validationErrors = validateCompanySettingsDraft(draft);
    setErrors(validationErrors);
    if (hasCompanySettingsValidationErrors(validationErrors)) {
      toast.error('يرجى تصحيح أخطاء إعدادات الشركة قبل الحفظ');
      return;
    }

    try {
      const savedSettings = await updateCompanySettingsMutation.mutateAsync(companySettingsDraftToPayload(draft));
      const savedDraft = companySettingsRecordToDraft(savedSettings);
      baseDraftRef.current = savedDraft;
      draftRef.current = savedDraft;
      setBaseDraft(savedDraft);
      setDraft(savedDraft);
      toast.success('تم حفظ إعدادات الشركة بنجاح');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر حفظ إعدادات الشركة');
    }
  };

  const handleJumpToSection = (id: SettingsSectionId) => {
    setActiveSection(id);
  };

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
        <SectionCard id="office" activeId={activeSection} title="بيانات المكتب" subtitle="الهوية الأساسية وبيانات التواصل المرتبطة بقوالب المستندات.">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-primary">
            الإعدادات هنا مرتبطة بسجل إعدادات الشركة المحفوظ، وليست حالة محلية مؤقتة.
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="اسم الشركة" field="company_name" draft={draft} errors={errors} disabled={isSaving} placeholder="Rentrix" onChange={handleDraftChange} />
            <FormField label="الاسم القانوني" field="legal_name" draft={draft} errors={errors} disabled={isSaving} placeholder="الاسم القانوني للشركة" onChange={handleDraftChange} />
            <FormField label="الرقم الضريبي" field="tax_number" draft={draft} errors={errors} disabled={isSaving} onChange={handleDraftChange} />
            <FormField label="رقم السجل التجاري" field="registration_number" draft={draft} errors={errors} disabled={isSaving} onChange={handleDraftChange} />
            <FormField label="الهاتف" field="phone" draft={draft} errors={errors} disabled={isSaving} onChange={handleDraftChange} />
            <FormField label="البريد الإلكتروني" field="email" draft={draft} errors={errors} disabled={isSaving} type="email" placeholder="email@example.com" onChange={handleDraftChange} />
            <FormField label="المدينة" field="city" draft={draft} errors={errors} disabled={isSaving} onChange={handleDraftChange} />
            <SelectField label="الدولة" field="country" draft={draft} errors={errors} disabled={isSaving} options={countryOptions} onChange={handleDraftChange} />
          </div>
          <label className="space-y-1 text-sm font-medium text-foreground">
            <span>العنوان</span>
            <Textarea
              value={draft.address}
              disabled={isSaving}
              aria-invalid={Boolean(errors.address)}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => handleDraftChange('address', event.target.value)}
            />
            {errors.address ? <span className="block text-xs text-destructive">{errors.address}</span> : null}
          </label>
        </SectionCard>

        <SectionCard id="identity" activeId={activeSection} title="الهوية والطباعة" subtitle="العملة، اللغة، الشعار، وصيغ الأرقام والتواريخ المعتمدة في المستندات.">
          <div className="grid gap-3 md:grid-cols-2">
            <SelectField label="العملة" field="currency" draft={draft} errors={errors} disabled={isSaving} options={currencyOptions} onChange={handleDraftChange} />
            <SelectField label="المحلية" field="locale" draft={draft} errors={errors} disabled={isSaving} options={localeOptions} onChange={handleDraftChange} />
            <SelectField label="المنطقة الزمنية" field="timezone" draft={draft} errors={errors} disabled={isSaving} options={timezoneOptions} onChange={handleDraftChange} />
            <SelectField label="صيغة التاريخ" field="date_format" draft={draft} errors={errors} disabled={isSaving} options={dateFormatOptions} onChange={handleDraftChange} />
            <SelectField label="صيغة الأرقام" field="number_format" draft={draft} errors={errors} disabled={isSaving} options={numberFormatOptions} onChange={handleDraftChange} />
            <FormField label="رابط الشعار" field="logo_url" draft={draft} errors={errors} disabled={isSaving} type="url" placeholder="https://example.com/logo.png" onChange={handleDraftChange} />
          </div>
          <label className="space-y-2 text-sm font-medium text-foreground">
            <span id="settings-logo-upload-label">رفع شعار الشركة</span>
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              disabled={isSaving}
              onChange={handleLogoFileChange}
              aria-labelledby="settings-logo-upload-label"
            />
            <span className="block text-[11px] text-muted-foreground">يُحفظ الشعار كقيمة مضمنة صغيرة للحفاظ على المعاينة والمستندات بدون إعداد Storage إضافي.</span>
          </label>
          <div className="grid gap-3 rounded-2xl border bg-muted/20 p-3 md:grid-cols-3">
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-background/70 p-4 text-center">
              {preview.logoUrl ? (
                <img src={preview.logoUrl} alt={`شعار ${preview.companyName}`} className="max-h-24 max-w-full rounded-lg object-contain" />
              ) : (
                <>
                  <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-base font-black text-primary">
                    {preview.companyName.slice(0, 2)}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{preview.logoFallbackLabel}</p>
                </>
              )}
            </div>
            <div className="grid gap-2 md:col-span-2">
              <PreviewField label="معاينة التاريخ" value={formattedPreviewDate} />
              <PreviewField label="معاينة المبلغ" value={formattedPreviewMoney} />
              <PreviewField label="اللغة المعتمدة" value={`${preview.defaultLanguage} (${preview.locale})`} />
            </div>
          </div>
        </SectionCard>

        <SectionCard id="documents" activeId={activeSection} title="العقود والفواتير" subtitle="بادئات المستندات والضريبة الافتراضية المطبّقة على الفواتير والعقود الجديدة.">
          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="بادئة الفواتير" field="invoice_prefix" draft={draft} errors={errors} disabled={isSaving} onChange={handleDraftChange} />
            <FormField label="بادئة العقود" field="contract_prefix" draft={draft} errors={errors} disabled={isSaving} onChange={handleDraftChange} />
            <FormField label="بادئة الإيصالات" field="receipt_prefix" draft={draft} errors={errors} disabled={isSaving} onChange={handleDraftChange} />
            <FormField label="ضريبة القيمة المضافة الافتراضية %" field="default_vat_rate" draft={draft} errors={errors} disabled={isSaving} type="number" inputMode="decimal" onChange={handleDraftChange} />
            <FormField label="نسبة VAT التشغيلية %" field="vat_rate" draft={draft} errors={errors} disabled={isSaving} type="number" inputMode="decimal" onChange={handleDraftChange} />
            <FormField label="رقم تسجيل VAT" field="vat_registration_number" draft={draft} errors={errors} disabled={isSaving} onChange={handleDraftChange} />
            <label className="flex items-center gap-2 rounded-xl border bg-background/70 p-3 text-sm font-medium md:col-span-2">
              <input
                type="checkbox"
                checked={draft.vat_enabled === 'true'}
                disabled={isSaving}
                onChange={(event) => handleDraftChange('vat_enabled', String(event.target.checked))}
              />
              <span>تفعيل VAT في إعدادات المكتب والتقارير</span>
            </label>
          </div>
        </SectionCard>

        <SectionCard id="cost-centers" activeId={activeSection} title="مراكز التكلفة" subtitle="تصنيف تشغيلي للمصروفات والتقارير حسب العقار أو النشاط بدون دفتر أستاذ عام.">
          <CostCentersSettingsSection />
        </SectionCard>

        <SectionCard id="payment-terms" activeId={activeSection} title="شروط السداد" subtitle="قوالب تشغيلية لاختيار جدول السداد في العقد بدون إنشاء دفتر أستاذ أو جدولة تلقائية موسعة.">
          <PaymentTermsSettingsSection />
        </SectionCard>

        <SectionCard id="notifications" activeId={activeSection} title="الإشعارات والمتابعة" subtitle="تفضيلات الإشعارات المسجلة حالياً. تُحفظ في سجل إعدادات المكتب.">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 rounded-xl border bg-background/70 p-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={draft.notification_email_enabled === 'true'}
                disabled={isSaving}
                onChange={(event) => handleDraftChange('notification_email_enabled', String(event.target.checked))}
              />
              <span>تفعيل إشعارات البريد الإلكتروني</span>
            </label>
            <label className="flex items-center gap-2 rounded-xl border bg-background/70 p-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={draft.notification_sms_enabled === 'true'}
                disabled={isSaving}
                onChange={(event) => handleDraftChange('notification_sms_enabled', String(event.target.checked))}
              />
              <span>تفعيل إشعارات الرسائل النصية</span>
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">
            ملخص الإشعارات المعتمد: {preview.notificationSummary}.
          </p>
        </SectionCard>

        <SectionCard id="security" activeId={activeSection} title="الأمان والحساب" subtitle="معلومات الجلسة الحالية وصلاحيات العرض. تغيير كلمة المرور منفصل ومؤمَّن.">
          <div className="grid gap-3 md:grid-cols-2">
            <PreviewField label="البريد الإلكتروني للمستخدم" value={user?.email ?? 'غير متاح'} muted={!user?.email} />
            <PreviewField
              label="الدور resolved role"
              value={authorization?.role ?? authorizationDiagnostics.resolvedRole ?? 'غير محدد'}
              muted={!authorization?.role && !authorizationDiagnostics.resolvedRole}
            />
            <PreviewField
              label="حالة بيانات الدور"
              value={authorizationDiagnostics.metadataMismatch ? 'تحتاج مراجعة metadata' : 'صالحة حسب الجلسة'}
              muted={authorizationDiagnostics.metadataMismatch}
            />
            <PreviewField label="حالة الجلسة" value={user ? 'نشطة' : 'غير متاحة'} muted={!user} />
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-background/70 p-3">
            <StatusBadge tone={sessionTone}>{authorizationDiagnostics.metadataMismatch ? 'تحذير صلاحيات' : 'جلسة آمنة'}</StatusBadge>
            <p className="text-[12px] text-muted-foreground">
              هذه القيم تعكس الجلسة الحالية فقط، ولا يتم تخزينها في سجل إعدادات الشركة.
            </p>
            <Button asChild variant="secondary" className="ms-auto">
              <Link to="/change-password">
                <KeyRound className="me-2 size-4" />
                تغيير كلمة المرور
              </Link>
            </Button>
          </div>
        </SectionCard>

        <SectionCard id="role-simulator" activeId={activeSection} title="محاكي الصلاحيات وأدوار الموظفين" subtitle="تبديل الدور الفعلي لاختبار سلوك الصلاحيات في النظام.">
          <RoleSimulatorSection />
        </SectionCard>

        <SectionCard id="system" activeId={activeSection} title="النظام والبيانات" subtitle="تفضيلات التطبيق المحلية (السمة، لغة الواجهة). المعاينة أدناه توضح أثر الإعدادات على العرض.">
          <div className="grid gap-3 rounded-2xl border bg-muted/20 p-3 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-sm font-black">تفضيلات الواجهة</p>
              <p className="text-[11px] text-muted-foreground">اللغة والسمة تُحفظان محلياً ولا تُسجَّلان ضمن إعدادات الشركة.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant={pageLanguage.language === 'ar' ? 'primary' : 'secondary'} onClick={() => handleDefaultLanguageChange('ar')}>AR</Button>
              <Button variant={pageLanguage.language === 'en' ? 'primary' : 'secondary'} onClick={() => handleDefaultLanguageChange('en')}>EN</Button>
              <Button variant="secondary" onClick={handleToggleTheme}>تبديل السمة ({theme === 'dark' ? 'داكنة' : 'فاتحة'})</Button>
            </div>
          </div>
          <details className="rounded-2xl border bg-muted/20 p-3 [&[open]>summary]:mb-2">
            <summary className="cursor-pointer text-sm font-black">معاينة أثر الإعدادات</summary>
            <dl className="grid gap-3 pt-2 md:grid-cols-2">
              <PreviewField label="اسم الشركة" value={preview.companyName} />
              <PreviewField label="الاسم القانوني" value={preview.legalName} muted={preview.legalName === 'غير محدد'} />
              <PreviewField label="اللغة الافتراضية" value={`${preview.defaultLanguage} (${preview.locale})`} />
              <PreviewField label="العملة الافتراضية" value={preview.defaultCurrency} />
              <PreviewField label="الدولة" value={preview.country} />
              <PreviewField label="المنطقة الزمنية" value={preview.timezone} />
              <PreviewField label="بادئة الفواتير" value={preview.invoicePrefix} />
              <PreviewField label="بادئة العقود" value={preview.contractPrefix} />
              <PreviewField label="بادئة الإيصالات" value={preview.receiptPrefix} />
              <PreviewField label="ضريبة القيمة المضافة الافتراضية" value={preview.defaultVatRate} />
            </dl>
          </details>
        </SectionCard>

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
