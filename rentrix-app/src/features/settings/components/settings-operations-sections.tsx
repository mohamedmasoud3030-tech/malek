import { Link } from '@tanstack/react-router';
import { Check, KeyRound, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/hooks/use-auth';
import type {
  CompanySettingsDraft,
  CompanySettingsDraftField,
  CompanySettingsPreviewModel,
} from '../settingsForm';
import { PreviewField } from './settings-form-fields';
import { SectionCard } from './settings-section-card';
import { RoleSimulatorSection } from '../role-simulator-section';
import type { SettingsSectionId } from '../settingsSections';

 type UseAuthResult = ReturnType<typeof useAuth>;
 type PageLanguage = Readonly<{ language: string }>;

 type SettingsOperationsSectionsProps = Readonly<{
  activeSection: SettingsSectionId;
  draft: CompanySettingsDraft;
  preview: CompanySettingsPreviewModel;
  isSaving: boolean;
  authorization: UseAuthResult['authorization'];
  authorizationDiagnostics: UseAuthResult['authorizationDiagnostics'];
  user: UseAuthResult['user'];
  theme: string;
  pageLanguage: PageLanguage;
  onDraftChange: (field: CompanySettingsDraftField, value: string) => void;
  onToggleTheme: () => void;
  onDefaultLanguageChange: (language: 'ar' | 'en') => void;
}>;

export function SettingsOperationsSections({
  activeSection,
  draft,
  preview,
  isSaving,
  authorization,
  authorizationDiagnostics,
  user,
  theme,
  pageLanguage,
  onDraftChange,
  onToggleTheme,
  onDefaultLanguageChange,
}: SettingsOperationsSectionsProps) {
  const sessionTone = authorizationDiagnostics.metadataMismatch ? 'gold' : 'green';
  const isDark = theme === 'dark';

  return (
    <>
      <SectionCard
        id="notifications"
        activeId={activeSection}
        title="الإشعارات والمتابعة"
        subtitle="تفضيلات الإشعارات المسجلة حالياً في سجل إعدادات المكتب."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex min-h-12 items-center gap-3 rounded-xl border bg-background/70 p-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={draft.notification_email_enabled === 'true'}
              disabled={isSaving}
              onChange={(event) => onDraftChange('notification_email_enabled', String(event.target.checked))}
            />
            <span>تفعيل إشعارات البريد الإلكتروني</span>
          </label>
          <label className="flex min-h-12 items-center gap-3 rounded-xl border bg-background/70 p-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={draft.notification_sms_enabled === 'true'}
              disabled={isSaving}
              onChange={(event) => onDraftChange('notification_sms_enabled', String(event.target.checked))}
            />
            <span>تفعيل إشعارات الرسائل النصية</span>
          </label>
        </div>
        <p className="text-[11px] text-muted-foreground">
          ملخص الإشعارات المعتمد: {preview.notificationSummary}.
        </p>
      </SectionCard>

      <SectionCard
        id="security"
        activeId={activeSection}
        title="الأمان والحساب"
        subtitle="معلومات الجلسة الحالية وصلاحيات العرض. تغيير كلمة المرور منفصل ومؤمّن."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <PreviewField label="البريد الإلكتروني للمستخدم" value={user?.email ?? 'غير متاح'} muted={!user?.email} />
          <PreviewField
            label="الدور الحالي"
            value={authorization?.role ?? authorizationDiagnostics.resolvedRole ?? 'غير محدد'}
            muted={!authorization?.role && !authorizationDiagnostics.resolvedRole}
          />
          <PreviewField
            label="حالة بيانات الدور"
            value={authorizationDiagnostics.metadataMismatch ? 'تحتاج مراجعة metadata' : 'صالحة حسب الجلسة'}
            muted={authorizationDiagnostics.metadataMismatch}
          />
          <PreviewField label="حالة الجلسة" value={user ? 'نشطة' : 'غير متاحة'} muted={!user} />
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-background/70 p-3">
          <StatusBadge tone={sessionTone}>
            {authorizationDiagnostics.metadataMismatch ? 'تحذير صلاحيات' : 'جلسة آمنة'}
          </StatusBadge>
          <p className="text-[12px] text-muted-foreground">
            هذه القيم تعكس الجلسة الحالية فقط، ولا تُحفظ في إعدادات الشركة.
          </p>
          <Button asChild variant="secondary" className="ms-auto">
            <Link to="/change-password">
              <KeyRound className="me-2 size-4" aria-hidden="true" />
              تغيير كلمة المرور
            </Link>
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        id="role-simulator"
        activeId={activeSection}
        title="محاكي الصلاحيات وأدوار الموظفين"
        subtitle="تبديل الدور الفعلي لاختبار سلوك الصلاحيات في النظام."
      >
        <RoleSimulatorSection />
      </SectionCard>

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
    </>
  );
}
