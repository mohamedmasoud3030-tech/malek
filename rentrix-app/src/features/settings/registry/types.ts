import type { ChangeEvent } from 'react';
import type {
  CompanySettingsDraft,
  CompanySettingsDraftField,
  CompanySettingsValidationErrors,
} from '../form/sectionDrafts';
import type { CompanySettingsPreviewModel } from '../settingsForm';

/**
 * WP-D Settings Platform — registry contract types.
 *
 * The registry is the single declarative source for the Settings workspace:
 * every section (navigation entry, form slice, lazy component) is described
 * here instead of being hard-coded inside `settings-page.tsx`.
 *
 * `SettingsSectionId` is the canonical URL/navigation identifier. It is a
 * stable public contract — governance deep links, the workspace nav, and the
 * summary tiles all resolve through it. Do not rename existing ids.
 */
export const settingsSectionIds = [
  'office',
  'identity',
  'documents',
  'finance-readiness',
  'cost-centers',
  'payment-terms',
  'notifications',
  'system',
] as const;

export type SettingsSectionId = (typeof settingsSectionIds)[number];

/**
 * Section ownership kinds:
 * - `form`      → section owns a slice of the company-settings draft (fields
 *                 listed in `SettingsSectionDefinition.fields`).
 * - `operations`→ section owns local/CRUD state (cost centers, payment terms)
 *                 or domain-gated workspaces (finance readiness).
 * - `system`    → section owns UI/system preferences (theme, language).
 */
export type SettingsSectionKind = 'form' | 'operations' | 'system';

/**
 * The shared prop bag passed to every registry section component. Sections
 * receive the full bag so the registry can render uniformly; each section
 * isolates the slice it owns via `useSettingsSection` and ignores the rest.
 */
export type SettingsSectionRenderProps = Readonly<{
  activeSection: SettingsSectionId;
  draft: CompanySettingsDraft;
  errors: CompanySettingsValidationErrors;
  isSaving: boolean;
  preview: CompanySettingsPreviewModel;
  formattedPreviewDate: string;
  formattedPreviewMoney: string;
  theme: string;
  pageLanguage: Readonly<{ language: string; direction: 'rtl' | 'ltr'; locale: string }>;
  onDraftChange: (field: CompanySettingsDraftField, value: string) => void;
  onLogoFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onToggleTheme: () => void;
  onDefaultLanguageChange: (language: 'ar' | 'en') => void;
}>;
