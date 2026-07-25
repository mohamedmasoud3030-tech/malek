import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { AutomationCenterView } from './components/automation-center-view';

export function AutomationPage() {
  return (
    <PageLayout dir="rtl" lang="ar">
      <PageHeader
        title="مركز الأتمتة"
        description="إدارة تذكيرات انتهاء العقود، استحقاق الإيجار، تقارير الملاك، وتنبيهات الصيانة من مكان واحد."
      />
      <AutomationCenterView />
    </PageLayout>
  );
}
