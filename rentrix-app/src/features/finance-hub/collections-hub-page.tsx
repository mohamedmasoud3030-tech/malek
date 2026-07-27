import { FileSpreadsheet, ReceiptText } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { SectionTabPanel, SectionTabs, type SectionTabItem } from '@/components/ui/section-tabs';
import { InvoicesPage } from '@/features/financials/invoices/invoices-page';
import { ReceiptsPage } from '@/features/financials/receipts/receipts-page';

type CollectionsSectionId = 'invoices' | 'receipts';

const sections: readonly SectionTabItem<CollectionsSectionId>[] = [
  { id: 'invoices', label: 'الفواتير', icon: FileSpreadsheet },
  { id: 'receipts', label: 'التحصيل والإيصالات', icon: ReceiptText },
];

/**
 * Merged hub for the daily collection cycle: an invoice becomes a receipt
 * once it's collected — these used to be two unrelated sidebar entries even
 * though they're one workflow. Old /invoices and /receipts routes still work
 * standalone (they redirect here) so no existing link breaks.
 */
export function CollectionsHubPage() {
  const [activeSection, setActiveSection] = useState<CollectionsSectionId>('invoices');

  return (
    <PageLayout dir="rtl" size="wide">
      <PageHeader
        title="التحصيل اليومي"
        description="الفواتير المستحقة وتسجيل دفعاتها، وسجل الإيصالات وطباعة سندات القبض — في مكان واحد."
      />

      <SectionTabs items={sections} activeId={activeSection} onChange={setActiveSection} ariaLabel="أقسام التحصيل اليومي" />

      <SectionTabPanel id="invoices" activeId={activeSection}>
        <InvoicesPage />
      </SectionTabPanel>
      <SectionTabPanel id="receipts" activeId={activeSection}>
        <ReceiptsPage />
      </SectionTabPanel>
    </PageLayout>
  );
}

export default CollectionsHubPage;
