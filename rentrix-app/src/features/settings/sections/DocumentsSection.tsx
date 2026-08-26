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

export function DocumentsSection({
  activeSection,
  draft,
  errors,
  isSaving,
  onDraftChange,
}: DocumentsSectionProps) {
  const section = useSettingsSection('documents', { draft, errors, isSaving, onDraftChange });

  return (
    <SectionCard id="documents" activeId={activeSection} title="المستندات والضريبة" subtitle="بادئات المستندات وبيانات VAT المرجعية للتوافق مع السجلات الحالية.">
      <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-[11px] font-semibold leading-5 text-foreground sm:rounded-xl sm:text-xs">
        <strong>تنبيه:</strong> نسب VAT هنا مرجعية للتوافق فقط. الضريبة المحاسبية الفعلية تعتمد على سياسة المالية المعتمدة.
      </div>

      <div className="grid grid-cols-2 gap-x-2.5 gap-y-2.5 sm:gap-3">
        <FormField label="بادئة الفواتير" field="invoice_prefix" draft={section.draft} errors={section.errors} disabled={isSaving} onChange={section.setField} />
        <FormField label="بادئة الإيصالات" field="receipt_prefix" draft={section.draft} errors={section.errors} disabled={isSaving} onChange={section.setField} />
        <div className="col-span-2 sm:col-span-1">
          <FormField label="بادئة العقود" field="contract_prefix" draft={section.draft} errors={section.errors} disabled={isSaving} onChange={section.setField} />
        </div>
        <FormField label="VAT مرجعية %" field="default_vat_rate" draft={section.draft} errors={section.errors} disabled={isSaving} type="number" inputMode="decimal" onChange={section.setField} />
        <FormField label="VAT قديمة %" field="vat_rate" draft={section.draft} errors={section.errors} disabled={isSaving} type="number" inputMode="decimal" onChange={section.setField} />
        <div className="col-span-2">
          <FormField label="رقم تسجيل VAT" field="vat_registration_number" draft={section.draft} errors={section.errors} disabled={isSaving} onChange={section.setField} />
        </div>
        <label className="col-span-2 flex min-h-11 items-center gap-2.5 rounded-lg border bg-background/70 px-3 py-2 text-xs font-bold sm:rounded-xl">
          <input
            type="checkbox"
            checked={section.draft.vat_enabled === 'true'}
            disabled={isSaving}
            onChange={(event) => section.setField('vat_enabled', String(event.target.checked))}
          />
          <span>إظهار مؤشر VAT المرجعي في السجلات القديمة</span>
        </label>
      </div>
    </SectionCard>
  );
}
