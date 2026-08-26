/**
 * WP-D compatibility seam: the appearance section implementation now lives in
 * `../sections/SystemSection`. This module preserves the historical import
 * path and component name used by the settings e2e fixture and embedded
 * surfaces.
 */
export { SystemSection as SettingsAppearanceSection, type SystemSectionProps as SettingsAppearanceSectionProps } from '../sections/SystemSection';
