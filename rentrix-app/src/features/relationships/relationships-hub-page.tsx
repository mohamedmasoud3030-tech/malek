import { MessageSquareText, Users } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { SectionTabPanel, SectionTabs, type SectionTabItem } from '@/components/ui/section-tabs';
import { CommunicationWorkspace } from '@/features/communication/communication-page';
import { TenantsWorkspace } from '@/features/tenants/TenantsPage';

type RelationshipsTabId = 'communication' | 'tenants';

const relationshipTabs: readonly SectionTabItem<RelationshipsTabId>[] = [
  { id: 'communication', label: 'التواصل والمتابعات', icon: MessageSquareText },
  { id: 'tenants', label: 'المستأجرون', icon: Users },
];

export function RelationshipsHubPage() {
  const [activeTab, setActiveTab] = useState<RelationshipsTabId>('communication');

  return (
    <PageLayout dir="rtl" lang="ar" size="wide">
      <PageHeader
        title="مركز العلاقات"
        description="مساحة عمل موحّدة لمتابعة تواصل المكتب وملفات المستأجرين دون التنقل بين صفحات منفصلة."
      />

      <SectionTabs
        items={relationshipTabs}
        activeId={activeTab}
        onChange={setActiveTab}
        ariaLabel="أقسام مركز العلاقات"
      />

      <SectionTabPanel id="communication" activeId={activeTab}>
        <CommunicationWorkspace embedded />
      </SectionTabPanel>

      <SectionTabPanel id="tenants" activeId={activeTab}>
        <TenantsWorkspace embedded />
      </SectionTabPanel>
    </PageLayout>
  );
}

export default RelationshipsHubPage;
