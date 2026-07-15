import { Link } from '@tanstack/react-router';
import { KeyRound } from 'lucide-react';
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
import { SettingsAppearanceSection } from './settings-appearance-section';
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

      <SettingsAppearanceSection
        activeSection={activeSection}
        preview={preview}
        theme={theme}
        pageLanguage={pageLanguage}
        onToggleTheme={onToggleTheme}
        onDefaultLanguageChange={onDefaultLanguageChange}
      />
    </>
  );
}
