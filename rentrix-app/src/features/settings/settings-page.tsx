import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { Building2, FileSignature, FolderTree, KeyRound, Lock, RefreshCcw, Save, ShieldCheck, Sparkles, Cog, Bell, User, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
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

type BaseFieldProps = Readonly<{
  label: string;
  field: CompanySettingsDraftField;
  draft: CompanySettingsDraft;
  errors: CompanySettingsValidationErrors;
  disabled: boolean;
  onChange: (field: CompanySettingsDraftField, value: string) => void;
}>;

type FormFieldProps = BaseFieldProps & Readonly<{
  placeholder?: string;
  type?: string;
}>;

function FormField({ label, field, draft, errors, disabled, placeholder, type = 'text', onChange }: FormFieldProps) {
  return (
    <label className="space-y-1 text-sm font-medium text-foreground">
      <span>{label}</span>
      <Input
        type={type}
        value={draft[field]}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={Boolean(errors[field])}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(field, event.target.value)}
      />
      {errors[field] ? <span className="block text-xs text-destructive">{errors[field]}</span> : null}
    </label>
  );
}

type SelectFieldProps = BaseFieldProps & Readonly<{
  options: readonly string[];
}>;

function SelectField({ label, field, draft, errors, disabled, options, onChange }: SelectFieldProps) {
  return (
    <label className="space-y-1 text-sm font-medium text-foreground">
      <span>{label}</span>
      <Select
        value={draft[field]}
        disabled={disabled}
        aria-invalid={Boolean(errors[field])}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(field, event.target.value)}
      >
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </Select>
      {errors[field] ? <span className="block text-xs text-destructive">{errors[field]}</span> : null}
    </label>
  );
}

type PreviewFieldProps = Readonly<{
  label: string;
  value: string;
  muted?: boolean;
}>;

function PreviewField({ label, value, muted = false }: PreviewFieldProps) {
  return (
    <div className="rounded-xl border bg-background/70 p-3">
      <dt className="text-[11px] font-bold text-muted-foreground">{label}</dt>
      <dd className={muted ? 'mt-1 text-sm text-muted-foreground' : 'mt-1 text-sm font-semibold text-foreground'}>
        {value}
      </dd>
    </div>
  );
}

// ── Section definitions ───────────────────────────────────────────────────────
//
// These drive both the in-page section nav and the actual content cards. Each
// section card is anchored by its id and renders only the persisted,
// editable fields. Non-persisted preferences stay informational.
export const settingsSections = [
  { id: 'office',      label: 'بيانات المكتب',        icon: Building2      },
  { id: 'identity',    label: 'الهوية والطباعة',      icon: FileSignature  },
  { id: 'documents',   label: 'العقود والفواتير',     icon: FileSignature  },
  { id: 'cost-centers', label: 'مراكز التكلفة',       icon: FolderTree     },
  { id: 'payment-terms', label: 'شروط السداد',        icon: CalendarClock  },
  { id: 'notifications', label: 'الإشعارات والتنبيهات', icon: Bell          },
  { id: 'security',    label: 'الأمان والحساب',       icon: ShieldCheck    },
  { id: 'role-simulator', label: 'محاكي الصلاحيات (Phase 6)', icon: Cog     },
  { id: 'system',      label: 'النظام والبيانات',     icon: Cog           },
] as const;

type SettingsSectionId = (typeof settingsSections)[number]['id'];


type SectionCardProps = Readonly<{
  id: SettingsSectionId;
  activeId: SettingsSectionId;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}>;

function SectionCard({ id, activeId, title, subtitle, children }: SectionCardProps) {
  return (
    <Card id={id} role="tabpanel" hidden={activeId !== id} className="scroll-mt-28 border-border/60">
      <CardHeader className="space-y-1 border-b border-border/60 bg-muted/20 px-4 py-3 sm:px-5">
        <CardTitle className="text-sm font-black">{title}</CardTitle>
        <p className="text-[11px] font-bold text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-3 p-4 sm:p-5">{children}</CardContent>
    </Card>
  );
}

function SettingsHero({ companyName, hasUnsavedChanges }: Readonly<{ companyName: string; hasUnsavedChanges: boolean }>) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 text-white sm:p-6">
      <div aria-hidden="true" className="pointer-events-none absolute -left-8 -top-8 size-40 rounded-full bg-primary/25 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-8 -right-4 size-32 rounded-full bg-violet-500/20 blur-3xl" />

      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-slate-300">
              <Sparkles className="size-4 text-primary" />
              مركز تحكم الإعدادات
            </p>
            <h1 className="mt-0.5 text-xl font-black sm:text-2xl">إعدادات المكتب</h1>
          </div>
          {hasUnsavedChanges ? (
            <StatusBadge tone="gold">تغييرات غير محفوظة</StatusBadge>
          ) : (
            <StatusBadge tone="green">كل الإعدادات محفوظة</StatusBadge>
          )}
        </div>

        <div className="mt-4 flex items-end gap-3">
          <div>
            <p className="text-3xl font-black tabular-nums sm:text-4xl">{companyName}</p>
            <p className="text-xs font-semibold text-slate-400">هوية الشركة المعتمدة حالياً</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold text-slate-300">
          <span className="rounded-full bg-white/10 px-3 py-1.5">
            بيانات موثقة
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1.5">
            مرجع لقوالب المستندات
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1.5">
            مصدر تفضيلات اللغة والسمة
          </span>
        </div>
      </div>
    </div>
  );
}

type OverviewTile = Readonly<{ label: string; value: string; helper: string; tone: 'green' | 'blue' | 'gold' | 'red' | 'gray' }>;

function OverviewRow({ tiles }: Readonly<{ tiles: readonly OverviewTile[] }>) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-2xl border border-border/60 bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold text-muted-foreground">{tile.label}</p>
            <StatusBadge tone={tile.tone}>{tile.value}</StatusBadge>
          </div>
          <p className="mt-2 text-base font-black text-foreground">{tile.helper}</p>
        </div>
      ))}
    </div>
  );
}

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
            <span>رفع شعار الشركة</span>
            <Input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" disabled={isSaving} onChange={handleLogoFileChange} />
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
            <FormField label="ضريبة القيمة المضافة الافتراضية %" field="default_vat_rate" draft={draft} errors={errors} disabled={isSaving} type="number" onChange={handleDraftChange} />
            <FormField label="نسبة VAT التشغيلية %" field="vat_rate" draft={draft} errors={errors} disabled={isSaving} type="number" onChange={handleDraftChange} />
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
