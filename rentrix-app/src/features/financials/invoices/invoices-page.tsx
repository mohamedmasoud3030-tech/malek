import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { InvoiceWorkspaceSection } from '../components/invoice-workspace-section';

export function InvoicesPage() {
  return (
    <PageLayout dir="rtl" size="wide">
      <PageHeader title="الفواتير" description="إدارة الفواتير المستحقة وتسجيل الدفعات من نفس نظام العرض المالي الموحد." />
      <InvoiceWorkspaceSection />
    </PageLayout>
  );
}
