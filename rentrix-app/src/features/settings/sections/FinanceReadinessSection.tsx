import { FinanceReadinessSection as TaxAuthorityFinanceReadinessSection } from '@/features/financials/tax-authority/finance-readiness-section';
import { TaxAuthorityWorkspace } from '@/features/financials/tax-authority/tax-profile-workspace';
import { SectionCard } from '../components/settings-section-card';
import type { SettingsSectionId } from '../settingsSections';

export type SettingsFinanceReadinessSectionProps = Readonly<{
  activeSection: SettingsSectionId;
}>;

/**
 * WP-D D.2 — FinanceReadinessSection (جاهزية المالية والضريبة).
 *
 * FAIL-CLOSED readiness gates: the dated tax authority (rent + management
 * fees), accounting periods, and the chart of accounts. These workspaces are
 * implemented in `features/financials/tax-authority/*` and are owned by
 * WP-B (Finance Hub Unification) — WP-D does NOT modify them, it only
 * composes them into the Settings platform through the registry.
 *
 * PARALLEL DEPENDENCY (documented): this section's bodies live under
 * `features/financials/`, which WP-B is actively migrating to `features/finance/`.
 * If WP-B moves these files, this import path must be updated to the new home;
 * until then the existing path is preserved and untouched by WP-D.
 */
export function SettingsFinanceReadinessSection({ activeSection }: SettingsFinanceReadinessSectionProps) {
  return (
    <SectionCard
      id="finance-readiness"
      activeId={activeSection}
      title="جاهزية المالية والضريبة"
      subtitle="السلطة الضريبية المعتمدة حسب التاريخ (إيجار وأتعاب)، فترات محاسبية، ودليل الحسابات — فشل مغلق عند النقص."
    >
      <div className="space-y-6">
        <TaxAuthorityFinanceReadinessSection />
        <TaxAuthorityWorkspace />
      </div>
    </SectionCard>
  );
}
