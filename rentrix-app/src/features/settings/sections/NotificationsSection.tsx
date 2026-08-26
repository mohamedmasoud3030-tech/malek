import type { CompanySettingsDraft, CompanySettingsDraftField, CompanySettingsPreviewModel, CompanySettingsValidationErrors } from '../settingsForm';
import { useSettingsSection } from '../form/useSettingsSection';
import { SectionCard } from '../components/settings-section-card';
import type { SettingsSectionId } from '../settingsSections';

export type NotificationsSectionProps = Readonly<{
  activeSection: SettingsSectionId;
  draft: CompanySettingsDraft;
  errors: CompanySettingsValidationErrors;
  isSaving: boolean;
  preview: CompanySettingsPreviewModel;
  onDraftChange: (field: CompanySettingsDraftField, value: string) => void;
}>;

export function NotificationsSection({
  activeSection,
  draft,
  errors,
  isSaving,
  onDraftChange,
}: NotificationsSectionProps) {
  const section = useSettingsSection('notifications', { draft, errors, isSaving, onDraftChange });

  return (
    <SectionCard
      id="notifications"
      activeId={activeSection}
      title="الإشعارات والمتابعة"
      subtitle="اختر قنوات الإشعارات المستخدمة للمكتب."
    >
      <div className="grid grid-cols-2 gap-2.5">
        <label className="flex min-h-11 items-center justify-between gap-2 rounded-lg border bg-background/70 px-3 py-2 text-xs font-bold sm:rounded-xl sm:text-sm">
          <span>البريد الإلكتروني</span>
          <input
            type="checkbox"
            checked={section.draft.notification_email_enabled === 'true'}
            disabled={isSaving}
            onChange={(event) => section.setField('notification_email_enabled', String(event.target.checked))}
          />
        </label>
        <label className="flex min-h-11 items-center justify-between gap-2 rounded-lg border bg-background/70 px-3 py-2 text-xs font-bold sm:rounded-xl sm:text-sm">
          <span>الرسائل النصية</span>
          <input
            type="checkbox"
            checked={section.draft.notification_sms_enabled === 'true'}
            disabled={isSaving}
            onChange={(event) => section.setField('notification_sms_enabled', String(event.target.checked))}
          />
        </label>
      </div>
    </SectionCard>
  );
}
