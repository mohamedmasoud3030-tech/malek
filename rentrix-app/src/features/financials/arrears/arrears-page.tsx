import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { ArrearsWorkspaceSection } from '../components/arrears-workspace-section';

export function ArrearsPage() {
  return (
    <PageLayout dir="rtl" size="wide">
      <PageHeader title="المتأخرات" description="متابعة المبالغ المتأخرة وفلاتر التحصيل ضمن نفس نظام الحاويات والبطاقات." />
      <ArrearsWorkspaceSection />
    </PageLayout>
  );
}
