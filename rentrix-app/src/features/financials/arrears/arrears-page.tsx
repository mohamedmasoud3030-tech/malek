import { Link } from '@tanstack/react-router';
import { FileText, ReceiptText, BarChart3 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { PageLayout } from '@/components/layout/page-layout';
import { ArrearsWorkspaceSection } from '../components/arrears-workspace-section';

export type ArrearsWorkspaceMode = 'standalone' | 'embedded';

export type ArrearsWorkspaceProps = Readonly<{
  /**
   * standalone: renders the full page shell (PageLayout + PageHeader) — used
   * by the legacy /arrears route when visited directly.
   * embedded: renders only the workspace body — used inside the
   * expenses/arrears finance hub, which already supplies its own page shell
   * and tab header.
   */
  mode?: ArrearsWorkspaceMode;
}>;

/**
 * Owns the arrears workspace body. Shared verbatim between the standalone
 * /arrears route and the embedded finance hub tab so business logic,
 * queries, and mutations are never duplicated.
 */
export function ArrearsWorkspace({ mode = 'standalone' }: ArrearsWorkspaceProps) {
  if (mode === 'embedded') {
    return <ArrearsWorkspaceSection />;
  }

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

export function ArrearsPage() {
  return <ArrearsWorkspace />;
}
