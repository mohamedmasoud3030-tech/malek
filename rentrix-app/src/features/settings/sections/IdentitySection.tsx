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
    <SectionCard id="identity" activeId={activeSection} title="الهوية والطباعة" subtitle="الشعار والعملة واللغة وصيغ الأرقام والتواريخ المستخدمة في المستندات.">
      <div className="grid grid-cols-2 gap-x-2.5 gap-y-2.5 sm:gap-3">
        <SelectField label="العملة" field="currency" draft={section.draft} errors={section.errors} disabled={isSaving} options={currencyOptions} onChange={section.setField} />
        <SelectField label="اللغة المحلية" field="locale" draft={section.draft} errors={section.errors} disabled={isSaving} options={localeOptions} onChange={section.setField} />
        <div className="col-span-2">
          <SelectField label="المنطقة الزمنية" field="timezone" draft={section.draft} errors={section.errors} disabled={isSaving} options={timezoneOptions} onChange={section.setField} />
        </div>
        <SelectField label="صيغة التاريخ" field="date_format" draft={section.draft} errors={section.errors} disabled={isSaving} options={dateFormatOptions} onChange={section.setField} />
        <SelectField label="صيغة الأرقام" field="number_format" draft={section.draft} errors={section.errors} disabled={isSaving} options={numberFormatOptions} onChange={section.setField} />
        <div className="col-span-2">
          <FormField label="رابط الشعار" field="logo_url" draft={section.draft} errors={section.errors} disabled={isSaving} type="url" placeholder="https://example.com/logo.png" onChange={section.setField} />
        </div>
      </div>

      <label className="block space-y-1 text-xs font-bold text-foreground">
        <span className="block px-0.5" id="settings-logo-upload-label">أو ارفع شعار الشركة</span>
        <Input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          disabled={isSaving}
          onChange={onLogoFileChange}
          aria-labelledby="settings-logo-upload-label"
          className="min-h-11 rounded-lg px-2 text-sm"
        />
        <span className="block px-0.5 text-[11px] font-medium text-muted-foreground">PNG أو JPG أو WebP أو SVG.</span>
      </label>

      <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2.5 rounded-xl border bg-muted/15 p-2.5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-3 sm:rounded-2xl sm:p-3">
        <div className="flex min-h-20 items-center justify-center rounded-lg border border-dashed bg-background/70 p-2 text-center sm:rounded-xl sm:p-3">
          {preview.logoUrl ? (
            <img src={preview.logoUrl} alt={`شعار ${preview.companyName}`} className="max-h-20 max-w-full rounded object-contain" />
          ) : (
            <div className="grid size-12 place-items-center rounded-xl bg-primary/10 text-sm font-black text-primary">
              {preview.companyName.slice(0, 2)}
            </div>
          )}
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-2">
          <PreviewField label="التاريخ" value={formattedPreviewDate} />
          <PreviewField label="المبلغ" value={formattedPreviewMoney} />
          <div className="sm:col-span-2">
            <PreviewField label="لغة المستندات" value={`${preview.defaultLanguage} (${preview.locale})`} />
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
