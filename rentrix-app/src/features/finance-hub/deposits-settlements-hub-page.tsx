import { FileCheck, HandCoins } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { SectionTabPanel, SectionTabs, type SectionTabItem } from '@/components/ui/section-tabs';
import DepositsPage from '@/features/financials/deposits/deposits-page';
import OwnerSettlementsPage from '@/features/owners/owner-settlements-page';

type DepositsSettlementsSectionId = 'deposits' | 'owner_settlements';

const sections: readonly SectionTabItem<DepositsSettlementsSectionId>[] = [
  { id: 'deposits', label: 'تأمين وأمانات المستأجرين', icon: FileCheck },
  { id: 'owner_settlements', label: 'تسويات الملاك', icon: HandCoins },
];

/**
 * Merged hub for money held on behalf of others: tenant deposits held by
 * the office, and owner settlements paid out to property owners. Both are
 * "funds in trust" workflows reviewed together, not daily operations.
 * Old /deposits and /owner-settlements routes still work standalone
 * (they redirect here) so no existing link breaks.
 */
export function DepositsSettlementsHubPage() {
  const [activeSection, setActiveSection] = useState<DepositsSettlementsSectionId>('deposits');

  return (
    <PageLayout dir="rtl" size="wide">
      <PageHeader
        title="تسويات وضمانات"
        description="تأمينات المستأجرين المحتجزة، وتسويات الملاك المُعدّة والمعتمدة للصرف — في مكان واحد."
      />

      <SectionTabs items={sections} activeId={activeSection} onChange={setActiveSection} ariaLabel="أقسام تسويات وضمانات" />

      <SectionTabPanel id="deposits" activeId={activeSection}>
        <DepositsPage />
      </SectionTabPanel>
      <SectionTabPanel id="owner_settlements" activeId={activeSection}>
        <OwnerSettlementsPage />
      </SectionTabPanel>
    </PageLayout>
  );
}

export default DepositsSettlementsHubPage;
