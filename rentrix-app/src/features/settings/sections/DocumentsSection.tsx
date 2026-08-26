import type { CompanySettingsDraft, CompanySettingsDraftField, CompanySettingsValidationErrors } from '../settingsForm';
import { useSettingsSection } from '../form/useSettingsSection';
import { FormField } from '../components/settings-form-fields';
import { SectionCard } from '../components/settings-section-card';
import type { SettingsSectionId } from '../settingsSections';

export type DocumentsSectionProps = Readonly<{
  activeSection: SettingsSectionId;
  draft: CompanySettingsDraft;
  errors: CompanySettingsValidationErrors;
  isSaving: boolean;
  onDraftChange: (field: CompanySettingsDraftField, value: string) => void;
}>;

/**
 * WP-D D.2 — DocumentsSection (المستندات والضريبة).
 *
 * Owns the documents slice of the company-settings draft: document prefixes
 * and reference VAT data kept for legacy compatibility. The actual tax policy
 * is decided by the dated tax-authority engines — this section only mirrors
 * reference values, exactly as before.
 */
export function DocumentsSection({
  activeSection,
  draft,
  errors,
  isSaving,
  onDraftChange,
}: DocumentsSectionProps) {
  const section = useSettingsSection('documents', { draft, errors, isSaving, onDraftChange });

  return (
    <SectionCard id="documents" activeId={activeSection} title="المستندات والضريبة" subtitle="بادئات المستندات وبيانات VAT المرجعية المتوافقة مع السجلات القديمة؛ لا تحدد هذه القيم وحدها ضريبة الفواتير أو أتعاب الإدارة.">
      <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs font-semibold leading-6 text-foreground md:col-span-2">
        <strong>مصدر الضريبة الفعلي:</strong> محرك المالية يستخدم سياسة ضريبة إيجار معتمدة ومؤرخة، وسياسة مستقلة لضريبة أتعاب الإدارة. تغيير نسب VAT المرجعية هنا لا يُنشئ أو يفعّل تلك السياسات ولا يغيّر الضريبة المحاسبية للفواتير المنشورة.
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="بادئة الفواتير" field="invoice_prefix" draft={section.draft} errors={section.errors} disabled={isSaving} onChange={section.setField} />
        <FormField label="بادئة العقود" field="contract_prefix" draft={section.draft} errors={section.errors} disabled={isSaving} onChange={section.setField} />
        <FormField label="بادئة الإيصالات" field="receipt_prefix" draft={section.draft} errors={section.errors} disabled={isSaving} onChange={section.setField} />
        <FormField label="VAT مرجعية للتوافق %" field="default_vat_rate" draft={section.draft} errors={section.errors} disabled={isSaving} type="number" inputMode="decimal" onChange={section.setField} />
        <FormField label="VAT تشغيلية قديمة للتوافق %" field="vat_rate" draft={section.draft} errors={section.errors} disabled={isSaving} type="number" inputMode="decimal" onChange={section.setField} />
        <FormField label="رقم تسجيل VAT" field="vat_registration_number" draft={section.draft} errors={section.errors} disabled={isSaving} onChange={section.setField} />
        <label className="flex items-center gap-2 rounded-xl border bg-background/70 p-3 text-sm font-medium md:col-span-2">
          <input
            type="checkbox"
            checked={section.draft.vat_enabled === 'true'}
            disabled={isSaving}
            onChange={(event) => section.setField('vat_enabled', String(event.target.checked))}
          />
          <span>مؤشر VAT مرجعي للتوافق مع السجلات والتقارير القديمة</span>
        </label>
      </div>
    </SectionCard>
  );
}
