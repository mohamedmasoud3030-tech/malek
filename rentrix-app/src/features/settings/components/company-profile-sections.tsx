import type { ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  supportedCompanyLocales,
  supportedCountries,
  supportedTimezones,
} from '@/lib/companySettings';
import { supportedCurrencies } from '@/lib/formatters';
import type {
  CompanySettingsDraft,
  CompanySettingsDraftField,
  CompanySettingsPreviewModel,
  CompanySettingsValidationErrors,
} from '../settingsForm';
import { FormField, PreviewField, SelectField } from './settings-form-fields';
import { SectionCard } from './settings-section-card';
import type { SettingsSectionId } from '../settingsSections';

const currencyOptions = supportedCurrencies;
const localeOptions = supportedCompanyLocales;
const countryOptions = supportedCountries;
const numberFormatOptions = ['ar-OM', 'en-OM', 'ar', 'en-US'];
const dateFormatOptions = ['dd/MM/yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy'];
const timezoneOptions = supportedTimezones;

type CompanyProfileSectionsProps = Readonly<{
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
 * The "بيانات المكتب" (office), "الهوية والطباعة" (identity), and
 * "العقود والفواتير" (documents) SectionCards. These three sections form the
 * core company-profile form and are grouped together because they share the
 * same draft/validation contract and are always edited as one unit.
 */
export function CompanyProfileSections({
  activeSection,
  draft,
  errors,
  isSaving,
  preview,
  formattedPreviewDate,
  formattedPreviewMoney,
  onDraftChange,
  onLogoFileChange,
}: CompanyProfileSectionsProps) {
  return (
    <>
      <SectionCard id="office" activeId={activeSection} title="بيانات المكتب" subtitle="الهوية الأساسية وبيانات التواصل المرتبطة بقوالب المستندات.">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-primary">
          الإعدادات هنا مرتبطة بسجل إعدادات الشركة المحفوظ، وليست حالة محلية مؤقتة.
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <FormField label="اسم الشركة" field="company_name" draft={draft} errors={errors} disabled={isSaving} placeholder="Rentrix" onChange={onDraftChange} />
          <FormField label="الاسم القانوني" field="legal_name" draft={draft} errors={errors} disabled={isSaving} placeholder="الاسم القانوني للشركة" onChange={onDraftChange} />
          <FormField label="الرقم الضريبي" field="tax_number" draft={draft} errors={errors} disabled={isSaving} onChange={onDraftChange} />
          <FormField label="رقم السجل التجاري" field="registration_number" draft={draft} errors={errors} disabled={isSaving} onChange={onDraftChange} />
          <FormField label="الهاتف" field="phone" draft={draft} errors={errors} disabled={isSaving} onChange={onDraftChange} />
          <FormField label="البريد الإلكتروني" field="email" draft={draft} errors={errors} disabled={isSaving} type="email" placeholder="email@example.com" onChange={onDraftChange} />
          <FormField label="المدينة" field="city" draft={draft} errors={errors} disabled={isSaving} onChange={onDraftChange} />
          <SelectField label="الدولة" field="country" draft={draft} errors={errors} disabled={isSaving} options={countryOptions} onChange={onDraftChange} />
        </div>
        <label className="space-y-1 text-sm font-medium text-foreground">
          <span>العنوان</span>
          <Textarea
            value={draft.address}
            disabled={isSaving}
            aria-invalid={Boolean(errors.address)}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onDraftChange('address', event.target.value)}
          />
          {errors.address ? <span className="block text-xs text-destructive">{errors.address}</span> : null}
        </label>
      </SectionCard>

      <SectionCard id="identity" activeId={activeSection} title="الهوية والطباعة" subtitle="العملة، اللغة، الشعار، وصيغ الأرقام والتواريخ المعتمدة في المستندات.">
        <div className="grid gap-3 md:grid-cols-2">
          <SelectField label="العملة" field="currency" draft={draft} errors={errors} disabled={isSaving} options={currencyOptions} onChange={onDraftChange} />
          <SelectField label="المحلية" field="locale" draft={draft} errors={errors} disabled={isSaving} options={localeOptions} onChange={onDraftChange} />
          <SelectField label="المنطقة الزمنية" field="timezone" draft={draft} errors={errors} disabled={isSaving} options={timezoneOptions} onChange={onDraftChange} />
          <SelectField label="صيغة التاريخ" field="date_format" draft={draft} errors={errors} disabled={isSaving} options={dateFormatOptions} onChange={onDraftChange} />
          <SelectField label="صيغة الأرقام" field="number_format" draft={draft} errors={errors} disabled={isSaving} options={numberFormatOptions} onChange={onDraftChange} />
          <FormField label="رابط الشعار" field="logo_url" draft={draft} errors={errors} disabled={isSaving} type="url" placeholder="https://example.com/logo.png" onChange={onDraftChange} />
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
          <span className="block text-[11px] text-muted-foreground">يُحفظ الشعار كقيمة مضمنة صغيرة للحفاظ على المعاينة والمستندات بدون إعداد Storage إضافي.</span>
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
                <p className="text-[11px] text-muted-foreground">{preview.logoFallbackLabel}</p>
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

      <SectionCard id="documents" activeId={activeSection} title="العقود والفواتير" subtitle="بادئات المستندات والضريبة الافتراضية المطبّقة على الفواتير والعقود الجديدة.">
        <div className="grid gap-3 md:grid-cols-2">
          <FormField label="بادئة الفواتير" field="invoice_prefix" draft={draft} errors={errors} disabled={isSaving} onChange={onDraftChange} />
          <FormField label="بادئة العقود" field="contract_prefix" draft={draft} errors={errors} disabled={isSaving} onChange={onDraftChange} />
          <FormField label="بادئة الإيصالات" field="receipt_prefix" draft={draft} errors={errors} disabled={isSaving} onChange={onDraftChange} />
          <FormField label="ضريبة القيمة المضافة الافتراضية %" field="default_vat_rate" draft={draft} errors={errors} disabled={isSaving} type="number" inputMode="decimal" onChange={onDraftChange} />
          <FormField label="نسبة VAT التشغيلية %" field="vat_rate" draft={draft} errors={errors} disabled={isSaving} type="number" inputMode="decimal" onChange={onDraftChange} />
          <FormField label="رقم تسجيل VAT" field="vat_registration_number" draft={draft} errors={errors} disabled={isSaving} onChange={onDraftChange} />
          <label className="flex items-center gap-2 rounded-xl border bg-background/70 p-3 text-sm font-medium md:col-span-2">
            <input
              type="checkbox"
              checked={draft.vat_enabled === 'true'}
              disabled={isSaving}
              onChange={(event) => onDraftChange('vat_enabled', String(event.target.checked))}
            />
            <span>تفعيل VAT في إعدادات المكتب والتقارير</span>
          </label>
        </div>
      </SectionCard>
    </>
  );
}
