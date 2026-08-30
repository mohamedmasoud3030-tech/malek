import { Check, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import type { CompanySettingsPreviewModel } from '../settingsForm';
import type { SettingsSectionId } from '../settingsSections';
import { SettingsPreviewField } from '../components/settings-form-fields';
import { SectionCard } from '../components/settings-section-card';

export type SystemSectionProps = Readonly<{
  activeSection: SettingsSectionId;
  preview: CompanySettingsPreviewModel;
  theme: string;
  pageLanguage: Readonly<{ language: string }>;
  onToggleTheme: () => void;
  onDefaultLanguageChange: (language: 'ar' | 'en') => void;
}>;

export function SystemSection({
  activeSection,
  preview,
  theme,
  pageLanguage,
  onToggleTheme,
  onDefaultLanguageChange,
}: SystemSectionProps) {
  const isDark = theme === 'dark';

  return (
    <SectionCard
      id="system"
      activeId={activeSection}
      title="المظهر والواجهة"
      subtitle="السمة ولغة الواجهة على هذا الجهاز."
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)]">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs font-black">السمة</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={!isDark ? 'primary' : 'secondary'}
                className="min-h-11 justify-start px-3"
                onClick={() => { if (isDark) onToggleTheme(); }}
              >
                <Sun className="me-1.5 size-4" aria-hidden="true" />
                فاتحة
                {!isDark ? <Check className="ms-auto size-4" aria-hidden="true" /> : null}
              </Button>
              <Button
                type="button"
                variant={isDark ? 'primary' : 'secondary'}
                className="min-h-11 justify-start px-3"
                onClick={() => { if (!isDark) onToggleTheme(); }}
              >
                <Moon className="me-1.5 size-4" aria-hidden="true" />
                داكنة
                {isDark ? <Check className="ms-auto size-4" aria-hidden="true" /> : null}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-black">لغة الواجهة</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                className="min-h-11"
                variant={pageLanguage.language === 'ar' ? 'primary' : 'secondary'}
                onClick={() => onDefaultLanguageChange('ar')}
              >
                العربية
              </Button>
              <Button
                type="button"
                className="min-h-11"
                variant={pageLanguage.language === 'en' ? 'primary' : 'secondary'}
                onClick={() => onDefaultLanguageChange('en')}
              >
                English
              </Button>
            </div>
          </div>
        </div>

        <div className="hidden rounded-xl border border-border/70 bg-muted/15 p-2.5 sm:block" aria-label="معاينة المظهر">
          <p className="text-[11px] font-black text-muted-foreground">معاينة مباشرة</p>
          <div className="mt-2 space-y-2 rounded-lg border bg-background p-2.5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-black">{preview.companyName}</p>
              <StatusBadge tone="success">نشط</StatusBadge>
            </div>
            <p className="text-[11px] font-bold text-muted-foreground">
              {preview.defaultCurrency} · {preview.locale}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="rounded-lg border bg-card p-2 text-xs font-bold">بطاقة</div>
              <div className="rounded-lg bg-primary p-2 text-xs font-black text-primary-foreground">إجراء أساسي</div>
            </div>
          </div>
        </div>
      </div>

      <details className="rounded-xl border bg-muted/15 p-2.5 [&[open]>summary]:mb-2">
        <summary className="cursor-pointer text-xs font-black">تفاصيل إعدادات الشركة</summary>
        <dl className="grid gap-2 pt-2 sm:grid-cols-2">
          <SettingsPreviewField label="اسم الشركة" value={preview.companyName} />
          <SettingsPreviewField label="الاسم القانوني" value={preview.legalName} muted={preview.legalName === 'غير محدد'} />
          <SettingsPreviewField label="اللغة الافتراضية" value={`${preview.defaultLanguage} (${preview.locale})`} />
          <SettingsPreviewField label="العملة الافتراضية" value={preview.defaultCurrency} />
          <SettingsPreviewField label="الدولة" value={preview.country} />
          <SettingsPreviewField label="المنطقة الزمنية" value={preview.timezone} />
          <SettingsPreviewField label="بادئة الفواتير" value={preview.invoicePrefix} />
          <SettingsPreviewField label="بادئة العقود" value={preview.contractPrefix} />
          <SettingsPreviewField label="بادئة الإيصالات" value={preview.receiptPrefix} />
          <SettingsPreviewField label="ضريبة القيمة المضافة الافتراضية" value={preview.defaultVatRate} />
        </dl>
      </details>
    </SectionCard>
  );
}
