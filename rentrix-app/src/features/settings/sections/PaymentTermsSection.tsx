import { PaymentTermsSettingsSection } from '../payment-terms-settings-section';
import { SectionCard } from '../components/settings-section-card';
import type { SettingsSectionId } from '../settingsSections';

export type PaymentTermsSectionProps = Readonly<{
  activeSection: SettingsSectionId;
}>;

/**
 * WP-D D.2 — PaymentTermsSection (شروط السداد).
 *
 * Payment-schedule template CRUD (installments, interval, archive) that owns
 * NO company-settings draft fields: templates live in their own
 * `payment_terms_templates` table with their own hooks/services. The heavy
 * CRUD body is `PaymentTermsSettingsSection`; this module owns the section
 * shell and its registry contract.
 */
export function PaymentTermsSection({ activeSection }: PaymentTermsSectionProps) {
  return (
    <SectionCard id="payment-terms" activeId={activeSection} title="شروط السداد" subtitle="قوالب تشغيلية لاختيار جدول السداد في العقد بدون إنشاء دفتر أستاذ أو جدولة تلقائية موسعة.">
      <PaymentTermsSettingsSection />
    </SectionCard>
  );
}
