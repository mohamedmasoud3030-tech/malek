import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { DepositsWorkspace } from './deposits-workspace';

export function DepositsPage() {
  return (
    <PageLayout dir="rtl" size="wide">
      <PageHeader
        title="تأمين وأمانات المستأجرين"
        description="تسجيل مبالغ التأمين المحتجزة للعقود النشطة، ومتابعة الخصومات والاستردادات مع مستندات الطباعة."
      />
      <DepositsWorkspace />
    </PageLayout>
  );
}

export default DepositsPage;
