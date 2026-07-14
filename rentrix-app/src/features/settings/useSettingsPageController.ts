import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { toast } from 'sonner';
import { formatCompanyDate, formatCompanyMoney } from '@/lib/companyFormatters';
import { normalizeCompanyLocale, type SupportedLanguage } from '@/lib/companySettings';
import { getAppLanguageState } from '@/lib/i18n';
import { useUiStore } from '@/store/ui-store';
import { useAuth } from '@/hooks/use-auth';
import { useBeforeUnloadGuard } from '@/hooks/use-unsaved-changes-guard';
import { useCompanySettings, useUpdateCompanySettings } from './useCompanySettings';
import type { SettingsSectionId } from './settingsSections';
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

/**
 * Owns all settings-page state: the company-settings draft lifecycle (load,
 * dirty tracking, discard-on-navigate), validation, save, logo upload, theme
 * and language toggles, and section-nav state. settings-page.tsx composes
 * this hook with presentational sections and stays render-only.
 */
export function useSettingsPageController() {
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

  return {
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
  };
}
