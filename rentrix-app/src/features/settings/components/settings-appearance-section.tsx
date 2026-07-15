import { Check, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import type { CompanySettingsPreviewModel } from '../settingsForm';
import type { SettingsSectionId } from '../settingsSections';
import { PreviewField } from './settings-form-fields';
import { SectionCard } from './settings-section-card';

export function SettingsAppearanceSection({
  activeSection,
  preview,
  theme,
  pageLanguage,
  onToggleTheme,
  onDefaultLanguageChange,
}: Readonly<{
  activeSection: SettingsSectionId;
  preview: CompanySettingsPreviewModel;
  theme: string;
  pageLanguage: Readonly<{ language: string }>;
  onToggleTheme: () => void;
  onDefaultLanguageChange: (language: 'ar' | 'en') => void;
}>) {
  const isDark = theme === 'dark';

  return (
    <SectionCard
      id="system"
      activeId={activeSection}
      title="المظهر والواجهة"
      subtitle="السمة ولغة الواجهة تُحفظان محلياً ولا تغيّران إعدادات الشركة أو صلاحياتها."
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)]">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-black">السمة</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={!isDark ? 'primary' : 'secondary'}
                className="min-h-12 justify-start"
                onClick={() => { if (isDark) onToggleTheme(); }}
              >
                <Sun className="me-2 size-4" aria-hidden="true" />
                فاتحة
                {!isDark ? <Check className="ms-auto size-4" aria-hidden="true" /> : null}
              </Button>
              <Button
                type="button"
                variant={isDark ? 'primary' : 'secondary'}
                className="min-h-12 justify-start"
                onClick={() => { if (!isDark) onToggleTheme(); }}
              >
                <Moon className="me-2 size-4" aria-hidden="true" />
                داكنة
                {isDark ? <Check className="ms-auto size-4" aria-hidden="true" /> : null}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-black">لغة الواجهة</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={pageLanguage.language === 'ar' ? 'primary' : 'secondary'}
                onClick={() => onDefaultLanguageChange('ar')}
              >
                العربية
              </Button>
              <Button
                type="button"
                variant={pageLanguage.language === 'en' ? 'primary' : 'secondary'}
                onClick={() => onDefaultLanguageChange('en')}
              >
                English
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-muted/20 p-3" aria-label="معاينة المظهر">
          <p className="text-xs font-black text-muted-foreground">معاينة مباشرة</p>
          <div className="mt-3 space-y-2 rounded-xl border bg-background p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="font-black">{preview.companyName}</p>
              <StatusBadge tone="green">نشط</StatusBadge>
            </div>
            <p className="text-xs font-bold text-muted-foreground">
              {preview.defaultCurrency} · {preview.locale}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="rounded-lg border bg-card p-2 text-xs font-bold">بطاقة</div>
              <div className="rounded-lg bg-primary p-2 text-xs font-black text-primary-foreground">إجراء أساسي</div>
            </div>
          </div>
        </div>
      </div>

      <details className="rounded-2xl border bg-muted/20 p-3 [&[open]>summary]:mb-2">
        <summary className="cursor-pointer text-sm font-black">تفاصيل أثر إعدادات الشركة</summary>
        <dl className="grid gap-3 pt-2 md:grid-cols-2">
          <PreviewField label="اسم الشركة" value={preview.companyName} />
          <PreviewField label="الاسم القانوني" value={preview.legalName} muted={preview.legalName === 'غير محدد'} />
          <PreviewField label="اللغة الافتراضية" value={`${preview.defaultLanguage} (${preview.locale})`} />
          <PreviewField label="العملة الافتراضية" value={preview.defaultCurrency} />
          <PreviewField label="الدولة" value={preview.country} />
          <PreviewField label="المنطقة الزمنية" value={preview.timezone} />
          <PreviewField label="بادئة الفواتير" value={preview.invoicePrefix} />
          <PreviewField label="بادئة العقود" value={preview.contractPrefix} />
          <PreviewField label="بادئة الإيصالات" value={preview.receiptPrefix} />
          <PreviewField label="ضريبة القيمة المضافة الافتراضية" value={preview.defaultVatRate} />
        </dl>
      </details>
    </SectionCard>
  );
}
