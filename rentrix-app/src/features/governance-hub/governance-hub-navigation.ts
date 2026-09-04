import {
  isSettingsSectionId,
  resolveSettingsSection,
  type SettingsSectionId,
} from '@/features/settings/registry/sectionRegistry';
import type { GovernanceHubSectionId } from './governance-hub-sections';

type VisibleGovernanceSection = Readonly<{ id: GovernanceHubSectionId }>;

export type GovernanceHubNavigation = Readonly<{
  hubSection: GovernanceHubSectionId;
  companySection: SettingsSectionId;
  legacyCompanySection: SettingsSectionId | null;
  canOpenCompany: boolean;
}>;

export function resolveGovernanceHubNavigation({
  requestedSection,
  requestedCompanySection,
  visibleSections,
}: Readonly<{
  requestedSection: unknown;
  requestedCompanySection: unknown;
  visibleSections: readonly VisibleGovernanceSection[];
}>): GovernanceHubNavigation {
  const requestedSectionId = typeof requestedSection === 'string' ? requestedSection : null;
  const fallbackSection = visibleSections[0]?.id ?? 'security';
  const hasRequestedHubSection = visibleSections.some((section) => section.id === requestedSectionId);
  const legacyCompanySection = !hasRequestedHubSection && isSettingsSectionId(requestedSectionId)
    ? requestedSectionId
    : null;
  const canOpenCompany = visibleSections.some((section) => section.id === 'company');
  const companySection = resolveSettingsSection(legacyCompanySection ?? requestedCompanySection);
  const hubSection = hasRequestedHubSection
    ? requestedSectionId as GovernanceHubSectionId
    : legacyCompanySection && canOpenCompany
      ? 'company'
      : fallbackSection;

  return {
    hubSection,
    companySection,
    legacyCompanySection: legacyCompanySection && canOpenCompany ? legacyCompanySection : null,
    canOpenCompany,
  };
}

export function buildCompanySettingsSearch(
  previous: Record<string, unknown>,
  companySection: SettingsSectionId,
): Record<string, unknown> {
  return {
    ...previous,
    section: 'company',
    companySection,
  };
}
