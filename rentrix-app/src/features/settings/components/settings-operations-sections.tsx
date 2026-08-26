import { useAuth } from '@/hooks/use-auth';
import type {
  CompanySettingsDraft,
  CompanySettingsDraftField,
  CompanySettingsPreviewModel,
} from '../settingsForm';
import { NotificationsSection } from '../sections/NotificationsSection';
import { SystemSection } from '../sections/SystemSection';
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

/**
 * Compatibility composition (WP-D seam): renders the operations sections
 * (notifications, system/appearance). The Settings page itself now composes
 * sections from the registry; this module is kept for legacy consumers so the
 * import path and prop contract stay intact.
 */
export function SettingsOperationsSections({
  activeSection,
  draft,
  preview,
  isSaving,
  theme,
  pageLanguage,
  onDraftChange,
  onToggleTheme,
  onDefaultLanguageChange,
}: SettingsOperationsSectionsProps) {
  return (
    <>
      <NotificationsSection
        activeSection={activeSection}
        draft={draft}
        errors={{}}
        isSaving={isSaving}
        preview={preview}
        onDraftChange={onDraftChange}
      />
      <SystemSection
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
