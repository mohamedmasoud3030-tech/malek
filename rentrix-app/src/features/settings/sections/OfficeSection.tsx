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
 *
 * Owns the office slice of the company-settings draft: identity and contact
 * fields bound to the saved company-settings record. Draft access, error
 * surfacing, and writes are isolated to this section's owned fields through
 * `useSettingsSection` — no other section can touch them.
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
    <SectionCard id="office" activeId={activeSection} title="بيانات المكتب" subtitle="الهوية الأساسية وبيانات التواصل المرتبطة بقوالب المستندات.">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-primary">
        الإعدادات هنا مرتبطة بسجل إعدادات الشركة المحفوظ، وليست حالة محلية مؤقتة.
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="اسم الشركة" field="company_name" draft={section.draft} errors={section.errors} disabled={isSaving} placeholder={APP_BRAND_NAME} onChange={section.setField} />
        <FormField label="الاسم القانوني" field="legal_name" draft={section.draft} errors={section.errors} disabled={isSaving} placeholder="الاسم القانوني للشركة" onChange={section.setField} />
        <FormField label="الرقم الضريبي" field="tax_number" draft={section.draft} errors={section.errors} disabled={isSaving} onChange={section.setField} />
        <FormField label="رقم السجل التجاري" field="registration_number" draft={section.draft} errors={section.errors} disabled={isSaving} onChange={section.setField} />
        <FormField label="الهاتف" field="phone" draft={section.draft} errors={section.errors} disabled={isSaving} onChange={section.setField} />
        <FormField label="البريد الإلكتروني" field="email" draft={section.draft} errors={section.errors} disabled={isSaving} type="email" placeholder="email@example.com" onChange={section.setField} />
        <FormField label="المدينة" field="city" draft={section.draft} errors={section.errors} disabled={isSaving} onChange={section.setField} />
        <SelectField label="الدولة" field="country" draft={section.draft} errors={section.errors} disabled={isSaving} options={countryOptions} onChange={section.setField} />
      </div>
      <label className="space-y-1 text-sm font-medium text-foreground">
        <span>العنوان</span>
        <Textarea
          value={section.draft.address}
          disabled={isSaving}
          aria-invalid={Boolean(section.errors.address)}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => section.setField('address', event.target.value)}
        />
        {section.errors.address ? <span className="block text-xs text-destructive">{section.errors.address}</span> : null}
      </label>
    </SectionCard>
  );
}
