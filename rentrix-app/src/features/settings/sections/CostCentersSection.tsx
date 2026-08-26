import { CostCentersSettingsSection } from '../cost-centers-settings-section';
import { SectionCard } from '../components/settings-section-card';
import type { SettingsSectionId } from '../settingsSections';

export type CostCentersSectionProps = Readonly<{
  activeSection: SettingsSectionId;
}>;

/**
 * WP-D D.2 — CostCentersSection (مراكز التكلفة).
 *
 * Operational classification CRUD (property/parent hierarchy, archive) that
 * owns NO company-settings draft fields: cost centers are their own
 * `cost_centers` table with their own hooks/services. The heavy CRUD body is
 * `CostCentersSettingsSection`; this module owns the section shell and its
 * registry contract.
 */
export function CostCentersSection({ activeSection }: CostCentersSectionProps) {
  return (
    <SectionCard id="cost-centers" activeId={activeSection} title="مراكز التكلفة" subtitle="تصنيف تشغيلي للمصروفات والتقارير حسب العقار أو النشاط بدون دفتر أستاذ عام.">
      <CostCentersSettingsSection />
    </SectionCard>
  );
}
