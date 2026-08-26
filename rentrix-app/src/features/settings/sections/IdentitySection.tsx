import type { ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import {
  supportedCompanyLocales,
  supportedTimezones,
} from '@/lib/companySettings';
import { supportedCurrencies } from '@/lib/formatters';
import type { CompanySettingsDraft, CompanySettingsDraftField, CompanySettingsPreviewModel, CompanySettingsValidationErrors } from '../settingsForm';
import { useSettingsSection } from '../form/useSettingsSection';
import { FormField, PreviewField, SelectField } from '../components/settings-form-fields';
import { SectionCard } from '../components/settings-section-card';
import type { SettingsSectionId } from '../settingsSections';

const currencyOptions = supportedCurrencies;
const localeOptions = supportedCompanyLocales;
const numberFormatOptions = ['ar-OM', 'en-OM', 'ar', 'en-US'];
const dateFormatOptions = ['dd/MM/yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy'];
const timezoneOptions = supportedTimezones;

export type IdentitySectionProps = Readonly<{
  activeSection: SettingsSectionId;
  draft: CompanySettingsDraft;
  errors: CompanySettingsValidationErrors;
  isSaving: boolean;
  preview: CompanySettingsPreviewModel;
  formattedPreviewDate: string;
  formattedPreviewMoney: string;
  onDraftChange: (field: CompanySettingsDraftField, value: string) => void;
  onLogoFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
}>;

/**
 * WP-D D.2 — IdentitySection (الهوية والطباعة).
 *
 * Owns the identity slice of the company-settings draft: currency, locale,
 * timezone, display formats, and the logo — the branding contract used by
 * document templates and formatters. Includes the live date/money preview.
 */
export function IdentitySection({
  activeSection,
  draft,
  errors,
  isSaving,
  preview,
  formattedPreviewDate,
  formattedPreviewMoney,
  onDraftChange,
  onLogoFileChange,
}: IdentitySectionProps) {
  const section = useSettingsSection('identity', { draft, errors, isSaving, onDraftChange });

  return (
    <SectionCard id="identity" activeId={activeSection} title="الهوية والطباعة" subtitle="العملة، اللغة، الشعار، وصيغ الأرقام والتواريخ المعتمدة في المستندات.">
      <div className="grid gap-3 md:grid-cols-2">
        <SelectField label="العملة" field="currency" draft={section.draft} errors={section.errors} disabled={isSaving} options={currencyOptions} onChange={section.setField} />
        <SelectField label="المحلية" field="locale" draft={section.draft} errors={section.errors} disabled={isSaving} options={localeOptions} onChange={section.setField} />
        <SelectField label="المنطقة الزمنية" field="timezone" draft={section.draft} errors={section.errors} disabled={isSaving} options={timezoneOptions} onChange={section.setField} />
        <SelectField label="صيغة التاريخ" field="date_format" draft={section.draft} errors={section.errors} disabled={isSaving} options={dateFormatOptions} onChange={section.setField} />
        <SelectField label="صيغة الأرقام" field="number_format" draft={section.draft} errors={section.errors} disabled={isSaving} options={numberFormatOptions} onChange={section.setField} />
        <FormField label="رابط الشعار" field="logo_url" draft={section.draft} errors={section.errors} disabled={isSaving} type="url" placeholder="https://example.com/logo.png" onChange={section.setField} />
      </div>
      <label className="space-y-2 text-sm font-medium text-foreground">
        <span id="settings-logo-upload-label">رفع شعار الشركة</span>
        <Input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          disabled={isSaving}
          onChange={onLogoFileChange}
          aria-labelledby="settings-logo-upload-label"
        />
        <span className="block text-xs text-muted-foreground">يُحفظ الشعار كقيمة مضمنة صغيرة للحفاظ على المعاينة والمستندات بدون إعداد Storage إضافي.</span>
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
              <p className="text-xs text-muted-foreground">{preview.logoFallbackLabel}</p>
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
  );
}
