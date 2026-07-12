import { Link } from '@tanstack/react-router';
import { FileText, ReceiptText, BarChart3 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { PageLayout } from '@/components/layout/page-layout';
import { ArrearsWorkspaceSection } from '../components/arrears-workspace-section';

export function ArrearsPage() {
  return (
    <PageLayout dir="rtl" size="wide">
      <PageHeader
        title="المتأخرات"
        description="متابعة المبالغ المتأخرة وفلاتر التحصيل ضمن نفس نظام الحاويات والبطاقات."
        secondaryActions={(
          <>
            <Button variant="secondary" asChild><Link to="/invoices"><FileText className="me-2 size-4" aria-hidden="true" />الفواتير</Link></Button>
            <Button variant="secondary" asChild><Link to="/receipts"><ReceiptText className="me-2 size-4" aria-hidden="true" />الإيصالات</Link></Button>
            <Button variant="secondary" asChild><Link to="/reports"><BarChart3 className="me-2 size-4" aria-hidden="true" />تقارير المتأخرات</Link></Button>
          </>
        )}
      />
      <ArrearsWorkspaceSection />
    </PageLayout>
  );
}
