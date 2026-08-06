import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CompanyProfileSections } from './components/company-profile-sections';
import { OverviewRow, SettingsHero } from './components/settings-hero';
import { SettingsAppearanceSection } from './components/settings-appearance-section';
import { SettingsSaveBar } from './components/settings-save-bar';
import { SettingsWorkspaceNav } from './components/settings-workspace-nav';
import {
  getCompanySettingsPreviewModel,
  type CompanySettingsDraft,
  type CompanySettingsDraftField,
} from './settingsForm';
import { buildSettingsSummaryTiles } from './settings-workspace-model';
import type { SettingsSectionId } from './settingsSections';

const initialDraft: CompanySettingsDraft = {
  company_name: 'Rentrix',
  legal_name: 'Rentrix Property Operations',
  tax_number: '',
  registration_number: '',
  phone: '+968 9000 0000',
  email: 'office@example.test',
  address: 'مسقط، سلطنة عمان',
  city: 'Muscat',
  country: 'OM',
  currency: 'OMR',
  locale: 'ar-OM',
  timezone: 'Asia/Muscat',
  date_format: 'dd/MM/yyyy',
  number_format: 'ar-OM',
  logo_url: '',
  invoice_prefix: 'INV',
  contract_prefix: 'CON',
  receipt_prefix: 'REC',
  default_vat_rate: '5',
  vat_enabled: 'true',
  vat_rate: '5',
  vat_registration_number: '',
  notification_email_enabled: 'true',
  notification_sms_enabled: 'false',
};

function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  const requestedTheme = new URLSearchParams(window.location.search).get('theme');
  return requestedTheme === 'dark' ? 'dark' : 'light';
}

export function SettingsWorkspaceE2EFixture() {
  const [baseDraft, setBaseDraft] = useState(initialDraft);
  const [draft, setDraft] = useState(initialDraft);
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('office');
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);
  const [submitCount, setSubmitCount] = useState(0);
  const isDirty = JSON.stringify(baseDraft) !== JSON.stringify(draft);
  const preview = useMemo(() => getCompanySettingsPreviewModel(draft), [draft]);
  const summaryTiles = buildSettingsSummaryTiles({
    draft,
    preview,
    isDirty,
    hasAuthorization: true,
    metadataMismatch: false,
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const handleDraftChange = (field: CompanySettingsDraftField, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitCount((current) => current + 1);
    setBaseDraft(draft);
  };

  return (
    <main
      className="fixed inset-0 z-[200] overflow-y-auto bg-background text-foreground"
      dir="rtl"
      data-e2e-settings-workspace
      data-visual-wave="malek-pro"
      data-submit-count={submitCount}
    >
      <div className="mx-auto min-w-0 max-w-[1500px] space-y-4 px-3 py-4 sm:px-6 lg:px-8">
        <SettingsHero companyName={preview.companyName} hasUnsavedChanges={isDirty} />
        <OverviewRow tiles={summaryTiles} />
        <SettingsSaveBar
          isDirty={isDirty}
          isSaving={false}
          onDiscard={() => setDraft(baseDraft)}
        />

        <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(230px,280px)_minmax(0,1fr)] md:items-start">
          <SettingsWorkspaceNav activeSection={activeSection} onChange={setActiveSection} />

          <form id="settings-company-form" className="min-w-0 space-y-4" onSubmit={handleSubmit}>
            <CompanyProfileSections
              activeSection={activeSection}
              draft={draft}
              errors={{}}
              isSaving={false}
              preview={preview}
              formattedPreviewDate="15/07/2026"
              formattedPreviewMoney="1,234.560 ر.ع."
              onDraftChange={handleDraftChange}
              onLogoFileChange={() => undefined}
            />
            <SettingsAppearanceSection
              activeSection={activeSection}
              preview={preview}
              theme={theme}
              pageLanguage={{ language: draft.locale.startsWith('ar') ? 'ar' : 'en' }}
              onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
              onDefaultLanguageChange={(language) => handleDraftChange('locale', language === 'ar' ? 'ar-OM' : 'en-OM')}
            />
          </form>
        </div>
      </div>
    </main>
  );
}
