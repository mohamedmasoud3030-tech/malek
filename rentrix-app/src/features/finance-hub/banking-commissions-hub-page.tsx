import { BadgeDollarSign, Landmark } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { SectionTabPanel, SectionTabs, type SectionTabItem } from '@/components/ui/section-tabs';
import { BankReconciliationPage } from '@/features/financials/reconciliation/bank-reconciliation-page';
import { CommissionsPage } from '@/features/commissions/commissions-page';

type BankingCommissionsSectionId = 'bank_reconciliation' | 'commissions';

const sections: readonly SectionTabItem<BankingCommissionsSectionId>[] = [
  { id: 'bank_reconciliation', label: 'مطابقة كشف البنك', icon: Landmark },
  { id: 'commissions', label: 'عمولات المكتب', icon: BadgeDollarSign },
];

/**
 * Merged hub for periodic (not daily) money reviews: matching bank records
 * against the ledger, and tracking staff commission payouts. Both are
 * reviewed on a cycle (weekly/monthly) rather than as part of daily
 * operations, so they're grouped separately from the daily-money hubs.
 * Old /bank-reconciliation and /commissions routes still work standalone
 * (they redirect here) so no existing link breaks.
 */
export function BankingCommissionsHubPage() {
  const [activeSection, setActiveSection] = useState<BankingCommissionsSectionId>('bank_reconciliation');

  return (
    <PageLayout dir="rtl" size="wide">
      <PageHeader
        title="البنوك والعمولات"
        description="مطابقة السجلات مع الحسابات البنكية، ومتابعة عمولات المكتب وحالات استحقاقها — في مكان واحد."
      />

      <SectionTabs items={sections} activeId={activeSection} onChange={setActiveSection} ariaLabel="أقسام البنوك والعمولات" />

      <SectionTabPanel id="bank_reconciliation" activeId={activeSection}>
        <BankReconciliationPage />
      </SectionTabPanel>
      <SectionTabPanel id="commissions" activeId={activeSection}>
        <CommissionsPage />
      </SectionTabPanel>
    </PageLayout>
  );
}

export default BankingCommissionsHubPage;
