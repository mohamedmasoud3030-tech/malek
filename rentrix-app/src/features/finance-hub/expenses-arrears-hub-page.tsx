import { ClipboardList, WalletCards } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { SectionTabPanel, SectionTabs, type SectionTabItem } from '@/components/ui/section-tabs';
import { ArrearsPage } from '@/features/financials/arrears/arrears-page';
import { ExpensesPage } from '@/features/financials/expenses/expenses-page';

type ExpensesArrearsSectionId = 'expenses' | 'arrears';

const sections: readonly SectionTabItem<ExpensesArrearsSectionId>[] = [
  { id: 'expenses', label: 'المصروفات التشغيلية', icon: WalletCards },
  { id: 'arrears', label: 'المتأخرات والديون', icon: ClipboardList },
];

/**
 * Merged hub for the outflow/collection-risk cycle: money going out
 * (expenses) and money not yet collected (arrears) are the two sides
 * a manager checks together when reviewing office cash health.
 * Old /expenses and /arrears routes still work standalone (they redirect
 * here) so no existing link breaks.
 */
export function ExpensesArrearsHubPage() {
  const [activeSection, setActiveSection] = useState<ExpensesArrearsSectionId>('expenses');

  return (
    <PageLayout dir="rtl" size="wide">
      <PageHeader
        title="المصروفات والذمم"
        description="تسجيل ومراجعة مصروفات العقارات، ومتابعة الذمم المتأخرة وأعمار الديون — في مكان واحد."
      />

      <SectionTabs items={sections} activeId={activeSection} onChange={setActiveSection} ariaLabel="أقسام المصروفات والذمم" />

      <SectionTabPanel id="expenses" activeId={activeSection}>
        <ExpensesPage />
      </SectionTabPanel>
      <SectionTabPanel id="arrears" activeId={activeSection}>
        <ArrearsPage />
      </SectionTabPanel>
    </PageLayout>
  );
}

export default ExpensesArrearsHubPage;
