import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { CompanySettingsDraftField } from '../form/sectionDrafts';
import { settingsSectionCatalog, type SettingsSectionDefinitionBase } from './section-catalog';
import type { SettingsSectionId, SettingsSectionRenderProps } from './types';

export type { SettingsSectionId } from './types';
export {
  isFormSection,
  draftFieldsFor,
  settingsSectionCatalog,
  settingsSections,
  isSettingsSectionId,
  resolveSettingsSection,
  type SettingsSectionDefinitionBase,
  type SettingsSectionListItem,
} from './section-catalog';

/**
 * Declarative Settings registry — the component side.
 *
 * Metadata lives in `section-catalog.ts` (a leaf module). This module only
 * attaches the lazy component to each catalogue entry. Keeping the split means
 * `SectionCard` and the workspace nav can read the catalogue without importing
 * this module, which would otherwise close a cycle:
 *
 *   sectionRegistry → sections/* → settings-section-card → sectionRegistry
 *
 * The registry is still the single declarative source for the Settings
 * workspace: every section (navigation entry, form slice, lazy component) is
 * described here instead of being hard-coded inside `settings-page.tsx`.
 */
export type SettingsSectionDefinition = SettingsSectionDefinitionBase &
  Readonly<{
    component: LazyExoticComponent<ComponentType<SettingsSectionRenderProps>>;
  }>;

const settingsSectionComponents: Readonly<
  Record<SettingsSectionId, LazyExoticComponent<ComponentType<SettingsSectionRenderProps>>>
> = {
  office: lazy(() => import('../sections/OfficeSection').then((module) => ({ default: module.OfficeSection }))),
  identity: lazy(() => import('../sections/IdentitySection').then((module) => ({ default: module.IdentitySection }))),
  documents: lazy(() => import('../sections/DocumentsSection').then((module) => ({ default: module.DocumentsSection }))),
  'finance-readiness': lazy(() =>
    import('../sections/FinanceReadinessSection').then((module) => ({ default: module.SettingsFinanceReadinessSection })),
  ),
  'cost-centers': lazy(() =>
    import('../sections/CostCentersSection').then((module) => ({ default: module.CostCentersSection })),
  ),
  'payment-terms': lazy(() =>
    import('../sections/PaymentTermsSection').then((module) => ({ default: module.PaymentTermsSection })),
  ),
  notifications: lazy(() =>
    import('../sections/NotificationsSection').then((module) => ({ default: module.NotificationsSection })),
  ),
  system: lazy(() => import('../sections/SystemSection').then((module) => ({ default: module.SystemSection }))),
};

export const settingsSectionRegistry: readonly SettingsSectionDefinition[] = settingsSectionCatalog.map((section) => ({
  ...section,
  component: settingsSectionComponents[section.id],
}));

export function getSettingsSection(id: SettingsSectionId): SettingsSectionDefinition | undefined {
  return settingsSectionRegistry.find((section) => section.id === id);
}

export function getVisibleSettingsSections(): readonly SettingsSectionDefinition[] {
  return settingsSectionRegistry.filter((section) => section.showInPrimaryNavigation);
}

export function getCompanySettingsSectionFieldOwners(): Readonly<Record<CompanySettingsDraftField, SettingsSectionId>> {
  const owners = {} as Record<CompanySettingsDraftField, SettingsSectionId>;

  for (const section of settingsSectionRegistry) {
    for (const field of section.fields) {
      owners[field] = section.id;
    }
  }

  return owners;
}
