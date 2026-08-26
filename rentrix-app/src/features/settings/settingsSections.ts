/**
 * WP-D compatibility seam.
 *
 * The declarative section definitions now live in
 * `./registry/sectionRegistry`. This module keeps the historical import path
 * (`@/features/settings/settingsSections`) working for navigation,
 * governance deep links, summary tiles, and tests. All symbols re-export the
 * canonical registry implementations — there is no second source of truth.
 */
export {
  getCompanySettingsSectionFieldOwners,
  getSettingsSection,
  getSettingsSectionDraftFields,
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
