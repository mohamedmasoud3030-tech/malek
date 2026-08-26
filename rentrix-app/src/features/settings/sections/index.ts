/**
 * WP-D section components index — the canonical per-section modules.
 *
 * The registry imports sections lazily through these paths; compat
 * components (`components/company-profile-sections.tsx`,
 * `components/settings-operations-sections.tsx`,
 * `components/settings-appearance-section.tsx`) compose the same modules for
 * legacy consumers (e.g. the settings e2e fixture).
 */
export { OfficeSection, type OfficeSectionProps } from './OfficeSection';
export { IdentitySection, type IdentitySectionProps } from './IdentitySection';
export { DocumentsSection, type DocumentsSectionProps } from './DocumentsSection';
export { NotificationsSection, type NotificationsSectionProps } from './NotificationsSection';
export { SystemSection, type SystemSectionProps } from './SystemSection';
export { CostCentersSection, type CostCentersSectionProps } from './CostCentersSection';
export { PaymentTermsSection, type PaymentTermsSectionProps } from './PaymentTermsSection';
export { SettingsFinanceReadinessSection, type SettingsFinanceReadinessSectionProps } from './FinanceReadinessSection';
