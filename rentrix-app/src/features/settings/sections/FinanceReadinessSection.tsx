import { ChevronDown } from 'lucide-react';
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
 * FAIL-CLOSED readiness gates remain unchanged. The advanced authority editor
 * is disclosure-based so the default Settings view stays focused on readiness
 * rather than rendering two full administrative workspaces at once.
 */
export function SettingsFinanceReadinessSection({ activeSection }: SettingsFinanceReadinessSectionProps) {
  return (
    <SectionCard
      id="finance-readiness"
      activeId={activeSection}
      title="جاهزية المالية والضريبة"
      subtitle="تحقق من جاهزية الضريبة والفترات المحاسبية ودليل الحسابات قبل التشغيل المالي."
    >
      <div className="space-y-3 [&_[data-component-card]]:shadow-none">
        <TaxAuthorityFinanceReadinessSection />

        <details className="group overflow-hidden rounded-xl border border-border/70 bg-card">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-black outline-none focus-visible:ring-2 focus-visible:ring-primary/25 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0 flex-1">إدارة السياسات الضريبية المتقدمة</span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="border-t border-border/60 p-2.5 sm:p-3 [&_[data-card-header]]:p-2.5 [&_[data-card-content]]:px-2.5 [&_[data-card-content]]:pb-2.5">
            <TaxAuthorityWorkspace />
          </div>
        </details>
      </div>
    </SectionCard>
  );
}
