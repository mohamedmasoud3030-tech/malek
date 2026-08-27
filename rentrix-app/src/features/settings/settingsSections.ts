/**
 * Settings registry compatibility seam. All symbols re-export the canonical
 * registry implementations; there is no second source of truth.
 */
export {
  getCompanySettingsSectionFieldOwners,
  getSettingsSection,
  getSettingsSectionDraftFields,
  getVisibleSettingsSections,
  isSettingsSectionId,
  resolveSettingsSection,
  settingsSectionRegistry,
  settingsSections,
} from './registry/sectionRegistry';
export type {
  SettingsSectionDefinition,
  SettingsSectionListItem,
  SettingsSectionRegistry,
} from './registry/sectionRegistry';
export type { SettingsSectionId } from './registry/types';
