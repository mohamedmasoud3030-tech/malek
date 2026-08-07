import { Link } from '@tanstack/react-router';
import { KeyRound, ListChecks, SearchCheck, ShieldAlert } from 'lucide-react';
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
