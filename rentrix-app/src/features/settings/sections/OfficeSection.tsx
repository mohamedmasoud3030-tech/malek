import type { ChangeEvent } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { APP_BRAND_NAME } from '@/lib/brand';
import { supportedCountries } from '@/lib/companySettings';
import type { CompanySettingsDraft, CompanySettingsDraftField, CompanySettingsValidationErrors } from '../settingsForm';
import { useSettingsSection } from '../form/useSettingsSection';
import { FormField, SelectField } from '../components/settings-form-fields';
import { SectionCard } from '../components/settings-section-card';
import type { SettingsSectionId } from '../settingsSections';

const countryOptions = supportedCountries;

export type OfficeSectionProps = Readonly<{
  activeSection: SettingsSectionId;
  draft: CompanySettingsDraft;
  errors: CompanySettingsValidationErrors;
  isSaving: boolean;
  onDraftChange: (field: CompanySettingsDraftField, value: string) => void;
}>;

/**
 * WP-D D.2 — OfficeSection (بيانات المكتب).
 * Owns the office slice of the company-settings draft through
 * `useSettingsSection`; no other section can mutate these fields.
 */
export function OfficeSection({
  activeSection,
  draft,
  errors,
  isSaving,
  onDraftChange,
}: OfficeSectionProps) {
  const section = useSettingsSection('office', { draft, errors, isSaving, onDraftChange });

  return (
    <SectionCard id="office" activeId={activeSection} title="بيانات المكتب" subtitle="الهوية الأساسية وبيانات التواصل المستخدمة في المستندات.">
      <div className="grid grid-cols-2 gap-x-2.5 gap-y-2.5 sm:gap-3">
        <div className="col-span-2 sm:col-span-1">
          <FormField label="اسم الشركة" field="company_name" draft={section.draft} errors={section.errors} disabled={isSaving} placeholder={APP_BRAND_NAME} onChange={section.setField} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <FormField label="الاسم القانوني" field="legal_name" draft={section.draft} errors={section.errors} disabled={isSaving} placeholder="الاسم القانوني للشركة" onChange={section.setField} />
        </div>
        <FormField label="الرقم الضريبي" field="tax_number" draft={section.draft} errors={section.errors} disabled={isSaving} onChange={section.setField} />
        <FormField label="السجل التجاري" field="registration_number" draft={section.draft} errors={section.errors} disabled={isSaving} onChange={section.setField} />
        <FormField label="الهاتف" field="phone" draft={section.draft} errors={section.errors} disabled={isSaving} onChange={section.setField} />
        <FormField label="المدينة" field="city" draft={section.draft} errors={section.errors} disabled={isSaving} onChange={section.setField} />
        <div className="col-span-2 sm:col-span-1">
          <FormField label="البريد الإلكتروني" field="email" draft={section.draft} errors={section.errors} disabled={isSaving} type="email" placeholder="email@example.com" onChange={section.setField} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <SelectField label="الدولة" field="country" draft={section.draft} errors={section.errors} disabled={isSaving} options={countryOptions} onChange={section.setField} />
        </div>
      </div>
      <label className="block space-y-1 text-xs font-bold text-foreground">
        <span className="block px-0.5">العنوان</span>
        <Textarea
          className="min-h-20 rounded-lg px-3 py-2 text-sm"
          value={section.draft.address}
          disabled={isSaving}
          aria-invalid={Boolean(section.errors.address)}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => section.setField('address', event.target.value)}
        />
        {section.errors.address ? <span className="block px-0.5 text-[11px] text-destructive">{section.errors.address}</span> : null}
      </label>
    </SectionCard>
  );
}
