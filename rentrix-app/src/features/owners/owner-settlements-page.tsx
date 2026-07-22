import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { OwnerSettlementWorkspace } from './components/OwnerSettlementWorkspace';

export function OwnerSettlementsPage() {
  return (
    <PageLayout dir="rtl" size="wide">
      <PageHeader
        title="تسويات الملاك"
        description="إعداد تسويات كل مالك عن الفترة، اعتمادها للصرف، وتنفيذ دفعات الصافي المستحق مع مستندات الطباعة."
      />
      <OwnerSettlementWorkspace />
    </PageLayout>
  );
}

export default OwnerSettlementsPage;
