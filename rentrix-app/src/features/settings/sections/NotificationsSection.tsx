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

/**
 * WP-D D.2 — NotificationsSection (الإشعارات والمتابعة).
 *
 * Owns the notifications slice of the company-settings draft: the two
 * recorded notification-channel toggles (email, SMS) persisted on the
 * company-settings row. Local-only preferences (theme, UI language) are not
 * part of this slice.
 */
export function NotificationsSection({
  activeSection,
  draft,
  errors,
  isSaving,
  preview,
  onDraftChange,
}: NotificationsSectionProps) {
  const section = useSettingsSection('notifications', { draft, errors, isSaving, onDraftChange });

  return (
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
            checked={section.draft.notification_email_enabled === 'true'}
            disabled={isSaving}
            onChange={(event) => section.setField('notification_email_enabled', String(event.target.checked))}
          />
          <span>تفعيل إشعارات البريد الإلكتروني</span>
        </label>
        <label className="flex min-h-12 items-center gap-3 rounded-xl border bg-background/70 p-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={section.draft.notification_sms_enabled === 'true'}
            disabled={isSaving}
            onChange={(event) => section.setField('notification_sms_enabled', String(event.target.checked))}
          />
          <span>تفعيل إشعارات الرسائل النصية</span>
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        ملخص الإشعارات المعتمد: {preview.notificationSummary}.
      </p>
    </SectionCard>
  );
}
