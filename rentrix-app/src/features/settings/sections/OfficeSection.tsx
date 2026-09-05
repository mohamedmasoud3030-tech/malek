import type { ChangeEvent } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { OfficeLaunchPanel } from '../office-launch/OfficeLaunchPanel';
import { APP_BRAND_NAME } from '@/lib/brand';
import { supportedCountries } from '@/lib/companySettings';
import type { CompanySettingsDraft, CompanySettingsDraftField, CompanySettingsValidationErrors } from '../settingsForm';
import { useSettingsSection } from '../form/useSettingsSection';
import { SettingsFormField, SettingsSelectField } from '../components/settings-form-fields';
import { SectionCard } from '../components/settings-section-card';
import type { SettingsSectionId } from '../registry/sectionRegistry';

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
      <fieldset className="min-w-0 space-y-2.5">
        <legend className="mb-2 text-[11px] font-black text-muted-foreground">الهوية القانونية</legend>
        <div className="grid grid-cols-2 gap-x-2.5 gap-y-2.5 sm:gap-3">
          <div className="col-span-2 sm:col-span-1">
            <SettingsFormField label="اسم الشركة" field="company_name" draft={section.draft} errors={section.errors} disabled={isSaving} placeholder={APP_BRAND_NAME} onChange={section.setField} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <SettingsFormField label="الاسم القانوني" field="legal_name" draft={section.draft} errors={section.errors} disabled={isSaving} placeholder="الاسم القانوني للشركة" onChange={section.setField} />
          </div>
          <SettingsFormField label="الرقم الضريبي" field="tax_number" draft={section.draft} errors={section.errors} disabled={isSaving} onChange={section.setField} />
          <SettingsFormField label="السجل التجاري" field="registration_number" draft={section.draft} errors={section.errors} disabled={isSaving} onChange={section.setField} />
        </div>
      </fieldset>

      <fieldset className="min-w-0 space-y-2.5 border-t border-border/55 pt-3">
        <legend className="mb-2 text-[11px] font-black text-muted-foreground">التواصل والموقع</legend>
        <div className="grid grid-cols-2 gap-x-2.5 gap-y-2.5 sm:gap-3">
          <SettingsFormField label="الهاتف" field="phone" draft={section.draft} errors={section.errors} disabled={isSaving} onChange={section.setField} />
          <SettingsFormField label="المدينة" field="city" draft={section.draft} errors={section.errors} disabled={isSaving} onChange={section.setField} />
          <div className="col-span-2 sm:col-span-1">
            <SettingsFormField label="البريد الإلكتروني" field="email" draft={section.draft} errors={section.errors} disabled={isSaving} type="email" placeholder="email@example.com" onChange={section.setField} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <SettingsSelectField label="الدولة" field="country" draft={section.draft} errors={section.errors} disabled={isSaving} options={countryOptions} onChange={section.setField} />
          </div>
        </div>
      </fieldset>

      <fieldset className="min-w-0 border-t border-border/55 pt-3">
        <legend className="mb-2 text-[11px] font-black text-muted-foreground">العنوان</legend>
        <label className="block space-y-1 text-xs font-bold text-foreground">
          <span className="sr-only">العنوان الكامل</span>
          <Textarea
            className="min-h-20 rounded-lg px-3 py-2 text-sm"
            value={section.draft.address}
            disabled={isSaving}
            aria-label="العنوان الكامل"
            aria-invalid={Boolean(section.errors.address)}
            placeholder="المنطقة، الشارع، المبنى"
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => section.setField('address', event.target.value)}
          />
          {section.errors.address ? <span className="block px-0.5 text-[11px] text-destructive">{section.errors.address}</span> : null}
        </label>
      </fieldset>

      <OfficeLaunchPanel draft={draft} />
    </SectionCard>
  );
}
