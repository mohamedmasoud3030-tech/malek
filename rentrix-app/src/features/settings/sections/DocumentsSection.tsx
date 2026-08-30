import { AlertTriangle } from 'lucide-react';
import type { CompanySettingsDraft, CompanySettingsDraftField, CompanySettingsValidationErrors } from '../settingsForm';
import { useSettingsSection } from '../form/useSettingsSection';
import { SettingsFormField } from '../components/settings-form-fields';
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
      <fieldset className="min-w-0 space-y-2.5">
        <legend className="mb-2 text-[11px] font-black text-muted-foreground">ترقيم المستندات</legend>
        <div className="grid grid-cols-2 gap-x-2.5 gap-y-2.5 sm:gap-3">
          <SettingsFormField label="بادئة الفواتير" field="invoice_prefix" draft={section.draft} errors={section.errors} disabled={isSaving} onChange={section.setField} />
          <SettingsFormField label="بادئة الإيصالات" field="receipt_prefix" draft={section.draft} errors={section.errors} disabled={isSaving} onChange={section.setField} />
          <div className="col-span-2 sm:col-span-1">
            <SettingsFormField label="بادئة العقود" field="contract_prefix" draft={section.draft} errors={section.errors} disabled={isSaving} onChange={section.setField} />
          </div>
        </div>
      </fieldset>

      <fieldset className="min-w-0 space-y-2.5 border-t border-border/55 pt-3">
        <legend className="mb-2 text-[11px] font-black text-muted-foreground">بيانات VAT المرجعية</legend>
        <div className="grid grid-cols-2 gap-x-2.5 gap-y-2.5 sm:gap-3">
          <SettingsFormField label="VAT مرجعية %" field="default_vat_rate" draft={section.draft} errors={section.errors} disabled={isSaving} type="number" inputMode="decimal" onChange={section.setField} />
          <SettingsFormField label="VAT قديمة %" field="vat_rate" draft={section.draft} errors={section.errors} disabled={isSaving} type="number" inputMode="decimal" onChange={section.setField} />
          <div className="col-span-2">
            <SettingsFormField label="رقم تسجيل VAT" field="vat_registration_number" draft={section.draft} errors={section.errors} disabled={isSaving} onChange={section.setField} />
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

        <div className="flex items-start gap-2 rounded-lg bg-warning/[0.08] px-2.5 py-2 text-[10px] font-semibold leading-4 text-muted-foreground sm:text-[11px]">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
          <p><strong className="text-foreground">مهم:</strong> هذه النسب للتوافق فقط؛ الضريبة المحاسبية الفعلية تأتي من سياسة المالية المعتمدة.</p>
        </div>
      </fieldset>
    </SectionCard>
  );
}
