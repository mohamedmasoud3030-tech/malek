import type { ChangeEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  supportedCompanyLocales,
  supportedTimezones,
} from '@/lib/companySettings';
import { supportedCurrencies } from '@/lib/formatters';
import type { CompanySettingsDraft, CompanySettingsDraftField, CompanySettingsPreviewModel, CompanySettingsValidationErrors } from '../settingsForm';
import { useSettingsSection } from '../form/useSettingsSection';
import { SettingsFormField, SettingsPreviewField, SettingsSelectField } from '../components/settings-form-fields';
import { SectionCard } from '../components/settings-section-card';
import type { SettingsSectionId } from '../registry/sectionRegistry';

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

function IdentityPreview({
  preview,
  formattedPreviewDate,
  formattedPreviewMoney,
}: Readonly<{
  preview: CompanySettingsPreviewModel;
  formattedPreviewDate: string;
  formattedPreviewMoney: string;
}>) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 rounded-xl border bg-muted/15 p-2.5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-3 sm:p-3">
      <div className="flex min-h-20 items-center justify-center rounded-lg border border-dashed bg-background/70 p-2 text-center sm:rounded-xl sm:p-3">
        {preview.logoUrl ? (
          <img src={preview.logoUrl} alt={`شعار ${preview.companyName}`} loading="lazy" decoding="async" className="max-h-20 max-w-full rounded object-contain" />
        ) : (
          <div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-sm font-black text-primary sm:size-12">
            {preview.companyName.slice(0, 2)}
          </div>
        )}
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-2">
        <SettingsPreviewField label="التاريخ" value={formattedPreviewDate} />
        <SettingsPreviewField label="المبلغ" value={formattedPreviewMoney} />
        <div className="sm:col-span-2">
          <SettingsPreviewField label="لغة المستندات" value={`${preview.defaultLanguage} (${preview.locale})`} />
        </div>
      </div>
    </div>
  );
}

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
      <fieldset className="min-w-0 space-y-2.5">
        <legend className="mb-2 text-[11px] font-black text-muted-foreground">التنسيق واللغة</legend>
        <div className="grid grid-cols-2 gap-x-2.5 gap-y-2.5 sm:gap-3">
          <SettingsSelectField label="العملة" field="currency" draft={section.draft} errors={section.errors} disabled={isSaving} options={currencyOptions} onChange={section.setField} />
          <SettingsSelectField label="اللغة المحلية" field="locale" draft={section.draft} errors={section.errors} disabled={isSaving} options={localeOptions} onChange={section.setField} />
          <div className="col-span-2">
            <SettingsSelectField label="المنطقة الزمنية" field="timezone" draft={section.draft} errors={section.errors} disabled={isSaving} options={timezoneOptions} onChange={section.setField} />
          </div>
          <SettingsSelectField label="صيغة التاريخ" field="date_format" draft={section.draft} errors={section.errors} disabled={isSaving} options={dateFormatOptions} onChange={section.setField} />
          <SettingsSelectField label="صيغة الأرقام" field="number_format" draft={section.draft} errors={section.errors} disabled={isSaving} options={numberFormatOptions} onChange={section.setField} />
        </div>
      </fieldset>

      <fieldset className="min-w-0 space-y-2.5 border-t border-border/55 pt-3">
        <legend className="mb-2 text-[11px] font-black text-muted-foreground">شعار الشركة</legend>
        <SettingsFormField label="رابط الشعار" field="logo_url" draft={section.draft} errors={section.errors} disabled={isSaving} type="url" placeholder="https://example.com/logo.png" onChange={section.setField} />
        <label className="block space-y-1 text-xs font-bold text-foreground">
          <span className="block px-0.5" id="settings-logo-upload-label">أو ارفع ملفًا</span>
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
      </fieldset>

      <details className="group rounded-xl border border-border/70 bg-card lg:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-black [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">معاينة الهوية والطباعة</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="border-t border-border/60 p-2.5">
          <IdentityPreview preview={preview} formattedPreviewDate={formattedPreviewDate} formattedPreviewMoney={formattedPreviewMoney} />
        </div>
      </details>

      <div className="hidden lg:block">
        <IdentityPreview preview={preview} formattedPreviewDate={formattedPreviewDate} formattedPreviewMoney={formattedPreviewMoney} />
      </div>
    </SectionCard>
  );
}
