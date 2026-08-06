import { Link } from '@tanstack/react-router';
import { FileText, ReceiptText, BarChart3 } from 'lucide-react';
import { EmbeddableWorkspace } from '@/components/layout/embeddable-workspace';
import { Button } from '@/components/ui/button';
import { ArrearsWorkspaceSection } from '../components/arrears-workspace-section';

export type ArrearsWorkspaceProps = Readonly<{
  /**
   * embedded: rendered inside the finance hub, which already supplies the page
   * shell — the workspace body renders without a second layout or header.
   * standalone (default): reached via /arrears, so it owns the page shell.
   */
  embedded?: boolean;
}>;

/**
 * Owns the arrears workspace body. Shared verbatim between the standalone
 * /arrears route and the embedded finance hub tab so business logic,
 * queries, and mutations are never duplicated.
 */
export function ArrearsWorkspace({ embedded = false }: ArrearsWorkspaceProps) {
  return (
    <EmbeddableWorkspace
      embedded={embedded}
      visualVariant="malek-pro"
      title="المتأخرات"
      description="متابعة المبالغ المتأخرة وفلاتر التحصيل ضمن نفس نظام الحاويات والبطاقات — الفلاتر محفوظة أثناء التنقل. "
      secondaryActions={(
        <>
          <Button variant="secondary" asChild><Link to="/invoices"><FileText className="me-2 size-4" aria-hidden="true" />الفواتير</Link></Button>
          <Button variant="secondary" asChild><Link to="/receipts"><ReceiptText className="me-2 size-4" aria-hidden="true" />الإيصالات</Link></Button>
          <Button variant="secondary" asChild><Link to="/reports"><BarChart3 className="me-2 size-4" aria-hidden="true" />تقارير المتأخرات</Link></Button>
        </>
      )}
    >
      <ArrearsWorkspaceSection />
    </EmbeddableWorkspace>
  );
}

export function ArrearsPage() {
  return <ArrearsWorkspace />;
}
